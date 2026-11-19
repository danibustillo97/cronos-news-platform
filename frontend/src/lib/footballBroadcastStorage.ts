import { supabase } from "./supabaseClient";

export interface FootballPlayer {
  id: string;
  dorsal: number;
  name: string;
  position: "POR" | "DEF" | "MED" | "ATA";
  starter: boolean;
  captain: boolean;
}

export interface FootballBroadcastPayload {
  scoreboard: unknown;
  lineups: { home: FootballPlayer[]; away: FootballPlayer[] };
  events: Array<{ id: string; type: string; team: "home" | "away"; minute: number; label: string }>;
  metrics: Record<string, number>;
  widgets: unknown[];
  scenes: unknown[];
  audit?: Array<{ id: string; action: string; team?: "home" | "away"; minute: number; createdAt: string }>;
}

export async function saveFootballBroadcast(
  id: string | null,
  name: string,
  competition: string,
  payload: FootballBroadcastPayload,
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

export async function loadLatestFootballBroadcast(): Promise<{
  id: string;
  name: string;
  competition: string;
  payload: FootballBroadcastPayload;
} | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("football_broadcast_matches")
    .select("id,name,competition,payload")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    name: string;
    competition: string;
    payload: FootballBroadcastPayload;
  } | null;
}
