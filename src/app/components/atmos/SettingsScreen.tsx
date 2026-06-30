import { useState, useEffect } from "react";
import { t, ui, mono } from "./tokens";
import type { Tr, Lang } from "./lang";
import { ambientEngine } from "./AudioEngine";
import { clearAllCustoms } from "./ambientStore";

const ACCENT_PRESETS = ["#4f8ef7","#7c5cbf","#3ecf8e","#f5a623","#ef4444","#ec4899","#06b6d4","#facc15"];
const BG_PRESETS = ["#0a0a0f","#101522","#f4f3ee"];   // dark · navy · soft off-white
const THEMES = ["Dark","Light","System"] as const;
type Theme = typeof THEMES[number];

function ls<T>(k: string, fb: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }

interface Props {
  tr: Tr; lang: Lang; onLangChange: (l: Lang) => void;
  theme: Theme; onThemeChange: (t: Theme) => void;
  accent: string; onAccentChange: (a: string) => void;
  bgColor: string | null; onBgColorChange: (c: string | null) => void;
  animations: boolean; onAnimationsChange: (v: boolean) => void;
  volume: number; onVolumeChange: (v: number) => void;
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: `1px solid ${t.border}`, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <span style={{ fontSize: 13, color: t.textPrimary }}>{label}</span>
        {sub && <p style={{ fontSize: 11, color: t.textSecondary, marginTop: 2, maxWidth: 320 }}>{sub}</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{children}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "6px 18px", marginBottom: 16 }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: t.textSecondary, paddingTop: 12, paddingBottom: 4 }}>{title}</p>
      {children}
    </div>
  );
}
function PillSelect<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, background: t.surfaceHover, borderRadius: 8, padding: 3 }}>
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
          style={{ padding: "5px 13px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: value === o ? 500 : 400, ...ui,
            background: value === o ? "rgba(79,142,247,0.2)" : "transparent", color: value === o ? t.accent : t.textSecondary }}>
          {o}
        </button>
      ))}
    </div>
  );
}
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)}
      style={{ width: 38, height: 21, borderRadius: 11, background: on ? t.accent : t.border, border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
      <div style={{ position: "absolute", top: 2, left: on ? 19 : 2, width: 17, height: 17, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
    </button>
  );
}
function MiniSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 120, height: 3, background: t.border, borderRadius: 2 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${value}%`, background: `linear-gradient(90deg,${t.accent},#7c5cbf)`, borderRadius: 2 }} />
        <input type="range" min={0} max={100} value={value} onChange={e => onChange(Number(e.target.value))}
          style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", height: "100%" }} />
        <div style={{ position: "absolute", top: "50%", left: `${value}%`, transform: "translate(-50%,-50%)", width: 11, height: 11, borderRadius: "50%", background: "#fff", boxShadow: `0 0 5px ${t.accent}88`, pointerEvents: "none" }} />
      </div>
      <span style={{ fontSize: 11, color: t.textSecondary, ...mono, width: 30, textAlign: "right" }}>{value}%</span>
    </div>
  );
}
function Swatch({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ width: 22, height: 22, borderRadius: "50%", background: color, border: active ? "2px solid #fff" : `2px solid ${t.border}`, cursor: "pointer", boxShadow: active ? `0 0 0 2px ${t.accent}55` : "none" }} />;
}

export function SettingsScreen({ tr, lang, onLangChange, theme, onThemeChange, accent, onAccentChange, bgColor, onBgColorChange, animations, onAnimationsChange, volume, onVolumeChange }: Props) {
  const [normalize, setNormalize] = useState<boolean>(() => ls("ss_normalize", false));
  const [crossfade, setCrossfade] = useState<boolean>(() => ls("ss_crossfade", true));
  const [flash, setFlash] = useState("");
  const [realUsage, setRealUsage] = useState<string>("…");

  // Real usage = localStorage + every audio Blob in IndexedDB, measured directly.
  // (navigator.storage.estimate() is rounded/spoofed in some browsers — e.g. Brave —
  //  so we sum the actual blob sizes instead.)
  useEffect(() => {
    let alive = true;
    const fmtBytes = (b: number) =>
      b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB`
      : b >= 1024 ? `${(b / 1024).toFixed(1)} KB`
      : `${b} B`;

    const sumStore = (dbName: string, storeName: string) => new Promise<number>((resolve) => {
      let req: IDBOpenDBRequest;
      try { req = indexedDB.open(dbName); } catch { resolve(0); return; }
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve(0); return; }
        try {
          const getAll = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
          getAll.onsuccess = () => {
            let total = 0;
            for (const v of (getAll.result as any[]) || []) {
              if (v instanceof Blob) total += v.size;
              else if (v && typeof v.size === "number") total += v.size;
              else if (v && typeof v.byteLength === "number") total += v.byteLength;
              else if (v != null) { try { total += new Blob([v]).size; } catch {} }
            }
            db.close(); resolve(total);
          };
          getAll.onerror = () => { db.close(); resolve(0); };
        } catch { db.close(); resolve(0); }
      };
      req.onerror = () => resolve(0);
    });

    (async () => {
      let lsBytes = 0;
      try { for (const k of Object.keys(localStorage)) lsBytes += k.length + (localStorage.getItem(k) ?? "").length; } catch {}
      const [pl, amb] = await Promise.all([ sumStore("stanssion-pl", "tracks"), sumStore("stanssion", "ambient") ]);
      if (alive) setRealUsage(fmtBytes(lsBytes + pl + amb));
    })();

    return () => { alive = false; };
  }, [flash]);

  const setNorm = (v: boolean) => { setNormalize(v); ambientEngine.setNormalize(v); localStorage.setItem("ss_normalize", JSON.stringify(v)); };
  const setCross = (v: boolean) => { setCrossfade(v); ambientEngine.setCrossfade(v); localStorage.setItem("ss_crossfade", JSON.stringify(v)); };

  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash(""), 1800); };

  // Keys that make up the app's data
  const DATA_KEYS = ["ss_events","ss_timers","ss_canvas","ss_canvas_name","ss_amb_custom","ss_amb_id","ss_amb_i","ss_amb_sp","ss_amb_de","ss_viz_colors","rb_favs","ss_theme","ss_accent","ss_bg","ss_animations","ss_lang","ss_vol","ss_normalize","ss_crossfade"];

  const counts = (() => {
    try {
      const ev = JSON.parse(localStorage.getItem("ss_events") || "[]").length;
      const tm = JSON.parse(localStorage.getItem("ss_timers") || "[]").length;
      const cv = JSON.parse(localStorage.getItem("ss_canvas") || '{"nodes":[]}').nodes?.length ?? 0;
      const am = JSON.parse(localStorage.getItem("ss_amb_custom") || "[]").length;
      const fv = Object.keys(JSON.parse(localStorage.getItem("rb_favs") || "{}")).length;
      return { ev, tm, cv, am, fv };
    } catch { return { ev: 0, tm: 0, cv: 0, am: 0, fv: 0 }; }
  })();

  const exportData = () => {
    const data: Record<string, unknown> = { _app: "StanSsion", _version: 5, _exported: new Date().toISOString() };
    for (const k of DATA_KEYS) { const v = localStorage.getItem(k); if (v !== null) { try { data[k] = JSON.parse(v); } catch { data[k] = v; } } }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = "stanssion_backup.json"; a.click();
  };
  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!confirm(tr.importConfirm)) return;
    f.text().then(txt => {
      try {
        const j = JSON.parse(txt);
        for (const k of DATA_KEYS) if (k in j) localStorage.setItem(k, JSON.stringify(j[k]));
        location.reload();
      } catch { alert("Invalid backup file"); }
    });
  };

  const clearEvents = () => {
    if (!confirm(lang === "es" ? "¿Borrar todos los eventos?" : "Clear all events?")) return;
    window.dispatchEvent(new Event("ss:clear-events"));
    localStorage.setItem("ss_events", JSON.stringify([]));
    showFlash(tr.cleared + " · " + tr.events);
  };
  const clearCanvas = () => {
    if (!confirm(lang === "es" ? "¿Borrar el lienzo?" : "Clear canvas?")) return;
    window.dispatchEvent(new Event("ss:clear-canvas"));
    localStorage.setItem("ss_canvas", JSON.stringify({ nodes: [], conns: [] }));
    showFlash(tr.cleared + " · " + tr.workspace);
  };

  const dangerBtn: React.CSSProperties = { padding: "6px 13px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)", color: "#ef4444", fontSize: 12, cursor: "pointer", ...ui };
  const btn: React.CSSProperties = { padding: "6px 13px", borderRadius: 7, border: `1px solid ${t.border}`, background: t.surfaceHover, color: t.textPrimary, fontSize: 12, cursor: "pointer", ...ui };

  return (
    <div className="ss-scroll" style={{ height: "100%", overflowY: "auto", maxWidth: 640, margin: "0 auto", padding: "0 4px", ...ui }}>

      {/* Appearance */}
      <Section title={tr.appearance}>
        <Row label={lang === "en" ? "Theme" : "Tema"}><PillSelect options={THEMES} value={theme} onChange={onThemeChange} /></Row>

        <Row label={lang === "en" ? "Accent color" : "Color de acento"}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {ACCENT_PRESETS.map(c => <Swatch key={c} color={c} active={accent === c} onClick={() => onAccentChange(c)} />)}
            <label style={{ position: "relative", width: 22, height: 22, borderRadius: "50%", cursor: "pointer", background: "conic-gradient(red,#ff0,lime,cyan,blue,magenta,red)", border: `2px solid ${t.border}` }}>
              <input type="color" value={accent} onChange={e => onAccentChange(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            </label>
          </div>
        </Row>

        <Row label={tr.background} sub={tr.customColor}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => onBgColorChange(null)} title={lang === "es" ? "Según el tema" : "Follow theme"}
              style={{ height: 22, padding: "0 10px", borderRadius: 11, fontSize: 11, cursor: "pointer", ...ui,
                border: bgColor === null ? `2px solid ${t.accent}` : `2px solid ${t.border}`, background: t.surfaceHover, color: t.textSecondary }}>
              {lang === "es" ? "Tema" : "Auto"}
            </button>
            {BG_PRESETS.map(c => <Swatch key={c} color={c} active={bgColor === c} onClick={() => onBgColorChange(c)} />)}
            <label style={{ position: "relative", width: 22, height: 22, borderRadius: "50%", cursor: "pointer", background: "conic-gradient(red,#ff0,lime,cyan,blue,magenta,red)", border: `2px solid ${t.border}` }}>
              <input type="color" value={bgColor ?? "#0a0a0f"} onChange={e => onBgColorChange(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            </label>
          </div>
        </Row>

        <Row label={lang === "en" ? "Language" : "Idioma"}><PillSelect options={["en","es"] as const} value={lang} onChange={onLangChange} /></Row>

        <Row label={lang === "en" ? "Animations" : "Animaciones"} sub={tr.reduceMotionHint}>
          <Toggle on={animations} onChange={onAnimationsChange} />
        </Row>
      </Section>

      {/* Audio — all functional */}
      <Section title={tr.audioSection}>
        <Row label={tr.masterVolume}><MiniSlider value={volume} onChange={onVolumeChange} /></Row>
        <Row label={tr.normalizeOutput} sub={lang === "es" ? "Evita picos y empareja el volumen del ambiente." : "Tames peaks and evens out ambient loudness."}>
          <Toggle on={normalize} onChange={setNorm} />
        </Row>
        <Row label={tr.smoothCrossfade} sub={lang === "es" ? "Funde la entrada/salida al cambiar de sonido." : "Fades sounds in/out when switching."}>
          <Toggle on={crossfade} onChange={setCross} />
        </Row>
      </Section>

      {/* Data */}
      <Section title={tr.data}>
        <Row label={tr.storageUsed}><span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, ...mono }}>{realUsage}</span></Row>
        <Row label={tr.exportData} sub={`${tr.exportIncludesLabel} · ${counts.ev} ${tr.events.toLowerCase()}, ${counts.tm} timers, ${counts.cv} ${lang==="es"?"nodos":"nodes"}, ${counts.am} ${lang==="es"?"sonidos":"sounds"}, ${counts.fv} ${tr.favorites.toLowerCase()}`}>
          <button onClick={exportData} style={btn}>{tr.exportData}</button>
        </Row>
        <Row label={tr.importData}>
          <label style={{ ...btn, display: "inline-flex" }}>
            {tr.importData}
            <input type="file" accept="application/json" onChange={importData} style={{ display: "none" }} />
          </label>
        </Row>
        <Row label={tr.clearEvents}><button onClick={clearEvents} style={dangerBtn}>{tr.clearEvents}</button></Row>
        <Row label={tr.clearCanvas}><button onClick={clearCanvas} style={dangerBtn}>{tr.clearCanvas}</button></Row>
      </Section>

      {/* Live preview / feedback */}
      <div style={{ marginBottom: 24, padding: "10px 16px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.accent, boxShadow: `0 0 8px ${accent}` }} />
        <span style={{ fontSize: 12, color: flash ? t.accent : t.textSecondary }}>
          {flash || (lang === "en" ? "Live preview — changes apply instantly" : "Vista previa — los cambios se aplican al instante")}
        </span>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: t.border }}>
          <div style={{ width: "60%", height: "100%", background: `linear-gradient(90deg, ${accent}, #7c5cbf)`, borderRadius: 2 }} />
        </div>
      </div>
    </div>
  );
}
