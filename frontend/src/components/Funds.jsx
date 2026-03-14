import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { RefreshCw, Wallet, TrendingUp, Lock, CreditCard } from "lucide-react";
import { getFunds } from "../utils/api";
import { formatINR } from "../utils/format";
import { useInterval } from "../hooks/useInterval";

function StatCard({ icon: Icon, label, value, sub, color = "text-base-content" }) {
  return (
    <div className="bg-base-300 rounded-xl p-3 flex items-start gap-3">
      <div className={`p-2 rounded-lg bg-base-200 ${color}`}>
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

export default function Funds() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getFunds();
      setData(res.data?.data ?? res.data ?? null);
    } catch (err) {
      if (!silent) toast.error(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  useInterval(() => fetch(true), 30000);

  // Normalise: Vortex API returns a nested structure
  const nse = data?.nse ?? data?.equity ?? {};
  const mcx = data?.mcx ?? data?.commodity ?? {};
  const avail = nse.available_margin ?? nse.net ?? data?.available_margin ?? 0;
  const used  = nse.utilised_margin  ?? nse.used ?? data?.used_margin  ?? 0;
  const coll  = nse.collateral       ?? data?.collateral ?? 0;

  return (
    <div className="card bg-base-200 border border-base-300 h-full">
      <div className="card-body p-4 gap-4">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-base font-semibold">Funds &amp; Margins</h2>
          <button className="btn btn-ghost btn-xs gap-1" onClick={() => fetch()} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && !data && (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-md" />
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                icon={Wallet}
                label="Available Margin"
                value={formatINR(avail)}
                color="text-success"
              />
              <StatCard
                icon={Lock}
                label="Used Margin"
                value={formatINR(used)}
                color="text-warning"
              />
              <StatCard
                icon={CreditCard}
                label="Collateral"
                value={formatINR(coll)}
                color="text-accent"
              />
              <StatCard
                icon={TrendingUp}
                label="Net Available"
                value={formatINR(Number(avail) + Number(coll))}
                color="text-primary"
              />
            </div>

            {/* NSE Breakdown */}
            {Object.keys(nse).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
                  NSE / Equity
                </h3>
                <div className="rounded-lg border border-base-300 overflow-hidden">
                  <table className="table table-xs w-full">
                    <tbody>
                      {Object.entries(nse).map(([k, v]) => (
                        <tr key={k} className="hover:bg-base-300/40">
                          <td className="text-xs text-base-content/60 capitalize">{k.replace(/_/g, " ")}</td>
                          <td className="text-right font-mono text-xs font-medium">
                            {typeof v === "number" ? formatINR(v) : String(v)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MCX Breakdown */}
            {Object.keys(mcx).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
                  MCX / Commodity
                </h3>
                <div className="rounded-lg border border-base-300 overflow-hidden">
                  <table className="table table-xs w-full">
                    <tbody>
                      {Object.entries(mcx).map(([k, v]) => (
                        <tr key={k} className="hover:bg-base-300/40">
                          <td className="text-xs text-base-content/60 capitalize">{k.replace(/_/g, " ")}</td>
                          <td className="text-right font-mono text-xs font-medium">
                            {typeof v === "number" ? formatINR(v) : String(v)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {!loading && !data && (
          <div className="text-center py-8 text-base-content/40 text-sm">
            No funds data available
          </div>
        )}

        <div className="text-xs text-base-content/40">Refreshes every 30s</div>
      </div>
    </div>
  );
}
