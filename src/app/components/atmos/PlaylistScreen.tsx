import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Play, Pause, SkipBack, SkipForward, Music2, Trash2, ListMusic, Heart, Plus, Shuffle, X, Search, HelpCircle } from "lucide-react";
import { t, mono, ui } from "./tokens";
import type { Tr } from "./lang";

// Dedicated IndexedDB for playlist audio blobs
const DB = "stanssion-pl", STORE = "tracks";
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function put(id: string, b: Blob) { const d = await db(); return new Promise<void>((res) => { const tx = d.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(b, id); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
async function get(id: string): Promise<Blob | undefined> { const d = await db(); return new Promise((res) => { const tx = d.transaction(STORE, "readonly"); const rq = tx.objectStore(STORE).get(id); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(undefined); }); }
async function del(id: string) { const d = await db(); return new Promise<void>((res) => { const tx = d.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(id); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }

interface Track { id: string; name: string; duration: number; }
interface MPlaylist { id: string; name: string; trackIds: string[]; }
const fmt = (s: number) => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00";

export function PlaylistScreen({ tr, volume }: { tr: Tr; volume: number }) {
  const [tracks, setTracks]   = useState<Track[]>(() => { try { return JSON.parse(localStorage.getItem("ss_playlist") || "[]"); } catch { return []; } });
  const [favs, setFavs]       = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("ss_pl_favs") || "[]"); } catch { return []; } });
  const [lists, setLists]     = useState<MPlaylist[]>(() => { try { return JSON.parse(localStorage.getItem("ss_pl_lists") || "[]"); } catch { return []; } });
  const [tab, setTab]         = useState<string>("all"); // "all" | "favs" | listId
  const [search, setSearch]   = useState("");
  const [showSpace, setShowSpace] = useState(false);
  const spaceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (spaceRef.current && !spaceRef.current.contains(e.target as Node)) setShowSpace(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const [queue, setQueue]     = useState<string[]>([]);  // track ids in play order
  const [curId, setCurId]     = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [pos, setPos] = useState(0); const [dur, setDur] = useState(0);
  const [addFor, setAddFor] = useState<Track | null>(null);
  const [newListName, setNewListName] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => { localStorage.setItem("ss_playlist", JSON.stringify(tracks)); }, [tracks]);
  useEffect(() => { localStorage.setItem("ss_pl_favs", JSON.stringify(favs)); }, [favs]);
  useEffect(() => { localStorage.setItem("ss_pl_lists", JSON.stringify(lists)); }, [lists]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume / 100; }, [volume]);

  const byId = (id: string) => tracks.find(x => x.id === id);
  const baseVisible: Track[] =
    tab === "all"  ? tracks :
    tab === "favs" ? tracks.filter(x => favs.includes(x.id)) :
    (lists.find(l => l.id === tab)?.trackIds.map(byId).filter(Boolean) as Track[] ?? []);
  const visible: Track[] = search.trim()
    ? baseVisible.filter(x => x.name.toLowerCase().includes(search.trim().toLowerCase()))
    : baseVisible;

  const loadAndPlay = useCallback(async (id: string, q: string[]) => {
    const blob = await get(id); if (!blob) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob); urlRef.current = url;
    const el = audioRef.current!; el.src = url; el.volume = volume / 100;
    setQueue(q); setCurId(id);
    el.play().then(() => setPlaying(true)).catch(() => {});
  }, [volume]);

  const playTrack = (trk: Track) => loadAndPlay(trk.id, visible.map(x => x.id));

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    files.forEach(f => {
      const id = "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const tmp = new Audio(URL.createObjectURL(f));
      tmp.onloadedmetadata = () => { put(id, f).then(() => setTracks(prev => [...prev, { id, name: f.name.replace(/\.[^.]+$/, ""), duration: tmp.duration }])); };
    });
  };

  const togglePlay = () => {
    const el = audioRef.current!;
    if (!curId && visible.length) { playTrack(visible[0]); return; }
    if (playing) { el.pause(); setPlaying(false); } else { el.play().then(() => setPlaying(true)).catch(() => {}); }
  };
  const step = (dir: 1 | -1) => {
    if (!queue.length) return;
    if (shuffle) { loadAndPlay(queue[Math.floor(Math.random() * queue.length)], queue); return; }
    const i = curId ? queue.indexOf(curId) : -1;
    loadAndPlay(queue[(i + dir + queue.length) % queue.length], queue);
  };

  const toggleFav = (id: string) => setFavs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const removeTrack = (id: string) => {
    del(id); setTracks(prev => prev.filter(x => x.id !== id));
    setFavs(prev => prev.filter(x => x !== id));
    setLists(prev => prev.map(l => ({ ...l, trackIds: l.trackIds.filter(x => x !== id) })));
    if (id === curId) { audioRef.current?.pause(); setPlaying(false); setCurId(null); }
  };
  const clearAll = () => {
    if (!tracks.length) return;
    if (!confirm(tr.clearAllConfirm)) return;
    tracks.forEach(t => del(t.id));
    audioRef.current?.pause();
    setPlaying(false); setCurId(null); setQueue([]);
    setTracks([]); setFavs([]);
    setLists(prev => prev.map(l => ({ ...l, trackIds: [] })));
  };
  const createList = (name: string, withId?: string) => { const l: MPlaylist = { id: "l_" + Date.now().toString(36), name: name.trim() || tr.newPlaylist, trackIds: withId ? [withId] : [] }; setLists(prev => [...prev, l]); return l.id; };
  const addToList = (lid: string, id: string) => setLists(prev => prev.map(l => l.id === lid && !l.trackIds.includes(id) ? { ...l, trackIds: [...l.trackIds, id] } : l));
  const deleteList = (lid: string) => { setLists(prev => prev.filter(l => l.id !== lid)); if (tab === lid) setTab("all"); };

  const cur = curId ? byId(curId) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 760, margin: "0 auto", width: "100%", ...ui }}>
      <audio ref={audioRef} onTimeUpdate={e => setPos((e.target as HTMLAudioElement).currentTime)} onLoadedMetadata={e => setDur((e.target as HTMLAudioElement).duration)} onEnded={() => step(1)} style={{ display: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ListMusic size={20} color={t.accent} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: t.textPrimary }}>{tr.playlist}</h2>
          <p style={{ fontSize: 12, color: t.textSecondary }}>{tracks.length} · MP3 / WAV / FLAC</p>
        </div>
        {/* Storage help (?) */}
        <div ref={spaceRef} style={{ position: "relative" }}>
          <button onClick={() => setShowSpace(v => !v)} title={tr.spaceHelpTitle}
            style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${t.border}`, background: t.surface, color: showSpace ? t.accent : t.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HelpCircle size={16} />
          </button>
          {showSpace && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 290, background: "var(--stanssion-bg,#12121e)", border: `1px solid ${t.border}`, borderRadius: 11, boxShadow: "0 14px 36px rgba(0,0,0,0.5)", zIndex: 200, padding: 13 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: t.textPrimary, marginBottom: 9 }}>{tr.spaceHelpTitle}</p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
                {tr.spaceHelp.map((line, i) => (
                  <li key={i} style={{ display: "flex", gap: 7, fontSize: 11.5, color: t.textSecondary, lineHeight: 1.45 }}>
                    <span style={{ color: t.accent, flexShrink: 0 }}>·</span><span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {tracks.length > 0 && (
          <button onClick={clearAll} title={tr.clearAll}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, ...ui,
              border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
            <Trash2 size={14} />{tr.clearAll}
          </button>
        )}
        <button onClick={() => setShuffle(s => !s)} title={tr.shuffle}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, ...ui,
            border: `1px solid ${shuffle ? "rgba(62,207,142,0.4)" : t.border}`, background: shuffle ? "rgba(62,207,142,0.12)" : t.surface, color: shuffle ? t.success : t.textSecondary }}>
          <Shuffle size={14} />{tr.shuffle}
        </button>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${t.accent},#7c5cbf)`, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 10px rgba(79,142,247,0.3)", ...ui }}>
          <Upload size={14} />{tr.uploadAudioFile}
          <input ref={fileRef} type="file" accept="audio/*" multiple onChange={onUpload} style={{ display: "none" }} />
        </label>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => setTab("all")} style={pill(tab === "all")}>{tr.allTab} {tracks.length}</button>
        <button onClick={() => setTab("favs")} style={pill(tab === "favs")}><Heart size={12} />{tr.favoritesTab} {favs.length}</button>
        {lists.map(l => (
          <button key={l.id} onClick={() => setTab(l.id)} style={pill(tab === l.id)}><ListMusic size={12} />{l.name}</button>
        ))}
        <button onClick={() => { const id = createList(tr.newPlaylist); setTab(id); }} title={tr.newPlaylist} style={{ ...pill(false), padding: "6px 9px" }}><Plus size={13} /></button>
      </div>

      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", borderRadius: 10, background: t.surface, border: `1px solid ${t.border}`, marginBottom: 12 }}>
        <Search size={14} color={t.textSecondary} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr.search}
          style={{ flex: 1, background: "none", border: "none", outline: "none", color: t.textPrimary, fontSize: 13, ...ui }} />
        {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: t.textSecondary, display: "flex", padding: 0 }}><X size={14} /></button>}
      </div>

      {/* Active playlist header */}
      {tab !== "all" && tab !== "favs" && (() => {
        const l = lists.find(x => x.id === tab); if (!l) return null;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <input value={l.name} onChange={e => setLists(prev => prev.map(x => x.id === l.id ? { ...x, name: e.target.value } : x))}
              style={{ background: "none", border: "none", outline: "none", color: t.textPrimary, fontSize: 14, fontWeight: 600, ...ui }} />
            <span style={{ flex: 1 }} />
            <button onClick={() => deleteList(l.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}><X size={15} /></button>
          </div>
        );
      })()}

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }} className="ss-scroll">
        {visible.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 40 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(79,142,247,0.08)", border: "1px solid rgba(79,142,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Music2 size={30} color={t.accent} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 13, color: t.textSecondary, textAlign: "center", maxWidth: 320, lineHeight: 1.6 }}>
              {search ? tr.noMatches : tab === "favs" ? tr.noFavoritesYet : tab === "all" ? tr.playlistWebDesc : tr.emptyMusicPlaylist}
            </p>
            {tab === "all" && !search && (
              <button onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 9, border: "1px solid rgba(79,142,247,0.4)", background: "rgba(79,142,247,0.12)", color: t.accent, fontSize: 13, fontWeight: 500, cursor: "pointer", ...ui }}>
                <Upload size={14} />{tr.uploadAudioFile}
              </button>
            )}
          </div>
        ) : visible.map((trk) => {
          const active = trk.id === curId;
          return (
            <div key={trk.id} onClick={() => playTrack(trk)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                border: `1px solid ${active ? "rgba(79,142,247,0.35)" : t.border}`, background: active ? "rgba(79,142,247,0.08)" : t.surface }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: active ? "rgba(79,142,247,0.18)" : t.surfaceHover, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: active ? t.accent : t.textSecondary }}>
                {active && playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: 2 }} />}
              </div>
              <p style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: active ? t.accent : t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trk.name}</p>
              <span style={{ fontSize: 11, color: t.textSecondary, ...mono }}>{fmt(trk.duration)}</span>
              <button onClick={e => { e.stopPropagation(); toggleFav(trk.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: favs.includes(trk.id) ? "#ef4444" : t.textSecondary }}><Heart size={14} fill={favs.includes(trk.id) ? "#ef4444" : "none"} /></button>
              <button onClick={e => { e.stopPropagation(); setAddFor(trk); setNewListName(""); }} title={tr.addToPlaylist} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: t.textSecondary }}><Plus size={15} /></button>
              <button onClick={e => { e.stopPropagation(); removeTrack(trk.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: t.textSecondary }}><Trash2 size={13} /></button>
            </div>
          );
        })}
      </div>

      {/* Player bar */}
      {cur && (
        <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 12, background: t.surface, border: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur.name}</p>
              {shuffle && <p style={{ fontSize: 10, color: t.success }}>{tr.shuffle}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => step(-1)} style={ctrl()}><SkipBack size={15} /></button>
              <button onClick={togglePlay} style={{ ...ctrl(), width: 44, height: 44, background: "rgba(79,142,247,0.16)", border: "1px solid rgba(79,142,247,0.4)", color: t.accent }}>
                {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
              </button>
              <button onClick={() => step(1)} style={ctrl()}><SkipForward size={15} /></button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, color: t.textSecondary, ...mono, width: 34 }}>{fmt(pos)}</span>
            <div style={{ position: "relative", flex: 1, height: 4, background: t.border, borderRadius: 2 }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${dur ? (pos / dur) * 100 : 0}%`, background: `linear-gradient(90deg,${t.accent},#7c5cbf)`, borderRadius: 2 }} />
              <input type="range" min={0} max={dur || 0} value={pos} step={0.1} onChange={e => { const v = Number(e.target.value); if (audioRef.current) audioRef.current.currentTime = v; setPos(v); }}
                style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", height: "100%" }} />
            </div>
            <span style={{ fontSize: 10, color: t.textSecondary, ...mono, width: 34, textAlign: "right" }}>{fmt(dur)}</span>
          </div>
        </div>
      )}

      {/* Add-to-list popover */}
      {addFor && (
        <div onClick={() => setAddFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 300, background: "var(--stanssion-bg,#12121e)", border: `1px solid ${t.border}`, borderRadius: 12, padding: 14, boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, marginBottom: 4 }}>{tr.addToPlaylist}</p>
            <p style={{ fontSize: 11, color: t.textSecondary, marginBottom: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{addFor.name}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto", marginBottom: 10 }}>
              {lists.length === 0 && <p style={{ fontSize: 12, color: t.textSecondary }}>{tr.emptyMusicPlaylist}</p>}
              {lists.map(l => (
                <button key={l.id} onClick={() => { addToList(l.id, addFor.id); setAddFor(null); }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.textPrimary, cursor: "pointer", fontSize: 13, ...ui }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}><ListMusic size={13} color={t.textSecondary} />{l.name}</span>
                  <span style={{ fontSize: 11, color: t.textSecondary }}>{l.trackIds.length}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder={tr.playlistName} onKeyDown={e => { if (e.key === "Enter" && newListName.trim()) { createList(newListName, addFor.id); setAddFor(null); } }}
                style={{ flex: 1, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.textPrimary, fontSize: 12, outline: "none", ...ui }} />
              <button onClick={() => { if (newListName.trim()) { createList(newListName, addFor.id); setAddFor(null); } }}
                style={{ padding: "0 12px", borderRadius: 8, border: "1px solid rgba(79,142,247,0.4)", background: "rgba(79,142,247,0.14)", color: t.accent, cursor: "pointer", fontSize: 12, ...ui }}>{tr.newTimerShort}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function pill(active: boolean): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1px solid ${active ? "rgba(79,142,247,0.4)" : t.border}`, cursor: "pointer",
    fontSize: 12, fontWeight: active ? 500 : 400, ...ui, background: active ? "rgba(79,142,247,0.16)" : t.surface, color: active ? t.accent : t.textSecondary };
}
function ctrl(): React.CSSProperties { return { width: 34, height: 34, borderRadius: "50%", border: `1px solid ${t.border}`, background: t.surfaceHover, color: t.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }; }
