import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Search, MapPin, Flame, Heart, ListMusic, Shuffle, Play, Pause, Radio, Wifi, X, RefreshCw, Plus, Dice5, HelpCircle } from "lucide-react";
import { t, mono, ui } from "./tokens";
import type { Tr } from "./lang";
import type { RGStation } from "../../App";

// ─── Radio Browser API (free, worldwide, CORS-enabled) ────────────────────────
const SERVERS = [
  "https://de1.api.radio-browser.info",
  "https://de2.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
  "https://fi1.api.radio-browser.info",
];
interface RBStation {
  stationuuid: string; name: string; url: string; url_resolved: string;
  country: string; countrycode: string; state: string;
  codec: string; bitrate: number; votes: number; clickcount: number; favicon: string;
}
async function rb<T>(path: string): Promise<T> {
  let lastErr: unknown;
  for (const base of SERVERS) {
    try { const r = await fetch(base + path, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } }); if (r.ok) return r.json(); }
    catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error("Radio Browser unreachable");
}
function toStation(s: RBStation): RGStation {
  return { id: s.stationuuid, title: s.name?.trim() || "Unknown", country: s.country || s.countrycode || "",
    placeId: s.stationuuid, placeTitle: s.state || s.country || "", streamUrl: s.url_resolved || s.url };
}
function clean(list: RBStation[]): RGStation[] {
  const seen = new Set<string>();
  return list.filter(s => (s.url_resolved || s.url) && s.name)
    .sort((a, b) => { const ah = (a.url_resolved || "").startsWith("https") ? 1 : 0; const bh = (b.url_resolved || "").startsWith("https") ? 1 : 0; if (ah !== bh) return bh - ah; return (b.clickcount || 0) - (a.clickcount || 0); })
    .map(toStation).filter(s => { const k = s.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

// Spanish → English country names so "japon", "alemania"… resolve to the API's English names.
const ES_COUNTRY: Record<string, string> = {
  "japon": "Japan", "alemania": "Germany", "españa": "Spain", "espana": "Spain",
  "estados unidos": "United States", "eeuu": "United States", "reino unido": "United Kingdom",
  "inglaterra": "United Kingdom", "francia": "France", "italia": "Italy", "brasil": "Brazil",
  "mexico": "Mexico", "méxico": "Mexico", "argentina": "Argentina", "colombia": "Colombia",
  "chile": "Chile", "peru": "Peru", "perú": "Peru", "uruguay": "Uruguay", "paraguay": "Paraguay",
  "bolivia": "Bolivia", "ecuador": "Ecuador", "venezuela": "Venezuela", "canada": "Canada",
  "canadá": "Canada", "china": "China", "corea": "South Korea", "corea del sur": "South Korea",
  "rusia": "Russia", "portugal": "Portugal", "holanda": "The Netherlands", "paises bajos": "The Netherlands",
  "belgica": "Belgium", "bélgica": "Belgium", "suiza": "Switzerland", "austria": "Austria",
  "suecia": "Sweden", "noruega": "Norway", "dinamarca": "Denmark", "finlandia": "Finland",
  "irlanda": "Ireland", "grecia": "Greece", "polonia": "Poland", "turquia": "Turkey", "turquía": "Turkey",
  "india": "India", "australia": "Australia", "nueva zelanda": "New Zealand", "egipto": "Egypt",
  "marruecos": "Morocco", "sudafrica": "South Africa", "sudáfrica": "South Africa",
};

// Searches across name, country (ES/EN) and genre tag, then merges + de-dupes.
async function smartSearch(term: string): Promise<RGStation[]> {
  const q = term.trim();
  const enc = encodeURIComponent;
  const countryEN = ES_COUNTRY[q.toLowerCase()] ?? q;
  const calls = [
    rb<RBStation[]>(`/json/stations/search?name=${enc(q)}&hidebroken=true&order=clickcount&reverse=true&limit=60`),
    rb<RBStation[]>(`/json/stations/search?country=${enc(countryEN)}&hidebroken=true&order=clickcount&reverse=true&limit=60`),
    rb<RBStation[]>(`/json/stations/search?tag=${enc(q)}&hidebroken=true&order=clickcount&reverse=true&limit=40`),
  ];
  const settled = await Promise.allSettled(calls);
  const merged: RBStation[] = [];
  const ids = new Set<string>();
  for (const r of settled) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      for (const s of r.value) { if (!ids.has(s.stationuuid)) { ids.add(s.stationuuid); merged.push(s); } }
    }
  }
  return clean(merged);
}

interface Playlist { id: string; name: string; stations: RGStation[]; }

interface Props {
  tr: Tr; onBack: () => void;
  playingStation: RGStation | null; isRadioPlaying: boolean;
  onPlayStation: (s: RGStation) => void; onPauseStation: () => void; onResumeStation: () => void;
}
type Tab = "local" | "top" | "favorites" | "playlist";

export function RadioPanel({ tr, onBack, playingStation, isRadioPlaying, onPlayStation, onPauseStation, onResumeStation }: Props) {
  const [tab, setTab]           = useState<Tab>("local");
  const [stations, setStations] = useState<RGStation[]>([]);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [query, setQuery]       = useState("");
  const [country, setCountry]   = useState("");
  const [shuffle, setShuffle]   = useState(false);
  const abortName = useRef(0);
  const [showHelp, setShowHelp] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const [favorites, setFavorites] = useState<Record<string, RGStation>>(() => { try { return JSON.parse(localStorage.getItem("rb_favs") || "{}"); } catch { return {}; } });
  const [playlists, setPlaylists] = useState<Playlist[]>(() => { try { return JSON.parse(localStorage.getItem("rb_playlists") || "[]"); } catch { return []; } });
  const [activePl, setActivePl]   = useState<string | null>(null);
  const [addFor, setAddFor]       = useState<RGStation | null>(null);
  const [newPlName, setNewPlName] = useState("");

  useEffect(() => { localStorage.setItem("rb_favs", JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem("rb_playlists", JSON.stringify(playlists)); }, [playlists]);

  const loadLocal = useCallback(async () => {
    setLoading(true); setError(null); setStatus(tr.detectingNear); setTab("local"); setActivePl(null);
    try {
      let cc = "";
      try { const geo = await (await fetch("https://get.geojs.io/v1/ip/geo.json", { signal: AbortSignal.timeout(7000) })).json(); cc = (geo.country_code || "").toUpperCase(); setCountry(geo.country || cc); } catch {}
      if (cc) {
        const list = await rb<RBStation[]>(`/json/stations/bycountrycodeexact/${cc}?hidebroken=true&order=clickcount&reverse=true&limit=120`);
        const cleaned = clean(list);
        if (cleaned.length) { setStations(cleaned); setStatus(tr.localStations(country || cc)); setLoading(false); return; }
      }
      setStatus(tr.couldNotDetect);
      setStations(clean(await rb<RBStation[]>(`/json/stations/topvote/120?hidebroken=true`)));
    } catch { setError(tr.errorStations); } finally { setLoading(false); }
  }, [tr, country]);

  const loadTop = useCallback(async () => {
    setLoading(true); setError(null); setStatus(""); setTab("top"); setActivePl(null);
    try { setStations(clean(await rb<RBStation[]>(`/json/stations/topvote/120?hidebroken=true`))); }
    catch { setError(tr.errorStations); } finally { setLoading(false); }
  }, [tr]);

  useEffect(() => { loadLocal(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (!query.trim()) return;
    const id = ++abortName.current;
    const handle = setTimeout(async () => {
      setLoading(true); setError(null); setStatus(""); setTab("local"); setActivePl(null);
      try { const list = await smartSearch(query); if (id === abortName.current) setStations(list); }
      catch { if (id === abortName.current) setError(tr.errorStations); }
      finally { if (id === abortName.current) setLoading(false); }
    }, 450);
    return () => clearTimeout(handle);
  }, [query, tr]);

  const toggleFav = (s: RGStation) => setFavorites(prev => { const n = { ...prev }; if (n[s.id]) delete n[s.id]; else n[s.id] = s; return n; });
  const handlePlay = (s: RGStation) => { if (playingStation?.id === s.id) { isRadioPlaying ? onPauseStation() : onResumeStation(); } else onPlayStation(s); };

  // ── Playlists ──
  const createPlaylist = (name: string, withStation?: RGStation) => {
    const pl: Playlist = { id: "pl_" + Date.now().toString(36), name: name.trim() || tr.newPlaylist, stations: withStation ? [withStation] : [] };
    setPlaylists(prev => [...prev, pl]); return pl.id;
  };
  const addToPlaylist = (plId: string, s: RGStation) => setPlaylists(prev => prev.map(p => p.id === plId && !p.stations.some(x => x.id === s.id) ? { ...p, stations: [...p.stations, s] } : p));
  const removeFromPlaylist = (plId: string, sid: string) => setPlaylists(prev => prev.map(p => p.id === plId ? { ...p, stations: p.stations.filter(x => x.id !== sid) } : p));
  const deletePlaylist = (plId: string) => { setPlaylists(prev => prev.filter(p => p.id !== plId)); if (activePl === plId) { setActivePl(null); setTab("local"); } };

  const favList = Object.values(favorites);
  const visible: RGStation[] =
    tab === "favorites" ? favList :
    tab === "playlist"  ? (playlists.find(p => p.id === activePl)?.stations ?? []) :
    stations;

  const playRandom = () => { if (visible.length) onPlayStation(visible[Math.floor(Math.random() * visible.length)]); };

  return (
    <div className="rp-root" style={ui}>
      {/* ── Left: search + list ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.textSecondary, fontSize: 12, cursor: "pointer", ...ui }}>
            <ArrowLeft size={13} />{tr.backToAudio}
          </button>
          <span style={{ flex: 1 }} />
          {/* API source badge + help */}
          <div ref={helpRef} style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 8px 5px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface }}>
              <Radio size={11} color={t.textSecondary} />
              <span style={{ fontSize: 11, color: t.textSecondary, ...mono }}>{tr.apiName}</span>
              <button onClick={() => setShowHelp(v => !v)} title={tr.radioLimitsTitle}
                style={{ background: "none", border: "none", cursor: "pointer", color: showHelp ? t.accent : t.textSecondary, display: "flex", padding: 0, marginLeft: 1 }}>
                <HelpCircle size={14} />
              </button>
            </div>
            {showHelp && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 290, background: "var(--stanssion-bg,#12121e)", border: `1px solid ${t.border}`, borderRadius: 11, boxShadow: "0 14px 36px rgba(0,0,0,0.5)", zIndex: 200, padding: 13 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: t.textPrimary, marginBottom: 9 }}>{tr.radioLimitsTitle}</p>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
                  {tr.radioLimits.map((line, i) => (
                    <li key={i} style={{ display: "flex", gap: 7, fontSize: 11.5, color: t.textSecondary, lineHeight: 1.45 }}>
                      <span style={{ color: t.accent, flexShrink: 0 }}>·</span><span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button onClick={() => setShuffle(s => !s)} title={tr.shuffle}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, cursor: "pointer", fontSize: 12, ...ui,
              border: `1px solid ${shuffle ? "rgba(62,207,142,0.4)" : t.border}`, background: shuffle ? "rgba(62,207,142,0.12)" : t.surface, color: shuffle ? t.success : t.textSecondary }}>
            <Shuffle size={13} />{tr.shuffle}
          </button>
          <button onClick={playRandom} disabled={!visible.length} title={tr.shuffle}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, cursor: visible.length ? "pointer" : "not-allowed", fontSize: 12, opacity: visible.length ? 1 : 0.4, ...ui,
              border: "1px solid rgba(124,92,191,0.4)", background: "rgba(124,92,191,0.1)", color: t.accentPurple }}>
            <Dice5 size={14} />Random
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button onClick={loadLocal} style={pill(tab === "local")}><MapPin size={13} />{tr.radioByLocation}</button>
          <button onClick={loadTop}   style={pill(tab === "top")}><Flame size={13} />{tr.radioTop}</button>
          <button onClick={() => { setTab("favorites"); setActivePl(null); }} style={pill(tab === "favorites")}><Heart size={13} />{tr.favoritesTab}{favList.length ? ` ${favList.length}` : ""}</button>
          {playlists.map(p => (
            <button key={p.id} onClick={() => { setTab("playlist"); setActivePl(p.id); }} style={pill(tab === "playlist" && activePl === p.id)}>
              <ListMusic size={12} />{p.name}
            </button>
          ))}
          <button onClick={() => { const id = createPlaylist(tr.newPlaylist); setTab("playlist"); setActivePl(id); }} title={tr.newPlaylist} style={{ ...pill(false), padding: "6px 9px" }}><Plus size={13} /></button>
        </div>

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", borderRadius: 10, background: t.surface, border: `1px solid ${t.border}` }}>
          <Search size={14} color={t.textSecondary} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tr.radioSearchAny}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: t.textPrimary, fontSize: 13, ...ui }} />
          {query
            ? <button onClick={() => { setQuery(""); loadLocal(); }} style={iconBtn()}><X size={14} /></button>
            : <button onClick={() => tab === "top" ? loadTop() : loadLocal()} title={tr.retryStations} style={iconBtn()}><RefreshCw size={13} /></button>}
        </div>

        {/* Playlist header (rename / delete) */}
        {tab === "playlist" && activePl && (() => {
          const pl = playlists.find(p => p.id === activePl); if (!pl) return null;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input value={pl.name} onChange={e => setPlaylists(prev => prev.map(p => p.id === pl.id ? { ...p, name: e.target.value } : p))}
                style={{ background: "none", border: "none", outline: "none", color: t.textPrimary, fontSize: 14, fontWeight: 600, ...ui }} />
              <span style={{ fontSize: 11, color: t.textSecondary }}>{pl.stations.length}</span>
              <span style={{ flex: 1 }} />
              <button onClick={() => deletePlaylist(pl.id)} style={{ ...iconBtn(), color: "#ef4444" }} title={tr.deleteSound}><X size={14} /></button>
            </div>
          );
        })()}

        {status && !loading && !error && tab !== "playlist" && tab !== "favorites" && <p style={{ fontSize: 11, color: t.textSecondary, margin: 0 }}>{status}</p>}

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5, minHeight: 120 }}>
          {loading && [...Array(8)].map((_, i) => (<div key={i} style={{ height: 56, borderRadius: 9, background: "rgba(128,128,160,0.06)", animation: "shimmer 1.4s infinite", animationDelay: `${i * 0.07}s` }} />))}

          {!loading && error && (
            <div style={{ padding: 24, textAlign: "center" }}>
              <p style={{ fontSize: 13, color: t.textSecondary, marginBottom: 10 }}>{error}</p>
              <button onClick={() => tab === "top" ? loadTop() : loadLocal()} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.textPrimary, fontSize: 12, cursor: "pointer", ...ui }}>{tr.retryStations}</button>
            </div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
              {tab === "favorites" ? <Heart size={28} color={t.border} /> : tab === "playlist" ? <ListMusic size={28} color={t.border} /> : <Radio size={28} color={t.border} />}
              <p style={{ fontSize: 13, color: t.textSecondary, textAlign: "center" }}>
                {tab === "favorites" ? tr.noFavoritesYet : tab === "playlist" ? tr.emptyPlaylist : tr.noStationsFound}
              </p>
            </div>
          )}

          {!loading && visible.map(s => (
            <StationRow key={s.id} station={s}
              isPlaying={playingStation?.id === s.id && isRadioPlaying}
              isActive={playingStation?.id === s.id}
              isFav={!!favorites[s.id]}
              onPlay={() => handlePlay(s)} onToggleFav={() => toggleFav(s)}
              onAdd={() => { setAddFor(s); setNewPlName(""); }}
              inPlaylist={tab === "playlist"} onRemove={() => activePl && removeFromPlaylist(activePl, s.id)} tr={tr} />
          ))}
        </div>
      </div>

      {/* ── Right: now playing ── */}
      <div className="rp-side">
        <NowPlaying station={playingStation} isPlaying={isRadioPlaying} onPause={onPauseStation} onResume={onResumeStation}
          isFav={playingStation ? !!favorites[playingStation.id] : false}
          onToggleFav={() => playingStation && toggleFav(playingStation)}
          favList={favList} onPlayFav={handlePlay} tr={tr} />
      </div>

      {/* Add-to-playlist popover */}
      {addFor && (
        <div onClick={() => setAddFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 300, background: "var(--stanssion-bg,#12121e)", border: `1px solid ${t.border}`, borderRadius: 12, padding: 14, boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, marginBottom: 4 }}>{tr.addToPlaylist}</p>
            <p style={{ fontSize: 11, color: t.textSecondary, marginBottom: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{addFor.title}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto", marginBottom: 10 }}>
              {playlists.length === 0 && <p style={{ fontSize: 12, color: t.textSecondary }}>{tr.emptyPlaylist}</p>}
              {playlists.map(p => (
                <button key={p.id} onClick={() => { addToPlaylist(p.id, addFor); setAddFor(null); }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.textPrimary, cursor: "pointer", fontSize: 13, ...ui }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}><ListMusic size={13} color={t.textSecondary} />{p.name}</span>
                  <span style={{ fontSize: 11, color: t.textSecondary }}>{p.stations.length}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={newPlName} onChange={e => setNewPlName(e.target.value)} placeholder={tr.playlistName} onKeyDown={e => { if (e.key === "Enter" && newPlName.trim()) { createPlaylist(newPlName, addFor); setAddFor(null); } }}
                style={{ flex: 1, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.textPrimary, fontSize: 12, outline: "none", ...ui }} />
              <button onClick={() => { if (newPlName.trim()) { createPlaylist(newPlName, addFor); setAddFor(null); } }}
                style={{ padding: "0 12px", borderRadius: 8, border: "1px solid rgba(79,142,247,0.4)", background: "rgba(79,142,247,0.14)", color: t.accent, cursor: "pointer", fontSize: 12, ...ui }}>{tr.newTimerShort}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer{0%,100%{opacity:0.4}50%{opacity:0.8}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        .rp-root{display:flex;gap:18px;height:100%;}
        .rp-side{width:260px;flex-shrink:0;}
        @media (max-width: 880px){ .rp-root{flex-direction:column;overflow-y:auto;} .rp-side{width:100%;} }
      `}</style>
    </div>
  );
}

function pill(active: boolean): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1px solid ${active ? "rgba(124,92,191,0.4)" : t.border}`, cursor: "pointer",
    fontSize: 12, fontWeight: active ? 500 : 400, ...ui, background: active ? "rgba(124,92,191,0.16)" : t.surface, color: active ? "#7c5cbf" : t.textSecondary };
}
function iconBtn(): React.CSSProperties { return { background: "none", border: "none", cursor: "pointer", color: t.textSecondary, display: "flex", padding: 0 }; }

function StationRow({ station, isPlaying, isActive, isFav, onPlay, onToggleFav, onAdd, inPlaylist, onRemove, tr }: {
  station: RGStation; isPlaying: boolean; isActive: boolean; isFav: boolean;
  onPlay: () => void; onToggleFav: () => void; onAdd: () => void; inPlaylist: boolean; onRemove: () => void; tr: Tr;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onPlay}
      style={{ padding: "10px 12px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.12s",
        border: `1px solid ${isActive ? "rgba(124,92,191,0.35)" : hov ? t.borderHover : t.border}`, background: isActive ? "rgba(124,92,191,0.08)" : hov ? t.surfaceHover : t.surface }}>
      <button onClick={e => { e.stopPropagation(); onPlay(); }}
        style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${isActive ? "rgba(124,92,191,0.5)" : t.border}`, background: isActive ? "rgba(124,92,191,0.18)" : t.surfaceHover, color: isActive ? "#7c5cbf" : t.textPrimary }}>
        {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: isActive ? "#7c5cbf" : t.textPrimary, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{station.title}</p>
        <p style={{ fontSize: 11, color: t.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{station.placeTitle || station.country}{isPlaying ? " · LIVE" : ""}</p>
      </div>
      {inPlaylist ? (
        <button onClick={e => { e.stopPropagation(); onRemove(); }} title={tr.removeFromList} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, flexShrink: 0, color: t.textSecondary, opacity: hov ? 1 : 0.5 }}><X size={14} /></button>
      ) : (
        <button onClick={e => { e.stopPropagation(); onAdd(); }} title={tr.addToPlaylist} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, flexShrink: 0, color: t.textSecondary, opacity: hov ? 1 : 0.5 }}><Plus size={15} /></button>
      )}
      <button onClick={e => { e.stopPropagation(); onToggleFav(); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, flexShrink: 0, color: isFav ? "#ef4444" : t.textSecondary, opacity: hov || isFav ? 1 : 0.5 }}>
        <Heart size={14} fill={isFav ? "#ef4444" : "none"} />
      </button>
    </div>
  );
}

function NowPlaying({ station, isPlaying, onPause, onResume, isFav, onToggleFav, favList, onPlayFav, tr }: {
  station: RGStation | null; isPlaying: boolean; onPause: () => void; onResume: () => void;
  isFav: boolean; onToggleFav: () => void; favList: RGStation[]; onPlayFav: (s: RGStation) => void; tr: Tr;
}) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>{tr.nowPlaying}</p>
      {station ? (
        <>
          <div style={{ width: "100%", aspectRatio: "1", borderRadius: 12, background: "rgba(124,92,191,0.12)", border: "1px solid rgba(124,92,191,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Wifi size={30} color="#7c5cbf" style={{ opacity: 0.6 }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, marginBottom: 4, lineHeight: 1.3 }}>{station.title}</p>
          <p style={{ fontSize: 11, color: t.textSecondary, marginBottom: 14 }}>{station.placeTitle} · {station.country}</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={isPlaying ? onPause : onResume}
              style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid rgba(124,92,191,0.4)", background: "rgba(124,92,191,0.16)", color: "#7c5cbf", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, ...ui }}>
              {isPlaying ? <><Pause size={14} fill="#7c5cbf" />{tr.pause}</> : <><Play size={14} fill="#7c5cbf" />{tr.play}</>}
            </button>
            <button onClick={onToggleFav} style={{ width: 42, height: 42, borderRadius: 10, border: `1px solid ${isFav ? "rgba(239,68,68,0.3)" : t.border}`, background: isFav ? "rgba(239,68,68,0.1)" : t.surfaceHover, color: isFav ? "#ef4444" : t.textSecondary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Heart size={15} fill={isFav ? "#ef4444" : "none"} />
            </button>
          </div>
          <p style={{ fontSize: 10, color: t.textSecondary, lineHeight: 1.5, marginTop: 10 }}>{tr.streamBlocked}</p>
        </>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Radio size={28} color={t.border} /><p style={{ fontSize: 12, color: t.textSecondary, textAlign: "center" }}>{tr.noStationsFound}</p>
        </div>
      )}
      {favList.length > 0 && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${t.border}`, paddingTop: 12, overflowY: "auto" }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: t.textSecondary, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{tr.favorites}</p>
          {favList.map(s => (
            <button key={s.id} onClick={() => onPlayFav(s)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 7, border: "none", background: "transparent", color: t.textPrimary, cursor: "pointer", fontSize: 12, textAlign: "left", ...ui }}>
              <Heart size={11} fill="#ef4444" color="#ef4444" style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
