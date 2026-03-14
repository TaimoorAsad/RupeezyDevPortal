"""
VortexFeed WebSocket wrapper.
Bridges real-time price / order updates to Flask-SocketIO so the React
frontend receives live data without polling.
"""

import logging
import os
from typing import Callable

from vortex_api import VortexFeed, Constants as Vc

logger = logging.getLogger(__name__)

_feed: VortexFeed | None = None
_socketio = None  # injected by app.py


def init_socketio(sio) -> None:
    """Store the Flask-SocketIO instance so callbacks can emit events."""
    global _socketio
    _socketio = sio


def _emit(event: str, data: dict) -> None:
    if _socketio:
        _socketio.emit(event, data)


# ── VortexFeed callbacks ──────────────────────────────────────────────────────

def _on_connect(ws, response) -> None:
    logger.info("VortexFeed connected: %s", response)
    _emit("ws_status", {"connected": True})


def _on_disconnect(ws) -> None:
    logger.warning("VortexFeed disconnected.")
    _emit("ws_status", {"connected": False})


def _on_error(ws, code, reason) -> None:
    logger.error("VortexFeed error [%s]: %s", code, reason)
    _emit("ws_error", {"error": str(reason), "code": code})


def _on_price_update(ws, update: dict) -> None:
    _emit("price_update", update)


def _on_order_update(ws, update: dict) -> None:
    logger.debug("Order update: %s", update)
    _emit("order_update", update)


# ── Public API ────────────────────────────────────────────────────────────────

def start_feed(access_token: str | None = None) -> None:
    """
    Start the VortexFeed connection in a background thread.
    Safe to call multiple times — stops the old feed first.
    """
    global _feed

    token = access_token or os.environ.get("RUPEEZY_ACCESS_TOKEN", "")
    if not token:
        raise RuntimeError("No access token available for VortexFeed.")

    if _feed:
        try:
            _feed.close()
        except Exception:
            pass

    feed = VortexFeed(token)
    feed.on_connect        = _on_connect
    feed.on_disconnect     = _on_disconnect
    feed.on_error          = _on_error
    feed.on_price_update   = _on_price_update
    feed.on_order_update   = _on_order_update

    # disable_ssl_verification works around Windows CA bundle issues
    # (the Rupeezy cert is valid; this only affects the local TLS handshake)
    feed.connect(threaded=True, disable_ssl_verification=True)
    _feed = feed
    logger.info("VortexFeed started.")


def stop_feed() -> None:
    global _feed
    if _feed:
        try:
            _feed.close()
        except Exception:
            pass
        _feed = None
        logger.info("VortexFeed stopped.")


def subscribe(exchange_type: str, token: int, mode: str = "LTP") -> None:
    """Subscribe to a symbol's price feed."""
    if not _feed:
        raise RuntimeError("VortexFeed is not running. Call start_feed() first.")

    exchange_map = {
        "NSE_EQ":  Vc.ExchangeTypes.NSE_EQUITY,
        "NSE_FO":  Vc.ExchangeTypes.NSE_FO,
        "NSE_CUR": Vc.ExchangeTypes.NSE_CURRENCY,
        "MCX":     Vc.ExchangeTypes.MCX,
        "BSE_EQ":  Vc.ExchangeTypes.BSE_EQUITY,
        "BSE_FO":  Vc.ExchangeTypes.BSE_FO,
    }
    mode_map = {
        "LTP":   Vc.QuoteModes.LTP,
        "FULL":  Vc.QuoteModes.FULL,
        "OHLCV": Vc.QuoteModes.OHLCV,
    }

    ex = exchange_map.get(exchange_type.upper(), Vc.ExchangeTypes.NSE_EQUITY)
    qm = mode_map.get(mode.upper(), Vc.QuoteModes.LTP)
    _feed.subscribe(ex, token, qm)
    logger.info("Subscribed %s-%d mode=%s", exchange_type, token, mode)


def unsubscribe(exchange_type: str, token: int) -> None:
    """Unsubscribe from a symbol's price feed."""
    if not _feed:
        return

    exchange_map = {
        "NSE_EQ":  Vc.ExchangeTypes.NSE_EQUITY,
        "NSE_FO":  Vc.ExchangeTypes.NSE_FO,
        "NSE_CUR": Vc.ExchangeTypes.NSE_CURRENCY,
        "MCX":     Vc.ExchangeTypes.MCX,
        "BSE_EQ":  Vc.ExchangeTypes.BSE_EQUITY,
        "BSE_FO":  Vc.ExchangeTypes.BSE_FO,
    }
    ex = exchange_map.get(exchange_type.upper(), Vc.ExchangeTypes.NSE_EQUITY)
    _feed.unsubscribe(ex, token)
    logger.info("Unsubscribed %s-%d", exchange_type, token)


def get_feed_status() -> dict:
    return {
        "running": _feed is not None,
        "connected": bool(_feed),
    }
