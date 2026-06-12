import { useState, useEffect } from "react";
import { Train, Clock } from "lucide-react";

interface HeaderProps {
  connected: boolean;
  simTime?: string;
  simSpeed?: number;
}

export default function Header({ connected, simTime, simSpeed = 1 }: HeaderProps) {
  const [wallTime, setWallTime] = useState(new Date());
  const [tick, setTick] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setWallTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick(p => !p), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header
      className="flex items-center justify-between px-5 h-14 shrink-0 z-50"
      style={{ backgroundColor: "#0B0F19", borderBottom: "1px solid #1E2A45" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <Train className="w-5 h-5" style={{ color: "#00E5FF" }} />
        <h1 className="font-display text-lg font-semibold tracking-tight" style={{ color: "#E5E7EB", letterSpacing: "-0.5px" }}>
          Railway Control Center
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-5">

        {/* Connection */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{
            backgroundColor: connected ? "#10B981" : "#EF4444",
            boxShadow: connected ? "0 0 8px 2px rgba(16,185,129,0.5)" : "0 0 8px 2px rgba(239,68,68,0.5)",
            animation: "glowPulse 2s ease-in-out infinite",
          }} />
          <span style={{ color: "#6B7280", fontFamily: "Inter, sans-serif", fontSize: "11px", letterSpacing: "0.5px" }}>
            {connected ? "System Online" : "Disconnected"}
          </span>
        </div>

        <div style={{ width: 1, height: 24, backgroundColor: "#1E2A45" }} />

        {/* Railway Clock */}
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" style={{ color: "#00E5FF" }} />
          <div style={{ lineHeight: 1 }}>
            <div style={{ color: "#6B7280", fontSize: "9px", letterSpacing: "0.8px", textTransform: "uppercase", fontFamily: "Inter, sans-serif", marginBottom: 2 }}>
              Railway Time
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono-custom" style={{
                color: "#00E5FF", fontSize: "16px", fontWeight: 700, letterSpacing: "2px",
                textShadow: "0 0 12px rgba(0,229,255,0.6)",
              }}>
                {simTime ?? "--:--"}
              </span>
              {/* blinking tick dot */}
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                backgroundColor: tick ? "#00E5FF" : "transparent",
                border: "1px solid rgba(0,229,255,0.5)",
                transition: "background-color 0.2s",
                display: "inline-block",
              }} />
              {simSpeed !== 1 && (
                <span style={{
                  color: simSpeed >= 20 ? "#F59E0B" : "#F472B6",
                  fontSize: "10px", fontFamily: "Inter, sans-serif", fontWeight: 700,
                  background: simSpeed >= 20 ? "rgba(245,158,11,0.12)" : "rgba(244,114,182,0.12)",
                  border: `1px solid ${simSpeed >= 20 ? "rgba(245,158,11,0.3)" : "rgba(244,114,182,0.3)"}`,
                  borderRadius: 4, padding: "1px 5px",
                }}>
                  {simSpeed < 1 ? `${simSpeed.toFixed(1)}×` : `${Math.round(simSpeed)}×`}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 24, backgroundColor: "#1E2A45" }} />

        {/* Wall Clock */}
        <div style={{ lineHeight: 1 }}>
          <div style={{ color: "#6B7280", fontSize: "9px", letterSpacing: "0.8px", textTransform: "uppercase", fontFamily: "Inter, sans-serif", marginBottom: 2 }}>
            Local Time
          </div>
          <span className="font-mono-custom" style={{ color: "#9CA3AF", fontSize: "13px" }}>
            {wallTime.toLocaleTimeString("en-IN", { hour12: false })}
          </span>
        </div>
      </div>
    </header>
  );
}
