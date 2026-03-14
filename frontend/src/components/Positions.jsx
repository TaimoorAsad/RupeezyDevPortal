import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { RefreshCw, XCircle } from "lucide-react";
import { getPositions, placeOrder } from "../utils/api";
import { formatINR, formatNum, pnlClass, pnlSign } from "../utils/format";
import { useSocket } from "../context/SocketContext";
import { useInterval } from "../hooks/useInterval";

export default function Positions() {
  const [positions, setPositions] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [squareing, setSquareing] = useState(false);
  const { priceMap } = useSocket() ?? {};

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getPositions();
      const list = res.data?.data?.positions ?? res.data?.data ?? [];
      setPositions(Array.isArray(list) ? list : []);
    } catch (err) {
      if (!silent) toast.error(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  useInterval(() => fetch(true), 20000);

  // Enrich positions with live LTP from WebSocket
  const enriched = positions.map((p) => {
    const key = `${p.exchange}-${p.token}`;
    const liveLtp = priceMap?.[key]?.ltp ?? null;
    const ltp = liveLtp ?? p.ltp ?? p.last_price ?? 0;
    const qty = (p.buy_quantity ?? 0) - (p.sell_quantity ?? 0);
    const avgPrice = p.average_price ?? p.buy_average ?? 0;
    const livePnl = qty !== 0 ? (ltp - avgPrice) * qty : p.pnl ?? 0;
    return { ...p, live_ltp: ltp, live_pnl: livePnl, net_qty: qty };
  });

  const totalPnl = enriched.reduce((sum, p) => sum + (p.live_pnl ?? 0), 0);

  const squareOff = async (pos) => {
    const qty = Math.abs(pos.net_qty);
    if (!qty) return;
    const side = pos.net_qty > 0 ? "SELL" : "BUY";
    try {
      await placeOrder({
        exchange:         pos.exchange,
        token:            pos.token,
        transaction_type: side,
        product:          pos.product ?? "INTRADAY",
        variety:          "REGULAR_MARKET_ORDER",
        quantity:         qty,
        price:            0,
        trigger_price:    0,
        disclosed_quantity: 0,
        validity:         "FULL_DAY",
      });
      toast.success(`Square-off order placed for ${pos.tradingsymbol ?? pos.token}`);
      fetch(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const squareAllOff = async () => {
    setSquareing(true);
    const open = enriched.filter((p) => p.net_qty !== 0);
    for (const pos of open) {
      await squareOff(pos);
    }
    setSquareing(false);
  };

  return (
    <div className="card bg-base-200 border border-base-300 h-full flex flex-col">
      <div className="card-body p-4 gap-3 flex flex-col min-h-0">
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="card-title text-base font-semibold">Positions</h2>
            <div className="text-xs mt-0.5">
              <span className="text-base-content/50">Total P&L: </span>
              <span className={`font-mono font-bold ${pnlClass(totalPnl)}`}>
                {pnlSign(totalPnl)}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {enriched.some((p) => p.net_qty !== 0) && (
              <button
                className="btn btn-error btn-xs gap-1"
                onClick={squareAllOff}
                disabled={squareing}
              >
                {squareing ? <span className="loading loading-spinner loading-xs" /> : <XCircle className="w-3.5 h-3.5" />}
                Square All
              </button>
            )}
            <button className="btn btn-ghost btn-xs gap-1" onClick={() => fetch()} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="overflow-auto flex-1 scrollbar-thin rounded-lg border border-base-300">
          <table className="table table-xs table-pin-rows w-full">
            <thead>
              <tr className="bg-base-300 text-base-content/70">
                <th>Symbol</th>
                <th className="text-right">Net Qty</th>
                <th className="text-right">Avg Price</th>
                <th className="text-right">LTP</th>
                <th className="text-right">Day P&L</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    <span className="loading loading-spinner loading-md" />
                  </td>
                </tr>
              )}
              {!loading && enriched.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-base-content/40 text-sm">
                    No open positions
                  </td>
                </tr>
              )}
              {!loading && enriched.map((pos, i) => (
                <tr key={i} className="hover:bg-base-300/40 transition-colors">
                  <td>
                    <div className="font-medium text-xs">{pos.tradingsymbol ?? pos.symbol ?? pos.token}</div>
                    <div className="text-xs text-base-content/40">{pos.exchange} · {pos.product}</div>
                  </td>
                  <td className="text-right font-mono text-xs">
                    <span className={pos.net_qty > 0 ? "text-success" : pos.net_qty < 0 ? "text-error" : "text-base-content/50"}>
                      {pos.net_qty > 0 ? "+" : ""}{pos.net_qty}
                    </span>
                  </td>
                  <td className="text-right font-mono text-xs">{formatNum(pos.average_price ?? pos.buy_average ?? 0)}</td>
                  <td className="text-right font-mono text-xs font-semibold text-accent">{formatNum(pos.live_ltp)}</td>
                  <td className={`text-right font-mono text-xs font-semibold ${pnlClass(pos.live_pnl)}`}>
                    {pnlSign(pos.live_pnl)}
                  </td>
                  <td className="text-right">
                    {pos.net_qty !== 0 && (
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        title="Square off"
                        onClick={() => squareOff(pos)}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-base-content/40 flex-shrink-0">
          {enriched.length} position{enriched.length !== 1 ? "s" : ""} · Live P&L via WebSocket
        </div>
      </div>
    </div>
  );
}
