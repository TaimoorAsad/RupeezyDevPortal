import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { X, CalendarClock, Search, Clock } from "lucide-react";
import axios from "axios";
import { searchInstruments } from "../utils/api";

const EXCHANGES    = ["NSE_EQ", "NSE_FO", "NSE_CUR", "MCX", "BSE_EQ"];
const SIDES        = ["BUY", "SELL"];
const PRODUCTS     = ["DELIVERY", "INTRADAY", "MTF"];
const VARIETIES    = [
  "REGULAR_MARKET_ORDER",
  "REGULAR_LIMIT_ORDER",
  "STOP_LIMIT_ORDER",
  "STOP_MARKET_ORDER",
];
const VALIDITIES   = ["DAY", "IOC", "AFTER_MARKET"];

// Preset times common in Indian markets
const PRESETS = [
  { label: "Market Open",    time: "09:15" },
  { label: "9:30 AM",        time: "09:30" },
  { label: "10:00 AM",       time: "10:00" },
  { label: "12:00 PM",       time: "12:00" },
  { label: "2:00 PM",        time: "14:00" },
  { label: "3:15 PM",        time: "15:15" },
  { label: "Market Close",   time: "15:29" },
];

function todayAt(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

function tomorrowAt(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d.toISOString().slice(0, 16);
}

// Minimum datetime-local value = now + 30 seconds
function minDatetime() {
  return new Date(Date.now() + 30000).toISOString().slice(0, 16);
}

export default function ScheduleOrderModal({ onClose, onCreated, prefill = {} }) {
  const [form, setForm] = useState({
    exchange:         prefill.exchange         ?? "NSE_EQ",
    token:            prefill.token            ?? "",
    symbol:           prefill.symbol           ?? "",
    transaction_type: prefill.transaction_type ?? "BUY",
    product:          prefill.product          ?? "INTRADAY",
    variety:          prefill.variety          ?? "REGULAR_LIMIT_ORDER",
    quantity:         prefill.quantity         ?? "",
    price:            prefill.price            ?? "",
    trigger_price:    prefill.trigger_price    ?? "0",
    validity:         prefill.validity         ?? "DAY",
    scheduled_time:   prefill.scheduled_time   ?? todayAt("09:15"),
  });

  const [submitting, setSubmitting] = useState(false);
  const [searchQ,    setSearchQ]    = useState("");
  const [searchRes,  setSearchRes]  = useState([]);

  // Symbol search
  useEffect(() => {
    if (searchQ.length < 2) { setSearchRes([]); return; }
    const tid = setTimeout(async () => {
      try {
        const res = await searchInstruments(searchQ, form.exchange);
        setSearchRes(res.data?.data?.slice(0, 8) ?? []);
      } catch { setSearchRes([]); }
    }, 300);
    return () => clearTimeout(tid);
  }, [searchQ, form.exchange]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const isMarket = form.variety.includes("MARKET");
  const isSL     = form.variety.startsWith("STOP");

  const validate = () => {
    if (!form.token)    return "Search and select a symbol first.";
    if (!form.quantity || Number(form.quantity) <= 0) return "Quantity must be > 0.";
    if (!isMarket && (!form.price || Number(form.price) <= 0)) return "Enter a valid price.";
    if (!form.scheduled_time) return "Pick a schedule time.";
    if (new Date(form.scheduled_time) <= new Date()) return "Scheduled time must be in the future.";
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }

    setSubmitting(true);
    try {
      await axios.post("/api/scheduled-orders", {
        ...form,
        token:         Number(form.token),
        quantity:      Number(form.quantity),
        price:         isMarket ? 0 : Number(form.price),
        trigger_price: Number(form.trigger_price) || 0,
        // Convert local datetime string to ISO-8601 with seconds
        scheduled_time: new Date(form.scheduled_time).toISOString().slice(0, 19),
      }, { withCredentials: true });

      toast.success(`Order scheduled for ${new Date(form.scheduled_time).toLocaleString("en-IN")}`);
      onCreated?.();
    } catch (err) {
      toast.error(err.response?.data?.message ?? err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg bg-base-100 border border-base-300 p-0 overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-base-300">
          <h3 className="font-semibold flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            Schedule an Order
          </h3>
          <button className="btn btn-ghost btn-xs btn-circle" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 flex flex-col gap-4">

          {/* ── Time ── */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-base-content/70 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Fire Order At
            </label>
            <input
              type="datetime-local"
              className="input input-bordered input-sm w-full"
              value={form.scheduled_time}
              min={minDatetime()}
              onChange={(e) => set("scheduled_time", e.target.value)}
              required
            />
            {/* Quick presets */}
            <div className="flex flex-wrap gap-1 mt-0.5">
              {PRESETS.map((p) => {
                const val  = todayAt(p.time);
                const val2 = tomorrowAt(p.time);
                const target = new Date(val) > new Date() ? val : val2;
                return (
                  <button
                    key={p.time}
                    type="button"
                    className={`btn btn-xs ${form.scheduled_time === target ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => set("scheduled_time", target)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Symbol ── */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-base-content/70">Exchange</label>
              <select
                className="select select-bordered select-sm w-full mt-1"
                value={form.exchange}
                onChange={(e) => { set("exchange", e.target.value); set("token", ""); set("symbol", ""); }}
              >
                {EXCHANGES.map((ex) => <option key={ex}>{ex}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-base-content/70">Symbol</label>
              <div className="relative mt-1">
                <label className="input input-bordered input-sm flex items-center gap-1.5">
                  <Search className="w-3 h-3 text-base-content/40 shrink-0" />
                  <input
                    className="grow bg-transparent outline-none text-sm"
                    placeholder={form.symbol || "Search…"}
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                  />
                  {form.symbol && (
                    <span className="badge badge-primary badge-sm truncate max-w-[100px]">
                      {form.symbol}
                    </span>
                  )}
                </label>
                {searchRes.length > 0 && (
                  <ul className="absolute top-full mt-1 left-0 w-full bg-base-200 border border-base-300 rounded-lg z-50 shadow-xl max-h-40 overflow-y-auto">
                    {searchRes.map((item, i) => (
                      <li
                        key={i}
                        className="px-3 py-1.5 hover:bg-base-300 cursor-pointer text-xs flex justify-between"
                        onClick={() => {
                          set("token", item.token ?? item.instrument_token);
                          set("symbol", item.tradingsymbol ?? item.symbol);
                          setSearchQ(""); setSearchRes([]);
                        }}
                      >
                        <span className="font-medium">{item.tradingsymbol ?? item.symbol}</span>
                        <span className="text-base-content/40 font-mono">{item.token ?? item.instrument_token}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* ── Side + Product ── */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-base-content/70">Side</label>
              <div className="flex gap-1 mt-1">
                {SIDES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`btn btn-sm flex-1 ${
                      form.transaction_type === s
                        ? s === "BUY" ? "btn-success" : "btn-error"
                        : "btn-ghost"
                    }`}
                    onClick={() => set("transaction_type", s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-base-content/70">Product</label>
              <select
                className="select select-bordered select-sm w-full mt-1"
                value={form.product}
                onChange={(e) => set("product", e.target.value)}
              >
                {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* ── Variety + Validity ── */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-base-content/70">Order Type</label>
              <select
                className="select select-bordered select-sm w-full mt-1"
                value={form.variety}
                onChange={(e) => set("variety", e.target.value)}
              >
                {VARIETIES.map((v) => <option key={v} value={v}>{v.replace(/_ORDER$/, "")}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-base-content/70">Validity</label>
              <select
                className="select select-bordered select-sm w-full mt-1"
                value={form.validity}
                onChange={(e) => set("validity", e.target.value)}
              >
                {VALIDITIES.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* ── Qty + Price ── */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-base-content/70">Quantity</label>
              <input
                type="number" min="1"
                className="input input-bordered input-sm w-full mt-1"
                placeholder="Qty"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-base-content/70">
                Price {isMarket && <span className="text-base-content/40">(market)</span>}
              </label>
              <input
                type="number" min="0" step="0.05"
                className="input input-bordered input-sm w-full mt-1"
                placeholder="0.00"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                disabled={isMarket}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-base-content/70">
                Trigger {!isSL && <span className="text-base-content/40">(optional)</span>}
              </label>
              <input
                type="number" min="0" step="0.05"
                className="input input-bordered input-sm w-full mt-1"
                placeholder="0.00"
                value={form.trigger_price}
                onChange={(e) => set("trigger_price", e.target.value)}
                disabled={!isSL}
              />
            </div>
          </div>

          {/* Summary */}
          {form.symbol && form.quantity && (
            <div className="bg-base-200 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
              <CalendarClock className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                <span className={form.transaction_type === "BUY" ? "text-success font-semibold" : "text-error font-semibold"}>
                  {form.transaction_type}
                </span>
                {" "}{form.quantity} × <span className="font-medium">{form.symbol}</span>
                {!isMarket && form.price && ` @ ₹${form.price}`}
                {" "}will fire at{" "}
                <span className="font-medium">
                  {new Date(form.scheduled_time).toLocaleString("en-IN", { hour12: true })}
                </span>
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm gap-1.5" disabled={submitting}>
              {submitting
                ? <span className="loading loading-spinner loading-xs" />
                : <CalendarClock className="w-3.5 h-3.5" />}
              Schedule Order
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
