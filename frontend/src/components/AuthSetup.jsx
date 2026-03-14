import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { KeyRound, LogIn, Eye, EyeOff, Wifi, FlaskConical, CheckCircle2, AlertCircle } from "lucide-react";
import { getAuthConfig, getLoginUrl, setAccessToken, exchangeToken } from "../utils/api";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function AuthSetup() {
  const { checkStatus } = useAuth();

  // Credentials state — pre-filled from .env when available
  const [apiSecret,     setApiSecret]     = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [accessToken,   setAccessTokenVal] = useState("");
  const [authCode,      setAuthCode]       = useState("");

  // UI state
  const [showSecret,    setShowSecret]    = useState(false);
  const [showToken,     setShowToken]     = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [demoLoading,   setDemoLoading]   = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [tab,           setTab]           = useState("oauth"); // oauth | authcode | token

  // Whether .env already has credentials
  const [envHasSecret,  setEnvHasSecret]  = useState(false);
  const [envHasAppId,   setEnvHasAppId]   = useState(false);
  const [envHasToken,   setEnvHasToken]   = useState(false);

  // Load config from backend (.env presence check)
  useEffect(() => {
    getAuthConfig()
      .then((res) => {
        const cfg = res.data;
        setEnvHasSecret(cfg.has_api_secret);
        setEnvHasAppId(cfg.has_application_id);
        setEnvHasToken(cfg.has_access_token);
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, []);

  const envReady = envHasSecret && envHasAppId;

  const handleOAuth = async () => {
    setLoading(true);
    try {
      // Only send credentials if the user typed something — otherwise the
      // backend will fall back to .env values automatically
      const body = {};
      if (apiSecret.trim())     body.api_secret     = apiSecret.trim();
      if (applicationId.trim()) body.application_id = applicationId.trim();

      const res = await getLoginUrl(body);
      window.open(res.data.login_url, "_blank", "noopener,noreferrer");
      toast.success("Login page opened in a new tab. Authorise there and return here.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectToken = async () => {
    if (!accessToken.trim()) {
      toast.error("Paste your access token.");
      return;
    }
    setLoading(true);
    try {
      await setAccessToken({ access_token: accessToken.trim() });
      toast.success("Access token accepted!");
      await checkStatus();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthCode = async () => {
    // Extract auth= value if user pasted the full URL
    let code = authCode.trim();
    try {
      const urlObj = new URL(code);
      code = urlObj.searchParams.get("auth") || urlObj.searchParams.get("auth_token") || urlObj.searchParams.get("token") || code;
    } catch {
      // not a URL, use as-is
    }
    if (!code) { toast.error("Paste the auth code or the full redirect URL."); return; }
    setLoading(true);
    try {
      await exchangeToken({ auth_token: code });
      toast.success("Authenticated successfully!");
      await checkStatus();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      await axios.post("/api/demo/enable", {}, { withCredentials: true });
      await checkStatus();
      toast.success("Demo mode enabled — explore the full dashboard!");
    } catch {
      toast.error("Could not enable demo mode.");
    } finally {
      setDemoLoading(false);
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-base-content">Rupeezy Dashboard</h1>
          <p className="text-base-content/60 mt-2 text-sm">
            Connect your Rupeezy Vortex account to get started
          </p>
        </div>

        <div className="card bg-base-200 border border-base-300 shadow-xl">
          <div className="card-body gap-4">

            {/* .env status pill */}
            {(envHasSecret || envHasAppId || envHasToken) && (
              <div className={`alert py-2 text-xs ${envReady ? "alert-success" : "alert-warning"}`}>
                {envReady
                  ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                  : <AlertCircle  className="w-4 h-4 shrink-0" />
                }
                <div>
                  <span className="font-semibold">.env detected — </span>
                  {envReady
                    ? "API credentials loaded. Click Login below."
                    : "Partial credentials found. Fill in the missing fields."
                  }
                  {envHasToken && <span className="block mt-0.5 text-base-content/70">Access token present — try the Direct Token tab.</span>}
                </div>
              </div>
            )}

            {/* Tab switcher */}
            <div role="tablist" className="tabs tabs-boxed bg-base-300">
              <button
                role="tab"
                className={`tab tab-sm font-medium ${tab === "oauth" ? "tab-active" : ""}`}
                onClick={() => setTab("oauth")}
              >
                OAuth Login
              </button>
              <button
                role="tab"
                className={`tab tab-sm font-medium ${tab === "authcode" ? "tab-active" : ""}`}
                onClick={() => setTab("authcode")}
              >
                Auth Code
              </button>
              <button
                role="tab"
                className={`tab tab-sm font-medium ${tab === "token" ? "tab-active" : ""}`}
                onClick={() => setTab("token")}
              >
                Access Token
              </button>
            </div>

            {tab === "oauth" && (
              <>
                {envReady ? (
                  /* Credentials already in .env — show a clean one-click login */
                  <div className="alert alert-info text-xs py-2">
                    <Wifi className="w-4 h-4 shrink-0" />
                    <span>
                      Credentials read from <code className="font-mono">.env</code>.
                      Click below to open the Rupeezy login page.
                    </span>
                  </div>
                ) : (
                  /* Missing from .env — show manual entry fields */
                  <>
                    <div className="alert alert-warning text-xs py-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Add credentials to <code className="font-mono">.env</code> to skip these fields next time.</span>
                    </div>

                    {/* API Secret */}
                    <div className="form-control gap-1">
                      <label className="label py-0">
                        <span className="label-text font-medium">API Secret</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showSecret ? "text" : "password"}
                          placeholder="Your Vortex API Secret"
                          className="input input-bordered w-full pr-10 font-mono text-sm"
                          value={apiSecret}
                          onChange={(e) => setApiSecret(e.target.value)}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                          onClick={() => setShowSecret(!showSecret)}
                        >
                          {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Application ID */}
                    <div className="form-control gap-1">
                      <label className="label py-0">
                        <span className="label-text font-medium">Application ID</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Your Vortex Application ID"
                        className="input input-bordered w-full font-mono text-sm"
                        value={applicationId}
                        onChange={(e) => setApplicationId(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <button
                  className="btn btn-primary w-full gap-2"
                  onClick={handleOAuth}
                  disabled={loading || (!envReady && (!apiSecret || !applicationId))}
                >
                  {loading
                    ? <span className="loading loading-spinner loading-sm" />
                    : <LogIn className="w-4 h-4" />
                  }
                  Open Rupeezy Login Page
                </button>
              </>
            )}

            {tab === "authcode" && (
              <>
                <div className="alert alert-info text-xs py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <div>
                    <span className="font-semibold">Redirect went to the wrong site?</span>
                    <span className="block mt-0.5">
                      Paste the full URL you landed on (or just the <code className="font-mono">auth=…</code> value) below.
                      We'll extract the token and exchange it.
                    </span>
                  </div>
                </div>

                <div className="form-control gap-1">
                  <label className="label py-0">
                    <span className="label-text font-medium">Redirect URL or Auth Code</span>
                  </label>
                  <textarea
                    placeholder="Paste the full URL you were redirected to, e.g. https://protrades.in/?auth=eyJ..."
                    className="textarea textarea-bordered w-full font-mono text-xs h-28 resize-none"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                  />
                </div>

                <button
                  className="btn btn-primary w-full gap-2"
                  onClick={handleAuthCode}
                  disabled={loading}
                >
                  {loading
                    ? <span className="loading loading-spinner loading-sm" />
                    : <KeyRound className="w-4 h-4" />
                  }
                  Exchange Auth Code
                </button>
              </>
            )}

            {tab === "token" && (
              <>
                <div className={`alert text-xs py-2 ${envHasToken ? "alert-success" : "alert-warning"}`}>
                  {envHasToken
                    ? <><CheckCircle2 className="w-4 h-4 shrink-0" /><span>Access token found in <code className="font-mono">.env</code> — paste it below or use OAuth to refresh it.</span></>
                    : <span>Use this if you already have an access token from a previous session.</span>
                  }
                </div>

                <div className="form-control gap-1">
                  <label className="label py-0">
                    <span className="label-text font-medium">Access Token</span>
                  </label>
                  <textarea
                    placeholder="Paste your access token here"
                    className="textarea textarea-bordered w-full font-mono text-xs h-24 resize-none"
                    value={accessToken}
                    onChange={(e) => setAccessTokenVal(e.target.value)}
                  />
                </div>

                <button
                  className="btn btn-primary w-full gap-2"
                  onClick={handleDirectToken}
                  disabled={loading}
                >
                  {loading
                    ? <span className="loading loading-spinner loading-sm" />
                    : <KeyRound className="w-4 h-4" />
                  }
                  Set Access Token
                </button>
              </>
            )}

            <div className="divider text-xs text-base-content/40 my-1">or</div>

            {/* Demo mode */}
            <button
              className="btn btn-outline btn-warning w-full gap-2"
              onClick={handleDemo}
              disabled={demoLoading}
            >
              {demoLoading
                ? <span className="loading loading-spinner loading-sm" />
                : <FlaskConical className="w-4 h-4" />
              }
              Try Demo — No login required
            </button>

            <p className="text-xs text-base-content/50 text-center">
              Get your API credentials at{" "}
              <a
                href="https://developer.rupeezy.in"
                target="_blank"
                rel="noopener noreferrer"
                className="link link-primary"
              >
                developer.rupeezy.in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
