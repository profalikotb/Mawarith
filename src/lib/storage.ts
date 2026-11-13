"use client";
/**
 * Local (on-device) storage. Nothing is saved unless the user presses «حفظ».
 * The working draft lives in sessionStorage (cleared when the tab closes).
 */
import { ENGINE_VERSION, RULESET_VERSION, type CaseInput } from "@/engine";

export interface CaseVersion {
  at: string;
  engineVersion: string;
  rulesetVersion: string;
  note?: string;
  input: CaseInput;
}
export interface SavedCase {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  versions: CaseVersion[];
}

const KEY = "mw:cases:v1";
const DRAFT = "mw:draft:v1";

function safeGet(store: Storage | undefined, k: string): string | null {
  try {
    return store?.getItem(k) ?? null;
  } catch {
    return null;
  }
}
function safeSet(store: Storage | undefined, k: string, v: string): boolean {
  try {
    store?.setItem(k, v);
    return true;
  } catch {
    return false;
  }
}

export function listCases(): SavedCase[] {
  const raw = safeGet(globalThis.localStorage, KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedCase[];
  } catch {
    return [];
  }
}

function writeAll(list: SavedCase[]) {
  return safeSet(globalThis.localStorage, KEY, JSON.stringify(list));
}

export function saveCaseVersion(id: string | null, input: CaseInput, note?: string): SavedCase | null {
  const list = listCases();
  const now = new Date().toISOString();
  const title = input.meta.title?.trim() || "مسألة بدون اسم";
  const version: CaseVersion = { at: now, engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION, note, input };
  let c = id ? list.find((x) => x.id === id) : undefined;
  if (c) {
    c.title = title;
    c.updatedAt = now;
    c.versions.push(version);
    if (c.versions.length > 30) c.versions = c.versions.slice(-30);
  } else {
    c = { id: id || crypto.randomUUID(), title, createdAt: now, updatedAt: now, versions: [version] };
    list.unshift(c);
  }
  return writeAll(list) ? c : null;
}

export function deleteCase(id: string) {
  writeAll(listCases().filter((c) => c.id !== id));
}

export function deleteAllCases() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function getCase(id: string) {
  return listCases().find((c) => c.id === id);
}

export interface Draft {
  caseId: string | null;
  step: number;
  input: CaseInput;
}
export function loadDraft(): Draft | null {
  const raw = safeGet(globalThis.sessionStorage, DRAFT);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}
export function saveDraft(d: Draft) {
  safeSet(globalThis.sessionStorage, DRAFT, JSON.stringify(d));
}
export function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT);
  } catch {
    /* ignore */
  }
}

/** Diff summary between two inputs — used for the change log. */
export function diffSummary(a: CaseInput, b: CaseInput): string[] {
  const out: string[] = [];
  const walk = (x: unknown, y: unknown, path: string) => {
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    if (x && y && typeof x === "object" && typeof y === "object" && !Array.isArray(x) && !Array.isArray(y)) {
      const keys = new Set([...Object.keys(x as object), ...Object.keys(y as object)]);
      for (const k of keys) walk((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k], path ? `${path}.${k}` : k);
    } else out.push(path);
  };
  walk(a, b, "");
  return out;
}
