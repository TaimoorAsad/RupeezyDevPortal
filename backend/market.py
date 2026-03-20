"""
Market data module — quotes, positions, holdings, funds, margins.
All data is fetched live from the Rupeezy Vortex API.
"""

import logging
import threading
import time
from vortex_api import Constants as Vc
from auth import get_client

logger = logging.getLogger(__name__)

# ── Instrument master cache (search) ──────────────────────────────────────────
_MASTER_LOCK = threading.Lock()
_MASTER_ROWS: list | None = None
_MASTER_LOADED_AT: float = 0.0
_MASTER_TTL_SEC = 3600  # refresh hourly

# UI exchange → column value in master.csv
_SEARCH_EXCHANGE_MAP = {
    "NSE_EQ":  "NSE_EQ",
    "NSE_FO":  "NSE_FO",
    "MCX":     "MCX_FO",
    "BSE_EQ":  "BSE_EQ",
    "BSE_FO":  "BSE_FO",
}

QUOTE_MODE_MAP = {
    "LTP":   Vc.QuoteModes.LTP,
    "FULL":  Vc.QuoteModes.FULL,
    "OHLCV": Vc.QuoteModes.OHLCV,
}

EXCHANGE_MAP = {
    "NSE_EQ":  "NSE_EQ",
    "NSE_FO":  "NSE_FO",
    "NSE_CUR": "NSE_CUR",
    "MCX":     "MCX",
    "BSE_EQ":  "BSE_EQ",
    "BSE_FO":  "BSE_FO",
}


def get_quotes(instruments: list[str], mode: str = "LTP") -> dict:
    """
    Fetch quotes for a list of instruments.

    ``instruments`` format: ["NSE_EQ-22", "NSE_EQ-1594"]
    ``mode``: LTP | FULL | OHLCV
    """
    client = get_client()
    quote_mode = QUOTE_MODE_MAP.get(mode.upper(), Vc.QuoteModes.LTP)
    return client.quotes(instruments, quote_mode)


def get_positions() -> dict:
    """Fetch all open intraday and overnight positions."""
    client = get_client()
    return client.positions()


def get_holdings() -> dict:
    """Fetch demat holdings."""
    client = get_client()
    return client.holdings()


def get_funds() -> dict:
    """Fetch funds / margin summary across segments."""
    client = get_client()
    return client.funds()


def get_margins(payload: list[dict]) -> dict:
    """
    Pre-order margin check.

    ``payload`` format expected by the Vortex API:
    [{"exchange": "NSE_EQ", "token": 22, "transaction_type": "BUY", ...}]
    """
    client = get_client()
    return client.margins(payload)


def get_order_margins(payload: dict) -> dict:
    """Calculate required margin for a single proposed order."""
    client = get_client()
    return client.order_margins(payload)


def _load_master_rows() -> list[list[str]]:
    """Download and parse instrument master CSV (cached)."""
    global _MASTER_ROWS, _MASTER_LOADED_AT
    now = time.time()
    with _MASTER_LOCK:
        if _MASTER_ROWS is not None and (now - _MASTER_LOADED_AT) < _MASTER_TTL_SEC:
            return _MASTER_ROWS
        client = get_client()
        raw = client.download_master()
        if not raw or not isinstance(raw, list):
            logger.warning("download_master returned empty or invalid data.")
            _MASTER_ROWS = []
        else:
            _MASTER_ROWS = raw
        _MASTER_LOADED_AT = now
        return _MASTER_ROWS


def search_instruments(query: str, exchange: str = "NSE_EQ") -> list[dict]:
    """
    Search instruments by symbol / name using Rupeezy static master.csv
    (SDK has no search_instruments; we filter client.download_master()).
    """
    q = (query or "").strip().lower()
    if len(q) < 1:
        return []

    ex_up = (exchange or "NSE_EQ").upper()
    if ex_up == "NSE_CUR":
        logger.warning("NSE_CUR is not in static master.csv; search returns empty.")
        return []

    csv_exchange = _SEARCH_EXCHANGE_MAP.get(ex_up)
    if not csv_exchange:
        csv_exchange = exchange.upper()

    rows = _load_master_rows()
    if not rows or len(rows) < 2:
        return []

    headers = [h.strip().lower() for h in rows[0]]
    try:
        idx_token = headers.index("token")
        idx_ex = headers.index("exchange")
        idx_sym = headers.index("symbol")
        idx_name = headers.index("instrument_name")
    except ValueError:
        logger.error("Unexpected master.csv header row: %s", rows[0])
        return []

    out: list[dict] = []
    for row in rows[1:]:
        if len(row) <= max(idx_token, idx_ex, idx_sym, idx_name):
            continue
        if row[idx_ex] != csv_exchange:
            continue
        sym = (row[idx_sym] or "").lower()
        name = (row[idx_name] or "").lower()
        if q not in sym and q not in name:
            continue
        try:
            tok = int(row[idx_token])
        except ValueError:
            continue
        series_val = ""
        if "series" in headers:
            si = headers.index("series")
            if len(row) > si:
                series_val = row[si] or ""
        out.append({
            "token":            tok,
            "instrument_token": tok,
            "tradingsymbol":    row[idx_sym],
            "symbol":           row[idx_sym],
            "name":             row[idx_name],
            "exchange":         row[idx_ex],
            "series":           series_val,
        })
        if len(out) >= 80:
            break

    return out
