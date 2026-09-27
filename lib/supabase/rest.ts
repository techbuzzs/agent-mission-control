type Row = Record<string, unknown>;

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing");
  return { url: `${url}/rest/v1`, key };
}

export async function supabaseRest<T = Row[]>(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers ?? {}) }, cache: "no-store" });
  const text = await response.text();
  const value = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(typeof value?.message === "string" ? value.message : `Supabase REST ${response.status}`);
  return value as T;
}

export async function supabaseHealth() {
  try { await supabaseRest("workspaces?select=id&limit=1"); return { ok: true }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unavailable" }; }
}

export async function selectRows<T = Row[]>(table: string, query: string) { return supabaseRest<T>(`${table}?${query}`); }
export async function insertRows<T = Row[]>(table: string, rows: Row | Row[], upsert = false) {
  return supabaseRest<T>(table, { method: "POST", headers: { Prefer: `${upsert ? "resolution=merge-duplicates," : ""}return=representation` }, body: JSON.stringify(rows) });
}
export async function updateRows<T = Row[]>(table: string, query: string, row: Row) {
  return supabaseRest<T>(`${table}?${query}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
}
