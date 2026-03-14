"""
Market data module — quotes, positions, holdings, funds, margins.
All data is fetched live from the Rupeezy Vortex API.
"""

import logging
from vortex_api import Constants as Vc
from auth import get_client

logger = logging.getLogger(__name__)

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


def search_instruments(query: str, exchange: str = "NSE_EQ") -> list[dict]:
    """
    Search for instruments by name or symbol.

    Returns a filtered list from the Vortex instrument master.
    The SDK provides a search / instrument lookup helper.
    """
    client = get_client()
    try:
        results = client.search_instruments(query, exchange)
        return results if isinstance(results, list) else results.get("data", [])
    except AttributeError:
        # Fallback: some SDK versions expose instrument search differently
        logger.warning("search_instruments not available on this SDK version.")
        return []
