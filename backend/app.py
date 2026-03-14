"""
Flask application entry point for the Rupeezy Dashboard.
Exposes a REST API consumed by the React frontend and handles
the Vortex OAuth callback flow.
"""

import os
import logging
from dotenv import load_dotenv
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_socketio import SocketIO

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Serve the built React frontend from ../frontend/dist when it exists
_FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
_SERVE_FRONTEND = os.path.isdir(_FRONTEND_DIST)

app = Flask(
    __name__,
    static_folder=_FRONTEND_DIST if _SERVE_FRONTEND else None,
    static_url_path="",
)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "change-me-in-production")

# Allow the dev Vite origin; in production everything is same-origin
_cors_origins = os.environ.get(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
CORS(app, supports_credentials=True, origins=_cors_origins)

socketio = SocketIO(
    app,
    cors_allowed_origins=_cors_origins,
    async_mode="threading",
)

# Inject socketio into the websocket module so it can emit events
import websocket as ws_module
ws_module.init_socketio(socketio)

import requests as _requests

import auth
import orders as ord_module
import market
import demo as demo_module
import charts as charts_module
import scheduler as sched_module


# ── Demo mode routes + interceptor ───────────────────────────────────────────

@app.route("/api/demo/enable", methods=["POST"])
def demo_enable():
    session["demo_mode"] = True
    session["rupeezy_access_token"] = "demo"
    return jsonify({"success": True, "demo": True})


@app.route("/api/demo/disable", methods=["POST"])
def demo_disable():
    session.pop("demo_mode", None)
    session.pop("rupeezy_access_token", None)
    return jsonify({"success": True, "demo": False})


@app.before_request
def intercept_demo():
    """
    When demo mode is active, intercept data API calls and return mock responses
    so that the full dashboard UI is visible without real credentials.
    """
    if not session.get("demo_mode"):
        return  # pass through to the real handler

    path = request.path

    # Orders
    if path == "/api/orders" and request.method == "GET":
        return jsonify({"success": True, "data": demo_module.orders_response()})

    if path == "/api/orders" and request.method == "POST":
        payload = request.get_json(force=True) or {}
        return jsonify({"success": True, "data": demo_module.place_order_response(payload)})

    if path.startswith("/api/orders/") and request.method in ("PUT", "DELETE"):
        return jsonify({"success": True, "data": {"message": "Demo: order updated"}})

    if path == "/api/basket-orders" and request.method == "POST":
        legs = request.get_json(force=True) or []
        results = [{"leg": i, "success": True, "data": demo_module.place_order_response({})} for i in range(len(legs))]
        return jsonify({"success": True, "data": results})

    # Market data
    if path == "/api/quotes" and request.method == "POST":
        body = request.get_json(force=True) or {}
        return jsonify({"success": True, "data": demo_module.quotes_response(body.get("instruments", []))})

    if path == "/api/positions":
        return jsonify({"success": True, "data": demo_module.positions_response()})

    if path == "/api/holdings":
        return jsonify({"success": True, "data": demo_module.holdings_response()})

    if path == "/api/funds":
        return jsonify({"success": True, "data": demo_module.funds_response()})

    if path in ("/api/margins", "/api/order-margins"):
        return jsonify({"success": True, "data": demo_module.margins_response()})

    if path == "/api/search":
        q = request.args.get("q", "")
        return jsonify({"success": True, "data": demo_module.search_response(q)})

    # WebSocket sub/unsub — acknowledge silently in demo mode
    if path.startswith("/api/ws/"):
        return jsonify({"success": True})

    if path == "/api/candles":
        return jsonify({"success": True, "data": demo_module.candles_response()})

    if path == "/api/analytics":
        return jsonify({"success": True, "data": demo_module.analytics_response()})

    if path == "/api/scheduled-orders" and request.method == "GET":
        return jsonify({"success": True, "data": []})

    if path == "/api/scheduled-orders" and request.method == "POST":
        return jsonify({"success": False, "message": "Scheduled orders are disabled in demo mode."}), 403


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.route("/api/auth/config", methods=["GET"])
def get_config():
    """Return which credentials are already present in the environment (values masked)."""
    return jsonify({
        "has_api_secret":     bool(os.environ.get("RUPEEZY_API_SECRET", "").strip()),
        "has_application_id": bool(os.environ.get("RUPEEZY_APPLICATION_ID", "").strip()),
        "has_access_token":   bool(os.environ.get("RUPEEZY_ACCESS_TOKEN", "").strip()),
        "redirect_url":       os.environ.get("RUPEEZY_REDIRECT_URL", "http://127.0.0.1:5000/callback"),
    })


@app.route("/api/auth/login-url", methods=["POST"])
def get_login_url():
    """Return the Rupeezy OAuth URL.
    Credentials are read from the POST body first, falling back to .env values."""
    data = request.get_json(force=True) or {}
    api_secret     = data.get("api_secret",     "").strip() or os.environ.get("RUPEEZY_API_SECRET",     "")
    application_id = data.get("application_id", "").strip() or os.environ.get("RUPEEZY_APPLICATION_ID", "")

    if not api_secret or not application_id:
        return jsonify({"success": False, "message": "RUPEEZY_API_SECRET and RUPEEZY_APPLICATION_ID are not set. Add them to your .env file or enter them on the setup page."}), 400

    # Persist for this session so exchange_token can reuse them
    session["rupeezy_api_secret"]     = api_secret
    session["rupeezy_application_id"] = application_id
    os.environ["RUPEEZY_API_SECRET"]     = api_secret
    os.environ["RUPEEZY_APPLICATION_ID"] = application_id

    redirect_url = data.get("redirect_url", "").strip() or os.environ.get("RUPEEZY_REDIRECT_URL", "http://127.0.0.1:5000/callback")

    try:
        url = auth.get_login_url(api_secret, application_id, redirect_url)
        return jsonify({"success": True, "login_url": url})
    except Exception as exc:
        logger.exception("Error generating login URL")
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/callback")
def oauth_callback():
    """
    Rupeezy OAuth callback — exchanges the one-time auth_token for an access token,
    then redirects the user back to the React frontend.
    """
    auth_token = (
        request.args.get("auth_token") or
        request.args.get("auth") or
        request.args.get("token", "")
    )
    if not auth_token:
        return jsonify({"success": False, "message": "No auth token in callback."}), 400

    api_secret     = session.get("rupeezy_api_secret")     or os.environ.get("RUPEEZY_API_SECRET", "")
    application_id = session.get("rupeezy_application_id") or os.environ.get("RUPEEZY_APPLICATION_ID", "")

    try:
        result = auth.exchange_auth_token(auth_token, api_secret, application_id)

        # Optionally persist access token to .env for next restart
        _write_access_token_to_env(result["access_token"])

        # Start the WebSocket feed
        ws_module.start_feed(result["access_token"])

        # Redirect to frontend
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
        from flask import redirect
        return redirect(f"{frontend_url}/?auth=success")
    except Exception as exc:
        logger.exception("Token exchange failed")
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/auth/exchange-token", methods=["POST"])
def api_exchange_token():
    """Manual token exchange endpoint (for when redirect isn't used)."""
    data       = request.get_json(force=True)
    auth_token = data.get("auth_token", "").strip() or data.get("auth", "").strip()
    if not auth_token:
        return jsonify({"success": False, "message": "auth_token is required."}), 400

    try:
        result = auth.exchange_auth_token(auth_token)
        _write_access_token_to_env(result["access_token"])
        try:
            ws_module.start_feed(result["access_token"])
        except Exception as ws_exc:
            logger.warning("WebSocket start failed: %s", ws_exc)
        return jsonify({"success": True, **result})
    except Exception as exc:
        logger.exception("Token exchange failed")
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/auth/set-token", methods=["POST"])
def set_access_token():
    """Directly set an access token (e.g. from .env or manual entry)."""
    data         = request.get_json(force=True)
    access_token = data.get("access_token", "").strip()
    if not access_token:
        return jsonify({"success": False, "message": "access_token is required."}), 400

    session["rupeezy_access_token"] = access_token
    os.environ["RUPEEZY_ACCESS_TOKEN"] = access_token

    try:
        ws_module.start_feed(access_token)
    except Exception as exc:
        logger.warning("WebSocket start failed after token set: %s", exc)

    return jsonify({"success": True, "message": "Access token set."})


@app.route("/api/auth/status", methods=["GET"])
def auth_status():
    import time, base64, json as _json
    is_demo   = bool(session.get("demo_mode"))
    token     = session.get("rupeezy_access_token") or os.environ.get("RUPEEZY_ACCESS_TOKEN", "")
    has_token = is_demo or bool(token)

    token_expires_at = None
    token_expired    = False
    if token and not is_demo:
        try:
            # Decode JWT payload (no verification needed here — just for expiry display)
            parts   = token.split(".")
            payload = _json.loads(base64.urlsafe_b64decode(parts[1] + "==").decode())
            exp     = payload.get("exp", 0)
            token_expires_at = exp
            token_expired    = exp < time.time()
        except Exception:
            pass

    return jsonify({
        "authenticated":    has_token and not token_expired,
        "demo":             is_demo,
        "token_expires_at": token_expires_at,
        "token_expired":    token_expired,
        "ws_status":        ws_module.get_feed_status(),
    })


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    auth.logout()
    ws_module.stop_feed()
    return jsonify({"success": True, "message": "Logged out."})


# ── Order routes ──────────────────────────────────────────────────────────────

@app.route("/api/orders", methods=["GET"])
@auth.require_auth
def get_orders():
    limit  = int(request.args.get("limit", 50))
    offset = int(request.args.get("offset", 1))
    try:
        data = ord_module.get_orders(limit, offset)
        return jsonify({"success": True, "data": data})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/orders", methods=["POST"])
@auth.require_auth
def place_order():
    payload = request.get_json(force=True)
    try:
        result = ord_module.place_order(payload)
        return jsonify({"success": True, "data": result})
    except (ValueError, KeyError) as exc:
        return jsonify({"success": False, "message": str(exc)}), 400
    except Exception as exc:
        logger.exception("Order placement failed")
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/orders/<order_id>", methods=["PUT"])
@auth.require_auth
def modify_order(order_id: str):
    payload = request.get_json(force=True)
    try:
        result = ord_module.modify_order(order_id, payload)
        return jsonify({"success": True, "data": result})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/orders/<order_id>", methods=["DELETE"])
@auth.require_auth
def cancel_order(order_id: str):
    try:
        result = ord_module.cancel_order(order_id)
        return jsonify({"success": True, "data": result})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/orders/<order_id>/history", methods=["GET"])
@auth.require_auth
def order_history(order_id: str):
    try:
        data = ord_module.get_order_history(order_id)
        return jsonify({"success": True, "data": data})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/basket-orders", methods=["POST"])
@auth.require_auth
def basket_orders():
    legs = request.get_json(force=True)
    if not isinstance(legs, list):
        return jsonify({"success": False, "message": "Payload must be a list of order legs."}), 400
    results = ord_module.place_basket_order(legs)
    return jsonify({"success": True, "data": results})


# ── Market data routes ────────────────────────────────────────────────────────

@app.route("/api/quotes", methods=["POST"])
@auth.require_auth
def get_quotes():
    data        = request.get_json(force=True)
    instruments = data.get("instruments", [])
    mode        = data.get("mode", "LTP")
    if not instruments:
        return jsonify({"success": False, "message": "instruments list is required."}), 400
    try:
        result = market.get_quotes(instruments, mode)
        return jsonify({"success": True, "data": result})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/positions", methods=["GET"])
@auth.require_auth
def get_positions():
    try:
        data = market.get_positions()
        return jsonify({"success": True, "data": data})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/holdings", methods=["GET"])
@auth.require_auth
def get_holdings():
    try:
        data = market.get_holdings()
        return jsonify({"success": True, "data": data})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/funds", methods=["GET"])
@auth.require_auth
def get_funds():
    try:
        data = market.get_funds()
        return jsonify({"success": True, "data": data})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/margins", methods=["POST"])
@auth.require_auth
def get_margins():
    payload = request.get_json(force=True)
    try:
        data = market.get_margins(payload)
        return jsonify({"success": True, "data": data})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/order-margins", methods=["POST"])
@auth.require_auth
def get_order_margins():
    payload = request.get_json(force=True)
    try:
        data = market.get_order_margins(payload)
        return jsonify({"success": True, "data": data})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/search", methods=["GET"])
@auth.require_auth
def search_instruments():
    query    = request.args.get("q", "").strip()
    exchange = request.args.get("exchange", "NSE_EQ")
    if not query:
        return jsonify({"success": False, "message": "Query parameter 'q' is required."}), 400
    try:
        results = market.search_instruments(query, exchange)
        return jsonify({"success": True, "data": results})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


# ── Charts & analytics routes ────────────────────────────────────────────────

@app.route("/api/candles", methods=["GET"])
@auth.require_auth
def get_candles():
    exchange   = request.args.get("exchange", "NSE_EQ")
    token      = request.args.get("token", type=int)
    resolution = request.args.get("resolution", "5")
    from_ts    = request.args.get("from", type=int)
    to_ts      = request.args.get("to",   type=int)

    if not token:
        return jsonify({"success": False, "message": "token is required"}), 400

    from datetime import datetime as _dt
    from_dt = _dt.fromtimestamp(from_ts) if from_ts else None
    to_dt   = _dt.fromtimestamp(to_ts)   if to_ts   else None

    try:
        data = charts_module.get_candles(exchange, token, resolution, from_dt, to_dt)
        return jsonify({"success": True, "data": data})
    except Exception as exc:
        logger.exception("Candles fetch failed")
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/analytics", methods=["GET"])
@auth.require_auth
def get_analytics():
    try:
        raw    = ord_module.get_orders(limit=200)
        orders = raw.get("orders", raw) if isinstance(raw, dict) else raw
        if isinstance(orders, dict):
            orders = orders.get("orders", [])
        data = charts_module.compute_analytics(orders if isinstance(orders, list) else [])
        return jsonify({"success": True, "data": data})
    except Exception as exc:
        logger.exception("Analytics failed")
        return jsonify({"success": False, "message": str(exc)}), 500


# Demo intercepts for charts
# (added inside before_request — no separate handler needed; candles return mock OHLCV)

# ── Scheduled orders routes ───────────────────────────────────────────────────

@app.route("/api/scheduled-orders", methods=["GET"])
@auth.require_auth
def list_scheduled():
    return jsonify({"success": True, "data": sched_module.list_all()})


@app.route("/api/scheduled-orders", methods=["POST"])
@auth.require_auth
def create_scheduled():
    body = request.get_json() or {}
    required = ["scheduled_time", "symbol", "exchange", "token",
                "transaction_type", "product", "variety", "quantity"]
    missing = [f for f in required if f not in body]
    if missing:
        return jsonify({"success": False, "message": f"Missing fields: {missing}"}), 400
    try:
        order = sched_module.create(
            scheduled_time    = body["scheduled_time"],
            symbol            = body["symbol"],
            exchange          = body["exchange"],
            token             = int(body["token"]),
            transaction_type  = body["transaction_type"],
            product           = body["product"],
            variety           = body["variety"],
            quantity          = int(body["quantity"]),
            price             = float(body.get("price", 0)),
            trigger_price     = float(body.get("trigger_price", 0)),
            validity          = body.get("validity", "DAY"),
            disclosed_quantity= int(body.get("disclosed_quantity", 0)),
            is_amo            = bool(body.get("is_amo", False)),
        )
        return jsonify({"success": True, "data": order}), 201
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400
    except Exception as exc:
        logger.exception("Failed to create scheduled order")
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/scheduled-orders/<order_id>/cancel", methods=["POST"])
@auth.require_auth
def cancel_scheduled(order_id):
    try:
        order = sched_module.cancel(order_id)
        return jsonify({"success": True, "data": order})
    except (KeyError, ValueError) as exc:
        return jsonify({"success": False, "message": str(exc)}), 400


@app.route("/api/scheduled-orders/<order_id>", methods=["DELETE"])
@auth.require_auth
def delete_scheduled(order_id):
    try:
        sched_module.delete(order_id)
        return jsonify({"success": True})
    except (KeyError, ValueError) as exc:
        return jsonify({"success": False, "message": str(exc)}), 400


# ── WebSocket subscription routes ─────────────────────────────────────────────

@app.route("/api/ws/subscribe", methods=["POST"])
@auth.require_auth
def ws_subscribe():
    data     = request.get_json(force=True)
    exchange = data.get("exchange", "NSE_EQ")
    token    = int(data.get("token", 0))
    mode     = data.get("mode", "LTP")
    try:
        ws_module.subscribe(exchange, token, mode)
        return jsonify({"success": True})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/ws/unsubscribe", methods=["POST"])
@auth.require_auth
def ws_unsubscribe():
    data     = request.get_json(force=True)
    exchange = data.get("exchange", "NSE_EQ")
    token    = int(data.get("token", 0))
    try:
        ws_module.unsubscribe(exchange, token)
        return jsonify({"success": True})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/ws/status", methods=["GET"])
def ws_status():
    return jsonify(ws_module.get_feed_status())


# ── SocketIO events ───────────────────────────────────────────────────────────

@socketio.on("connect")
def on_socket_connect():
    logger.info("Frontend WebSocket client connected.")


@socketio.on("disconnect")
def on_socket_disconnect():
    logger.info("Frontend WebSocket client disconnected.")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _write_access_token_to_env(token: str) -> None:
    """Persist the access token back into the .env file."""
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, "r") as f:
            lines = f.readlines()
        updated = False
        for i, line in enumerate(lines):
            if line.startswith("RUPEEZY_ACCESS_TOKEN="):
                lines[i] = f"RUPEEZY_ACCESS_TOKEN={token}\n"
                updated = True
                break
        if not updated:
            lines.append(f"RUPEEZY_ACCESS_TOKEN={token}\n")
        with open(env_path, "w") as f:
            f.writelines(lines)
    except Exception as exc:
        logger.warning("Could not write access token to .env: %s", exc)


def _auto_start_from_env():
    """If a saved access token exists in .env, start the WebSocket feed automatically."""
    token = os.environ.get("RUPEEZY_ACCESS_TOKEN", "").strip()
    if token:
        try:
            ws_module.start_feed(token)
            logger.info("Auto-started VortexFeed from saved access token in .env")
        except Exception as exc:
            logger.warning("Auto-start WebSocket failed (token may be expired): %s", exc)


@app.errorhandler(_requests.exceptions.HTTPError)
def handle_http_error(exc):
    """Catch 401/403 from Rupeezy SDK and tell the frontend to re-authenticate."""
    if exc.response is not None and exc.response.status_code == 401:
        auth.logout()
        return jsonify({
            "success": False,
            "message": "Session expired. Please log in again.",
            "reauth": True,
        }), 401
    return jsonify({"success": False, "message": str(exc)}), 502


# ── Serve React SPA (production) ──────────────────────────────────────────────
if _SERVE_FRONTEND:
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_spa(path):
        """Serve React app for all non-API routes."""
        # Let Flask serve static assets (JS, CSS, images) normally
        full = os.path.join(_FRONTEND_DIST, path)
        if path and os.path.isfile(full):
            return app.send_static_file(path)
        # SPA fallback → index.html
        return app.send_static_file("index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    _auto_start_from_env()
    sched_module.init(socketio=socketio)
    socketio.run(app, host="0.0.0.0", port=port, debug=True, allow_unsafe_werkzeug=True)
