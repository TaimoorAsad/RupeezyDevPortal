/**
 * Formatting helpers for numbers, currencies, and dates.
 */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatINR  = (v) => INR.format(Number(v) || 0);
export const formatNum  = (v, d = 2) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(v) || 0);
export const formatPct  = (v) => `${(Number(v) || 0).toFixed(2)}%`;
export const formatDate = (v) =>
  v ? new Date(v).toLocaleString("en-IN", { hour12: false }) : "—";
export const formatTime = (v) =>
  v ? new Date(v).toLocaleTimeString("en-IN", { hour12: false }) : "—";

export const pnlClass = (v) =>
  Number(v) >= 0 ? "text-success" : "text-error";

export const pnlSign = (v) =>
  Number(v) >= 0 ? `+${formatINR(v)}` : formatINR(v);

export const badgeVariant = (status) => {
  const s = (status || "").toUpperCase();
  if (["COMPLETE", "FILLED"].includes(s)) return "badge-success";
  if (["REJECTED", "CANCELLED"].includes(s)) return "badge-error";
  if (["OPEN", "TRIGGER_PENDING"].includes(s)) return "badge-warning";
  return "badge-ghost";
};
