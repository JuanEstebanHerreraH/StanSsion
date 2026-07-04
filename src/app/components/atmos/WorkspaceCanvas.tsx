import { useState, useRef, useCallback, useEffect } from "react";
import {
  MousePointer2, StickyNote, CheckSquare, Image as ImageIcon, Link2,
  ZoomIn, ZoomOut, Maximize, Download, Upload, Trash2, Palette, Unlink, X, Plus,
} from "lucide-react";
import { t, ui } from "./tokens";
import type { Tr } from "./lang";

type NodeType = "note" | "task" | "image";
interface TaskItem { text: string; done: boolean; }
interface CNode {
  id: string; type: NodeType;
  x: number; y: number; w: number; h: number;
  title: string; content: string; color: string;
  tasks?: TaskItem[]; src?: string;
}
interface Conn { id: string; from: string; to: string; }
interface CanvasData { nodes: CNode[]; conns: Conn[]; }

const STORE = "ss_canvas";
const COLORS = ["#f5a623", "#4f8ef7", "#7c5cbf", "#3ecf8e", "#ef4444", "#ec4899"];

const DEFAULT: CanvasData = {
  nodes: [
    { id: "n1", type: "note", x: 80,  y: 80,  w: 220, h: 130, title: "Ambient layers", content: "Rain + cafe noise = focus. Density ~70% feels natural.", color: "#f5a623" },
    { id: "n2", type: "task", x: 380, y: 60,  w: 230, h: 170, title: "Today", content: "", color: "#4f8ef7",
      tasks: [{ text: "Design mixer UI", done: false }, { text: "Add preset export", done: true }, { text: "Fix radio buffer", done: false }] },
    { id: "n3", type: "note", x: 180, y: 280, w: 210, h: 120, title: "Idea", content: "Binaural beat layer — different freqs per mode.", color: "#7c5cbf" },
  ],
  conns: [{ id: "c1", from: "n3", to: "n2" }],
};

function load(): CanvasData {
  try { const v = localStorage.getItem(STORE); if (v) return JSON.parse(v); } catch {}
  return DEFAULT;
}

let _id = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(_id++).toString(36)}`;

export function WorkspaceCanvas({ tr }: { tr: Tr }) {
  const [data, setData]       = useState<CanvasData>(load);
  const [tool, setTool]       = useState<NodeType | "select" | "connect">("select");
  const [sel, setSel]         = useState<string | null>(null);
  const [selConn, setSelConn] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [scale, setScale]     = useState(1);
  const [pan, setPan]         = useState({ x: 30, y: 30 });
  const [name, setName]       = useState(() => { try { return localStorage.getItem("ss_canvas_name") || "StanSsion Workspace"; } catch { return "StanSsion Workspace"; } });

  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const drag = useRef<any>(null);
  const pendingImgPos = useRef<{ x: number; y: number } | null>(null);

  // Persist
  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(data)); }, [data]);
  useEffect(() => { localStorage.setItem("ss_canvas_name", name); }, [name]);

  // Clear-canvas from Settings
  useEffect(() => {
    const h = () => { setData({ nodes: [], conns: [] }); localStorage.setItem(STORE, JSON.stringify({ nodes: [], conns: [] })); setSel(null); setSelConn(null); };
    window.addEventListener("ss:clear-canvas", h);
    return () => window.removeEventListener("ss:clear-canvas", h);
  }, []);

  const toWorld = (clientX: number, clientY: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left - pan.x) / scale, y: (clientY - r.top - pan.y) / scale };
  };

  const patch = (id: string, p: Partial<CNode>) => setData(d => ({ ...d, nodes: d.nodes.map(n => n.id === id ? { ...n, ...p } : n) }));
  const removeNode = (id: string) => setData(d => ({ nodes: d.nodes.filter(n => n.id !== id), conns: d.conns.filter(c => c.from !== id && c.to !== id) }));
  const removeConn = (id: string) => setData(d => ({ ...d, conns: d.conns.filter(c => c.id !== id) }));

  const addNode = (type: NodeType, x: number, y: number, extra: Partial<CNode> = {}) => {
    const base: CNode = {
      id: uid("n"), type, x: x - 100, y: y - 50,
      w: type === "image" ? 200 : type === "task" ? 230 : 210,
      h: type === "image" ? 150 : type === "task" ? 160 : 120,
      title: type === "note" ? "Note" : type === "task" ? "Tasks" : "Image",
      content: "", color: COLORS[Math.floor(Math.random() * COLORS.length)],
      ...(type === "task" ? { tasks: [] } : {}), ...extra,
    };
    setData(d => ({ ...d, nodes: [...d.nodes, base] }));
    setSel(base.id);
    return base.id;
  };

  // ── Canvas background interactions ───────────────────────────────────────
  const onBgMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.bg) return;
    setSel(null); setSelConn(null); setEditing(null);
    const w = toWorld(e.clientX, e.clientY);
    if (tool === "note" || tool === "task") { addNode(tool, w.x, w.y); setTool("select"); return; }
    if (tool === "image") { pendingImgPos.current = w; fileRef.current?.click(); return; }
    // Select/Connect → pan
    drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  };

  const onNodeMouseDown = (e: React.MouseEvent, n: CNode) => {
    e.stopPropagation();
    if (tool === "connect") {
      if (!connectFrom) { setConnectFrom(n.id); }
      else if (connectFrom !== n.id) {
        setData(d => ({ ...d, conns: [...d.conns, { id: uid("c"), from: connectFrom, to: n.id }] }));
        setConnectFrom(null); setTool("select");
      }
      return;
    }
    setSel(n.id); setSelConn(null);
    drag.current = { kind: "move", id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y };
  };

  const onResizeMouseDown = (e: React.MouseEvent, n: CNode) => {
    e.stopPropagation();
    drag.current = { kind: "resize", id: n.id, sx: e.clientX, sy: e.clientY, ow: n.w, oh: n.h };
  };

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const d = drag.current; if (!d) return;
    if (d.kind === "pan") { setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) }); return; }
    const dx = (e.clientX - d.sx) / scale, dy = (e.clientY - d.sy) / scale;
    if (d.kind === "move")   patch(d.id, { x: d.ox + dx, y: d.oy + dy });
    if (d.kind === "resize") patch(d.id, { w: Math.max(120, d.ow + dx), h: Math.max(80, d.oh + dy) });
  }, [scale]);

  const onMouseUp = useCallback(() => { drag.current = null; }, []);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const r = wrapRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const next = Math.min(2.5, Math.max(0.3, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    // zoom toward cursor
    setPan(p => ({ x: mx - (mx - p.x) * (next / scale), y: my - (my - p.y) * (next / scale) }));
    setScale(next);
  };

  // ── Image upload + paste ─────────────────────────────────────────────────
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height || 1;
        const w = 240, h = Math.round(w / ratio);
        const pos = pendingImgPos.current ?? toWorld(window.innerWidth / 2, window.innerHeight / 2);
        addNode("image", pos.x + 100, pos.y + 50, { src, w, h, title: f.name.slice(0, 24) });
        pendingImgPos.current = null;
      };
      img.src = src;
    };
    reader.readAsDataURL(f);
    setTool("select");
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items; if (!items) return;
      for (const it of items) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile(); if (!f) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const src = reader.result as string;
            const img = new Image();
            img.onload = () => {
              const ratio = img.width / img.height || 1;
              const w = 240, h = Math.round(w / ratio);
              const r = wrapRef.current?.getBoundingClientRect();
              const cx = r ? (r.width / 2 - pan.x) / scale : 200;
              const cy = r ? (r.height / 2 - pan.y) / scale : 200;
              addNode("image", cx + 100, cy + 50, { src, w, h, title: "Pasted image" });
            };
            img.src = src;
          };
          reader.readAsDataURL(f);
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pan, scale]);

  // ── Export / Import (free replacement for "Share") ────────────────────────
  const exportBoard = () => {
    const blob = new Blob([JSON.stringify({ name, ...data }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/\s+/g, "_") || "board"}.json`;
    a.click();
  };
  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    f.text().then(txt => {
      try { const j = JSON.parse(txt); if (j.nodes) { setData({ nodes: j.nodes, conns: j.conns || [] }); if (j.name) setName(j.name); } }
      catch { alert("Invalid board file"); }
    });
  };

  const fitView = () => { setScale(1); setPan({ x: 30, y: 30 }); };

  const TOOLS: { id: typeof tool; icon: React.ReactNode; label: string }[] = [
    { id: "select",  icon: <MousePointer2 size={16} />, label: tr.toolSelect },
    { id: "note",    icon: <StickyNote size={16} />,    label: tr.toolNote },
    { id: "task",    icon: <CheckSquare size={16} />,   label: tr.toolTask },
    { id: "image",   icon: <ImageIcon size={16} />,     label: tr.toolImage },
    { id: "connect", icon: <Link2 size={16} />,         label: tr.toolConnect },
  ];

  const nodeById = (id: string) => data.nodes.find(n => n.id === id);
  const edgePath = (a: CNode, b: CNode) => {
    const ax = a.x + a.w, ay = a.y + a.h / 2, bx = b.x, by = b.y + b.h / 2;
    return `M${ax},${ay} C${ax + 50},${ay} ${bx - 50},${by} ${bx},${by}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", ...ui }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 14px", borderRadius: 10, background: t.surface, border: `1px solid ${t.border}`, flexWrap: "wrap" }}>
        <input value={name} onChange={e => setName(e.target.value)}
          style={{ background: "none", border: "none", outline: "none", color: t.textPrimary, fontSize: 14, fontWeight: 500, ...ui, flex: 1, minWidth: 120 }} />
        <input ref={importRef} type="file" accept="application/json" onChange={onImport} style={{ display: "none" }} />
        <button onClick={() => importRef.current?.click()} style={topBtn()}><Upload size={13} />{tr.importBoard}</button>
        <button onClick={exportBoard} style={topBtn(true)}><Download size={13} />{tr.exportBoard}</button>
      </div>

      {/* Canvas */}
      <div ref={wrapRef} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}
        style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: 12, border: `1px solid ${t.border}`, background: "var(--stanssion-bg,#0a0a0f)" }}>

        {/* Background (pannable) */}
        <div data-bg="1" onMouseDown={onBgMouseDown}
          style={{ position: "absolute", inset: 0, cursor: tool === "select" || tool === "connect" ? "grab" : "crosshair",
            backgroundImage: "radial-gradient(circle, rgba(128,128,160,0.15) 1px, transparent 1px)",
            backgroundSize: `${24 * scale}px ${24 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}>

          {/* World layer */}
          <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, transformOrigin: "0 0", pointerEvents: "none" }}>
            {/* Connections */}
            <svg width="1" height="1" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
              <defs>
                <marker id="arr" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                  <polygon points="0 0, 9 3.5, 0 7" fill="rgba(124,92,191,0.7)" />
                </marker>
              </defs>
              {data.conns.map(c => {
                const a = nodeById(c.from), b = nodeById(c.to); if (!a || !b) return null;
                const dPath = edgePath(a, b);
                const active = selConn === c.id;
                return (
                  <g key={c.id} style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onMouseDown={e => { e.stopPropagation(); setSelConn(c.id); setSel(null); }}>
                    <path d={dPath} stroke="transparent" strokeWidth={14} fill="none" />
                    <path d={dPath} stroke={active ? "#ec4899" : "rgba(124,92,191,0.6)"} strokeWidth={active ? 2.5 : 1.6}
                      fill="none" strokeDasharray="5 4" markerEnd="url(#arr)" />
                  </g>
                );
              })}
            </svg>

            {/* Connection delete button at midpoint */}
            {selConn && (() => {
              const c = data.conns.find(x => x.id === selConn); const a = c && nodeById(c.from); const b = c && nodeById(c.to);
              if (!a || !b) return null;
              const mx = (a.x + a.w + b.x) / 2, my = (a.y + a.h / 2 + b.y + b.h / 2) / 2;
              return (
                <button onMouseDown={e => { e.stopPropagation(); removeConn(selConn); setSelConn(null); }}
                  style={{ position: "absolute", left: mx - 50, top: my - 14, pointerEvents: "auto", display: "flex", alignItems: "center", gap: 5,
                    padding: "4px 10px", borderRadius: 7, border: "1px solid rgba(236,72,153,0.4)", background: "#1a1426", color: "#ec4899", fontSize: 11, cursor: "pointer", ...ui }}>
                  <Unlink size={11} />{tr.disconnect}
                </button>
              );
            })()}

            {/* Nodes */}
            {data.nodes.map(n => {
              const selected = sel === n.id;
              const isConnSrc = connectFrom === n.id;
              return (
                <div key={n.id} onMouseDown={e => onNodeMouseDown(e, n)}
                  style={{ position: "absolute", left: n.x, top: n.y, width: n.w, height: n.h, pointerEvents: "auto",
                    background: n.type === "image" ? "rgba(0,0,0,0.2)" : `${n.color}1a`,
                    backdropFilter: "blur(8px)",
                    border: `1px solid ${selected ? "rgba(79,142,247,0.6)" : isConnSrc ? "#ec4899" : `${n.color}55`}`,
                    borderRadius: 10, padding: n.type === "image" ? 0 : 12, overflow: "hidden",
                    cursor: tool === "connect" ? "crosshair" : "grab", userSelect: "none",
                    boxShadow: selected ? "0 0 0 2px rgba(79,142,247,0.25), 0 6px 22px rgba(0,0,0,0.4)" : "0 2px 12px rgba(0,0,0,0.3)",
                    display: "flex", flexDirection: "column", zIndex: selected ? 10 : 2 }}>

                  {n.type === "image" ? (
                    <img src={n.src} alt={n.title} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 9, pointerEvents: "none" }} />
                  ) : (
                    <>
                      <input value={n.title} onChange={e => patch(n.id, { title: e.target.value })} onMouseDown={e => e.stopPropagation()}
                        style={{ background: "none", border: "none", outline: "none", color: t.textPrimary, fontSize: 12.5, fontWeight: 600, marginBottom: 6, width: "100%", ...ui }} />
                      {n.type === "task" ? (
                        <TaskList node={n} patch={patch} />
                      ) : editing === n.id ? (
                        <textarea autoFocus defaultValue={n.content}
                          onMouseDown={e => e.stopPropagation()}
                          onBlur={e => { patch(n.id, { content: e.target.value }); setEditing(null); }}
                          onKeyDown={e => { if (e.key === "Escape") setEditing(null); e.stopPropagation(); }}
                          style={{ flex: 1, width: "100%", background: "rgba(128,128,160,0.08)", border: `1px solid ${t.accent}44`, borderRadius: 6, color: t.textPrimary, fontSize: 11.5, lineHeight: 1.5, padding: 6, resize: "none", outline: "none", ...ui }} />
                      ) : (
                        <p onDoubleClick={e => { e.stopPropagation(); setEditing(n.id); }} title="Double-click to edit"
                          style={{ fontSize: 11.5, color: t.textSecondary, lineHeight: 1.5, cursor: "text", flex: 1, overflow: "hidden" }}>
                          {n.content || <span style={{ opacity: 0.4 }}>{tr.toolNote}…</span>}
                        </p>
                      )}
                    </>
                  )}

                </div>
              );
            })}

            {/* Selected node toolbar + resize handle — rendered OUTSIDE the nodes so the
                node's overflow:hidden can't clip them (this was the delete/resize bug) */}
            {sel && (() => {
              const n = nodeById(sel); if (!n) return null;
              return (
                <>
                  <div onMouseDown={e => e.stopPropagation()}
                    style={{ position: "absolute", left: n.x + n.w / 2, top: n.y - 38, transform: "translateX(-50%)", display: "flex", gap: 2, background: "#18182a", border: `1px solid ${t.border}`, borderRadius: 8, padding: 3, boxShadow: "0 4px 16px rgba(0,0,0,0.5)", zIndex: 30, pointerEvents: "auto" }}>
                    {n.type !== "image" && (
                      <button onClick={() => setEditing(n.id)} style={ctxBtn()} title="Edit"><StickyNote size={13} /></button>
                    )}
                    <label style={{ ...ctxBtn(), position: "relative" }} title={tr.color}>
                      <Palette size={13} />
                      <input type="color" value={n.color} onChange={e => patch(n.id, { color: e.target.value })} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
                    </label>
                    <button onClick={() => { setTool("connect"); setConnectFrom(n.id); }} style={ctxBtn()} title={tr.toolConnect}><Link2 size={13} /></button>
                    <button onClick={() => { removeNode(n.id); setSel(null); }} style={{ ...ctxBtn(), color: "#ef4444" }} title="Delete"><Trash2 size={13} /></button>
                  </div>
                  <div onMouseDown={e => onResizeMouseDown(e, n)}
                    style={{ position: "absolute", left: n.x + n.w - 5, top: n.y + n.h - 5, width: 14, height: 14, borderRadius: 3, background: "#fff", border: `2px solid ${t.accent}`, cursor: "se-resize", zIndex: 30, pointerEvents: "auto" }} />
                </>
              );
            })()}
          </div>

          {/* Empty state */}
          {data.nodes.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, pointerEvents: "none" }}>
              <Plus size={36} color={t.border} />
              <p style={{ fontSize: 13, color: t.textSecondary, textAlign: "center", maxWidth: 280 }}>{tr.canvasHint}</p>
            </div>
          )}
        </div>

        {/* Hidden inputs */}
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />

        {/* Connect hint */}
        {tool === "connect" && (
          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", padding: "7px 14px", borderRadius: 8, background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.3)", color: "#ec4899", fontSize: 12, zIndex: 40 }}>
            {connectFrom ? (tr.toolConnect + " → …") : tr.toolConnect}
            <button onClick={() => { setTool("select"); setConnectFrom(null); }} style={{ background: "none", border: "none", color: "#ec4899", cursor: "pointer", marginLeft: 8, verticalAlign: "middle" }}><X size={12} /></button>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 4, background: "rgba(16,16,26,0.92)", border: `1px solid ${t.border}`, borderRadius: 10, padding: 6, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", zIndex: 30 }}>
          {TOOLS.map(tl => (
            <button key={tl.id as string} title={tl.label} onClick={() => { setTool(tl.id); setConnectFrom(null); }}
              style={{ width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                background: tool === tl.id ? "rgba(79,142,247,0.18)" : "transparent", color: tool === tl.id ? t.accent : t.textSecondary }}>
              {tl.icon}
            </button>
          ))}
        </div>

        {/* Zoom controls */}
        <div style={{ position: "absolute", bottom: 14, right: 14, display: "flex", gap: 4, background: "rgba(16,16,26,0.92)", border: `1px solid ${t.border}`, borderRadius: 8, padding: 4, zIndex: 30 }}>
          <button onClick={() => setScale(s => Math.max(0.3, +(s - 0.1).toFixed(2)))} style={zBtn()}><ZoomOut size={13} /></button>
          <span style={{ fontSize: 11, color: t.textSecondary, display: "flex", alignItems: "center", padding: "0 6px", fontFamily: "'JetBrains Mono',monospace", minWidth: 40, justifyContent: "center" }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.5, +(s + 0.1).toFixed(2)))} style={zBtn()}><ZoomIn size={13} /></button>
          <button onClick={fitView} title={tr.fitView} style={zBtn()}><Maximize size={12} /></button>
        </div>
      </div>
    </div>
  );
}

function TaskList({ node, patch }: { node: CNode; patch: (id: string, p: Partial<CNode>) => void }) {
  const [val, setVal] = useState("");
  const tasks = node.tasks ?? [];
  const set = (tasks: TaskItem[]) => patch(node.id, { tasks });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, overflowY: "auto" }} onMouseDown={e => e.stopPropagation()}>
      {tasks.map((task, i) => (
        <label key={i} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
          <input type="checkbox" checked={task.done} onChange={() => set(tasks.map((x, j) => j === i ? { ...x, done: !x.done } : x))}
            style={{ accentColor: node.color, width: 13, height: 13 }} />
          <span style={{ fontSize: 11.5, color: task.done ? t.textSecondary : t.textPrimary, textDecoration: task.done ? "line-through" : "none", flex: 1 }}>{task.text}</span>
          <button onClick={() => set(tasks.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: t.textSecondary, cursor: "pointer", padding: 0 }}><X size={10} /></button>
        </label>
      ))}
      <input value={val} onChange={e => setVal(e.target.value)} placeholder="+ task"
        onKeyDown={e => { if (e.key === "Enter" && val.trim()) { set([...tasks, { text: val.trim(), done: false }]); setVal(""); } e.stopPropagation(); }}
        style={{ background: "none", border: "none", borderBottom: `1px solid ${t.border}`, outline: "none", color: t.textPrimary, fontSize: 11, padding: "2px 0", ...ui }} />
    </div>
  );
}

function topBtn(primary = false): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7, cursor: "pointer", fontSize: 12, ...ui,
    border: `1px solid ${primary ? "rgba(79,142,247,0.4)" : t.border}`, background: primary ? "rgba(79,142,247,0.12)" : "transparent", color: primary ? t.accent : t.textSecondary };
}
function ctxBtn(): React.CSSProperties {
  return { width: 28, height: 26, borderRadius: 6, border: "none", background: "transparent", color: t.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
}
function zBtn(): React.CSSProperties {
  return { width: 28, height: 26, borderRadius: 6, border: "none", background: "transparent", color: t.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
}
