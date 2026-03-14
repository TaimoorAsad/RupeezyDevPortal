"""
Rupeezy Vortex OAuth authentication handler.
Manages login URL generation, token exchange, and session-level credential storage.
Designed as a standalone adapter module compatible with OpenAlgo's broker pattern.
"""

import os
import logging
from functools import wraps
from flask import session, jsonify, g
from vortex_api import VortexAPI

logger = logging.getLogger(__name__)

_client_cache: VortexAPI | None = None


def _build_client(api_secret: str | None = None, app_id: str | None = None) -> VortexAPI:
    """Instantiate VortexAPI with credentials from args or environment."""
    secret = api_secret or os.environ.get("RUPEEZY_API_SECRET", "")
    application_id = app_id or os.environ.get("RUPEEZY_APPLICATION_ID", "")
    if not secret or not application_id:
        raise ValueError("RUPEEZY_API_SECRET and RUPEEZY_APPLICATION_ID must be set.")
    return VortexAPI(secret, application_id)


def get_client() -> VortexAPI:
    """
    Return an authenticated VortexAPI client.
    Uses the access token stored in the Flask session (preferred) or .env fallback.
    Raises RuntimeError when no valid token is available.
    """
    global _client_cache

    access_token = session.get("rupeezy_access_token") or os.environ.get("RUPEEZY_ACCESS_TOKEN", "")

    if not access_token:
        raise RuntimeError("Not authenticated. Obtain an access token first via /api/auth/login.")

    # Re-use cached client when the token hasn't changed
    if _client_cache and getattr(_client_cache, "_access_token", None) == access_token:
        return _client_cache

    client = _build_client()
    # Inject the access token directly so the SDK treats the session as active.
    client.access_token = access_token
    # Store for introspection / cache-key comparison
    client._access_token = access_token  # type: ignore[attr-defined]
    _client_cache = client
    return client


def require_auth(f):
    """Decorator that returns 401 when no access token is present.
    Demo sessions (session['demo_mode'] = True) are allowed through —
    the before_request interceptor in app.py will have already returned
    mock data before the actual route handler is called.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get("demo_mode"):
            return f(*args, **kwargs)
        try:
            get_client()
        except RuntimeError as exc:
            return jsonify({"success": False, "message": str(exc)}), 401
        return f(*args, **kwargs)
    return decorated


def get_login_url(api_secret: str, application_id: str, redirect_url: str | None = None) -> str:
    """
    Generate the Rupeezy OAuth login URL for the given credentials.
    The user must visit this URL and authorise the application.
    ``redirect_url`` is the OAuth callback URL registered on the Rupeezy developer portal.
    """
    client = _build_client(api_secret, application_id)
    callback = redirect_url or os.environ.get("RUPEEZY_REDIRECT_URL", "http://127.0.0.1:5000/callback")
    url = client.login_url(callback)
    logger.info("Generated Rupeezy login URL with callback: %s", callback)
    return url


def exchange_auth_token(auth_token: str, api_secret: str | None = None, application_id: str | None = None) -> dict:
    """
    Exchange the one-time auth_token (from the OAuth callback) for a persistent
    access token. Stores the result in the Flask session and updates os.environ
    so that the .env file can be written back by the caller if desired.

    Returns a dict with ``access_token`` and ``user_info`` keys.
    """
    client = _build_client(api_secret, application_id)
    response = client.exchange_token(auth_token)

    access_token = response.get("data", {}).get("access_token") or response.get("access_token", "")
    if not access_token:
        raise ValueError(f"Token exchange failed. API response: {response}")

    # Persist in session
    session["rupeezy_access_token"] = access_token
    # Make immediately available to get_client() in this process
    os.environ["RUPEEZY_ACCESS_TOKEN"] = access_token

    logger.info("Rupeezy access token exchanged and stored in session.")
    return {
        "access_token": access_token,
        "user_info": response.get("data", {}),
    }


def logout() -> None:
    """Clear authentication state from the session."""
    session.pop("rupeezy_access_token", None)
    global _client_cache
    _client_cache = None
    logger.info("Rupeezy session cleared.")
