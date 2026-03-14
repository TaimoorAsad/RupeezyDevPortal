import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

// Demo: realistic base prices for common tokens
const DEMO_BASES = {
  "NSE_EQ-2885":  2867.30,   // RELIANCE
  "NSE_EQ-1594":  1558.90,   // INFY
  "NSE_EQ-2953":  3921.20,   // TCS
  "NSE_EQ-1333":  1632.45,   // HDFCBANK
  "NSE_EQ-3787":   412.35,   // WIPRO
  "NSE_EQ-1270":   985.60,   // ICICIBANK
  "NSE_EQ-26000": 24186.50,  // NIFTY
};

function randTick(base) {
  const pct   = (Math.random() - 0.48) * 0.003; // slight upward bias
  const price = parseFloat((base * (1 + pct)).toFixed(2));
  const change = parseFloat((price - base).toFixed(2));
  const changePct = parseFloat(((change / base) * 100).toFixed(2));
  return { price, change, changePct };
}

export function SocketProvider({ children }) {
  const { authenticated, demo } = useAuth();
  const socketRef  = useRef(null);
  const demoPrices = useRef({ ...DEMO_BASES }); // mutable running prices for demo
  const [priceMap,      setPriceMap]      = useState({});
  const [orderUpdates,  setOrderUpdates]  = useState([]);

  // Real WebSocket (non-demo)
  useEffect(() => {
    if (!authenticated || demo) return;

    const socket = io("/", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("price_update", (data) => {
      setPriceMap((prev) => ({
        ...prev,
        [`${data.exchange}-${data.token}`]: data,
      }));
    });

    socket.on("order_update", (data) => {
      setOrderUpdates((prev) => [data, ...prev.slice(0, 49)]);
    });

    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authenticated, demo]);

  // Demo: simulate price ticks every ~1.5 s
  useEffect(() => {
    if (!demo) return;

    // Seed initial price map from bases
    const initial = {};
    for (const [key, base] of Object.entries(DEMO_BASES)) {
      const [exchange, token] = key.split("-");
      initial[key] = { exchange, token: Number(token), ltp: base, change: 0, pct: 0 };
    }
    setPriceMap(initial);

    const id = setInterval(() => {
      const updates = {};
      for (const [key, currentPrice] of Object.entries(demoPrices.current)) {
        const { price, change, changePct } = randTick(currentPrice);
        demoPrices.current[key] = price;
        const [exchange, token] = key.split("-");
        updates[key] = {
          exchange,
          token: Number(token),
          ltp:    price,
          change,
          change_percent: changePct,
        };
      }
      setPriceMap((prev) => ({ ...prev, ...updates }));
    }, 1500);

    return () => clearInterval(id);
  }, [demo]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, priceMap, orderUpdates }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
