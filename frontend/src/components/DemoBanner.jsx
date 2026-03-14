import React from "react";
import { FlaskConical, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function DemoBanner() {
  const { demo, checkStatus } = useAuth();
  const navigate = useNavigate();

  if (!demo) return null;

  const exitDemo = async () => {
    try {
      await axios.post("/api/demo/disable", {}, { withCredentials: true });
      await checkStatus();
      navigate("/setup");
      toast("Demo mode exited. Connect your Rupeezy account to trade live.");
    } catch {
      navigate("/setup");
    }
  };

  return (
    <div className="w-full bg-warning/15 border-b border-warning/30 px-4 py-1.5 flex items-center gap-2 flex-shrink-0">
      <FlaskConical className="w-3.5 h-3.5 text-warning shrink-0" />
      <span className="text-xs font-semibold text-warning">DEMO MODE</span>
      <span className="text-xs text-base-content/60 flex-1">
        Showing simulated data — no real orders are placed
      </span>
      <button
        className="btn btn-xs btn-ghost text-warning gap-1 hover:bg-warning/10"
        onClick={exitDemo}
      >
        <X className="w-3 h-3" />
        Exit Demo
      </button>
    </div>
  );
}
