"""
Charts & analytics module.
Provides historical OHLCV candles and computed trade analytics from the order book.
"""

import logging
from datetime import datetime, timedelta
from vortex_api import Constants as Vc
from auth import get_client

logger = logging.getLogger(__name__)

RESOLUTION_MAP = {
    "1":    Vc.Resolutions.MIN_1,
    "3":    Vc.Resolutions.MIN_3,
    "5":    Vc.Resolutions.MIN_5,
    "10":   Vc.Resolutions.MIN_10,
    "15":   Vc.Resolutions.MIN_15,
    "30":   Vc.Resolutions.MIN_30,
    "60":   Vc.Resolutions.MIN_60,
    "1D":   Vc.Resolutions.DAY,
    "1W":   Vc.Resolutions.WEEK,
    "1M":   Vc.Resolutions.MONTH,
}

EXCHANGE_MAP = {
    "NSE_EQ":  Vc.ExchangeTypes.NSE_EQUITY,
    "NSE_FO":  Vc.ExchangeTypes.NSE_FO,
    "NSE_CUR": Vc.ExchangeTypes.NSE_CURRENCY,
    "MCX":     Vc.ExchangeTypes.MCX,
    "BSE_EQ":  Vc.ExchangeTypes.BSE_EQUITY,
    "BSE_FO":  Vc.ExchangeTypes.BSE_FO,
}

# Default look-back periods per resolution
LOOKBACK_DAYS = {
    "1": 1, "3": 1, "5": 2, "10": 3, "15": 5,
    "30": 10, "60": 20, "1D": 365, "1W": 730, "1M": 1825,
}


def get_candles(exchange: str, token: int, resolution: str = "5",
                from_dt: datetime | None = None, to_dt: datetime | None = None) -> dict:
    """
    Fetch OHLCV candle data.
    Returns normalised list of {time, open, high, low, close, volume}.
    """
    client = get_client()

    ex  = EXCHANGE_MAP.get(exchange.upper(), Vc.ExchangeTypes.NSE_EQUITY)
    res = RESOLUTION_MAP.get(resolution, Vc.Resolutions.MIN_5)

    to_dt   = to_dt   or datetime.now()
    from_dt = from_dt or (to_dt - timedelta(days=LOOKBACK_DAYS.get(resolution, 5)))

    raw = client.historical_candles(
        exchange=ex,
        token=token,
        to=to_dt,
        start=from_dt,
        resolution=res,
    )

    # Surface API-level errors (expired token, bad params, etc.)
    if isinstance(raw, dict) and raw.get("s") == "error":
        msg = raw.get("errmsg", raw.get("message", "Unknown API error"))
        raise RuntimeError(f"Rupeezy API error: {msg}")
    if isinstance(raw, dict) and raw.get("status") == "error":
        msg = raw.get("message", "Unknown API error")
        raise RuntimeError(f"Rupeezy API error: {msg}")

    # Vortex returns TradingView-style columnar arrays:
    # { "s": "ok", "t": [...], "o": [...], "h": [...], "l": [...], "c": [...], "v": [...] }
    # When there is no data, the API returns {"s": "no_data", "t": null, ...}
    if raw.get("s") == "no_data":
        return {"candles": []}

    timestamps = raw.get("t") or []
    opens      = raw.get("o") or []
    highs      = raw.get("h") or []
    lows       = raw.get("l") or []
    closes     = raw.get("c") or []
    volumes    = raw.get("v") or []

    if not timestamps:
        logger.warning("Empty candles response: %s", raw)
        return {"candles": []}

    normalised = [
        {
            "time":   timestamps[i],
            "open":   opens[i],
            "high":   highs[i],
            "low":    lows[i],
            "close":  closes[i],
            "volume": volumes[i] if i < len(volumes) else 0,
        }
        for i in range(len(timestamps))
    ]

    return {"candles": normalised}


# ── Trade analytics ───────────────────────────────────────────────────────────

def compute_analytics(orders: list[dict]) -> dict:
    """
    Compute trade performance metrics from the completed order list.
    Pairs BUY and SELL fills to calculate per-trade P&L.
    """
    completed = [
        o for o in orders
        if str(o.get("status", "")).upper() in ("COMPLETE", "FILLED")
        and o.get("average_price", 0) > 0
    ]

    # Build per-symbol trade pairs
    trades = []
    buys: dict[str, list] = {}

    for o in sorted(completed, key=lambda x: x.get("order_timestamp", "")):
        sym = o.get("tradingsymbol") or str(o.get("token", ""))
        qty = int(o.get("filled_quantity") or o.get("quantity", 0))
        px  = float(o.get("average_price", 0))
        side = (o.get("transaction_type") or "").upper()
        ts   = o.get("order_timestamp", "")

        if side == "BUY":
            buys.setdefault(sym, []).append({"qty": qty, "price": px, "time": ts})
        elif side == "SELL":
            matched_qty = qty
            while matched_qty > 0 and buys.get(sym):
                b = buys[sym][0]
                used = min(b["qty"], matched_qty)
                pnl  = (px - b["price"]) * used
                trades.append({
                    "symbol":   sym,
                    "entry":    b["price"],
                    "exit":     px,
                    "qty":      used,
                    "pnl":      round(pnl, 2),
                    "entry_time": b["time"],
                    "exit_time":  ts,
                    "side":     "LONG",
                })
                b["qty"] -= used
                if b["qty"] == 0:
                    buys[sym].pop(0)
                matched_qty -= used

    # ── Metrics ──────────────────────────────────────────────────────────────
    total_trades = len(trades)
    if total_trades == 0:
        return {
            "total_trades": 0, "win_rate": 0, "total_pnl": 0,
            "avg_profit": 0, "avg_loss": 0, "best_trade": 0, "worst_trade": 0,
            "profit_factor": 0, "max_drawdown": 0,
            "equity_curve": [], "trades": [],
        }

    winners  = [t for t in trades if t["pnl"] > 0]
    losers   = [t for t in trades if t["pnl"] <= 0]
    total_pnl = sum(t["pnl"] for t in trades)

    gross_profit = sum(t["pnl"] for t in winners) or 0
    gross_loss   = abs(sum(t["pnl"] for t in losers)) or 1

    # Equity curve — running cumulative P&L
    equity = 0
    curve  = []
    for t in trades:
        equity += t["pnl"]
        curve.append({"time": t["exit_time"], "value": round(equity, 2)})

    # Max drawdown from equity curve
    peak = 0
    max_dd = 0
    for pt in curve:
        if pt["value"] > peak:
            peak = pt["value"]
        dd = peak - pt["value"]
        if dd > max_dd:
            max_dd = dd

    return {
        "total_trades":   total_trades,
        "winners":        len(winners),
        "losers":         len(losers),
        "win_rate":       round(len(winners) / total_trades * 100, 1),
        "total_pnl":      round(total_pnl, 2),
        "avg_profit":     round(gross_profit / max(len(winners), 1), 2),
        "avg_loss":       round(-gross_loss / max(len(losers), 1), 2),
        "best_trade":     round(max(t["pnl"] for t in trades), 2),
        "worst_trade":    round(min(t["pnl"] for t in trades), 2),
        "profit_factor":  round(gross_profit / gross_loss, 2),
        "max_drawdown":   round(max_dd, 2),
        "equity_curve":   curve,
        "trades":         trades[-50:],  # last 50 for table display
    }
