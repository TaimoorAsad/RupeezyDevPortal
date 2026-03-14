import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2, Activity } from "lucide-react";
import { wsSubscribe, wsUnsubscribe, getQuotes } from "../utils/api";
import { formatNum } from "../utils/format";
import { useSocket } from "../context/SocketContext";

const EXCHANGES = ["NSE_EQ", "NSE_FO", "NSE_CUR", "MCX_FO"];

// Predefined popular instruments for quick-add
const PRESETS = [
  { label: "NIFTY 50",  exchange: "NSE_EQ", token: 26000 },
  { label: "SENSEX",    exchange: "NSE_EQ", token: 1 },
  { label: "RELIANCE",  exchange: "NSE_EQ", token: 2885 },
  { label: "INFY",      exchange: "NSE_EQ", token: 1594 },
  { label: "TCS",       exchange: "NSE_EQ", token: 2953 },
  { label: "HDFC BANK", exchange: "NSE_EQ", token: 1333 },
];

function PriceCell({ prev, curr }) {
  const ref      = useRef(null);
  const prevRef  = useRef(prev);
  const changed  = prev !== null && curr !== prev;
  const up       = curr > prev;

  useEffect(() => {
    if (!changed) return;
    const el = ref.current;
    if (!el) return;
    el.classList.remove("flash-green", "flash-red");
    void el.offsetWidth;
    el.classList.add(up ? "flash-green" : "flash-red");
  }, [curr]);

  return (
    <span ref={ref} className={`font-mono font-semibold text-sm tabular-nums ${
      changed ? (up ? "text-success" : "text-error") : "text-accent"
    }`}>
      {curr != null ? formatNum(curr) : "—"}
    </span>
  );
}

export default function Watchlist() {
  const [items,   setItems]   = useState(PRESETS.map((p) => ({ ...p, ltp: null, prevLtp: null, change: null, pct: null })));
  const [newExch, setNewExch] = useState("NSE_EQ");
  const [newTok,  setNewTok]  = useState("");
  const [newLbl,  setNewLbl]  = useState("");
  const { priceMap } = useSocket() ?? {};

  // Subscribe all items on mount
  useEffect(() => {
    items.forEach((item) => {
      wsSubscribe({ exchange: item.exchange, token: item.token, mode: "FULL" }).catch(() => {});
    });
    return () => {
      items.forEach((item) => {
        wsUnsubscribe({ exchange: item.exchange, token: item.token }).catch(() => {});
      });
    };
  }, []);

  // Apply incoming price updates
  useEffect(() => {
    if (!priceMap) return;
    setItems((prev) =>
      prev.map((item) => {
        const key  = `${item.exchange}-${item.token}`;
        const upd  = priceMap[key];
        if (!upd) return item;
        return {
          ...item,
          prevLtp: item.ltp,
          ltp:    upd.ltp ?? item.ltp,
          change: upd.change ?? item.change,
          pct:    upd.change_percent ?? upd.pct ?? item.pct,
          open:   upd.open   ?? item.open,
          high:   upd.high   ?? item.high,
          low:    upd.low    ?? item.low,
          close:  upd.close  ?? item.close,
          volume: upd.volume ?? item.volume,
        };
      })
    );
  }, [priceMap]);

  // Fetch initial LTPs
  useEffect(() => {
    const instruments = items.map((i) => `${i.exchange}-${i.token}`);
    getQuotes(instruments, "FULL").then((res) => {
      const d = res.data?.data ?? {};
      setItems((prev) =>
        prev.map((item) => {
          const key = `${item.exchange}-${item.token}`;
          const q   = d[key] ?? d[String(item.token)] ?? null;
          if (!q) return item;
          return {
            ...item,
            ltp:    q.ltp ?? item.ltp,
            open:   q.open,
            high:   q.high,
            low:    q.low,
            close:  q.close,
            volume: q.volume,
          };
        })
      );
    }).catch(() => {});
  }, []);

  const addItem = async () => {
    const tok = parseInt(newTok);
    if (!tok) { toast.error("Enter a valid token number."); return; }
    if (items.find((i) => i.exchange === newExch && i.token === tok)) {
      toast.error("Already in watchlist."); return;
    }
    const item = { label: newLbl || `${newExch}-${tok}`, exchange: newExch, token: tok, ltp: null, prevLtp: null };
    setItems((p) => [...p, item]);
    try {
      await wsSubscribe({ exchange: newExch, token: tok, mode: "FULL" });
    } catch (err) {
      toast.error(`Subscribe failed: ${err.message}`);
    }
    setNewTok("");
    setNewLbl("");
  };

  const removeItem = async (exchange, token) => {
    setItems((p) => p.filter((i) => !(i.exchange === exchange && i.token === token)));
    try {
      await wsUnsubscribe({ exchange, token });
    } catch {}
  };

  return (
    <div className="card bg-base-200 border border-base-300 h-full flex flex-col">
      <div className="card-body p-4 gap-3 flex flex-col min-h-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="card-title text-base font-semibold">Watchlist</h2>
          <span className="badge badge-xs badge-primary ml-auto">{items.length}</span>
        </div>

        {/* Add symbol row */}
        <div className="flex gap-1 flex-shrink-0">
          <select
            className="select select-bordered select-xs"
            value={newExch}
            onChange={(e) => setNewExch(e.target.value)}
          >
            {EXCHANGES.map((ex) => <option key={ex}>{ex}</option>)}
          </select>
          <input
            type="number"
            placeholder="Token"
            className="input input-bordered input-xs w-24 font-mono"
            value={newTok}
            onChange={(e) => setNewTok(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
          />
          <input
            type="text"
            placeholder="Label"
            className="input input-bordered input-xs flex-1 min-w-0"
            value={newLbl}
            onChange={(e) => setNewLbl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
          />
          <button className="btn btn-primary btn-xs" onClick={addItem}>
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Watchlist rows */}
        <div className="flex-1 overflow-auto scrollbar-thin space-y-1">
          {items.map((item) => (
            <div
              key={`${item.exchange}-${item.token}`}
              className="flex items-center justify-between rounded-lg bg-base-300 px-3 py-2 hover:bg-base-300/80 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{item.label}</div>
                <div className="text-xs text-base-content/40">{item.exchange} · {item.token}</div>
                {(item.open || item.high || item.low) && (
                  <div className="text-xs text-base-content/50 font-mono mt-0.5">
                    O:{formatNum(item.open ?? 0)} H:{formatNum(item.high ?? 0)} L:{formatNum(item.low ?? 0)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 ml-2">
                <div className="text-right">
                  <PriceCell prev={item.prevLtp} curr={item.ltp} />
                  {item.pct != null && (
                    <div className={`text-xs font-mono ${Number(item.pct) >= 0 ? "text-success" : "text-error"}`}>
                      {Number(item.pct) >= 0 ? "+" : ""}{Number(item.pct).toFixed(2)}%
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-ghost btn-xs text-error"
                  onClick={() => removeItem(item.exchange, item.token)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-base-content/40 flex-shrink-0">
          Live prices via WebSocket · click + to add tokens
        </div>
      </div>
    </div>
  );
}
