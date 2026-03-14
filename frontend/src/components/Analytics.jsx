import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { RefreshCw, TrendingUp, TrendingDown, Target, Zap, AlertTriangle, Award } from "lucide-react";
import axios from "axios";
import { formatINR, formatNum, formatPct, pnlClass, pnlSign } from "../utils/format";
import { useInterval } from "../hooks/useInterval";

// ── Custom tooltip ────────────────────────────────────────────────────────────
function PnlTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-base-200 border border-base-300 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-base-content/50 mb-1">{label}</div>
      <div className={`font-mono font-bold ${Number(val) >= 0 ? "text-success" : "text-error"}`}>
        {pnlSign(val)}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "text-base-content", bg = "bg-base-300" }) {
  return (
    <div className={`${bg} rounded-xl p-3 flex items-start gap-3`}>
      <div className={`p-2 rounded-lg bg-base-200/50 ${color} shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-base-content/50">{label}</div>
        <div className={`font-mono font-bold text-sm mt-0.5 ${color}`}>{value}</div>
        {sub && <div className="text-xs text-base-content/40 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get("/api/analytics", { withCredentials: true });
      setData(res.data?.data ?? null);
    } catch (err) {
      if (!silent) toast.error(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  useInterval(() => fetch(true), 60000);

  // Per-symbol P&L aggregation for bar chart
  const symPnl = React.useMemo(() => {
    if (!data?.trades) return [];
    const map = {};
    data.trades.forEach((t) => {
      map[t.symbol] = (map[t.symbol] || 0) + t.pnl;
    });
    return Object.entries(map)
      .map(([symbol, pnl]) => ({ symbol, pnl: parseFloat(pnl.toFixed(2)) }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [data]);

  // Format equity curve time axis
  const equityCurve = React.useMemo(() => {
    if (!data?.equity_curve) return [];
    return data.equity_curve.map((pt) => ({
      ...pt,
      label: pt.time
        ? new Date(pt.time).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
        : "",
    }));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-base-content/40 text-sm">
        No trade data available
      </div>
    );
  }

  const pnlPositive = data.total_pnl >= 0;

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto scrollbar-thin pb-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold">Trade Analytics</h2>
          <p className="text-xs text-base-content/50 mt-0.5">
            Based on {data.total_trades} completed trade{data.total_trades !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn btn-ghost btn-xs gap-1" onClick={() => fetch()} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-shrink-0">
        <StatCard
          icon={pnlPositive ? TrendingUp : TrendingDown}
          label="Total P&L"
          value={pnlSign(data.total_pnl)}
          color={pnlPositive ? "text-success" : "text-error"}
        />
        <StatCard
          icon={Target}
          label="Win Rate"
          value={`${data.win_rate}%`}
          sub={`${data.winners}W / ${data.losers}L`}
          color={data.win_rate >= 50 ? "text-success" : "text-warning"}
        />
        <StatCard
          icon={Zap}
          label="Profit Factor"
          value={formatNum(data.profit_factor)}
          sub="Gross profit / Gross loss"
          color={data.profit_factor >= 1.5 ? "text-success" : data.profit_factor >= 1 ? "text-warning" : "text-error"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Max Drawdown"
          value={formatINR(data.max_drawdown)}
          color="text-error"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-shrink-0">
        <StatCard icon={Award}       label="Best Trade"  value={pnlSign(data.best_trade)}  color="text-success" />
        <StatCard icon={TrendingDown} label="Worst Trade" value={pnlSign(data.worst_trade)} color="text-error"   />
        <StatCard icon={TrendingUp}   label="Avg Profit"  value={formatINR(data.avg_profit)} color="text-success" />
        <StatCard icon={TrendingDown} label="Avg Loss"    value={formatINR(data.avg_loss)}   color="text-error"   />
      </div>

      {/* Equity curve */}
      <div className="card bg-base-200 border border-base-300 flex-shrink-0">
        <div className="card-body p-4 gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Equity Curve</h3>
            <span className={`text-xs font-mono font-bold ${pnlClass(data.total_pnl)}`}>
              {pnlSign(data.total_pnl)}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={equityCurve} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={pnlPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={pnlPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<PnlTooltip />} />
              <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="value"
                stroke={pnlPositive ? "#22c55e" : "#ef4444"}
                strokeWidth={2}
                fill="url(#pnlGrad)"
                dot={false}
                activeDot={{ r: 4, fill: pnlPositive ? "#22c55e" : "#ef4444" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-symbol P&L */}
      {symPnl.length > 0 && (
        <div className="card bg-base-200 border border-base-300 flex-shrink-0">
          <div className="card-body p-4 gap-3">
            <h3 className="font-semibold text-sm">P&L by Symbol</h3>
            <ResponsiveContainer width="100%" height={Math.min(symPnl.length * 36 + 20, 240)}>
              <BarChart data={symPnl} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `₹${(v/1000).toFixed(1)}k`} />
                <YAxis type="category" dataKey="symbol" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
                <Tooltip
                  formatter={(v) => [pnlSign(v), "P&L"]}
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <ReferenceLine x={0} stroke="#334155" />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                  {symPnl.map((entry, i) => (
                    <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Trade log */}
      {data.trades?.length > 0 && (
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body p-4 gap-3">
            <h3 className="font-semibold text-sm">Trade Log <span className="text-base-content/40 font-normal text-xs">(last 50)</span></h3>
            <div className="overflow-auto max-h-72 scrollbar-thin rounded-lg border border-base-300">
              <table className="table table-xs w-full">
                <thead>
                  <tr className="bg-base-300 text-base-content/70">
                    <th>Symbol</th>
                    <th>Side</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Entry</th>
                    <th className="text-right">Exit</th>
                    <th className="text-right">P&L</th>
                    <th className="text-right">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.trades].reverse().map((t, i) => {
                    const ret = ((t.exit - t.entry) / t.entry * 100).toFixed(2);
                    return (
                      <tr key={i} className="hover:bg-base-300/40">
                        <td className="font-medium text-xs">{t.symbol}</td>
                        <td><span className="badge badge-xs badge-success">{t.side}</span></td>
                        <td className="text-right font-mono text-xs">{t.qty}</td>
                        <td className="text-right font-mono text-xs">{formatNum(t.entry)}</td>
                        <td className="text-right font-mono text-xs">{formatNum(t.exit)}</td>
                        <td className={`text-right font-mono text-xs font-semibold ${pnlClass(t.pnl)}`}>
                          {pnlSign(t.pnl)}
                        </td>
                        <td className={`text-right font-mono text-xs ${pnlClass(ret)}`}>
                          {Number(ret) >= 0 ? "+" : ""}{ret}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
