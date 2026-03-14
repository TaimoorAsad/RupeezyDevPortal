/**
 * Axios API client with automatic error normalisation.
 * All requests are sent with credentials (session cookies).
 */

import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const data    = err.response?.data;
    const message = data?.message || err.response?.statusText || err.message || "Unknown error";

    // If Rupeezy session expired, redirect to setup page
    if (err.response?.status === 401 && data?.reauth) {
      import("react-hot-toast").then(({ default: toast }) => {
        toast.error("Session expired — please log in again.", { id: "reauth" });
      });
      // Small delay so the toast shows before navigation
      setTimeout(() => { window.location.href = "/setup"; }, 1200);
    }

    return Promise.reject(new Error(message));
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const getAuthConfig  = ()  => api.get("/auth/config");
export const getLoginUrl    = (d) => api.post("/auth/login-url", d);
export const exchangeToken  = (d) => api.post("/auth/exchange-token", d);
export const setAccessToken = (d) => api.post("/auth/set-token", d);
export const getAuthStatus  = ()  => api.get("/auth/status");
export const logout         = ()  => api.post("/auth/logout");

// ── Orders ────────────────────────────────────────────────────────────────────
export const getOrders      = (params) => api.get("/orders", { params });
export const placeOrder     = (d)      => api.post("/orders", d);
export const modifyOrder    = (id, d)  => api.put(`/orders/${id}`, d);
export const cancelOrder    = (id)     => api.delete(`/orders/${id}`);
export const getOrderHistory= (id)     => api.get(`/orders/${id}/history`);
export const placeBasket    = (legs)   => api.post("/basket-orders", legs);

// ── Market data ───────────────────────────────────────────────────────────────
export const getQuotes      = (instruments, mode = "LTP") =>
  api.post("/quotes", { instruments, mode });
export const getPositions   = ()  => api.get("/positions");
export const getHoldings    = ()  => api.get("/holdings");
export const getFunds       = ()  => api.get("/funds");
export const getMargins     = (d) => api.post("/margins", d);
export const getOrderMargins= (d) => api.post("/order-margins", d);
export const searchInstruments = (q, exchange = "NSE_EQ") =>
  api.get("/search", { params: { q, exchange } });

// ── WebSocket subscriptions ───────────────────────────────────────────────────
export const wsSubscribe    = (d) => api.post("/ws/subscribe", d);
export const wsUnsubscribe  = (d) => api.post("/ws/unsubscribe", d);
export const wsStatus       = ()  => api.get("/ws/status");
