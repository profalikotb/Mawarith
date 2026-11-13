"use client";
/**
 * Optional cloud saving (Supabase). Enabled only when NEXT_PUBLIC_SUPABASE_URL
 * and NEXT_PUBLIC_SUPABASE_ANON_KEY are set. Row Level Security in
 * supabase/migrations/001_init.sql restricts every row to its owner.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENGINE_VERSION, RULESET_VERSION, type CaseInput } from "@/engine";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
export const cloudEnabled = () => Boolean(url && key);

export function sb(): SupabaseClient | null {
  if (!cloudEnabled()) return null;
  if (!client) client = createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

export async function signInWithEmail(email: string) {
  const c = sb();
  if (!c) throw new Error("cloud disabled");
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/cases` } });
  if (error) throw error;
}

export async function currentUser() {
  const c = sb();
  if (!c) return null;
  const { data } = await c.auth.getUser();
  return data.user ?? null;
}

export async function signOut() {
  await sb()?.auth.signOut();
}

export interface CloudCase {
  id: string;
  title: string;
  updated_at: string;
}

export async function listCloudCases(): Promise<CloudCase[]> {
  const c = sb();
  if (!c) return [];
  const { data, error } = await c.from("cases").select("id,title,updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  return data as CloudCase[];
}

export async function saveCloudVersion(caseId: string | null, input: CaseInput, note?: string): Promise<string> {
  const c = sb();
  if (!c) throw new Error("cloud disabled");
  const title = input.meta.title?.trim() || "مسألة بدون اسم";
  let id = caseId;
  if (!id) {
    const { data, error } = await c.from("cases").insert({ title }).select("id").single();
    if (error) throw error;
    id = data.id as string;
  } else {
    const { error } = await c.from("cases").update({ title, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  }
  const { error: e2 } = await c
    .from("case_versions")
    .insert({ case_id: id, input, note: note ?? null, engine_version: ENGINE_VERSION, ruleset_version: RULESET_VERSION });
  if (e2) throw e2;
  return id!;
}

export async function loadLatestCloudVersion(caseId: string): Promise<CaseInput | null> {
  const c = sb();
  if (!c) return null;
  const { data, error } = await c
    .from("case_versions")
    .select("input")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.input as CaseInput) ?? null;
}

export async function deleteCloudCase(caseId: string) {
  const c = sb();
  if (!c) return;
  const { error } = await c.from("cases").delete().eq("id", caseId);
  if (error) throw error;
}

export async function exportCloudData() {
  const c = sb();
  if (!c) return null;
  const { data: cases } = await c.from("cases").select("*");
  const { data: versions } = await c.from("case_versions").select("*");
  return { cases, versions };
}
