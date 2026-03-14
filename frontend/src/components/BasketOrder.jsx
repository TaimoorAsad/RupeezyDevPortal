import React, { useState } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2, Send, AlertCircle } from "lucide-react";
import { placeBasket, getMargins } from "../utils/api";
import { formatINR } from "../utils/format";

const EXCHANGES  = ["NSE_EQ", "NSE_FO", "NSE_CUR", "MCX", "BSE_EQ", "BSE_FO"];
const PRODUCTS   = ["DELIVERY", "INTRADAY", "MTF"];
const VARIETIES  = ["REGULAR_LIMIT_ORDER", "REGULAR_MARKET_ORDER", "STOP_LIMIT_ORDER", "STOP_MARKET_ORDER"];
const VALIDITIES = ["FULL_DAY", "IMMEDIATE_OR_CANCEL", "AFTER_MARKET"];

const EMPTY_LEG = {
  exchange: "NSE_EQ",
  token: "",
  transaction_type: "BUY",
  product: "INTRADAY",
  variety: "REGULAR_LIMIT_ORDER",
  quantity: "",
  price: "",
  trigger_price: "",
  disclosed_quantity: "",
  validity: "FULL_DAY",
};

export default function BasketOrder() {
  const [legs,        setLegs]       = useState([{ ...EMPTY_LEG, id: Date.now() }]);
  const [loading,     setLoading]    = useState(false);
  const [marginData,  setMarginData] = useState(null);
  const [margLoading, setMargLoad]   = useState(false);
  const [results,     setResults]    = useState([]);

  const addLeg = () => setLegs((p) => [...p, { ...EMPTY_LEG, id: Date.now() }]);

  const removeLeg = (id) => setLegs((p) => p.filter((l) => l.id !== id));

  const updateLeg = (id, key, val) =>
    setLegs((p) => p.map((l) => (l.id === id ? { ...l, [key]: val } : l)));

  const buildPayload = () =>
    legs.map((l) => ({
      exchange:           l.exchange,
      token:              Number(l.token),
      transaction_type:   l.transaction_type,
      product:            l.product,
      variety:            l.variety,
      quantity:           Number(l.quantity),
      price:              Number(l.price) || 0,
      trigger_price:      Number(l.trigger_price) || 0,
      disclosed_quantity: Number(l.disclosed_quantity) || 0,
      validity:           l.validity,
    }));

  const checkMargin = async () => {
    const valid = legs.filter((l) => l.token && l.quantity);
    if (!valid.length) { toast.error("Fill at least one leg."); return; }
    setMargLoad(true);
    try {
      const res = await getMargins(buildPayload().filter((l) => l.token && l.quantity));
      setMarginData(res.data?.data ?? null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setMargLoad(false);
    }
  };

  const executeBasket = async () => {
    const valid = legs.filter((l) => l.token && l.quantity);
    if (!valid.length) { toast.error("Fill at least one leg with token and quantity."); return; }
    setLoading(true);
    setResults([]);
    try {
      const res = await placeBasket(buildPayload().filter((l) => l.token && l.quantity));
      const data = res.data?.data ?? [];
      setResults(data);
      const ok   = data.filter((r) => r.success).length;
      const fail = data.length - ok;
      toast.success(`Basket: ${ok} placed${fail ? `, ${fail} failed` : ""}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const thCls = "text-xs text-base-content/60 font-medium whitespace-nowrap";

  return (
    <div className="card bg-base-200 border border-base-300 h-full flex flex-col">
      <div className="card-body p-4 gap-4 flex flex-col min-h-0">
        <div className="flex items-center justify-between flex-shrink-0">
          <h2 className="card-title text-base font-semibold">Basket Order</h2>
          <button className="btn btn-ghost btn-xs gap-1" onClick={addLeg}>
            <Plus className="w-3.5 h-3.5" /> Add Leg
          </button>
        </div>

        {/* Legs table */}
        <div className="overflow-auto flex-1 scrollbar-thin rounded-lg border border-base-300">
          <table className="table table-xs w-full">
            <thead>
              <tr className="bg-base-300">
                <th className={thCls}>#</th>
                <th className={thCls}>Exch</th>
                <th className={thCls}>Token</th>
                <th className={thCls}>Side</th>
                <th className={thCls}>Product</th>
                <th className={thCls}>Type</th>
                <th className={thCls}>Qty</th>
                <th className={thCls}>Price</th>
                <th className={thCls}>Trigger</th>
                <th className={thCls}>Validity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {legs.map((leg, idx) => (
                <tr key={leg.id} className="hover:bg-base-300/30">
                  <td className="text-xs font-mono text-base-content/50">{idx + 1}</td>

                  {/* Exchange */}
                  <td>
                    <select
                      className="select select-bordered select-xs w-20"
                      value={leg.exchange}
                      onChange={(e) => updateLeg(leg.id, "exchange", e.target.value)}
                    >
                      {EXCHANGES.map((ex) => <option key={ex}>{ex}</option>)}
                    </select>
                  </td>

                  {/* Token */}
                  <td>
                    <input
                      type="number"
                      placeholder="Token"
                      className="input input-bordered input-xs w-20 font-mono"
                      value={leg.token}
                      onChange={(e) => updateLeg(leg.id, "token", e.target.value)}
                    />
                  </td>

                  {/* Side */}
                  <td>
                    <select
                      className={`select select-bordered select-xs w-16 font-bold ${
                        leg.transaction_type === "BUY" ? "text-success" : "text-error"
                      }`}
                      value={leg.transaction_type}
                      onChange={(e) => updateLeg(leg.id, "transaction_type", e.target.value)}
                    >
                      <option>BUY</option>
                      <option>SELL</option>
                    </select>
                  </td>

                  {/* Product */}
                  <td>
                    <select
                      className="select select-bordered select-xs w-24"
                      value={leg.product}
                      onChange={(e) => updateLeg(leg.id, "product", e.target.value)}
                    >
                      {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </td>

                  {/* Variety */}
                  <td>
                    <select
                      className="select select-bordered select-xs w-32"
                      value={leg.variety}
                      onChange={(e) => updateLeg(leg.id, "variety", e.target.value)}
                    >
                      {VARIETIES.map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </td>

                  {/* Qty */}
                  <td>
                    <input
                      type="number"
                      min="1"
                      placeholder="0"
                      className="input input-bordered input-xs w-16 font-mono"
                      value={leg.quantity}
                      onChange={(e) => updateLeg(leg.id, "quantity", e.target.value)}
                    />
                  </td>

                  {/* Price */}
                  <td>
                    <input
                      type="number"
                      step="0.05"
                      placeholder="0.00"
                      className="input input-bordered input-xs w-20 font-mono"
                      value={leg.price}
                      onChange={(e) => updateLeg(leg.id, "price", e.target.value)}
                    />
                  </td>

                  {/* Trigger */}
                  <td>
                    <input
                      type="number"
                      step="0.05"
                      placeholder="0.00"
                      className="input input-bordered input-xs w-20 font-mono"
                      value={leg.trigger_price}
                      onChange={(e) => updateLeg(leg.id, "trigger_price", e.target.value)}
                    />
                  </td>

                  {/* Validity */}
                  <td>
                    <select
                      className="select select-bordered select-xs w-24"
                      value={leg.validity}
                      onChange={(e) => updateLeg(leg.id, "validity", e.target.value)}
                    >
                      {VALIDITIES.map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </td>

                  <td>
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      disabled={legs.length === 1}
                      onClick={() => removeLeg(leg.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Margin summary */}
        {marginData && (
          <div className="rounded-lg bg-base-300 p-3 text-sm flex flex-wrap gap-4">
            <div>
              <span className="text-base-content/50 text-xs">Required Margin</span>
              <div className="font-mono font-bold text-warning">
                {formatINR(marginData.required_margin ?? marginData.total ?? 0)}
              </div>
            </div>
            <div>
              <span className="text-base-content/50 text-xs">Available</span>
              <div className="font-mono font-bold text-success">
                {formatINR(marginData.available_margin ?? marginData.available ?? 0)}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
                  r.success ? "bg-success/10 text-success" : "bg-error/10 text-error"
                }`}
              >
                <span className="font-bold">Leg {r.leg + 1}:</span>
                <span>{r.success ? "Placed" : `Failed — ${r.error}`}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            className="btn btn-ghost btn-sm gap-1 flex-1"
            onClick={checkMargin}
            disabled={margLoading}
          >
            {margLoading ? <span className="loading loading-spinner loading-xs" /> : <AlertCircle className="w-4 h-4" />}
            Check Margin
          </button>
          <button
            className="btn btn-primary btn-sm gap-1 flex-1"
            onClick={executeBasket}
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner loading-xs" /> : <Send className="w-4 h-4" />}
            Execute Basket ({legs.length} leg{legs.length !== 1 ? "s" : ""})
          </button>
        </div>
      </div>
    </div>
  );
}
