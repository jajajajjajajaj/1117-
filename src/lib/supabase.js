import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/^["']|["']$/g, "");
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim().replace(/^["']|["']$/g, "");

let client = null;
let problem = "";
if (!url || !key) problem = "missing";
else {
  try {
    client = createClient(url, key);
  } catch (e) {
    problem = `invalid: ${e.message}`;
  }
}
export const configured = Boolean(client);
export const configProblem = problem;
export const supabase = client;

export const defaultSettings = () => ({
  capacity: 1,
  published: { mon: false, tue: false, thu: false },
  assignments: { mon: {}, tue: {}, thu: {} },
  manual: { mon: {}, tue: {}, thu: {} },
  unassigned: { mon: [], tue: [], thu: [] },
  lastRun: null,
});

// ── 신청자 (누구나) ──────────────────────────────────────────
export async function fetchApplicants() {
  const { data, error } = await supabase.from("applicants").select("*");
  if (error) throw error;
  const map = {};
  for (const r of data) map[r.nick] = { nick: r.nick, days: r.days, updatedAt: new Date(r.updated_at).getTime() };
  return map;
}

export async function upsertApplicant(nick, days) {
  const { error } = await supabase
    .from("applicants")
    .upsert({ nick, days, updated_at: new Date().toISOString() }, { onConflict: "nick" });
  if (error) throw error;
}

export async function fetchSettings() {
  const { data, error } = await supabase.from("settings").select("data").eq("id", 1).maybeSingle();
  if (error) throw error;
  return { ...defaultSettings(), ...(data?.data || {}) };
}

// ── 관리자 (코드 입력, 토큰 세션) ────────────────────
const TOKEN_KEY = "adminToken";
const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };
const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} };

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export async function signIn(code) {
  const tok = await rpc("admin_login", { p_code: code.trim() });
  if (!tok) throw new Error("bad credentials");
  setToken(tok);
}

export async function signOut() {
  const t = getToken();
  if (t) { try { await rpc("admin_logout", { p_token: t }); } catch {} }
  setToken("");
}

export async function getSession() {
  const t = getToken();
  if (!t) return null;
  try {
    const ok = await rpc("admin_check", { p_token: t });
    if (!ok) setToken("");
    return ok ? { token: t } : null;
  } catch { return null; }
}

export async function saveSettings(settings) {
  await rpc("admin_save_settings", { p_token: getToken(), p_data: settings });
}

export async function deleteApplicant(nick) {
  await rpc("admin_delete_applicant", { p_token: getToken(), p_nick: nick });
}

export async function resetAll() {
  await rpc("admin_reset", { p_token: getToken(), p_data: defaultSettings() });
}

export async function changeCode(newCode) {
  await rpc("admin_change_code", { p_token: getToken(), p_new: newCode });
}
