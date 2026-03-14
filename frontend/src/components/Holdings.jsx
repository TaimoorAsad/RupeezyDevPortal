import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { RefreshCw } from "lucide-react";
import { getHoldings } from "../utils/api";
import { formatINR, formatNum, formatPct, pnlClass, pnlSign } from "../utils/format";
import { useSocket } from "../context/SocketContext";

export default function Holdings() {
  const [holdings, setHoldings] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const { priceMap } = useSocket() ?? {};

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getHoldings();
      const list = res.data?.data?.holdings ?? res.data?.data ?? [];
      setHoldings(Array.isArray(list) ? list : []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const enriched = holdings.map((h) => {
    const key    = `NSE_EQ-${h.token ?? h.instrument_token}`;
    const ltp    = priceMap?.[key]?.ltp ?? h.ltp ?? h.last_price ?? 0;
    const avgBuy = h.average_price ?? h.average_buy_price ?? 0;
    const qty    = h.quantity ?? 0;
    const curVal = ltp * qty;
    const invVal = avgBuy * qty;
    const pnl    = curVal - invVal;
    const pct    = invVal > 0 ? (pnl / invVal) * 100 : 0;
    return { ...h, live_ltp: ltp, current_value: curVal, invested_value: invVal, live_pnl: pnl, pnl_pct: pct };
  });

  const totalInvested = enriched.reduce((s, h) => s + h.invested_value, 0);
  const totalCurrent  = enriched.reduce((s, h) => s + h.current_value,  0);
  const totalPnl      = totalCurrent - totalInvested;
  const totalPct      = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  return (
    <div className="card bg-base-200 border border-base-300 h-full flex flex-col">
      <div className="card-body p-4 gap-3 flex flex-col min-h-0">
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="card-title text-base font-semibold">Holdings</h2>
            {enriched.length > 0 && (
              <div className="text-xs mt-0.5 flex gap-3">
                <span className="text-base-content/50">
                  Invested: <span className="font-mono text-base-content/80">{formatINR(totalInvested)}</span>
                </span>
                <span className="text-base-content/50">
                  Current: <span className="font-mono text-base-content/80">{formatINR(totalCurrent)}</span>
                </span>
                <span className={`font-mono font-bold ${pnlClass(totalPnl)}`}>
                  {pnlSign(totalPnl)} ({formatPct(totalPct)})
                </span>
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-xs gap-1" onClick={fetch} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="overflow-auto flex-1 scrollbar-thin rounded-lg border border-base-300">
          <table className="table table-xs table-pin-rows w-full">
            <thead>
              <tr className="bg-base-300 text-base-content/70">
                <th>Symbol</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Avg Buy</th>
                <th className="text-right">LTP</th>
                <th className="text-right">Current Value</th>
                <th className="text-right">P&L</th>
                <th className="text-right">P&L %</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    <span className="loading loading-spinner loading-md" />
                  </td>
                </tr>
              )}
              {!loading && enriched.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-base-content/40 text-sm">
                    No holdings found
                  </td>
                </tr>
              )}
              {!loading && enriched.map((h, i) => (
                <tr key={i} className="hover:bg-base-300/40 transition-colors">
                  <td>
                    <div className="font-medium text-xs">{h.tradingsymbol ?? h.symbol}</div>
                    <div className="text-xs text-base-content/40">{h.exchange ?? "NSE"}</div>
                  </td>
                  <td className="text-right font-mono text-xs">{h.quantity}</td>
                  <td className="text-right font-mono text-xs">{formatNum(h.average_price ?? h.average_buy_price ?? 0)}</td>
                  <td className="text-right font-mono text-xs font-semibold text-accent">{formatNum(h.live_ltp)}</td>
                  <td className="text-right font-mono text-xs">{formatINR(h.current_value)}</td>
                  <td className={`text-right font-mono text-xs font-semibold ${pnlClass(h.live_pnl)}`}>
                    {pnlSign(h.live_pnl)}
                  </td>
                  <td className={`text-right font-mono text-xs font-semibold ${pnlClass(h.pnl_pct)}`}>
                    {formatPct(h.pnl_pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-base-content/40 flex-shrink-0">
          {enriched.length} holding{enriched.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
