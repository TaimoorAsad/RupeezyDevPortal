import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { RefreshCw, X, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { getOrders, cancelOrder, modifyOrder } from "../utils/api";
import { formatINR, formatTime, badgeVariant } from "../utils/format";
import { useSocket } from "../context/SocketContext";
import { useInterval } from "../hooks/useInterval";

const VARIETIES = ["REGULAR_LIMIT_ORDER", "REGULAR_MARKET_ORDER", "STOP_LIMIT_ORDER", "STOP_MARKET_ORDER"];

export default function OrderBook() {
  const [orders,      setOrders]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [filter,      setFilter]      = useState("ALL");
  const [editRow,     setEditRow]     = useState(null);
  const [editForm,    setEditForm]    = useState({});
  const [expandedId,  setExpandedId]  = useState(null);
  const { orderUpdates } = useSocket() ?? {};

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getOrders({ limit: 50 });
      const list = res.data?.data?.orders ?? res.data?.data ?? [];
      setOrders(Array.isArray(list) ? list : []);
    } catch (err) {
      if (!silent) toast.error(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useInterval(() => fetchOrders(true), 15000);

  // Refresh on real-time order update
  useEffect(() => {
    if (orderUpdates?.length) fetchOrders(true);
  }, [orderUpdates]);

  const handleCancel = async (orderId) => {
    try {
      await cancelOrder(orderId);
      toast.success("Order cancelled.");
      fetchOrders(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const startEdit = (order) => {
    setEditRow(order.order_id);
    setEditForm({
      variety:      order.variety ?? "REGULAR_LIMIT_ORDER",
      quantity:     order.quantity ?? "",
      price:        order.price ?? "",
      trigger_price: order.trigger_price ?? "",
      validity:     order.validity ?? "FULL_DAY",
    });
  };

  const saveEdit = async (orderId) => {
    try {
      await modifyOrder(orderId, {
        ...editForm,
        quantity:     Number(editForm.quantity),
        price:        Number(editForm.price),
        trigger_price: Number(editForm.trigger_price),
      });
      toast.success("Order modified.");
      setEditRow(null);
      fetchOrders(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const STATUSES = ["ALL", "OPEN", "TRIGGER_PENDING", "COMPLETE", "CANCELLED", "REJECTED"];

  const filtered = filter === "ALL"
    ? orders
    : orders.filter((o) => (o.status ?? "").toUpperCase() === filter);

  return (
    <div className="card bg-base-200 border border-base-300 h-full flex flex-col">
      <div className="card-body p-4 gap-3 flex flex-col min-h-0">
        <div className="flex items-center justify-between flex-shrink-0">
          <h2 className="card-title text-base font-semibold">Order Book</h2>
          <button
            className="btn btn-ghost btn-xs gap-1"
            onClick={() => fetchOrders()}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Status filter */}
        <div className="flex gap-1 flex-wrap flex-shrink-0">
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`btn btn-xs ${filter === s ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1 scrollbar-thin rounded-lg border border-base-300">
          <table className="table table-xs table-pin-rows w-full">
            <thead>
              <tr className="bg-base-300 text-base-content/70">
                <th>Time</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Type</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <span className="loading loading-spinner loading-md" />
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-base-content/40 text-sm">
                    No orders found
                  </td>
                </tr>
              )}
              {!loading && filtered.map((order) => {
                const oid    = order.order_id ?? order.id;
                const status = (order.status ?? "").toUpperCase();
                const isOpen = ["OPEN", "TRIGGER_PENDING"].includes(status);
                const isEdit = editRow === oid;
                const isExp  = expandedId === oid;

                return (
                  <React.Fragment key={oid}>
                    <tr className="hover:bg-base-300/40 transition-colors">
                      <td className="font-mono text-xs text-base-content/60 whitespace-nowrap">
                        {formatTime(order.order_timestamp ?? order.created_at)}
                      </td>
                      <td>
                        <div className="font-medium text-xs">
                          {order.tradingsymbol ?? order.symbol ?? order.token}
                        </div>
                        <div className="text-xs text-base-content/40">{order.exchange}</div>
                      </td>
                      <td>
                        <span className={`font-bold text-xs ${
                          order.transaction_type === "BUY" ? "text-success" : "text-error"
                        }`}>
                          {order.transaction_type}
                        </span>
                      </td>
                      <td className="font-mono text-xs">
                        {order.filled_quantity ?? 0}/{order.quantity}
                      </td>
                      <td className="font-mono text-xs">
                        {formatINR(order.average_price || order.price || 0)}
                      </td>
                      <td className="text-xs text-base-content/60">{order.variety}</td>
                      <td>
                        <span className={`badge badge-xs ${badgeVariant(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {isOpen && (
                            <>
                              {order.variety !== "REGULAR_MARKET_ORDER" && (
                                <button
                                  className="btn btn-ghost btn-xs"
                                  title="Modify"
                                  onClick={() => startEdit(order)}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                className="btn btn-ghost btn-xs text-error"
                                title="Cancel"
                                onClick={() => handleCancel(oid)}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => setExpandedId(isExp ? null : oid)}
                          >
                            {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline edit row */}
                    {isEdit && (
                      <tr className="bg-base-300/60">
                        <td colSpan={8} className="p-3">
                          <div className="flex flex-wrap gap-2 items-end">
                            <div className="form-control gap-0.5">
                              <label className="text-xs text-base-content/60">Type</label>
                              <select
                                className="select select-bordered select-xs"
                                value={editForm.variety}
                                onChange={(e) => setEditForm((p) => ({ ...p, variety: e.target.value }))}
                              >
                                {VARIETIES.map((v) => <option key={v}>{v}</option>)}
                              </select>
                            </div>
                            <div className="form-control gap-0.5">
                              <label className="text-xs text-base-content/60">Qty</label>
                              <input
                                type="number"
                                className="input input-bordered input-xs w-20 font-mono"
                                value={editForm.quantity}
                                onChange={(e) => setEditForm((p) => ({ ...p, quantity: e.target.value }))}
                              />
                            </div>
                            <div className="form-control gap-0.5">
                              <label className="text-xs text-base-content/60">Price</label>
                              <input
                                type="number"
                                step="0.05"
                                className="input input-bordered input-xs w-24 font-mono"
                                value={editForm.price}
                                onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
                              />
                            </div>
                            <div className="form-control gap-0.5">
                              <label className="text-xs text-base-content/60">Trigger</label>
                              <input
                                type="number"
                                step="0.05"
                                className="input input-bordered input-xs w-24 font-mono"
                                value={editForm.trigger_price}
                                onChange={(e) => setEditForm((p) => ({ ...p, trigger_price: e.target.value }))}
                              />
                            </div>
                            <button className="btn btn-primary btn-xs" onClick={() => saveEdit(oid)}>Save</button>
                            <button className="btn btn-ghost btn-xs" onClick={() => setEditRow(null)}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Expanded detail row */}
                    {isExp && !isEdit && (
                      <tr className="bg-base-300/30">
                        <td colSpan={8} className="px-4 py-2">
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                            {[
                              ["Order ID", oid],
                              ["Product",  order.product],
                              ["Validity", order.validity],
                              ["Trigger",  formatINR(order.trigger_price ?? 0)],
                              ["Disc Qty", order.disclosed_quantity ?? 0],
                              ["Message",  order.message ?? order.status_message ?? "—"],
                            ].map(([k, v]) => (
                              <div key={k}>
                                <div className="text-base-content/50">{k}</div>
                                <div className="font-mono font-medium break-all">{v}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-base-content/40 flex-shrink-0">
          {filtered.length} order{filtered.length !== 1 ? "s" : ""} · Auto-refreshes every 15s
        </div>
      </div>
    </div>
  );
}
