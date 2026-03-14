import React, { useState, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import {
  Clock, Trash2, XCircle, RefreshCw, Plus, CalendarClock,
  CheckCircle2, AlertCircle, TimerOff, Loader2,
} from "lucide-react";
import axios from "axios";
import { useSocket } from "../context/SocketContext";
import { formatDate } from "../utils/format";
import { useInterval } from "../hooks/useInterval";
import ScheduleOrderModal from "./ScheduleOrderModal";

const STATUS_BADGE = {
  pending:   "badge-warning",
  executed:  "badge-success",
  failed:    "badge-error",
  cancelled: "badge-ghost",
  missed:    "badge-error",
};

const STATUS_ICON = {
  pending:   <Loader2   className="w-3.5 h-3.5 animate-spin" />,
  executed:  <CheckCircle2 className="w-3.5 h-3.5" />,
  failed:    <AlertCircle  className="w-3.5 h-3.5" />,
  cancelled: <XCircle      className="w-3.5 h-3.5" />,
  missed:    <TimerOff     className="w-3.5 h-3.5" />,
};

function Countdown({ isoTime }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const tick = () => {
      const diff = new Date(isoTime) - Date.now();
      if (diff <= 0) { setLabel("Executing…"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isoTime]);

  return <span className="font-mono text-xs text-warning">{label}</span>;
}

export default function ScheduledOrders() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const { socket } = useSocket() ?? {};

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get("/api/scheduled-orders", { withCredentials: true });
      setOrders(res.data?.data ?? []);
    } catch (err) {
      if (!silent) toast.error(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  useInterval(() => fetch(true), 10000);

  // Live update from SocketIO when an order executes
  useEffect(() => {
    if (!socket) return;
    const handler = (update) => {
      setOrders((prev) =>
        prev.map((o) => o.id === update.id ? { ...o, ...update } : o)
      );
      if (update.status === "executed") {
        toast.success(`Scheduled order executed: ${update.id.slice(0, 8)}`);
      } else if (update.status === "failed") {
        toast.error(`Scheduled order failed: ${update.result}`);
      }
    };
    socket.on("scheduled_order_update", handler);
    return () => socket.off("scheduled_order_update", handler);
  }, [socket]);

  const cancel = async (id) => {
    try {
      await axios.post(`/api/scheduled-orders/${id}/cancel`, {}, { withCredentials: true });
      toast.success("Order cancelled.");
      fetch(true);
    } catch (err) { toast.error(err.message); }
  };

  const remove = async (id) => {
    try {
      await axios.delete(`/api/scheduled-orders/${id}`, { withCredentials: true });
      setOrders((p) => p.filter((o) => o.id !== id));
    } catch (err) { toast.error(err.message); }
  };

  const pending   = orders.filter((o) => o.status === "pending");
  const completed = orders.filter((o) => o.status !== "pending");

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto scrollbar-thin pb-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            Scheduled Orders
          </h2>
          <p className="text-xs text-base-content/50 mt-0.5">
            Orders queued to fire automatically at a specific time
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-xs" onClick={() => fetch()} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Schedule Order
          </button>
        </div>
      </div>

      {/* Pending queue */}
      <div className="card bg-base-200 border border-base-300 flex-shrink-0">
        <div className="card-body p-4 gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              Pending Queue
              {pending.length > 0 && (
                <span className="ml-2 badge badge-warning badge-sm">{pending.length}</span>
              )}
            </h3>
          </div>

          {pending.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2 text-base-content/30">
              <Clock className="w-8 h-8" />
              <p className="text-sm">No pending scheduled orders</p>
              <button
                className="btn btn-primary btn-sm mt-2 gap-1"
                onClick={() => setShowModal(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Schedule your first order
              </button>
            </div>
          ) : (
            <div className="overflow-auto rounded-lg border border-base-300">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="bg-base-300 text-base-content/70 text-xs">
                    <th>Symbol</th>
                    <th>Side</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th>Type</th>
                    <th>Scheduled At</th>
                    <th>Fires In</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((o) => (
                    <tr key={o.id} className="hover:bg-base-300/40">
                      <td>
                        <div className="font-medium text-xs">{o.symbol}</div>
                        <div className="text-base-content/40 text-xs">{o.exchange}</div>
                      </td>
                      <td>
                        <span className={`badge badge-xs ${o.transaction_type === "BUY" ? "badge-success" : "badge-error"}`}>
                          {o.transaction_type}
                        </span>
                      </td>
                      <td className="text-right font-mono text-xs">{o.quantity}</td>
                      <td className="text-right font-mono text-xs">
                        {o.price > 0 ? `₹${o.price.toLocaleString("en-IN")}` : "MARKET"}
                      </td>
                      <td className="text-xs text-base-content/60">{o.variety?.replace(/_ORDER$/, "")}</td>
                      <td className="text-xs">{formatDate(o.scheduled_time)}</td>
                      <td><Countdown isoTime={o.scheduled_time} /></td>
                      <td>
                        <button
                          className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                          onClick={() => cancel(o.id)}
                          title="Cancel"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {completed.length > 0 && (
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body p-4 gap-3">
            <h3 className="font-semibold text-sm">History</h3>
            <div className="overflow-auto max-h-72 rounded-lg border border-base-300 scrollbar-thin">
              <table className="table table-xs w-full">
                <thead>
                  <tr className="bg-base-300 text-base-content/70">
                    <th>Symbol</th>
                    <th>Side</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th>Scheduled</th>
                    <th>Executed</th>
                    <th>Status</th>
                    <th>Result</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[...completed].reverse().map((o) => (
                    <tr key={o.id} className="hover:bg-base-300/40">
                      <td className="font-medium text-xs">{o.symbol}</td>
                      <td>
                        <span className={`badge badge-xs ${o.transaction_type === "BUY" ? "badge-success" : "badge-error"}`}>
                          {o.transaction_type}
                        </span>
                      </td>
                      <td className="text-right font-mono text-xs">{o.quantity}</td>
                      <td className="text-right font-mono text-xs">
                        {o.price > 0 ? `₹${o.price}` : "MARKET"}
                      </td>
                      <td className="text-xs">{formatDate(o.scheduled_time)}</td>
                      <td className="text-xs">{o.executed_at ? formatDate(o.executed_at) : "—"}</td>
                      <td>
                        <span className={`badge badge-xs gap-1 ${STATUS_BADGE[o.status] ?? "badge-ghost"}`}>
                          {STATUS_ICON[o.status]}
                          {o.status}
                        </span>
                      </td>
                      <td className="text-xs text-base-content/50 max-w-[160px] truncate" title={String(o.result ?? "")}>
                        {o.result ? String(o.result).slice(0, 40) : "—"}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-xs text-base-content/40 hover:text-error"
                          onClick={() => remove(o.id)}
                          title="Delete record"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <ScheduleOrderModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetch(); }}
        />
      )}
    </div>
  );
}
