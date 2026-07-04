import { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw, ChevronDown, Plus, X, Check } from "lucide-react";
import { t, mono, ui } from "./tokens";
import type { Tr } from "./lang";

export interface CustomTimer { id: string; name: string; durationSec: number; }

interface Props {
  tr: Tr;
  timers: CustomTimer[];
  setTimers: React.Dispatch<React.SetStateAction<CustomTimer[]>>;
  timerTab: number;
  seconds: number;
  running: boolean;
  done?: boolean;
  onSelect: (i: number) => void;
  onToggle: () => void;
  onReset: () => void;
}

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export function TimerWidget({ tr, timers, setTimers, timerTab, seconds, running, done, onSelect, onToggle, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [hh, setHh] = useState("0");
  const [mm, setMm] = useState("25");
  const [ss, setSs] = useState("0");
  const ref = useRef<HTMLDivElement>(null);

  const cur = timers[timerTab] ?? timers[0];
  const total = cur?.durationSec ?? 1500;
  const progress = total > 0 ? Math.min(((total - seconds) / total) * 100, 100) : 0;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const add = () => {
    const h = Math.max(0, parseInt(hh, 10) || 0);
    const m = Math.max(0, parseInt(mm, 10) || 0);
    const s = Math.max(0, parseInt(ss, 10) || 0);
    const totalSec = h * 3600 + m * 60 + s;
    if (!name.trim() || totalSec < 1) return;
    setTimers(prev => [...prev, { id: Date.now().toString(36), name: name.trim(), durationSec: totalSec }]);
    setName(""); setHh("0"); setMm("25"); setSs("0");
  };
  const del = (id: string) => {
    if (timers.length <= 1) return;
    setTimers(prev => {
      const next = prev.filter(x => x.id !== id);
      const idx = prev.findIndex(x => x.id === id);
      if (idx === timerTab) onSelect(Math.max(0, timerTab - 1));
      else if (idx < timerTab) onSelect(timerTab - 1);
      return next;
    });
  };

  const ring = 2 * Math.PI * 18;
  const accentBg = done ? "rgba(62,207,142,0.18)" : running ? "rgba(79,142,247,0.12)" : t.surface;
  const accentBd = done ? "rgba(62,207,142,0.55)" : running ? "rgba(79,142,247,0.35)" : t.border;

  return (
    <div ref={ref} style={{ position: "relative", ...ui }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "8px 12px 8px 10px", borderRadius: 14,
        background: accentBg, border: `1px solid ${accentBd}`,
        boxShadow: done ? "0 0 24px rgba(62,207,142,0.25)" : running ? "0 0 18px rgba(79,142,247,0.12)" : "none",
        animation: done ? "timerDone 0.7s ease-in-out 3" : "none",
      }}>
        {/* Ring */}
        <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
          <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="22" cy="22" r="18" fill="none" stroke={t.border} strokeWidth="3.5" />
            <circle cx="22" cy="22" r="18" fill="none" stroke={done ? "#3ecf8e" : t.accent} strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={`${ring}`} strokeDashoffset={`${ring * (1 - progress / 100)}`}
              style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {done
              ? <Check size={18} color="#3ecf8e" />
              : <div style={{ width: 7, height: 7, borderRadius: "50%", background: running ? t.accent : t.textSecondary, boxShadow: running ? `0 0 7px ${t.accent}` : "none", animation: running ? "pulse 2s infinite" : "none" }} />}
          </div>
        </div>

        {/* Digits + preset selector */}
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05, minWidth: 78 }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: done ? "#3ecf8e" : t.textPrimary, letterSpacing: "0.01em", ...mono }}>{fmt(seconds)}</span>
          <button onClick={() => setOpen(o => !o)}
            style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 1, color: t.textSecondary, fontSize: 11, ...ui }}>
            {done ? tr.timerDone : (cur?.name ?? tr.timerLabel)}
            <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={onToggle} title={running ? tr.pause : tr.start}
            style={{ width: 34, height: 34, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              border: `1px solid ${running ? "rgba(79,142,247,0.45)" : "rgba(79,142,247,0.3)"}`,
              background: running ? "rgba(79,142,247,0.2)" : "rgba(79,142,247,0.12)", color: t.accent }}>
            {running ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" style={{ marginLeft: 1 }} />}
          </button>
          <button onClick={onReset} title={tr.reset}
            style={{ width: 34, height: 34, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              border: `1px solid ${t.border}`, background: "transparent", color: t.textSecondary }}>
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Preset popover */}
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 240, background: "var(--stanssion-bg,#12121e)", border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: "0 14px 36px rgba(0,0,0,0.5)", zIndex: 200, padding: 8 }}>
          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: t.textSecondary, padding: "4px 8px 6px" }}>{tr.timerPresets}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 200, overflowY: "auto" }}>
            {timers.map((tm, i) => (
              <div key={tm.id} style={{ display: "flex", alignItems: "center", borderRadius: 8, background: i === timerTab ? "rgba(79,142,247,0.12)" : "transparent" }}>
                <button onClick={() => { onSelect(i); setOpen(false); }}
                  style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", color: i === timerTab ? t.accent : t.textPrimary, fontSize: 13, ...ui }}>
                  <span>{tm.name}</span>
                  <span style={{ fontSize: 11, color: t.textSecondary, ...mono }}>{fmt(tm.durationSec)}</span>
                </button>
                {timers.length > 1 && (
                  <button onClick={() => del(tm.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textSecondary, padding: 8 }}><X size={12} /></button>
                )}
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 6, paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={tr.newTimerShort} onKeyDown={e => e.key === "Enter" && add()}
              style={{ width: "100%", background: t.surface, border: `1px solid ${t.border}`, borderRadius: 7, padding: "7px 9px", color: t.textPrimary, fontSize: 12, outline: "none", boxSizing: "border-box", ...ui }} />
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {([["h", hh, setHh, 99], ["m", mm, setMm, 59], ["s", ss, setSs, 59]] as const).map(([lbl, val, set, max]) => (
                <div key={lbl} style={{ flex: 1, display: "flex", alignItems: "center", gap: 3, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 7, padding: "5px 7px" }}>
                  <input value={val} onChange={e => set(e.target.value.replace(/[^0-9]/g, ""))} type="number" min="0" max={max} onKeyDown={e => e.key === "Enter" && add()}
                    style={{ width: "100%", minWidth: 0, background: "none", border: "none", outline: "none", color: t.textPrimary, fontSize: 13, textAlign: "right", ...mono }} />
                  <span style={{ fontSize: 11, color: t.textSecondary, ...mono }}>{lbl}</span>
                </div>
              ))}
              <button onClick={add} title={tr.newTimerShort} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(79,142,247,0.4)", background: "rgba(79,142,247,0.14)", color: t.accent, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Plus size={14} /></button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes timerDone{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
      `}</style>
    </div>
  );
}
