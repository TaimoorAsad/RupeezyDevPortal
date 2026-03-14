import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";
import toast from "react-hot-toast";
import { RefreshCw, Search } from "lucide-react";
import axios from "axios";
import { searchInstruments } from "../utils/api";
import { formatNum } from "../utils/format";
import { useSocket } from "../context/SocketContext";

const TIMEFRAMES = [
  { label: "1m",  value: "1"  },
  { label: "5m",  value: "5"  },
  { label: "15m", value: "15" },
  { label: "30m", value: "30" },
  { label: "1h",  value: "60" },
  { label: "1D",  value: "1D" },
  { label: "1W",  value: "1W" },
];

const EXCHANGES = ["NSE_EQ", "NSE_FO", "NSE_CUR", "MCX", "BSE_EQ"];

// Default symbol per exchange — shown as quick-access presets
const EXCHANGE_DEFAULTS = {
  NSE_EQ:  { label: "NIFTY 50", token: 26000 },
  NSE_FO:  null,   // user must search
  NSE_CUR: null,
  MCX:     null,
  BSE_EQ:  { label: "SENSEX",   token: 1 },
};

const POPULAR = [
  { label: "NIFTY 50", exchange: "NSE_EQ", token: 26000 },
  { label: "RELIANCE", exchange: "NSE_EQ", token: 2885  },
  { label: "TCS",      exchange: "NSE_EQ", token: 2953  },
  { label: "INFY",     exchange: "NSE_EQ", token: 1594  },
  { label: "HDFC",     exchange: "NSE_EQ", token: 1333  },
];

export default function CandleChart() {
  const chartContainerRef = useRef(null);
  const chartRef          = useRef(null);
  const candleRef         = useRef(null);
  const volRef            = useRef(null);

  const [exchange,  setExchange]  = useState("NSE_EQ");
  const [token,     setToken]     = useState(26000);
  const [symbol,    setSymbol]    = useState("NIFTY 50");
  const [needSearch, setNeedSearch] = useState(false);
  const [timeframe, setTimeframe] = useState("5");
  const [loading,   setLoading]   = useState(false);
  const [hovered,   setHovered]   = useState(null);
  const [searchQ,   setSearchQ]   = useState("");
  const [searchRes, setSearchRes] = useState([]);

  const { priceMap } = useSocket() ?? {};

  // ── Build chart once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "#0f172a" },
        textColor:  "#94a3b8",
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#334155" },
      timeScale: {
        borderColor:    "#334155",
        timeVisible:    true,
        secondsVisible: false,
      },
      width:  chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 420,
    });

    // v5: use addSeries(SeriesType, options)
    const candle = chart.addSeries(CandlestickSeries, {
      upColor:         "#22c55e",
      downColor:       "#ef4444",
      borderUpColor:   "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor:     "#22c55e",
      wickDownColor:   "#ef4444",
    });

    const vol = chart.addSeries(HistogramSeries, {
      color:        "#6366f130",
      priceFormat:  { type: "volume" },
      priceScaleId: "volume",
    });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) { setHovered(null); return; }
      const c = param.seriesData.get(candle);
      if (c) setHovered(c);
    });

    chartRef.current  = chart;
    candleRef.current = candle;
    volRef.current    = vol;

    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width:  chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 420,
        });
      }
    });
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current  = null;
      candleRef.current = null;
      volRef.current    = null;
    };
  }, []);

  // ── Fetch OHLCV ───────────────────────────────────────────────────────────
  const fetchCandles = useCallback(async () => {
    if (!token || needSearch || !candleRef.current) return;
    setLoading(true);
    try {
      const res = await axios.get("/api/candles", {
        params: { exchange, token, resolution: timeframe },
        withCredentials: true,
      });
      const candles = res.data?.data?.candles ?? [];
      if (!candles.length) {
        toast("No candle data returned for this symbol/timeframe.");
        return;
      }
      const sorted = [...candles].sort((a, b) => a.time - b.time);
      candleRef.current.setData(sorted);
      volRef.current.setData(
        sorted.map((c) => ({
          time:  c.time,
          value: c.volume,
          color: c.close >= c.open ? "#22c55e30" : "#ef444430",
        }))
      );
      chartRef.current.timeScale().fitContent();
    } catch (err) {
      toast.error(err.message ?? "Failed to load candles");
    } finally {
      setLoading(false);
    }
  }, [exchange, token, timeframe]);

  useEffect(() => { fetchCandles(); }, [fetchCandles]);

  // ── Live LTP tick → update last candle ───────────────────────────────────
  useEffect(() => {
    if (!priceMap || !candleRef.current) return;
    const upd = priceMap[`${exchange}-${token}`];
    if (!upd?.ltp) return;
    const now = Math.floor(Date.now() / 1000);
    try {
      candleRef.current.update({
        time:  now,
        open:  upd.ltp,
        high:  upd.ltp,
        low:   upd.ltp,
        close: upd.ltp,
      });
    } catch {}
  }, [priceMap, exchange, token]);

  // ── Symbol search ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchQ.length < 2) { setSearchRes([]); return; }
    const tid = setTimeout(async () => {
      try {
        const res = await searchInstruments(searchQ, exchange);
        setSearchRes(res.data?.data?.slice(0, 8) ?? []);
      } catch { setSearchRes([]); }
    }, 300);
    return () => clearTimeout(tid);
  }, [searchQ, exchange]);

  const selectSymbol = (item) => {
    setToken(item.token ?? item.instrument_token);
    setSymbol(item.tradingsymbol ?? item.symbol);
    setNeedSearch(false);
    setSearchQ("");
    setSearchRes([]);
  };

  const livePrice = priceMap?.[`${exchange}-${token}`]?.ltp;

  return (
    <div className="card bg-base-200 border border-base-300 h-full flex flex-col">
      <div className="card-body p-3 gap-2 flex flex-col h-full min-h-0">

        {/* ── Top toolbar ── */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <select
            className="select select-bordered select-xs"
            value={exchange}
            onChange={(e) => {
              const ex = e.target.value;
              setExchange(ex);
              const def = EXCHANGE_DEFAULTS[ex];
              if (def) {
                setToken(def.token);
                setSymbol(def.label);
                setNeedSearch(false);
              } else {
                setToken(null);
                setSymbol("");
                setNeedSearch(true);
                // Clear chart
                if (candleRef.current) candleRef.current.setData([]);
                if (volRef.current)    volRef.current.setData([]);
              }
            }}
          >
            {EXCHANGES.map((ex) => <option key={ex}>{ex}</option>)}
          </select>

          {/* Symbol search */}
          <div className="relative">
            <label className="input input-bordered input-xs h-8 flex items-center gap-1 px-2">
              <Search className="w-3 h-3 text-base-content/40 shrink-0" />
              <input
                className="grow bg-transparent outline-none text-xs w-28"
                placeholder={symbol}
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
            </label>
            {searchRes.length > 0 && (
              <ul className="absolute top-full mt-1 left-0 w-56 bg-base-200 border border-base-300 rounded-lg z-50 shadow-xl max-h-48 overflow-y-auto">
                {searchRes.map((item, i) => (
                  <li
                    key={i}
                    className="px-3 py-1.5 hover:bg-base-300 cursor-pointer text-xs flex justify-between"
                    onClick={() => selectSymbol(item)}
                  >
                    <span className="font-medium">{item.tradingsymbol ?? item.symbol}</span>
                    <span className="text-base-content/40 font-mono text-xs">
                      {item.token ?? item.instrument_token}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick-access symbols */}
          {POPULAR.map((p) => (
            <button
              key={p.token}
              className={`btn btn-xs ${token === p.token ? "btn-primary" : "btn-ghost"}`}
              onClick={() => { setToken(p.token); setSymbol(p.label); setExchange(p.exchange); }}
            >
              {p.label}
            </button>
          ))}

          <div className="flex-1" />

          {livePrice && (
            <span className="font-mono font-bold text-accent text-sm tabular-nums">
              {formatNum(livePrice)}
            </span>
          )}

          <button
            className="btn btn-ghost btn-xs"
            onClick={fetchCandles}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* ── Timeframe row ── */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              className={`btn btn-xs ${timeframe === tf.value ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTimeframe(tf.value)}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* ── OHLCV hover strip ── */}
        <div className="flex gap-3 text-xs font-mono flex-shrink-0 h-4">
          {hovered ? (
            <>
              <span className="text-base-content/50">O <span className="text-base-content">{formatNum(hovered.open)}</span></span>
              <span className="text-success">H {formatNum(hovered.high)}</span>
              <span className="text-error">L {formatNum(hovered.low)}</span>
              <span className={hovered.close >= hovered.open ? "text-success" : "text-error"}>
                C {formatNum(hovered.close)}
              </span>
              {hovered.volume != null && (
                <span className="text-base-content/50">
                  V <span className="text-base-content">{Number(hovered.volume).toLocaleString("en-IN")}</span>
                </span>
              )}
            </>
          ) : (
            <span className="text-base-content/30 text-xs">Hover over a candle to see OHLCV</span>
          )}
        </div>

        {/* ── Chart canvas ── */}
        <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-base-300 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-base-200/70 z-10">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          )}
          {needSearch && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-200/90 z-10 gap-3">
              <Search className="w-8 h-8 text-base-content/30" />
              <div className="text-center">
                <p className="font-semibold text-sm">Search for a symbol</p>
                <p className="text-xs text-base-content/50 mt-1">
                  Type a symbol name in the search box above to load its chart
                </p>
              </div>
            </div>
          )}
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>

        <div className="text-xs text-base-content/30 flex-shrink-0 leading-none">
          {symbol} · {exchange} · token {token} · {TIMEFRAMES.find((t) => t.value === timeframe)?.label}
        </div>
      </div>
    </div>
  );
}
