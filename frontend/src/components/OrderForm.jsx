import React, { useState, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { TrendingUp, TrendingDown, Search, AlertCircle, CheckCircle2, CalendarClock } from "lucide-react";
import { placeOrder, getQuotes, getOrderMargins, searchInstruments } from "../utils/api";
import { formatINR, formatNum } from "../utils/format";
import ScheduleOrderModal from "./ScheduleOrderModal";

const EXCHANGES    = ["NSE_EQ", "NSE_FO", "NSE_CUR", "MCX", "BSE_EQ", "BSE_FO"];
const PRODUCTS     = ["DELIVERY", "INTRADAY", "MTF"];
const VARIETIES    = ["REGULAR_LIMIT_ORDER", "REGULAR_MARKET_ORDER", "STOP_LIMIT_ORDER", "STOP_MARKET_ORDER"];
const VALIDITIES   = ["FULL_DAY", "IMMEDIATE_OR_CANCEL", "AFTER_MARKET"];

const DEFAULT_FORM = {
  exchange: "NSE_EQ",
  token: "",
  symbol: "",
  transaction_type: "BUY",
  product: "DELIVERY",
  variety: "REGULAR_LIMIT_ORDER",
  quantity: "",
  price: "",
  trigger_price: "",
  disclosed_quantity: "",
  validity: "FULL_DAY",
};

export default function OrderForm({ onOrderPlaced }) {
  const [form,        setForm]        = useState(DEFAULT_FORM);
  const [ltp,         setLtp]         = useState(null);
  const [margin,       setMargin]       = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [marginLoad,   setMarginLoad]   = useState(false);
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [searchQ,      setSearchQ]      = useState("");
  const [searchRes,    setSearchRes]    = useState([]);
  const [searching,    setSearching]    = useState(false);

  const isMarket = form.variety === "REGULAR_MARKET_ORDER";
  const isSL     = form.variety === "STOP_LIMIT_ORDER" || form.variety === "STOP_MARKET_ORDER";

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Fetch LTP when exchange + token set
  useEffect(() => {
    if (!form.token || !form.exchange) { setLtp(null); return; }
    const instr = `${form.exchange}-${form.token}`;
    getQuotes([instr], "LTP")
      .then((res) => {
        const d = res.data?.data;
        const price = d?.[instr]?.ltp ?? d?.[0]?.ltp ?? null;
        setLtp(price);
        if (price && !form.price && !isMarket) {
          update("price", String(price));
        }
      })
      .catch(() => setLtp(null));
  }, [form.token, form.exchange]);

  // Symbol search
  useEffect(() => {
    if (!searchQ.trim() || searchQ.length < 2) { setSearchRes([]); return; }
    const tid = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchInstruments(searchQ, form.exchange);
        setSearchRes(res.data?.data?.slice(0, 10) ?? []);
      } catch { setSearchRes([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(tid);
  }, [searchQ, form.exchange]);

  const selectSymbol = (item) => {
    setForm((p) => ({
      ...p,
      token:  String(item.token ?? item.instrument_token ?? ""),
      symbol: item.tradingsymbol ?? item.symbol ?? "",
    }));
    setSearchQ("");
    setSearchRes([]);
  };

  const fetchMargin = async () => {
    if (!form.token || !form.quantity) return;
    setMarginLoad(true);
    try {
      const res = await getOrderMargins({
        exchange:         form.exchange,
        token:            Number(form.token),
        transaction_type: form.transaction_type,
        product:          form.product,
        variety:          form.variety,
        quantity:         Number(form.quantity),
        price:            Number(form.price) || 0,
      });
      setMargin(res.data?.data);
    } catch { setMargin(null); }
    finally { setMarginLoad(false); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.token || !form.quantity) {
      toast.error("Symbol/token and quantity are required.");
      return;
    }
    setConfirmOpen(true);
  };

  const confirmPlace = async () => {
    setConfirmOpen(false);
    setLoading(true);
    try {
      const payload = {
        exchange:           form.exchange,
        token:              Number(form.token),
        transaction_type:   form.transaction_type,
        product:            form.product,
        variety:            form.variety,
        quantity:           Number(form.quantity),
        price:              Number(form.price) || 0,
        trigger_price:      Number(form.trigger_price) || 0,
        disclosed_quantity: Number(form.disclosed_quantity) || 0,
        validity:           form.validity,
      };
      await placeOrder(payload);
      toast.success(`${form.transaction_type} order placed for ${form.symbol || form.token}!`);
      setForm(DEFAULT_FORM);
      setLtp(null);
      setMargin(null);
      onOrderPlaced?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "input input-bordered input-sm w-full font-mono-num";
  const labelCls = "label-text text-xs font-medium text-base-content/70";

  return (
    <>
      <div className="card bg-base-200 border border-base-300 h-full">
        <div className="card-body p-4 gap-4">
          <h2 className="card-title text-base font-semibold">Place Order</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* BUY / SELL toggle */}
            <div className="flex rounded-lg overflow-hidden border border-base-300">
              {["BUY", "SELL"].map((side) => (
                <button
                  key={side}
                  type="button"
                  className={`flex-1 py-2 text-sm font-bold transition-colors flex items-center justify-center gap-1
                    ${form.transaction_type === side
                      ? side === "BUY"
                        ? "bg-success text-white"
                        : "bg-error text-white"
                      : "bg-base-300 text-base-content/50 hover:bg-base-300/80"
                    }`}
                  onClick={() => update("transaction_type", side)}
                >
                  {side === "BUY" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {side}
                </button>
              ))}
            </div>

            {/* Exchange */}
            <div className="form-control gap-1">
              <label className="label py-0"><span className={labelCls}>Exchange</span></label>
              <select
                className="select select-bordered select-sm w-full"
                value={form.exchange}
                onChange={(e) => update("exchange", e.target.value)}
              >
                {EXCHANGES.map((ex) => <option key={ex}>{ex}</option>)}
              </select>
            </div>

            {/* Symbol search */}
            <div className="form-control gap-1 relative">
              <label className="label py-0"><span className={labelCls}>Symbol / Token</span></label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search symbol or enter token..."
                  className={`${inputCls} pr-8`}
                  value={searchQ || form.symbol || form.token}
                  onChange={(e) => {
                    setSearchQ(e.target.value);
                    if (!e.target.value) {
                      setForm((p) => ({ ...p, token: "", symbol: "" }));
                    }
                  }}
                />
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40" />
              </div>
              {searching && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-base-200 border border-base-300 rounded-lg z-50 p-2">
                  <span className="loading loading-spinner loading-xs" />
                </div>
              )}
              {searchRes.length > 0 && (
                <ul className="absolute top-full mt-1 left-0 right-0 bg-base-200 border border-base-300 rounded-lg z-50 shadow-xl max-h-48 overflow-y-auto">
                  {searchRes.map((item, i) => (
                    <li
                      key={i}
                      className="px-3 py-2 hover:bg-base-300 cursor-pointer text-sm flex items-center justify-between"
                      onClick={() => selectSymbol(item)}
                    >
                      <span className="font-medium">{item.tradingsymbol ?? item.symbol}</span>
                      <span className="text-xs text-base-content/50 font-mono">
                        {item.token ?? item.instrument_token}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Manual token entry if no search */}
              {!form.symbol && (
                <input
                  type="number"
                  placeholder="Or enter token directly"
                  className={`${inputCls} mt-1`}
                  value={form.token}
                  onChange={(e) => update("token", e.target.value)}
                />
              )}

              {/* LTP badge */}
              {ltp !== null && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-base-content/50">LTP:</span>
                  <span className="text-xs font-mono font-semibold text-accent">{formatNum(ltp)}</span>
                </div>
              )}
            </div>

            {/* Product + Variety */}
            <div className="grid grid-cols-2 gap-2">
              <div className="form-control gap-1">
                <label className="label py-0"><span className={labelCls}>Product</span></label>
                <select
                  className="select select-bordered select-sm"
                  value={form.product}
                  onChange={(e) => update("product", e.target.value)}
                >
                  {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-control gap-1">
                <label className="label py-0"><span className={labelCls}>Order Type</span></label>
                <select
                  className="select select-bordered select-sm"
                  value={form.variety}
                  onChange={(e) => update("variety", e.target.value)}
                >
                  {VARIETIES.map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>

            {/* Quantity */}
            <div className="form-control gap-1">
              <label className="label py-0"><span className={labelCls}>Quantity</span></label>
              <input
                type="number"
                min="1"
                placeholder="0"
                className={inputCls}
                value={form.quantity}
                onChange={(e) => update("quantity", e.target.value)}
              />
            </div>

            {/* Price (hidden for market orders) */}
            {!isMarket && (
              <div className="form-control gap-1">
                <label className="label py-0"><span className={labelCls}>Price</span></label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  placeholder="0.00"
                  className={inputCls}
                  value={form.price}
                  onChange={(e) => update("price", e.target.value)}
                />
              </div>
            )}

            {/* Trigger price for SL orders */}
            {isSL && (
              <div className="form-control gap-1">
                <label className="label py-0"><span className={labelCls}>Trigger Price</span></label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  placeholder="0.00"
                  className={inputCls}
                  value={form.trigger_price}
                  onChange={(e) => update("trigger_price", e.target.value)}
                />
              </div>
            )}

            {/* Validity */}
            <div className="form-control gap-1">
              <label className="label py-0"><span className={labelCls}>Validity</span></label>
              <select
                className="select select-bordered select-sm"
                value={form.validity}
                onChange={(e) => update("validity", e.target.value)}
              >
                {VALIDITIES.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>

            {/* Margin estimator */}
            <div>
              <button
                type="button"
                className="btn btn-ghost btn-xs gap-1 text-accent"
                onClick={fetchMargin}
                disabled={marginLoad || !form.token || !form.quantity}
              >
                {marginLoad ? <span className="loading loading-spinner loading-xs" /> : <AlertCircle className="w-3 h-3" />}
                Estimate Margin
              </button>
              {margin && (
                <div className="mt-2 rounded-lg bg-base-300 p-2 text-xs grid grid-cols-2 gap-1">
                  <span className="text-base-content/60">Required</span>
                  <span className="font-mono text-right font-semibold">{formatINR(margin.required_margin ?? margin.total ?? 0)}</span>
                  <span className="text-base-content/60">Available</span>
                  <span className="font-mono text-right">{formatINR(margin.available_margin ?? margin.available ?? 0)}</span>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className={`btn btn-sm w-full font-bold ${
                form.transaction_type === "BUY" ? "btn-success" : "btn-error"
              }`}
              disabled={loading}
            >
              {loading ? <span className="loading loading-spinner loading-sm" /> : null}
              {form.transaction_type} {form.symbol || (form.token ? `Token ${form.token}` : "")}
            </button>

            <button
              type="button"
              className="btn btn-sm btn-ghost w-full gap-1.5 text-base-content/60"
              onClick={() => setScheduleOpen(true)}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              Schedule for later
            </button>
          </form>
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmOpen && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Confirm Order
            </h3>
            <div className="py-4 space-y-2 text-sm">
              {[
                ["Side",    form.transaction_type, form.transaction_type === "BUY" ? "text-success" : "text-error"],
                ["Symbol",  form.symbol || form.token],
                ["Exchange",form.exchange],
                ["Qty",     form.quantity],
                ["Type",    form.variety],
                ["Product", form.product],
                !isMarket && ["Price", `₹ ${form.price}`],
                isSL      && ["Trigger", `₹ ${form.trigger_price}`],
              ].filter(Boolean).map(([k, v, cls]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-base-content/60">{k}</span>
                  <span className={`font-semibold font-mono ${cls ?? ""}`}>{v}</span>
                </div>
              ))}
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button
                className={`btn btn-sm ${form.transaction_type === "BUY" ? "btn-success" : "btn-error"}`}
                onClick={confirmPlace}
              >
                Confirm &amp; Place
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setConfirmOpen(false)} />
        </dialog>
      )}

      {scheduleOpen && (
        <ScheduleOrderModal
          prefill={{
            exchange:         form.exchange,
            token:            form.token,
            symbol:           form.symbol,
            transaction_type: form.transaction_type,
            product:          form.product,
            variety:          form.variety,
            quantity:         form.quantity,
            price:            form.price,
            trigger_price:    form.trigger_price,
            validity:         form.validity,
          }}
          onClose={() => setScheduleOpen(false)}
          onCreated={() => {
            setScheduleOpen(false);
            toast.success("Order scheduled!");
          }}
        />
      )}
    </>
  );
}
