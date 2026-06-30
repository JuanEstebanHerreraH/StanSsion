// Central registry for ambient sounds: built-ins + unlimited user customs.
// Custom metadata lives in localStorage; the actual audio blob lives in IndexedDB
// (see AudioEngine idbPut/idbGet/idbDelete).
import { BUILTIN_SOUNDS, idbPut, idbDelete, ambientEngine, type SoundRef } from "./AudioEngine";
import type { Tr } from "./lang";

export interface CustomSound { id: string; name: string; }

const KEY = "ss_amb_custom";

export function loadCustoms(): CustomSound[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function saveCustoms(list: CustomSound[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export async function addCustom(name: string, file: File): Promise<CustomSound> {
  const id = "c_" + Date.now().toString(36);
  await idbPut(id, file);
  const list = [...loadCustoms(), { id, name }];
  saveCustoms(list);
  return { id, name };
}

export async function removeCustom(id: string) {
  await idbDelete(id);
  ambientEngine.evictCache(id);
  saveCustoms(loadCustoms().filter(c => c.id !== id));
}

export function clearAllCustoms() {
  loadCustoms().forEach(c => { idbDelete(c.id); ambientEngine.evictCache(c.id); });
  localStorage.removeItem(KEY);
}

// Resolve a sound id → playable ref
export function refFor(id: string): SoundRef {
  const b = BUILTIN_SOUNDS.find(s => s.id === id);
  if (b) return { id: b.id, builtin: true, url: b.url };
  return { id, builtin: false };
}

// Resolve a sound id → display label + emoji
export function metaFor(id: string, tr: Tr): { emoji: string; label: string } {
  const b = BUILTIN_SOUNDS.find(s => s.id === id);
  if (b) return { emoji: b.emoji, label: tr[b.nameKey] as string };
  const c = loadCustoms().find(s => s.id === id);
  return { emoji: "🎵", label: c?.name || (tr.ambRain as string) };
}
