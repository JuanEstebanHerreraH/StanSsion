import { CloudRain, Radio, Timer, Volume2, Play, Pause, VolumeX } from "lucide-react";
import { t, mono, ui } from "./tokens";
import type { Tr } from "./lang";
import type { TimerState } from "./AudioDashboard";
import type { RGStation } from "../../App";

interface Props {
  tr:             Tr;
  timer:          TimerState;
  timerDuration:  number;
  playingStation: RGStation | null;
  isRadioPlaying: boolean;
  onPauseRadio:   () => void;
  onResumeRadio:  () => void;
  ambientEnabled: boolean;
  ambientLabel:   string;
  ambientEmoji:   string;
  intensity:      number;
  volume:         number;
  onVolumeChange: (v: number) => void;
}

export function PlayerBar({
  tr, timer, timerDuration,
  playingStation, isRadioPlaying, onPauseRadio, onResumeRadio,
  ambientEnabled, ambientLabel, ambientEmoji, intensity,
  volume, onVolumeChange,
}: Props) {
  const { seconds } = timer;
  const progress = timerDuration > 0 ? Math.min(((timerDuration - seconds) / timerDuration) * 100, 100) : 0;
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <footer style={{ height: 60, background: "rgba(8,8,18,0.93)", backdropFilter: "blur(20px)",
      borderTop: `1px solid ${t.border}`, display: "flex", alignItems: "center",
      padding: "0 20px", gap: 10, position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, ...ui }}>

      {/* Timer progress bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: t.border }}>
        <div style={{ height: "100%", width: `${progress}%`,
          background: `linear-gradient(90deg, ${t.accent}, ${t.accentPurple})`,
          transition: "width 1s linear", boxShadow: `0 0 4px ${t.accent}` }} />
      </div>

      {/* Ambient pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 20,
        background: ambientEnabled ? "rgba(79,142,247,0.1)" : t.surface,
        border: `1px solid ${ambientEnabled ? "rgba(79,142,247,0.25)" : t.border}`,
        whiteSpace: "nowrap", flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%",
          background: ambientEnabled ? t.success : t.border,
          boxShadow: ambientEnabled ? `0 0 5px ${t.success}` : "none",
          animation: ambientEnabled ? "pulse 2s infinite" : "none" }} />
        <CloudRain size={12} color={ambientEnabled ? t.accent : t.textSecondary} />
        <span style={{ fontSize: 12, color: ambientEnabled ? t.accent : t.textSecondary, fontWeight: ambientEnabled ? 500 : 400 }}>
          {ambientEmoji} {ambientLabel}{ambientEnabled ? ` — ${intensity}%` : ""}
        </span>
      </div>

      {/* Radio pill */}
      {playingStation ? (
        <button onClick={isRadioPlaying ? onPauseRadio : onResumeRadio}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 20,
            background: "rgba(124,92,191,0.1)", border: "1px solid rgba(124,92,191,0.25)",
            whiteSpace: "nowrap", flexShrink: 0, cursor: "pointer" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%",
            background: isRadioPlaying ? t.success : t.textSecondary,
            boxShadow: isRadioPlaying ? `0 0 5px ${t.success}` : "none",
            animation: isRadioPlaying ? "pulse 2s infinite 0.5s" : "none" }} />
          {isRadioPlaying
            ? <Pause size={10} color={t.accentPurple} fill={t.accentPurple} />
            : <Play  size={10} color={t.accentPurple} fill={t.accentPurple} />}
          <span style={{ fontSize: 12, color: t.accentPurple, fontWeight: 500,
            maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
            {playingStation.title}
          </span>
        </button>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 20,
          background: t.surface, border: `1px solid ${t.border}`, whiteSpace: "nowrap", flexShrink: 0 }}>
          <Radio size={12} color={t.textSecondary} />
          <span style={{ fontSize: 12, color: t.textSecondary }}>{tr.radio}</span>
        </div>
      )}

      {/* Timer mini display */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 20,
        background: t.surface, border: `1px solid ${t.border}`, whiteSpace: "nowrap", flexShrink: 0 }}>
        <Timer size={12} color={t.textSecondary} />
        <span style={{ fontSize: 13, color: t.textPrimary, ...mono }}>{fmt(seconds)}</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Volume */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button onClick={() => onVolumeChange(volume === 0 ? 80 : 0)}
          style={{ background: "none", border: "none", cursor: "pointer", color: t.textSecondary, display: "flex", padding: 2 }}>
          {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <div style={{ position: "relative", width: 90, height: 3, background: t.border, borderRadius: 2 }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${volume}%`,
            background: `linear-gradient(90deg, ${t.accent}, ${t.accentPurple})`, borderRadius: 2 }} />
          <input type="range" min={0} max={100} value={volume}
            onChange={e => onVolumeChange(Number(e.target.value))}
            style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", height: "100%" }} />
          <div style={{ position: "absolute", top: "50%", left: `${volume}%`,
            transform: "translate(-50%,-50%)", width: 9, height: 9, borderRadius: "50%",
            background: "#fff", boxShadow: `0 0 5px ${t.accent}88`, pointerEvents: "none" }} />
        </div>
        <span style={{ fontSize: 11, color: t.textSecondary, ...mono, width: 26, textAlign: "right" }}>{volume}%</span>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </footer>
  );
}
