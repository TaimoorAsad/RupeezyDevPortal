"""
Scheduled Orders — place orders at a specific future date/time.

Scheduled orders are stored in a JSON file (scheduled_orders.json) so they
survive backend restarts. APScheduler fires each job at the requested time
and calls the Vortex order placement API on the user's behalf.
"""

import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from threading import Lock

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger

import orders as ord_module

logger = logging.getLogger(__name__)

_STORE = Path(__file__).parent / "scheduled_orders.json"
_lock  = Lock()
_scheduler: BackgroundScheduler | None = None
_socketio = None   # injected by app.py


# ── Persistence ───────────────────────────────────────────────────────────────

def _load() -> dict:
    if _STORE.exists():
        try:
            return json.loads(_STORE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save(store: dict) -> None:
    _STORE.write_text(json.dumps(store, indent=2, default=str), encoding="utf-8")


# ── Scheduler lifecycle ────────────────────────────────────────────────────────

def init(socketio=None) -> None:
    """Start the APScheduler background scheduler and re-queue pending jobs."""
    global _scheduler, _socketio
    _socketio = socketio

    # Idempotent init (important under gunicorn import/reload paths)
    if _scheduler is not None:
        return

    _scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
    _scheduler.start()

    # Re-queue any pending orders from a previous session
    with _lock:
        store = _load()
        now   = datetime.now()
        for order in store.values():
            if order["status"] == "pending":
                run_at = datetime.fromisoformat(order["scheduled_time"])
                if run_at > now:
                    _add_job(order["id"], run_at)
                else:
                    # Missed while server was down
                    order["status"] = "missed"
                    order["result"] = "Server was offline at scheduled time"
        _save(store)

    logger.info("Scheduled-order scheduler started. %d jobs re-queued.", _scheduler.get_jobs().__len__())


def shutdown() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None


# ── Internal job execution ────────────────────────────────────────────────────

def _add_job(order_id: str, run_at: datetime) -> None:
    """Register a one-shot APScheduler job for the given order."""
    _scheduler.add_job(
        _execute_order,
        trigger=DateTrigger(run_date=run_at),
        args=[order_id],
        id=order_id,
        replace_existing=True,
        misfire_grace_time=60,
    )


def _execute_order(order_id: str) -> None:
    """APScheduler calls this at the scheduled time."""
    with _lock:
        store = _load()
        order = store.get(order_id)
        if not order or order["status"] != "pending":
            return

        logger.info("Executing scheduled order %s (%s %s %s)",
                    order_id, order["transaction_type"], order["quantity"], order["symbol"])

        try:
            result = ord_module.place_order(
                exchange        = order["exchange"],
                token           = order["token"],
                transaction_type= order["transaction_type"],
                product         = order["product"],
                variety         = order["variety"],
                quantity        = order["quantity"],
                price           = order.get("price", 0),
                trigger_price   = order.get("trigger_price", 0),
                validity        = order.get("validity", "DAY"),
                disclosed_quantity = order.get("disclosed_quantity", 0),
                is_amo          = order.get("is_amo", False),
            )
            order["status"] = "executed"
            order["result"] = result
            order["executed_at"] = datetime.now().isoformat()
            logger.info("Scheduled order %s executed: %s", order_id, result)
        except Exception as exc:
            order["status"] = "failed"
            order["result"] = str(exc)
            order["executed_at"] = datetime.now().isoformat()
            logger.error("Scheduled order %s failed: %s", order_id, exc)

        _save(store)

    # Notify frontend via SocketIO
    if _socketio:
        try:
            _socketio.emit("scheduled_order_update", {
                "id":     order_id,
                "status": order["status"],
                "result": str(order.get("result", "")),
            })
        except Exception:
            pass


# ── Public CRUD API ───────────────────────────────────────────────────────────

def create(
    scheduled_time: str,
    symbol: str,
    exchange: str,
    token: int,
    transaction_type: str,
    product: str,
    variety: str,
    quantity: int,
    price: float = 0,
    trigger_price: float = 0,
    validity: str = "DAY",
    disclosed_quantity: int = 0,
    is_amo: bool = False,
) -> dict:
    """
    Schedule a new order.
    `scheduled_time` must be an ISO-8601 string: "2026-03-13T09:15:00"
    """
    run_at = datetime.fromisoformat(scheduled_time)
    if run_at <= datetime.now():
        raise ValueError("scheduled_time must be in the future.")

    order_id = str(uuid.uuid4())
    order = {
        "id":               order_id,
        "symbol":           symbol,
        "exchange":         exchange,
        "token":            token,
        "transaction_type": transaction_type,
        "product":          product,
        "variety":          variety,
        "quantity":         quantity,
        "price":            price,
        "trigger_price":    trigger_price,
        "validity":         validity,
        "disclosed_quantity": disclosed_quantity,
        "is_amo":           is_amo,
        "scheduled_time":   scheduled_time,
        "status":           "pending",
        "created_at":       datetime.now().isoformat(),
        "executed_at":      None,
        "result":           None,
    }

    with _lock:
        store = _load()
        store[order_id] = order
        _save(store)

    _add_job(order_id, run_at)
    logger.info("Scheduled order %s created for %s", order_id, scheduled_time)
    return order


def list_all() -> list:
    with _lock:
        store = _load()
    return sorted(store.values(), key=lambda x: x["scheduled_time"])


def get(order_id: str) -> dict | None:
    with _lock:
        return _load().get(order_id)


def cancel(order_id: str) -> dict:
    with _lock:
        store = _load()
        order = store.get(order_id)
        if not order:
            raise KeyError(f"Scheduled order {order_id} not found.")
        if order["status"] != "pending":
            raise ValueError(f"Cannot cancel order with status '{order['status']}'.")

        order["status"] = "cancelled"
        _save(store)

    # Remove from APScheduler
    try:
        _scheduler.remove_job(order_id)
    except Exception:
        pass

    logger.info("Scheduled order %s cancelled.", order_id)
    return order


def delete(order_id: str) -> None:
    """Remove the order record entirely (only non-pending)."""
    with _lock:
        store = _load()
        order = store.get(order_id)
        if not order:
            raise KeyError(f"Scheduled order {order_id} not found.")
        if order["status"] == "pending":
            raise ValueError("Cancel the order before deleting it.")
        del store[order_id]
        _save(store)
