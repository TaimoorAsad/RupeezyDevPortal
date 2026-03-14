"""
Demo mode — returns realistic fake data for every API endpoint.
No Rupeezy credentials required. Enabled via /api/demo/enable.
"""

from datetime import datetime, timedelta
import random

# ── Helpers ───────────────────────────────────────────────────────────────────

def _ts(minutes_ago=0):
    return (datetime.now() - timedelta(minutes=minutes_ago)).strftime("%Y-%m-%dT%H:%M:%S")


def _rand_price(base, pct=0.5):
    return round(base * (1 + random.uniform(-pct / 100, pct / 100)), 2)


# ── Mock datasets ─────────────────────────────────────────────────────────────

MOCK_ORDERS = [
    {
        "order_id": "ORD001",
        "tradingsymbol": "RELIANCE",
        "exchange": "NSE_EQ",
        "transaction_type": "BUY",
        "product": "DELIVERY",
        "variety": "REGULAR_LIMIT_ORDER",
        "quantity": 10,
        "filled_quantity": 10,
        "price": 2845.50,
        "average_price": 2844.75,
        "trigger_price": 0,
        "disclosed_quantity": 0,
        "validity": "FULL_DAY",
        "status": "COMPLETE",
        "order_timestamp": _ts(45),
        "message": "",
    },
    {
        "order_id": "ORD002",
        "tradingsymbol": "TCS",
        "exchange": "NSE_EQ",
        "transaction_type": "SELL",
        "product": "INTRADAY",
        "variety": "REGULAR_MARKET_ORDER",
        "quantity": 5,
        "filled_quantity": 5,
        "price": 0,
        "average_price": 3921.20,
        "trigger_price": 0,
        "disclosed_quantity": 0,
        "validity": "FULL_DAY",
        "status": "COMPLETE",
        "order_timestamp": _ts(30),
        "message": "",
    },
    {
        "order_id": "ORD003",
        "tradingsymbol": "INFY",
        "exchange": "NSE_EQ",
        "transaction_type": "BUY",
        "product": "DELIVERY",
        "variety": "REGULAR_LIMIT_ORDER",
        "quantity": 20,
        "filled_quantity": 0,
        "price": 1540.00,
        "average_price": 0,
        "trigger_price": 0,
        "disclosed_quantity": 0,
        "validity": "FULL_DAY",
        "status": "OPEN",
        "order_timestamp": _ts(5),
        "message": "",
    },
    {
        "order_id": "ORD004",
        "tradingsymbol": "HDFCBANK",
        "exchange": "NSE_EQ",
        "transaction_type": "BUY",
        "product": "DELIVERY",
        "variety": "STOP_LIMIT_ORDER",
        "quantity": 15,
        "filled_quantity": 0,
        "price": 1620.00,
        "average_price": 0,
        "trigger_price": 1615.00,
        "disclosed_quantity": 0,
        "validity": "FULL_DAY",
        "status": "TRIGGER_PENDING",
        "order_timestamp": _ts(12),
        "message": "",
    },
    {
        "order_id": "ORD005",
        "tradingsymbol": "WIPRO",
        "exchange": "NSE_EQ",
        "transaction_type": "SELL",
        "product": "INTRADAY",
        "variety": "REGULAR_LIMIT_ORDER",
        "quantity": 50,
        "filled_quantity": 0,
        "price": 415.00,
        "average_price": 0,
        "trigger_price": 0,
        "disclosed_quantity": 0,
        "validity": "FULL_DAY",
        "status": "CANCELLED",
        "order_timestamp": _ts(60),
        "message": "Cancelled by user",
    },
]

MOCK_POSITIONS = [
    {
        "tradingsymbol": "RELIANCE",
        "exchange": "NSE_EQ",
        "token": 2885,
        "product": "DELIVERY",
        "buy_quantity": 10,
        "sell_quantity": 0,
        "average_price": 2844.75,
        "ltp": 2867.30,
        "pnl": 225.50,
    },
    {
        "tradingsymbol": "NIFTY24NOV21000CE",
        "exchange": "NSE_FO",
        "token": 58234,
        "product": "INTRADAY",
        "buy_quantity": 50,
        "sell_quantity": 0,
        "average_price": 142.00,
        "ltp": 168.50,
        "pnl": 1325.00,
    },
    {
        "tradingsymbol": "TCS",
        "exchange": "NSE_EQ",
        "token": 2953,
        "product": "INTRADAY",
        "buy_quantity": 0,
        "sell_quantity": 5,
        "average_price": 3921.20,
        "ltp": 3905.60,
        "pnl": 78.00,
    },
]

MOCK_HOLDINGS = [
    {
        "tradingsymbol": "RELIANCE",
        "exchange": "NSE",
        "token": 2885,
        "quantity": 25,
        "average_price": 2610.40,
        "ltp": 2867.30,
    },
    {
        "tradingsymbol": "INFY",
        "exchange": "NSE",
        "token": 1594,
        "quantity": 50,
        "average_price": 1428.75,
        "ltp": 1558.90,
    },
    {
        "tradingsymbol": "HDFCBANK",
        "exchange": "NSE",
        "token": 1333,
        "quantity": 30,
        "average_price": 1580.20,
        "ltp": 1632.45,
    },
    {
        "tradingsymbol": "TCS",
        "exchange": "NSE",
        "token": 2953,
        "quantity": 10,
        "average_price": 3650.00,
        "ltp": 3921.20,
    },
    {
        "tradingsymbol": "WIPRO",
        "exchange": "NSE",
        "token": 3787,
        "quantity": 100,
        "average_price": 445.60,
        "ltp": 412.35,
    },
]

MOCK_FUNDS = {
    "nse": {
        "available_margin": 148320.50,
        "utilised_margin": 51679.50,
        "collateral": 25000.00,
        "opening_balance": 200000.00,
        "payin": 0,
        "span": 18420.00,
        "exposure": 12350.00,
        "option_premium": 7100.00,
        "turnover": 485200.00,
    },
    "mcx": {
        "available_margin": 32500.00,
        "utilised_margin": 7500.00,
        "collateral": 0,
        "opening_balance": 40000.00,
    },
}

MOCK_QUOTES = {
    "NSE_EQ-2885": {"ltp": 2867.30, "open": 2851.00, "high": 2882.00, "low": 2843.50, "close": 2850.00, "volume": 3241500},
    "NSE_EQ-1594": {"ltp": 1558.90, "open": 1542.00, "high": 1565.20, "low": 1538.75, "close": 1545.00, "volume": 5820300},
    "NSE_EQ-2953": {"ltp": 3921.20, "open": 3895.00, "high": 3934.80, "low": 3887.00, "close": 3900.00, "volume": 1245800},
    "NSE_EQ-1333": {"ltp": 1632.45, "open": 1618.00, "high": 1641.00, "low": 1612.30, "close": 1620.00, "volume": 8431200},
    "NSE_EQ-26000": {"ltp": 24186.50, "open": 24050.00, "high": 24230.00, "low": 24010.00, "close": 24060.00, "volume": 0},
}

MOCK_SEARCH = [
    {"tradingsymbol": "RELIANCE", "token": 2885, "exchange": "NSE_EQ", "name": "Reliance Industries Ltd"},
    {"tradingsymbol": "INFY",     "token": 1594, "exchange": "NSE_EQ", "name": "Infosys Ltd"},
    {"tradingsymbol": "TCS",      "token": 2953, "exchange": "NSE_EQ", "name": "Tata Consultancy Services"},
    {"tradingsymbol": "HDFCBANK", "token": 1333, "exchange": "NSE_EQ", "name": "HDFC Bank Ltd"},
    {"tradingsymbol": "WIPRO",    "token": 3787, "exchange": "NSE_EQ", "name": "Wipro Ltd"},
    {"tradingsymbol": "ICICIBANK","token": 1270, "exchange": "NSE_EQ", "name": "ICICI Bank Ltd"},
    {"tradingsymbol": "AXISBANK", "token": 5900, "exchange": "NSE_EQ", "name": "Axis Bank Ltd"},
    {"tradipsymbol":  "SBIN",     "token": 3045, "exchange": "NSE_EQ", "name": "State Bank of India"},
]


# ── Response builders (add slight randomness to prices) ──────────────────────

def orders_response():
    return {"orders": MOCK_ORDERS}


def positions_response():
    pos = []
    for p in MOCK_POSITIONS:
        pos.append({**p, "ltp": _rand_price(p["ltp"])})
    return {"positions": pos}


def holdings_response():
    hld = []
    for h in MOCK_HOLDINGS:
        hld.append({**h, "ltp": _rand_price(h["ltp"])})
    return {"holdings": hld}


def funds_response():
    return MOCK_FUNDS


def quotes_response(instruments: list[str]):
    result = {}
    for instr in instruments:
        base = MOCK_QUOTES.get(instr)
        if base:
            result[instr] = {**base, "ltp": _rand_price(base["ltp"])}
        else:
            # Unknown token — return a plausible random price
            result[instr] = {"ltp": round(random.uniform(100, 5000), 2), "open": 0, "high": 0, "low": 0, "close": 0, "volume": 0}
    return result


def search_response(query: str):
    q = query.lower()
    return [s for s in MOCK_SEARCH if q in s["tradingsymbol"].lower() or q in s.get("name", "").lower()]


def place_order_response(payload: dict):
    return {
        "order_id": f"DEMO{random.randint(10000, 99999)}",
        "status": "COMPLETE",
        "message": "Demo order accepted",
    }


def margins_response():
    required  = round(random.uniform(8000, 25000), 2)
    available = round(required * random.uniform(2, 5), 2)
    return {
        "required_margin": required,
        "available_margin": available,
        "total": required,
        "available": available,
    }


def candles_response():
    """Generate ~100 realistic 5-min OHLCV candles ending now."""
    import time as _time
    candles = []
    close = 2850.0
    now = int(_time.time())
    # align to 5-min boundary
    now = now - (now % 300)
    for i in range(99, -1, -1):
        ts    = now - i * 300
        pct   = (random.random() - 0.49) * 0.008
        open_ = round(close * (1 + (random.random() - 0.5) * 0.003), 2)
        close = round(open_ * (1 + pct), 2)
        high  = round(max(open_, close) * (1 + random.random() * 0.003), 2)
        low   = round(min(open_, close) * (1 - random.random() * 0.003), 2)
        vol   = random.randint(10000, 150000)
        candles.append({"time": ts, "open": open_, "high": high, "low": low, "close": close, "volume": vol})
    return {"candles": candles}


def analytics_response():
    """Generate realistic trade analytics for demo mode."""
    import time as _time
    trades = []
    equity = 0
    curve  = []
    symbols = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "WIPRO", "ICICIBANK"]
    now = int(_time.time())

    for i in range(40):
        sym   = random.choice(symbols)
        entry = round(random.uniform(500, 4000), 2)
        pct   = (random.random() - 0.42) * 0.04   # slight positive bias
        exit_ = round(entry * (1 + pct), 2)
        qty   = random.randint(5, 50)
        pnl   = round((exit_ - entry) * qty, 2)
        ts    = _time.strftime("%Y-%m-%dT%H:%M:%S", _time.localtime(now - (40 - i) * 3600))
        trades.append({"symbol": sym, "entry": entry, "exit": exit_, "qty": qty, "pnl": pnl,
                       "entry_time": ts, "exit_time": ts, "side": "LONG"})
        equity += pnl
        curve.append({"time": ts, "value": round(equity, 2)})

    winners = [t for t in trades if t["pnl"] > 0]
    losers  = [t for t in trades if t["pnl"] <= 0]
    gross_p = sum(t["pnl"] for t in winners) or 1
    gross_l = abs(sum(t["pnl"] for t in losers)) or 1

    peak = 0; max_dd = 0
    for pt in curve:
        if pt["value"] > peak: peak = pt["value"]
        dd = peak - pt["value"]
        if dd > max_dd: max_dd = dd

    return {
        "total_trades":  len(trades),
        "winners":       len(winners),
        "losers":        len(losers),
        "win_rate":      round(len(winners) / len(trades) * 100, 1),
        "total_pnl":     round(equity, 2),
        "avg_profit":    round(gross_p / max(len(winners), 1), 2),
        "avg_loss":      round(-gross_l / max(len(losers), 1), 2),
        "best_trade":    round(max(t["pnl"] for t in trades), 2),
        "worst_trade":   round(min(t["pnl"] for t in trades), 2),
        "profit_factor": round(gross_p / gross_l, 2),
        "max_drawdown":  round(max_dd, 2),
        "equity_curve":  curve,
        "trades":        trades,
    }
