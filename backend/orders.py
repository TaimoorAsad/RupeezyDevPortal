"""
Order management module — place, modify, cancel, and fetch orders via Rupeezy Vortex API.
Mirrors the thin adapter pattern used by OpenAlgo broker modules.
"""

import logging
from vortex_api import Constants as Vc
from auth import get_client

logger = logging.getLogger(__name__)

# ── Constants / mappings ──────────────────────────────────────────────────────

EXCHANGE_MAP = {
    "NSE_EQ":  Vc.ExchangeTypes.NSE_EQUITY,
    "NSE_FO":  Vc.ExchangeTypes.NSE_FO,
    "NSE_CUR": Vc.ExchangeTypes.NSE_CURRENCY,
    "MCX":     Vc.ExchangeTypes.MCX,
    "BSE_EQ":  Vc.ExchangeTypes.BSE_EQUITY,
    "BSE_FO":  Vc.ExchangeTypes.BSE_FO,
}

TRANSACTION_MAP = {
    "BUY":  Vc.TransactionSides.BUY,
    "SELL": Vc.TransactionSides.SELL,
}

PRODUCT_MAP = {
    "DELIVERY":  Vc.ProductTypes.DELIVERY,
    "INTRADAY":  Vc.ProductTypes.INTRADAY,
    "MTF":       Vc.ProductTypes.MTF,
}

VARIETY_MAP = {
    "REGULAR_MARKET_ORDER": Vc.VarietyTypes.REGULAR_MARKET_ORDER,
    "REGULAR_LIMIT_ORDER":  Vc.VarietyTypes.REGULAR_LIMIT_ORDER,
    "STOP_LIMIT_ORDER":     Vc.VarietyTypes.STOP_LIMIT_ORDER,
    "STOP_MARKET_ORDER":    Vc.VarietyTypes.STOP_MARKET_ORDER,
}

VALIDITY_MAP = {
    "FULL_DAY":             Vc.ValidityTypes.FULL_DAY,
    "IMMEDIATE_OR_CANCEL":  Vc.ValidityTypes.IMMEDIATE_OR_CANCEL,
    "AFTER_MARKET":         Vc.ValidityTypes.AFTER_MARKET,
}


def _resolve(mapping: dict, key: str, label: str):
    if key not in mapping:
        raise ValueError(f"Invalid {label}: '{key}'. Valid options: {list(mapping.keys())}")
    return mapping[key]


# ── Order CRUD ────────────────────────────────────────────────────────────────

def place_order(payload: dict) -> dict:
    """
    Place a new order.

    Expected payload keys:
        exchange, token, transaction_type, product, variety,
        quantity, price, trigger_price, disclosed_quantity, validity
    """
    client = get_client()

    exchange        = _resolve(EXCHANGE_MAP,     payload["exchange"],          "exchange")
    transaction     = _resolve(TRANSACTION_MAP,  payload["transaction_type"],  "transaction_type")
    product         = _resolve(PRODUCT_MAP,      payload["product"],           "product")
    variety         = _resolve(VARIETY_MAP,      payload["variety"],           "variety")
    validity        = _resolve(VALIDITY_MAP,     payload.get("validity", "FULL_DAY"),  "validity")

    response = client.place_order(
        exchange=exchange,
        token=int(payload["token"]),
        transaction_type=transaction,
        product=product,
        variety=variety,
        quantity=int(payload["quantity"]),
        price=float(payload.get("price", 0)),
        trigger_price=float(payload.get("trigger_price", 0)),
        disclosed_quantity=int(payload.get("disclosed_quantity", 0)),
        validity=validity,
    )
    logger.info("Order placed: %s", response)
    return response


def modify_order(order_id: str, payload: dict) -> dict:
    """
    Modify an existing pending/open order.

    Supported modification fields: quantity, price, trigger_price,
    disclosed_quantity, validity, variety.
    """
    client = get_client()

    kwargs: dict = {"order_id": order_id}

    if "variety" in payload:
        kwargs["variety"] = _resolve(VARIETY_MAP, payload["variety"], "variety")
    if "quantity" in payload:
        kwargs["quantity"] = int(payload["quantity"])
    if "price" in payload:
        kwargs["price"] = float(payload["price"])
    if "trigger_price" in payload:
        kwargs["trigger_price"] = float(payload["trigger_price"])
    if "disclosed_quantity" in payload:
        kwargs["disclosed_quantity"] = int(payload["disclosed_quantity"])
    if "validity" in payload:
        kwargs["validity"] = _resolve(VALIDITY_MAP, payload["validity"], "validity")

    response = client.modify_order(**kwargs)
    logger.info("Order modified %s: %s", order_id, response)
    return response


def cancel_order(order_id: str) -> dict:
    """Cancel an open/pending order by order_id."""
    client = get_client()
    response = client.cancel_order(order_id)
    logger.info("Order cancelled %s: %s", order_id, response)
    return response


def get_orders(limit: int = 50, offset: int = 1) -> dict:
    """Fetch the order book."""
    client = get_client()
    return client.orders(limit=limit, offset=offset)


def get_order_history(order_id: str) -> dict:
    """Fetch audit trail for a specific order."""
    client = get_client()
    return client.order_history(order_id)


# ── Basket orders ─────────────────────────────────────────────────────────────

def place_basket_order(legs: list[dict]) -> list[dict]:
    """
    Place multiple order legs as a basket.

    Each leg is a dict matching the ``place_order`` payload schema.
    Returns a list of individual order responses.
    """
    results = []
    for i, leg in enumerate(legs):
        try:
            result = place_order(leg)
            results.append({"leg": i, "success": True, "data": result})
        except Exception as exc:
            logger.error("Basket leg %d failed: %s", i, exc)
            results.append({"leg": i, "success": False, "error": str(exc)})
    return results
