import { supabase } from "./supabaseClient";

// One durable football match workspace per user (table football_broadcast_matches, RLS by user_id).
// The payload is owned by the broadcaster; this module only moves it in and out of Supabase.

export interface StoredFootballBroadcast<T> {
  id: string;
  name: string;
  competition: string;
  payload: T;
}

/** Upserts the workspace and returns its id, or null when nobody is signed in. */
export async function saveFootballBroadcast<T>(
  id: string | null,
  name: string,
  competition: string,
  payload: T,
): Promise<string | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) return null;

  const row = {
    ...(id ? { id } : {}),
    user_id: userId,
    name: name.trim() || "Partido sin título",
    competition: competition.trim(),
    payload,
  };
  const { data, error } = await supabase
    .from("football_broadcast_matches")
    .upsert(row, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Latest workspace of the signed-in user, or null (no session or nothing saved yet). */
export async function loadLatestFootballBroadcast<T>(): Promise<StoredFootballBroadcast<T> | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("football_broadcast_matches")
    .select("id,name,competition,payload")
    .neq("competition", PRODUCTION_COMPETITION) // the production workspace row is not a match workspace
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as StoredFootballBroadcast<T> | null;
}

/** Marker of the production-room workspace row (rundowns, rules, history, preferences) in the same table. */
export const PRODUCTION_COMPETITION = "__nexus_production__";

/** The production workspace of the signed-in user (same table and RLS), or null. */
export async function loadProductionWorkspace<T>(): Promise<StoredFootballBroadcast<T> | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("football_broadcast_matches")
    .select("id,name,competition,payload")
    .eq("competition", PRODUCTION_COMPETITION)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as StoredFootballBroadcast<T> | null;
}
