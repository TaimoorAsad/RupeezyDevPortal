import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getAuthStatus, logout as apiLogout } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authenticated,   setAuthenticated]   = useState(false);
  const [wsConnected,     setWsConnected]     = useState(false);
  const [demo,            setDemo]            = useState(false);
  const [tokenExpiresAt,  setTokenExpiresAt]  = useState(null);
  const [loading,         setLoading]         = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const res = await getAuthStatus();
      setAuthenticated(res.data.authenticated);
      setWsConnected(res.data.ws_status?.connected ?? false);
      setDemo(res.data.demo ?? false);
      setTokenExpiresAt(res.data.token_expires_at ?? null);
    } catch {
      setAuthenticated(false);
      setDemo(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const logout = async () => {
    await apiLogout();
    setAuthenticated(false);
    setWsConnected(false);
    setDemo(false);
    setTokenExpiresAt(null);
  };

  return (
    <AuthContext.Provider
      value={{ authenticated, wsConnected, demo, tokenExpiresAt, loading, setAuthenticated, setWsConnected, setDemo, checkStatus, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
};
