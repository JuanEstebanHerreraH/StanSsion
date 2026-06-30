import { Music2, Brain, Settings, ListMusic, Radio, Monitor } from "lucide-react";
import { t, ui } from "./tokens";
import type { Lang, Tr } from "./lang";

type Screen = "audio" | "radio" | "workspace" | "settings" | "playlist";

interface SidebarProps {
  active: Screen;
  onNavigate: (s: Screen) => void;
  lang: Lang;
  onLangToggle: () => void;
  tr: Tr;
}

export function Sidebar({ active, onNavigate, lang, onLangToggle, tr }: SidebarProps) {
  const navItems: { id: Screen; icon: React.ReactNode; label: string }[] = [
    { id: "audio",     icon: <Music2 size={16} />,    label: tr.navDashboard },
    { id: "radio",     icon: <Radio size={16} />,     label: tr.navStations },
    { id: "playlist",  icon: <ListMusic size={16} />, label: tr.playlist },
    { id: "workspace", icon: <Brain size={16} />,     label: tr.workspace },
    { id: "settings",  icon: <Settings size={16} />,  label: tr.settings },
  ];

  return (
    <aside style={{
      width: 220, minWidth: 220, height: "100%",
      background: "var(--stanssion-sidebar, rgba(16,16,26,0.92))",
      backdropFilter: t.glassBlur,
      borderRight: `1px solid ${t.border}`,
      display: "flex", flexDirection: "column", ...ui,
    }}>
      {/* Logo */}
      <div style={{ padding: "22px 18px 18px", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8,
            background: `linear-gradient(135deg, ${t.accent}, ${t.accentPurple})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "logoHue 4s linear infinite" }}>
            <Music2 size={14} color="#fff" />
          </div>
          <span style={{ color: t.textPrimary, fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>
            StanSsion
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "12px 10px", flex: 1 }}>
        {navItems.map((item) => {
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", paddingLeft: isActive ? 10 : 12,
                borderRadius: 8, border: "none",
                borderLeft: isActive ? `2px solid ${t.accent}` : "2px solid transparent",
                cursor: "pointer", marginBottom: 2,
                background: isActive ? "rgba(79,142,247,0.12)" : "transparent",
                color: isActive ? t.accent : t.textSecondary,
                fontSize: 14, fontWeight: isActive ? 500 : 400, transition: "all 0.15s", textAlign: "left", ...ui,
              }}
              onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = t.surfaceHover; (e.currentTarget as HTMLButtonElement).style.color = t.textPrimary; } }}
              onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = t.textSecondary; } }}>
              {item.icon}{item.label}
            </button>
          );
        })}
      </nav>

      {/* Install desktop app (inert placeholder — wired once a download link exists) */}
      <div style={{ padding: "0 12px 12px" }}>
        <button title={tr.installSoonHint}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderRadius: 9,
            border: `1px solid ${t.border}`, background: t.surface, color: t.textSecondary, cursor: "pointer", fontSize: 12.5, fontWeight: 500, textAlign: "left", ...ui }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = t.surfaceHover; (e.currentTarget as HTMLButtonElement).style.color = t.textPrimary; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = t.surface; (e.currentTarget as HTMLButtonElement).style.color = t.textSecondary; }}>
          <Monitor size={15} />{tr.installDesktop}
        </button>
      </div>

      {/* Language toggle */}
      <div style={{ padding: "0 14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 20, padding: 3, width: "fit-content" }}>
          {(["en", "es"] as Lang[]).map((l) => (
            <button key={l} onClick={() => lang !== l && onLangToggle()}
              style={{ padding: "4px 12px", borderRadius: 16, border: "none",
                background: lang === l ? "rgba(79,142,247,0.2)" : "transparent",
                color: lang === l ? t.accent : t.textSecondary,
                fontSize: 11, fontWeight: lang === l ? 600 : 400,
                cursor: lang === l ? "default" : "pointer", transition: "all 0.15s",
                fontFamily: "'JetBrains Mono', monospace" }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <style>{`@keyframes logoHue {0%{filter:hue-rotate(0deg)}50%{filter:hue-rotate(40deg)}100%{filter:hue-rotate(0deg)}}`}</style>
    </aside>
  );
}
