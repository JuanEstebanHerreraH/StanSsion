import { useState, useEffect, useRef } from "react";
import { Sidebar }         from "./components/atmos/Sidebar";
import { PlayerBar }       from "./components/atmos/PlayerBar";
import { AudioDashboard }  from "./components/atmos/AudioDashboard";
import { RadioPanel }      from "./components/atmos/RadioPanel";
import { WorkspaceCanvas } from "./components/atmos/WorkspaceCanvas";
import { SettingsScreen }  from "./components/atmos/SettingsScreen";
import { PlaylistScreen }  from "./components/atmos/PlaylistScreen";
import { TimerWidget, type CustomTimer } from "./components/atmos/TimerWidget";
import { translations, type Lang, type Tr } from "./components/atmos/lang";
import { ambientEngine } from "./components/atmos/AudioEngine";
import { refFor, metaFor } from "./components/atmos/ambientStore";
import confetti from "canvas-confetti";
import type { TimerState } from "./components/atmos/AudioDashboard";

export interface RGStation {
  id: string; title: string; country: string;
  placeId: string; placeTitle: string; streamUrl: string;
}

type Screen = "audio" | "radio" | "workspace" | "settings" | "playlist";
export type ThemeMode = "Dark" | "Light" | "System";

function ls<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

const DEFAULT_TIMERS: CustomTimer[] = [
  { id: "t1", name: "Pomodoro", durationSec: 1500 },
  { id: "t2", name: "Sleep",    durationSec: 3600 },
  { id: "t3", name: "Focus",    durationSec: 3000 },
];

// luminance 0..1
function lum(hex: string): number {
  const m = hex.replace("#", "");
  if (m.length < 6) return 0.5;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("audio");
  const [lang,   setLang]   = useState<Lang>(() => ls("ss_lang", "en"));

  // ── Appearance ──────────────────────────────────────────────────────────
  const [theme,  setThemeState]  = useState<ThemeMode>(() => ls("ss_theme", "Dark"));
  const [accent, setAccentState] = useState<string>(() => ls("ss_accent", "#4f8ef7"));
  const [bgColor, setBgColorState] = useState<string | null>(() => ls("ss_bg", null));
  const [animations, setAnimationsState] = useState<boolean>(() => ls("ss_animations", true));

  const applyAppearance = (t: ThemeMode, a: string, bg: string | null) => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    let dark = t === "Dark" || (t === "System" && prefersDark);
    if (bg) dark = lum(bg) < 0.5;           // custom bg drives text contrast
    const root = document.documentElement;
    if (dark) {
      root.style.setProperty("--stanssion-surface",      "rgba(255,255,255,0.04)");
      root.style.setProperty("--stanssion-surface-hover", "rgba(255,255,255,0.07)");
      root.style.setProperty("--stanssion-border",        "rgba(255,255,255,0.08)");
      root.style.setProperty("--stanssion-border-hover",  "rgba(255,255,255,0.14)");
      root.style.setProperty("--stanssion-text-primary",  "#e8e8f0");
      root.style.setProperty("--stanssion-text-secondary","#8888a0");
      root.style.setProperty("--stanssion-sidebar",       "rgba(16,16,26,0.92)");
    } else {
      root.style.setProperty("--stanssion-surface",      "rgba(255,255,255,0.75)");
      root.style.setProperty("--stanssion-surface-hover", "rgba(255,255,255,0.95)");
      root.style.setProperty("--stanssion-border",        "rgba(20,20,40,0.12)");
      root.style.setProperty("--stanssion-border-hover",  "rgba(20,20,40,0.22)");
      root.style.setProperty("--stanssion-text-primary",  "#1f1f29");
      root.style.setProperty("--stanssion-text-secondary","#5b5b6b");
      root.style.setProperty("--stanssion-sidebar",       "rgba(255,255,255,0.8)");
    }
    const bgVal = bg ?? (dark ? "#0a0a0f" : "#f4f3ee");   // softer off-white, not pure white
    root.style.setProperty("--stanssion-bg", bgVal);
    document.body.style.background = bgVal;
    root.style.setProperty("--stanssion-accent", a);
  };

  useEffect(() => { applyAppearance(theme, accent, bgColor); }, [theme, accent, bgColor]);
  useEffect(() => { document.documentElement.classList.toggle("ss-no-anim", !animations); }, [animations]);

  const setTheme   = (v: ThemeMode)      => { setThemeState(v); localStorage.setItem("ss_theme", JSON.stringify(v)); setBgColor(null); };
  const setAccent  = (v: string)         => { setAccentState(v);     localStorage.setItem("ss_accent", JSON.stringify(v)); };
  const setBgColor = (v: string | null)  => { setBgColorState(v);    v === null ? localStorage.removeItem("ss_bg") : localStorage.setItem("ss_bg", JSON.stringify(v)); };
  const setAnimations = (v: boolean)     => { setAnimationsState(v); localStorage.setItem("ss_animations", JSON.stringify(v)); };
  const handleLang = (v: Lang) => { setLang(v); localStorage.setItem("ss_lang", JSON.stringify(v)); };

  // ── Timers (lifted so the header widget can show them everywhere) ─────────
  const [timers,   setTimers]   = useState<CustomTimer[]>(() => {
    const raw = ls<any[]>("ss_timers", DEFAULT_TIMERS);
    return raw.map(t => ({
      id: t.id, name: t.name,
      durationSec: typeof t.durationSec === "number" ? t.durationSec
        : typeof t.durationMin === "number" ? t.durationMin * 60 : 1500,
    }));
  });
  const [timerTab, setTimerTab] = useState(0);
  const [seconds,  setSeconds]  = useState(DEFAULT_TIMERS[0].durationSec);
  const [running,  setRunning]  = useState(false);
  const [timerDone, setTimerDone] = useState(false);

  useEffect(() => { localStorage.setItem("ss_timers", JSON.stringify(timers)); }, [timers]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Completion: chime + notification + confetti + visual flash
  const celebrate = () => {
    const name = (timers[timerTab] ?? timers[0])?.name ?? "Timer";
    // chime
    try {
      const ctx = new AudioContext();
      const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = f;
        const start = ctx.currentTime + i * 0.18;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.25, start + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
        o.connect(g); g.connect(ctx.destination);
        o.start(start); o.stop(start + 0.55);
      });
      setTimeout(() => ctx.close(), 1600);
    } catch {}
    // notification
    try {
      if ("Notification" in window) {
        if (Notification.permission === "granted") new Notification("StanSsion", { body: tr.notifBody(name) });
        else if (Notification.permission !== "denied") Notification.requestPermission().then(p => { if (p === "granted") new Notification("StanSsion", { body: tr.notifBody(name) }); });
      }
    } catch {}
    // confetti
    try { confetti({ particleCount: 90, spread: 70, origin: { y: 0.2 }, colors: [accent, "#7c5cbf", "#3ecf8e"] }); } catch {}
  };

  useEffect(() => {
    if (seconds === 0 && running) {
      setRunning(false);
      setTimerDone(true);
      celebrate();
      setTimeout(() => setTimerDone(false), 4000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, running]);

  const selectTimer = (i: number) => { setTimerTab(i); setRunning(false); setTimerDone(false); setSeconds((timers[i] ?? timers[0]).durationSec); };
  const resetTimer  = () => { setRunning(false); setTimerDone(false); setSeconds((timers[timerTab] ?? timers[0]).durationSec); };
  const toggleTimer = () => { setTimerDone(false); setRunning(r => !r); };

  // ── Radio (persistent audio element) ──────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingStation, setPlayingStation] = useState<RGStation | null>(null);
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);

  const playStation = (s: RGStation) => {
    const el = audioRef.current; if (!el) return;
    el.src    = s.streamUrl;
    el.volume = volume / 100;
    el.play().catch(() => {});
    setPlayingStation(s);
    setIsRadioPlaying(true);
  };
  const pauseRadio  = () => { audioRef.current?.pause();  setIsRadioPlaying(false); };
  const resumeRadio = () => { audioRef.current?.play().catch(() => {}); setIsRadioPlaying(true); };

  // ── Ambient ────────────────────────────────────────────────────────────
  const [ambientEnabled, setAmbientEnabled] = useState(false);
  const [ambientId, setAmbientId] = useState<string>(() => ls("ss_amb_id", "rain"));
  const [intensity, setIntensity] = useState<number>(() => ls("ss_amb_i", 60));
  const [speed,     setSpeed]     = useState<number>(() => ls("ss_amb_sp", 50));
  const [density,   setDensity]   = useState<number>(() => ls("ss_amb_de", 80));

  const saveAmbient = (id: string, i: number, sp: number, de: number) => {
    localStorage.setItem("ss_amb_id", JSON.stringify(id));
    localStorage.setItem("ss_amb_i",  JSON.stringify(i));
    localStorage.setItem("ss_amb_sp", JSON.stringify(sp));
    localStorage.setItem("ss_amb_de", JSON.stringify(de));
  };

  const startAmbient = async () => {
    const ok = await ambientEngine.play(refFor(ambientId), intensity, speed, density);
    setAmbientEnabled(ok);
    saveAmbient(ambientId, intensity, speed, density);
  };
  const stopAmbient   = () => { ambientEngine.stop(); setAmbientEnabled(false); };
  const toggleAmbient = () => (ambientEnabled ? stopAmbient() : startAmbient());

  const handleSetAmbientId = async (id: string) => {
    setAmbientId(id);
    saveAmbient(id, intensity, speed, density);
    if (ambientEnabled) {
      const ok = await ambientEngine.play(refFor(id), intensity, speed, density);
      setAmbientEnabled(ok);
    }
  };
  const handleIntensity = (v: number) => { setIntensity(v); if (ambientEnabled) ambientEngine.updateParams(v, speed, density); saveAmbient(ambientId, v, speed, density); };
  const handleSpeed     = (v: number) => { setSpeed(v);     if (ambientEnabled) ambientEngine.updateParams(intensity, v, density); saveAmbient(ambientId, intensity, v, density); };
  const handleDensity   = (v: number) => { setDensity(v);   if (ambientEnabled) ambientEngine.updateParams(intensity, speed, v); saveAmbient(ambientId, intensity, speed, v); };

  // ── Volume + audio settings ───────────────────────────────────────────────
  const [volume, setVolumeState] = useState<number>(() => ls("ss_vol", 80));
  const handleVolumeChange = (v: number) => {
    setVolumeState(v);
    ambientEngine.setVolume(v);
    if (audioRef.current) audioRef.current.volume = v / 100;
    localStorage.setItem("ss_vol", JSON.stringify(v));
  };

  useEffect(() => {
    ambientEngine.setVolume(volume);
    ambientEngine.setNormalize(ls("ss_normalize", false));
    ambientEngine.setCrossfade(ls("ss_crossfade", true));
    if (audioRef.current) audioRef.current.volume = volume / 100;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timer: TimerState = { seconds, running, timerTab, setSeconds, setRunning, setTimerTab: selectTimer };
  const tr = translations[lang] as Tr;
  const ambMeta = metaFor(ambientId, tr);

  const titleFor = (s: Screen) =>
    s === "audio" ? tr.audioDashboard : s === "radio" ? tr.radio : s === "workspace" ? tr.workspaceCanvas : s === "settings" ? tr.settings : tr.playlist;

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--stanssion-bg,#0a0a0f)", fontFamily: "'Inter',sans-serif", color: "var(--stanssion-text-primary,#e8e8f0)", overflow: "hidden" }}>
      <audio ref={audioRef} style={{ display: "none" }} onError={() => setIsRadioPlaying(false)} />

      <div style={{ position: "relative", zIndex: 10, flexShrink: 0 }}>
        <Sidebar active={screen} onNavigate={setScreen} lang={lang}
          onLangToggle={() => handleLang(lang === "en" ? "es" : "en")} tr={tr} />
      </div>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 1, paddingBottom: 64 }}>
        {/* Header */}
        <div style={{ padding: "14px 24px 12px", borderBottom: `1px solid var(--stanssion-border,rgba(255,255,255,0.08))`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexShrink: 0, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 2 }}>{titleFor(screen)}</h1>
            {(screen === "audio" || screen === "radio") && (
              <p style={{ fontSize: 11, color: "var(--stanssion-text-secondary,#8888a0)" }}>
                {ambientEnabled && playingStation ? `${lang === "en" ? "Active" : "Activo"} · ${ambMeta.label} + ${playingStation.title}`
                  : ambientEnabled ? `${lang === "en" ? "Active" : "Activo"} · ${ambMeta.label}`
                  : playingStation ? `${lang === "en" ? "Active" : "Activo"} · ${playingStation.title}`
                  : lang === "en" ? "No active session" : "Sin sesión activa"}
              </p>
            )}
          </div>

          {/* Prominent, always-visible timer */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {screen === "audio" && (
              <button onClick={() => setScreen("radio")} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid var(--stanssion-border)`, background: `var(--stanssion-surface)`, color: `var(--stanssion-text-secondary)`, fontSize: 12, cursor: "pointer" }}>
                {tr.browseStations}
              </button>
            )}
            <TimerWidget tr={tr} timers={timers} setTimers={setTimers} timerTab={timerTab} seconds={seconds} running={running} done={timerDone}
              onSelect={selectTimer} onToggle={toggleTimer} onReset={resetTimer} />
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", padding: 20 }}>
          {screen === "audio" && (
            <AudioDashboard tr={tr} lang={lang} onOpenRadio={() => setScreen("radio")}
              playingStation={playingStation} isRadioPlaying={isRadioPlaying}
              onPauseRadio={pauseRadio} onResumeRadio={resumeRadio}
              ambientEnabled={ambientEnabled} ambientId={ambientId}
              intensity={intensity} speed={speed} density={density}
              onToggleAmbient={toggleAmbient} onSetAmbientId={handleSetAmbientId}
              onSetIntensity={handleIntensity} onSetSpeed={handleSpeed} onSetDensity={handleDensity}
              animations={animations}
            />
          )}
          {screen === "radio"     && <RadioPanel tr={tr} onBack={() => setScreen("audio")} playingStation={playingStation} isRadioPlaying={isRadioPlaying} onPlayStation={playStation} onPauseStation={pauseRadio} onResumeStation={resumeRadio} />}
          {screen === "workspace" && <WorkspaceCanvas tr={tr} />}
          {screen === "settings"  && <SettingsScreen tr={tr} lang={lang} onLangChange={handleLang} theme={theme} onThemeChange={setTheme} accent={accent} onAccentChange={setAccent} bgColor={bgColor} onBgColorChange={setBgColor} animations={animations} onAnimationsChange={setAnimations} volume={volume} onVolumeChange={handleVolumeChange} />}
          {screen === "playlist"  && <PlaylistScreen tr={tr} volume={volume} />}
        </div>
      </main>

      <PlayerBar tr={tr} timer={timer} timerDuration={(timers[timerTab] ?? timers[0]).durationSec}
        playingStation={playingStation} isRadioPlaying={isRadioPlaying}
        onPauseRadio={pauseRadio} onResumeRadio={resumeRadio}
        ambientEnabled={ambientEnabled} ambientLabel={ambMeta.label} ambientEmoji={ambMeta.emoji} intensity={intensity}
        volume={volume} onVolumeChange={handleVolumeChange} />
    </div>
  );
}
