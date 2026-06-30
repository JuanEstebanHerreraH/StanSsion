import { useState, useEffect, useRef } from "react";
import { ChevronDown, Radio, RefreshCw, Play, Pause, Plus, X, Star, Search, Upload, Trash2 } from "lucide-react";
import { t, mono, ui } from "./tokens";
import type { Tr, Lang } from "./lang";
import type { RGStation } from "../../App";
import { ambientEngine, BUILTIN_SOUNDS } from "./AudioEngine";
import { loadCustoms, addCustom, removeCustom, metaFor, type CustomSound } from "./ambientStore";

// Kept here because App + PlayerBar import this type.
export interface TimerState {
  seconds: number; running: boolean; timerTab: number;
  setSeconds: (s: number) => void;
  setRunning: (r: boolean | ((p: boolean) => boolean)) => void;
  setTimerTab: (i: number) => void;
}

interface StanEvent {
  id: string; name: string; icon: string;
  tagLabel: string; tagColor: string;
  priority: boolean; active: boolean;
  scheduledDate?: string;
}

function ls<T>(k: string, fb: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; }
}

const EVENT_ICONS = ["🌧","☕","🌿","🎯","🌙","⚡","📚","🎵"];
const TAG_COLORS  = ["#4f8ef7","#7c5cbf","#3ecf8e","#f5a623","#ef4444","#ec4899"];

const DEFAULT_EVENTS: StanEvent[] = [
  { id:"e1", name:"Morning Focus", icon:"🌧", tagLabel:"work",  tagColor:"#4f8ef7", priority:false, active:false, scheduledDate:"" },
  { id:"e2", name:"Deep Work",     icon:"🎯", tagLabel:"focus", tagColor:"#3ecf8e", priority:true,  active:false, scheduledDate:"" },
  { id:"e3", name:"Late Night",    icon:"🌙", tagLabel:"rest",  tagColor:"#7c5cbf", priority:false, active:false, scheduledDate:"" },
];

interface Props {
  tr: Tr; lang: Lang; onOpenRadio: () => void;
  playingStation: RGStation | null; isRadioPlaying: boolean;
  onPauseRadio: () => void; onResumeRadio: () => void;
  ambientEnabled: boolean; ambientId: string;
  intensity: number; speed: number; density: number;
  onToggleAmbient: () => void; onSetAmbientId: (id: string) => void;
  onSetIntensity: (v: number) => void; onSetSpeed: (v: number) => void; onSetDensity: (v: number) => void;
  animations: boolean;
}

// ── Shared sub-components ───────────────────────────────────────────────────────
function GlassCard({ children, glow=false, style={}, className }: { children: React.ReactNode; glow?: boolean; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{ background:t.surface, backdropFilter:t.glassBlur, border:`1px solid ${glow?"rgba(79,142,247,0.22)":t.border}`, borderRadius:12, padding:18, boxShadow: glow ? `0 0 20px rgba(79,142,247,0.07), inset 0 1px 0 rgba(255,255,255,0.04)` : `inset 0 1px 0 rgba(255,255,255,0.03)`, ...style }}>
      {children}
    </div>
  );
}

function RangeSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ fontSize:11, color:t.textSecondary }}>{label}</span>
        <span style={{ fontSize:11, color:t.accent, ...mono }}>{value}%</span>
      </div>
      <div style={{ position:"relative", height:3, background:t.border, borderRadius:2 }}>
        <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${value}%`, background:`linear-gradient(90deg,${t.accent},#7c5cbf)`, borderRadius:2 }} />
        <input type="range" min={0} max={100} value={value} onChange={e=>onChange(Number(e.target.value))}
          style={{ position:"absolute", inset:0, width:"100%", opacity:0, cursor:"pointer", height:"100%" }} />
        <div style={{ position:"absolute", top:"50%", left:`${value}%`, transform:"translate(-50%,-50%)", width:11, height:11, borderRadius:"50%", background:"#fff", boxShadow:`0 0 5px ${t.accent}`, pointerEvents:"none" }} />
      </div>
    </div>
  );
}

function Visualizer({ vizColors, animations }: { vizColors: [string,string]; animations: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const timeRef   = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const fftArr = new Uint8Array(64);
    const draw = () => {
      const { width: w, height: h } = canvas;
      ctx.clearRect(0,0,w,h);
      if (animations) timeRef.current += 0.018;
      ambientEngine.getFrequencyData(fftArr);
      const real = animations && fftArr.some(v=>v>0);
      const bars = 64, barW = (w/bars)*0.55, gap = w/bars, baseY = h*0.74;
      ctx.beginPath(); ctx.moveTo(0,baseY); ctx.lineTo(w,baseY);
      ctx.strokeStyle="rgba(79,142,247,0.3)"; ctx.lineWidth=1; ctx.stroke();
      for (let i=0;i<bars;i++) {
        const bh = real ? (fftArr[i%fftArr.length]/255)*baseY*0.95
          : (Math.sin((i/bars)*Math.PI*3+timeRef.current)*0.5+0.5)*(Math.sin((i/bars)*Math.PI+timeRef.current*0.7)*0.4+0.6)*baseY*0.88;
        const x = i*gap+gap*0.2;
        const g2 = ctx.createLinearGradient(0,baseY-bh,0,baseY);
        g2.addColorStop(0,`${vizColors[1]}f2`); g2.addColorStop(1,`${vizColors[0]}f2`);
        ctx.fillStyle=g2; ctx.beginPath(); ctx.roundRect(x,baseY-bh,barW,bh,[3,3,0,0]); ctx.fill();
      }
      if (animations) animRef.current = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(animRef.current);
  }, [vizColors, animations]);
  return <canvas ref={canvasRef} width={600} height={160} style={{ width:"100%", height:160, display:"block" }} />;
}

function WaveMini({ animations }: { animations: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const anim = useRef<number>(0); const time = useRef(0);
  const bars = Array.from({length:15},(_,i)=>({p:i*0.42,f:0.8+(i%4)*0.15,b:4+(i%5)*3}));
  useEffect(()=>{
    const c = ref.current; if(!c) return;
    const ctx = c.getContext("2d")!;
    const draw=()=>{
      const {width:w,height:h}=c; ctx.clearRect(0,0,w,h); if (animations) time.current+=0.04;
      bars.forEach((bar,i)=>{ const x=(i/bars.length)*w+w/bars.length/2; const bh=bar.b+Math.sin(time.current*bar.f+bar.p)*5; const bw=w/bars.length-2;
        const g=ctx.createLinearGradient(0,h-bh,0,h); g.addColorStop(0,"rgba(124,92,191,0.85)"); g.addColorStop(1,"rgba(124,92,191,0.28)");
        ctx.fillStyle=g; ctx.beginPath(); ctx.roundRect(x-bw/2,h-bh,bw,bh,2); ctx.fill(); });
      if (animations) anim.current=requestAnimationFrame(draw);
    }; draw(); return ()=>cancelAnimationFrame(anim.current);
  },[animations]);
  return <canvas ref={ref} width={240} height={22} style={{width:"100%",height:22,display:"block",marginBottom:2}}/>;
}

// ── Main ────────────────────────────────────────────────────────────────────────
export function AudioDashboard(props: Props) {
  const { tr, lang, onOpenRadio, playingStation, isRadioPlaying, onPauseRadio, onResumeRadio,
    ambientEnabled, ambientId, intensity, speed, density,
    onToggleAmbient, onSetAmbientId, onSetIntensity, onSetSpeed, onSetDensity, animations } = props;

  // Ambient dropdown + custom sounds
  const [showDrop,setShowDrop]=useState(false);
  const dropRef=useRef<HTMLDivElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const [customs,setCustoms]=useState<CustomSound[]>(()=>loadCustoms());
  const [adding,setAdding]=useState(false);
  const [newSoundName,setNewSoundName]=useState("");
  const pendingFile=useRef<File|null>(null);

  const [showVizPicker,setShowVizPicker]=useState(false);
  const [vizColors,setVizColors]=useState<[string,string]>(()=>{ try{return JSON.parse(localStorage.getItem("ss_viz_colors")||"null")??["#4f8ef7","#7c5cbf"];}catch{return["#4f8ef7","#7c5cbf"]; }});
  const VIZ_PRESETS:[string,string][]=[["#4f8ef7","#7c5cbf"],["#3ecf8e","#4f8ef7"],["#f5a623","#ef4444"],["#ec4899","#7c5cbf"],["#06b6d4","#3ecf8e"],["#ffffff","#8888a0"]];

  // Events
  const [events,setEvents]=useState<StanEvent[]>(()=>ls("ss_events",DEFAULT_EVENTS));
  const [eventFilter,setEventFilter]=useState<"all"|"featured">("all");
  const [eventSearch,setEventSearch]=useState("");
  const [showEventForm,setShowEventForm]=useState(false);
  const [newName,setNewName]=useState(""); const [newIcon,setNewIcon]=useState(EVENT_ICONS[0]);
  const [newTag,setNewTag]=useState(""); const [newTagColor,setNewTagColor]=useState(TAG_COLORS[0]);
  const [newDate,setNewDate]=useState("");

  const inp:React.CSSProperties={background:t.surface,border:`1px solid ${t.border}`,borderRadius:7,padding:"7px 10px",color:t.textPrimary,fontSize:12,outline:"none",width:"100%",...ui};

  useEffect(()=>{ localStorage.setItem("ss_events",JSON.stringify(events)); },[events]);
  useEffect(()=>{ localStorage.setItem("ss_viz_colors",JSON.stringify(vizColors)); },[vizColors]);

  useEffect(()=>{
    const h=()=>{ setEvents([]); localStorage.setItem("ss_events",JSON.stringify([])); };
    window.addEventListener("ss:clear-events",h);
    return ()=>window.removeEventListener("ss:clear-events",h);
  },[]);

  useEffect(()=>{
    const check=()=>{
      const now=Date.now();
      setEvents(prev=>prev.map(ev=>{
        if(!ev.scheduledDate) return ev;
        const diff=Math.abs(now-new Date(ev.scheduledDate).getTime());
        if(diff<60000 && !ev.active) return {...ev, active:true};
        return ev;
      }));
    };
    check(); const id=setInterval(check,30000); return ()=>clearInterval(id);
  },[]);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(dropRef.current&&!dropRef.current.contains(e.target as Node)) setShowDrop(false); };
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  },[]);

  // ── Ambient sound handlers ───────────────────────────────────────────────
  const pickFile=()=>fileRef.current?.click();
  const onFileChosen=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0]; if(!f) return;
    pendingFile.current=f; setNewSoundName(f.name.replace(/\.[^.]+$/,"")); setAdding(true); e.target.value="";
  };
  const confirmAddSound=async()=>{
    const f=pendingFile.current; const name=newSoundName.trim();
    if(!f||!name) return;
    const c=await addCustom(name,f);
    setCustoms(loadCustoms());
    setAdding(false); setNewSoundName(""); pendingFile.current=null;
    onSetAmbientId(c.id);
  };
  const deleteSound=async(id:string)=>{
    if(!confirm(tr.deleteSound)) return;
    await removeCustom(id); setCustoms(loadCustoms());
    if(ambientId===id) onSetAmbientId("rain");
  };

  // ── Events handlers ──────────────────────────────────────────────────────
  const saveEvent=()=>{
    if(!newName.trim()) return;
    setEvents(prev=>[...prev,{id:Date.now().toString(),name:newName,icon:newIcon,tagLabel:newTag||"custom",tagColor:newTagColor,priority:false,active:false,scheduledDate:newDate}]);
    setNewName(""); setNewTag(""); setNewDate(""); setNewTagColor(TAG_COLORS[0]); setShowEventForm(false);
  };
  const togglePriority=(id:string)=>setEvents(prev=>prev.map(ev=>ev.id===id?{...ev,priority:!ev.priority}:ev));
  const deleteEvent=(id:string)=>setEvents(prev=>prev.filter(ev=>ev.id!==id));
  const setEventColor=(id:string,c:string)=>setEvents(prev=>prev.map(ev=>ev.id===id?{...ev,tagColor:c}:ev));

  const featuredCount = events.filter(e=>e.priority).length;
  const filteredEvents = events
    .filter(ev=>eventFilter==="all" || ev.priority)
    .filter(ev=>!eventSearch || ev.name.toLowerCase().includes(eventSearch.toLowerCase()) || ev.tagLabel.toLowerCase().includes(eventSearch.toLowerCase()))
    .sort((a,b)=>{ if(a.priority!==b.priority) return a.priority?-1:1; return 0; });

  const ambMeta = metaFor(ambientId, tr);

  return (
    <div className="ssd-root" style={ui}>

      {/* ════ Left column ════ */}
      <div className="ssd-col-left">

        {/* ── Ambiente ── */}
        <GlassCard glow>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <span style={{ fontSize:13, fontWeight:600, color:t.textPrimary }}>{tr.ambiente}</span>
            <button onClick={onToggleAmbient} style={{ width:34,height:20,borderRadius:10,background:ambientEnabled?t.accent:t.border,border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s" }}>
              <div style={{ position:"absolute",top:2,left:ambientEnabled?16:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s" }}/>
            </button>
          </div>

          <input ref={fileRef} type="file" accept="audio/*" onChange={onFileChosen} style={{ display:"none" }}/>
          <div ref={dropRef} style={{ position:"relative", marginBottom:14 }}>
            <button onClick={()=>setShowDrop(v=>!v)} style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 12px", borderRadius:9, border:`1px solid ${t.border}`, background:t.surfaceHover, color:t.textPrimary, cursor:"pointer", fontSize:13, ...ui }}>
              <span style={{ display:"flex", alignItems:"center", gap:7, minWidth:0 }}>
                <span style={{ fontSize:15 }}>{ambMeta.emoji}</span>
                <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ambMeta.label}</span>
              </span>
              <ChevronDown size={13} color={t.textSecondary} style={{ transform:showDrop?"rotate(180deg)":"none", transition:"transform .15s", flexShrink:0 }}/>
            </button>

            {showDrop && (
              <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:"var(--stanssion-bg,#12121e)", border:`1px solid ${t.border}`, borderRadius:10, zIndex:80, boxShadow:"0 12px 32px rgba(0,0,0,0.5)", overflow:"hidden" }}>
                <div style={{ maxHeight:240, overflowY:"auto", padding:4 }}>
                  <p style={{ fontSize:9, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:t.textSecondary, padding:"6px 9px 3px" }}>{tr.builtIn}</p>
                  {BUILTIN_SOUNDS.map(s=>{
                    const sel=ambientId===s.id;
                    return (
                      <button key={s.id} onClick={()=>{ onSetAmbientId(s.id); setShowDrop(false); }}
                        style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"9px 10px", border:"none", borderRadius:7, background:sel?"rgba(79,142,247,0.12)":"transparent", color:sel?t.accent:t.textPrimary, cursor:"pointer", fontSize:13, textAlign:"left", ...ui }}>
                        <span style={{ fontSize:15 }}>{s.emoji}</span>{tr[s.nameKey] as string}
                      </button>
                    );
                  })}
                  {customs.length>0 && <p style={{ fontSize:9, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:t.textSecondary, padding:"8px 9px 3px" }}>{lang==="es"?"Personalizados":"Custom"}</p>}
                  {customs.map(c=>{
                    const sel=ambientId===c.id;
                    return (
                      <div key={c.id} style={{ display:"flex", alignItems:"center", borderRadius:7, background:sel?"rgba(79,142,247,0.12)":"transparent" }}>
                        <button onClick={()=>{ onSetAmbientId(c.id); setShowDrop(false); }}
                          style={{ flex:1, display:"flex", alignItems:"center", gap:9, padding:"9px 10px", border:"none", background:"transparent", color:sel?t.accent:t.textPrimary, cursor:"pointer", fontSize:13, textAlign:"left", minWidth:0, ...ui }}>
                          <span style={{ fontSize:15 }}>🎵</span><span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
                        </button>
                        <button onClick={()=>deleteSound(c.id)} title={tr.deleteSound} style={{ background:"none", border:"none", cursor:"pointer", color:t.textSecondary, padding:8, flexShrink:0 }}><Trash2 size={12}/></button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ borderTop:`1px solid ${t.border}`, padding:6 }}>
                  <button onClick={()=>{ setShowDrop(false); pickFile(); }}
                    style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"9px 0", borderRadius:7, border:`1px dashed ${t.border}`, background:"transparent", color:t.accent, fontSize:12, cursor:"pointer", ...ui }}>
                    <Upload size={13}/>{tr.addCustomSound}
                  </button>
                </div>
              </div>
            )}
          </div>

          {adding && (
            <div style={{ background:"rgba(79,142,247,0.05)", border:"1px solid rgba(79,142,247,0.15)", borderRadius:9, padding:10, marginBottom:14, display:"flex", flexDirection:"column", gap:8 }}>
              <input autoFocus placeholder={tr.customSoundName} value={newSoundName} onChange={e=>setNewSoundName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&confirmAddSound()} style={inp}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={confirmAddSound} style={{ flex:1, padding:"6px 0", borderRadius:7, border:"1px solid rgba(79,142,247,0.4)", background:"rgba(79,142,247,0.15)", color:t.accent, fontSize:12, fontWeight:500, cursor:"pointer", ...ui }}>{tr.save}</button>
                <button onClick={()=>{ setAdding(false); pendingFile.current=null; }} style={{ padding:"6px 12px", borderRadius:7, border:"none", background:"transparent", color:t.textSecondary, fontSize:12, cursor:"pointer", ...ui }}>{tr.cancel}</button>
              </div>
            </div>
          )}

          <p style={{ fontSize:10, color:t.textSecondary, marginBottom:10 }}>
            {tr.intensity} = {lang==="es"?"volumen":"volume"} · {tr.speed} = {lang==="es"?"velocidad":"rate"} · {tr.density} = {lang==="es"?"filtro":"filter"}
          </p>
          <RangeSlider label={tr.intensity} value={intensity} onChange={onSetIntensity}/>
          <RangeSlider label={tr.speed}     value={speed}     onChange={onSetSpeed}/>
          <RangeSlider label={tr.density}   value={density}   onChange={onSetDensity}/>
        </GlassCard>

        {/* ── Radio ── */}
        <GlassCard>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:13, fontWeight:600, color:t.textPrimary }}>{tr.radio}</span>
              {isRadioPlaying && <span style={{ display:"flex",alignItems:"center",gap:3,padding:"1px 6px",borderRadius:20,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.22)" }}><div style={{ width:4,height:4,borderRadius:"50%",background:"#ef4444",animation:"pulse 2s infinite" }}/><span style={{ fontSize:8,color:"#ef4444",...mono,fontWeight:600,letterSpacing:"0.08em" }}>LIVE</span></span>}
            </div>
            <Radio size={14} color="#7c5cbf"/>
          </div>
          {playingStation ? (
            <>
              <p style={{ fontSize:13, color:t.textPrimary, fontWeight:500, marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{playingStation.title}</p>
              <p style={{ fontSize:11, color:t.textSecondary, marginBottom:10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{playingStation.placeTitle} · {playingStation.country}</p>
              <WaveMini animations={animations}/>
              <div style={{ display:"flex", gap:8, marginTop:10 }}>
                <button onClick={isRadioPlaying?onPauseRadio:onResumeRadio} style={{ flex:1,padding:"9px 0",borderRadius:9,border:`1px solid ${isRadioPlaying?"rgba(124,92,191,0.5)":t.border}`,background:isRadioPlaying?"rgba(124,92,191,0.15)":t.surface,color:isRadioPlaying?"#7c5cbf":t.textPrimary,fontSize:12,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,...ui }}>
                  {isRadioPlaying?<><Pause size={12} fill="#7c5cbf"/>{tr.pause}</>:<><Play size={12} fill="currentColor"/>{tr.start}</>}
                </button>
                <button onClick={onOpenRadio} style={{ flex:1,padding:"9px 0",borderRadius:9,border:`1px solid ${t.border}`,background:t.surface,color:t.textSecondary,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,...ui }}>
                  <RefreshCw size={12}/>{tr.changeStation}
                </button>
              </div>
            </>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:10,padding:"16px 0" }}>
              <p style={{ fontSize:12,color:t.textSecondary,textAlign:"center" }}>{lang==="es"?"Ninguna emisora seleccionada":"No station selected"}</p>
              <button onClick={onOpenRadio} style={{ padding:"8px 16px",borderRadius:8,border:`1px solid ${t.border}`,background:t.surface,color:t.textPrimary,fontSize:12,cursor:"pointer",...ui }}>{tr.browseStations}</button>
            </div>
          )}
        </GlassCard>
      </div>

      {/* ════ Right column ════ */}
      <div className="ssd-col-right">

        {/* ── Visualizer ── */}
        <GlassCard style={{ flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:600, color:t.textPrimary }}>{tr.visualizer}</span>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={()=>setShowVizPicker(v=>!v)} style={{ display:"flex",gap:3,background:"none",border:"none",cursor:"pointer",padding:2 }}>
                <div style={{ width:12,height:12,borderRadius:3,background:`linear-gradient(135deg,${vizColors[0]},${vizColors[1]})` }}/>
              </button>
              <span style={{ fontSize:11, color:t.textSecondary, ...mono }}>FFT · 44.1kHz</span>
            </div>
          </div>
          {showVizPicker && (
            <div style={{ display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center" }}>
              {VIZ_PRESETS.map(([c1,c2],idx)=>(
                <button key={idx} onClick={()=>{ setVizColors([c1,c2]); }}
                  style={{ width:28,height:28,borderRadius:6,background:`linear-gradient(135deg,${c1},${c2})`,border:vizColors[0]===c1&&vizColors[1]===c2?"2px solid #fff":"2px solid transparent",cursor:"pointer" }}/>
              ))}
              <span style={{ width:1, height:22, background:t.border, margin:"0 2px" }}/>
              <span style={{ fontSize:10, color:t.textSecondary, ...mono }}>RGB</span>
              <label title="Color 1" style={{ position:"relative", width:28, height:28, borderRadius:6, background:vizColors[0], border:`1px solid ${t.border}`, cursor:"pointer", overflow:"hidden", flexShrink:0 }}>
                <input type="color" value={vizColors[0]} onChange={e=>setVizColors([e.target.value, vizColors[1]])} style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0, cursor:"pointer" }}/>
              </label>
              <label title="Color 2" style={{ position:"relative", width:28, height:28, borderRadius:6, background:vizColors[1], border:`1px solid ${t.border}`, cursor:"pointer", overflow:"hidden", flexShrink:0 }}>
                <input type="color" value={vizColors[1]} onChange={e=>setVizColors([vizColors[0], e.target.value])} style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0, cursor:"pointer" }}/>
              </label>
              <span style={{ width:34, height:22, borderRadius:5, background:`linear-gradient(135deg,${vizColors[0]},${vizColors[1]})`, border:`1px solid ${t.border}` }}/>
            </div>
          )}
          <Visualizer vizColors={vizColors} animations={animations}/>
        </GlassCard>

        {/* ── Events ── */}
        <GlassCard className="ssd-events" style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", minHeight:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexShrink:0, flexWrap:"wrap" }}>
            <span style={{ fontSize:13, fontWeight:600, color:t.textPrimary }}>{tr.events}</span>
            <div style={{ display:"flex", gap:3, background:t.surface, borderRadius:9, padding:3, border:`1px solid ${t.border}` }}>
              {(["all","featured"] as const).map(f=>(
                <button key={f} onClick={()=>setEventFilter(f)}
                  style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:7, border:"none", cursor:"pointer", fontSize:11.5,
                    background:eventFilter===f?"rgba(79,142,247,0.18)":"transparent", color:eventFilter===f?t.accent:t.textSecondary, fontWeight:eventFilter===f?500:400, ...ui }}>
                  {f==="featured" && <Star size={11} fill={eventFilter===f?t.accent:"none"}/>}
                  {f==="all"?tr.all:tr.featured}{f==="featured"&&featuredCount>0?` ${featuredCount}`:""}
                </button>
              ))}
            </div>
            <span style={{ flex:1 }}/>
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 11px", borderRadius:9, background:t.surface, border:`1px solid ${t.border}` }}>
              <Search size={12} color={t.textSecondary}/>
              <input value={eventSearch} onChange={e=>setEventSearch(e.target.value)} placeholder={lang==="es"?"Buscar…":"Search…"}
                style={{ background:"none",border:"none",outline:"none",color:t.textPrimary,fontSize:12,width:90,...ui }}/>
              {eventSearch&&<button onClick={()=>setEventSearch("")} style={{ background:"none",border:"none",cursor:"pointer",color:t.textSecondary,padding:0 }}><X size={11}/></button>}
            </div>
            <button onClick={()=>setShowEventForm(v=>!v)} style={{ display:"flex",alignItems:"center",gap:5,padding:"7px 13px",borderRadius:9,border:"none",background:`linear-gradient(135deg,${t.accent},#7c5cbf)`,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 10px rgba(79,142,247,0.3)",...ui }}>
              <Plus size={13}/>{lang==="es"?"Nuevo":"New"}
            </button>
          </div>

          {showEventForm && (
            <div style={{ background:"rgba(79,142,247,0.04)",border:"1px solid rgba(79,142,247,0.12)",borderRadius:10,padding:12,marginBottom:10,display:"flex",flexDirection:"column",gap:9,flexShrink:0 }}>
              <input placeholder={tr.eventName} value={newName} onChange={e=>setNewName(e.target.value)} style={inp}/>
              <div style={{ display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" }}>
                <span style={{ fontSize:11,color:t.textSecondary,width:42 }}>{lang==="es"?"Ícono":"Icon"}</span>
                {EVENT_ICONS.map(ic=>(<button key={ic} onClick={()=>setNewIcon(ic)} style={{ width:28,height:28,borderRadius:6,border:`1px solid ${newIcon===ic?t.accent:t.border}`,background:newIcon===ic?"rgba(79,142,247,0.15)":t.surface,fontSize:14,cursor:"pointer" }}>{ic}</button>))}
              </div>
              <div style={{ display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" }}>
                <span style={{ fontSize:11,color:t.textSecondary,width:42 }}>{lang==="es"?"Etiqueta":"Tag"}</span>
                <input placeholder="label" value={newTag} onChange={e=>setNewTag(e.target.value)} style={{ ...inp,width:120 }}/>
                {TAG_COLORS.map(c=>(<button key={c} onClick={()=>setNewTagColor(c)} style={{ width:18,height:18,borderRadius:"50%",background:c,border:newTagColor===c?"2px solid #fff":"2px solid transparent",cursor:"pointer" }}/>))}
                <label title={tr.color} style={{ width:22,height:22,borderRadius:"50%",border:`1px solid ${t.border}`,cursor:"pointer",overflow:"hidden",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",background:`conic-gradient(red,#ff0,lime,cyan,blue,magenta,red)` }}>
                  <input type="color" value={newTagColor} onChange={e=>setNewTagColor(e.target.value)} style={{ position:"absolute",inset:-4,opacity:0,cursor:"pointer" }}/>
                </label>
              </div>
              <div style={{ display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" }}>
                <span style={{ fontSize:11,color:t.textSecondary,width:42 }}>{lang==="es"?"Fecha":"Date"}</span>
                <input type="datetime-local" value={newDate} onChange={e=>setNewDate(e.target.value)}
                  style={{ ...inp,width:200,colorScheme:"dark",...mono,fontSize:11 }}/>
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={saveEvent} style={{ padding:"6px 16px",borderRadius:7,border:"1px solid rgba(79,142,247,0.4)",background:"rgba(79,142,247,0.15)",color:t.accent,fontSize:12,fontWeight:500,cursor:"pointer",...ui }}>{tr.save}</button>
                <button onClick={()=>setShowEventForm(false)} style={{ background:"none",border:"none",color:t.textSecondary,fontSize:12,cursor:"pointer",...ui }}>{tr.cancel}</button>
              </div>
            </div>
          )}

          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:7, minHeight:80 }}>
            {filteredEvents.length===0 ? (
              <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:20 }}>
                <p style={{ fontSize:12,color:t.textSecondary,textAlign:"center" }}>
                  {eventSearch ? (lang==="es"?"Sin coincidencias":"No matches") : eventFilter==="featured" ? tr.noFeatured : tr.noEventsYet}
                </p>
              </div>
            ) : filteredEvents.map(ev=>(
              <EventRow key={ev.id} event={ev} lang={lang}
                onTogglePriority={()=>togglePriority(ev.id)} onDelete={()=>deleteEvent(ev.id)} onColor={c=>setEventColor(ev.id,c)} tr={tr}/>
            ))}
          </div>
        </GlassCard>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        .ssd-root{display:grid;grid-template-columns:268px 1fr;gap:18px;height:100%;min-height:0;}
        .ssd-col-left{display:flex;flex-direction:column;gap:14px;min-width:0;overflow-y:auto;padding-right:2px;}
        .ssd-col-right{display:flex;flex-direction:column;gap:14px;min-width:0;overflow:hidden;}
        @media (max-width: 880px){
          .ssd-root{grid-template-columns:1fr;height:100%;overflow-y:auto;}
          .ssd-col-left{overflow:visible;}
          .ssd-col-right{overflow:visible;}
          .ssd-events{min-height:380px;}
        }
        @media (max-height: 760px){
          .ssd-root{overflow-y:auto;}
          .ssd-col-left{overflow:visible;}
          .ssd-col-right{overflow:visible;}
          .ssd-events{min-height:340px;}
        }
      `}</style>
    </div>
  );
}

// ── Event Row (redesigned — color bar, depth, clean controls) ─────────────────
function EventRow({ event, lang, onTogglePriority, onDelete, onColor, tr }: { event: StanEvent; lang: Lang; onTogglePriority: ()=>void; onDelete: ()=>void; onColor: (c:string)=>void; tr: Tr }) {
  const [hov,setHov]=useState(false);
  const isUpcoming = event.scheduledDate && new Date(event.scheduledDate).getTime() > Date.now();
  const fmtDate = (d:string) => { try { return new Date(d).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); } catch { return ""; } };
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ position:"relative", display:"flex", alignItems:"center", gap:11, padding:"11px 13px 11px 14px", borderRadius:11, overflow:"hidden",
        border:`1px solid ${event.active?"rgba(79,142,247,0.4)":event.priority?"rgba(245,166,35,0.3)":hov?t.borderHover:t.border}`,
        background:hov?t.surfaceHover:t.surface, transition:"all 0.12s" }}>
      {/* color accent bar */}
      <span style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:event.tagColor }}/>
      {/* icon chip */}
      <span style={{ width:34, height:34, borderRadius:9, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, background:`${event.tagColor}1f`, border:`1px solid ${event.tagColor}33` }}>{event.icon}</span>
      <div style={{ flex:1,minWidth:0 }}>
        <p style={{ fontSize:13,fontWeight:500,color:t.textPrimary,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{event.name}</p>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <span style={{ fontSize:10,padding:"1px 8px",borderRadius:20,background:`${event.tagColor}22`,color:event.tagColor,fontWeight:500 }}>{event.tagLabel}</span>
          {event.scheduledDate && (
            <span style={{ fontSize:10,color:isUpcoming?"#f5a623":t.textSecondary,...mono }}>{isUpcoming?"🕐 ":""}{fmtDate(event.scheduledDate)}</span>
          )}
        </div>
      </div>
      {/* controls (inline, no overlap) */}
      <label title={tr.color} style={{ position:"relative", width:18, height:18, borderRadius:"50%", background:event.tagColor, cursor:"pointer", flexShrink:0, boxShadow:`0 0 0 2px ${event.tagColor}30`, overflow:"hidden" }}>
        <input type="color" value={event.tagColor} onChange={e=>onColor(e.target.value)} style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0, cursor:"pointer" }}/>
      </label>
      <button onClick={onTogglePriority} title={tr.featured}
        style={{ background:"none",border:"none",cursor:"pointer",color:event.priority?"#f5a623":t.textSecondary,opacity:hov||event.priority?1:0.45,transition:"opacity 0.15s",padding:3,flexShrink:0,display:"flex" }}>
        <Star size={15} fill={event.priority?"#f5a623":"none"}/>
      </button>
      <button onClick={onDelete} title={lang==="es"?"Eliminar":"Delete"}
        style={{ background:"none",border:"none",cursor:"pointer",color:t.textSecondary,opacity:hov?1:0,transition:"opacity 0.15s",padding:3,flexShrink:0,display:"flex" }}
        onMouseEnter={e=>(e.currentTarget.style.color="#ef4444")} onMouseLeave={e=>(e.currentTarget.style.color=t.textSecondary)}>
        <X size={14}/>
      </button>
    </div>
  );
}
