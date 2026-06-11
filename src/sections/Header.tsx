import { useState, useEffect } from "react";
import { Train } from "lucide-react";

interface HeaderProps {
  connected: boolean;
}

export default function Header({ connected }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className="flex items-center justify-between px-5 h-14 shrink-0 z-50"
      style={{
        backgroundColor: "#0B0F19",
        borderBottom: "1px solid #1E2A45",
      }}
    >
      <div className="flex items-center gap-3">
        <Train className="w-5 h-5" style={{ color: "#00E5FF" }} />
        <h1
          className="font-display text-lg font-semibold tracking-tight"
          style={{ color: "#E5E7EB", letterSpacing: "-0.5px" }}
        >
          Railway Control Center
        </h1>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: connected ? "#10B981" : "#EF4444",
              boxShadow: connected
                ? "0 0 8px 2px rgba(16, 185, 129, 0.5)"
                : "0 0 8px 2px rgba(239, 68, 68, 0.5)",
              animation: "glowPulse 2s ease-in-out infinite",
            }}
          />
          <span
            className="text-xs font-medium"
            style={{
              color: "#6B7280",
              fontFamily: "Inter, sans-serif",
              fontSize: "11px",
              letterSpacing: "0.5px",
            }}
          >
            {connected ? "System Online" : "Disconnected"}
          </span>
        </div>

        <span
          className="font-mono-custom text-sm"
          style={{ color: "#E5E7EB", fontSize: "13px" }}
        >
          {time.toLocaleTimeString("en-US", { hour12: false })}
        </span>
      </div>
    </header>
  );
}
