"use client";
import React, { useEffect, useState } from "react";

interface MatchResult {
  id: string;
  date: string;
  league: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  time: string;
  country_code?: string;
}

interface LiveScoresWidgetProps {
  horizontal?: boolean;
}

export default function LiveScoresWidget({ horizontal = false }: LiveScoresWidgetProps) {
  const [matches, setMatches] = useState<MatchResult[]>([]);

  useEffect(() => {
    async function fetchMatches() {
      try {
        const res = await fetch("https://backendcronosnews-production.up.railway.app/api/match-results");
        const data = await res.json();
        if (data.success) {
          const sorted = data.results.slice().sort(
            (a: MatchResult, b: MatchResult) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          setMatches(sorted);
        }
      } catch (err) {
        console.error("Error fetching match results", err);
      }
    }

    fetchMatches();
    const interval = setInterval(fetchMatches, 30000);
    return () => clearInterval(interval);
  }, []);

  const liveStatuses = ["Halftime", "Second Half", "First Half"];
  const isLive = (match: MatchResult) => liveStatuses.includes(match.status);

  const statusTranslations: Record<string, string> = {
    "First Half": "Primera Mitad",
    "Second Half": "Segunda Mitad",
    "Halftime": "Descanso",
    "Delayed": "Retrasado",
    "Full Time": "Finalizado",
  };

  const extractMinute = (timeStr: string): number => {
    const match = timeStr?.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const abbreviate = (name: string) => {
    const words = name
      .split(" ")
      .filter((w) => w.length > 2 || /^[A-Z]/.test(w));
    return words
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 3)
      .padEnd(3, "X");
  };

  const liveMatches = matches
    .filter(isLive)
    .sort((a, b) => extractMinute(b.time) - extractMinute(a.time))
    .slice(0, 8);

  const finishedMatches = matches
    .filter((m) => m.status === "Full Time")
    .slice(0, 10);

  const MatchCard = (match: MatchResult) => (
    <div
      key={match.id}
      className={`bg-[#111111] text-white rounded-xl px-3 py-2 md:px-4 md:py-3 border border-neutral-800 shadow-sm transition-all duration-200 font-sans ${
        horizontal ? "min-w-[220px] w-[220px] shrink-0" : ""
      }`}
    >
      <div className="flex justify-between items-center text-gray-400 text-[10px] md:text-xs mb-1 tracking-wide">
        <span className="uppercase font-medium truncate">{match.league.replace(/\.\d+$/, "")}</span>
        <span>{formatDate(match.date)}</span>
      </div>

      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="w-1/3 truncate text-left">
          <div className="text-[12px] md:text-sm font-semibold text-white leading-tight">{abbreviate(match.home_team)}</div>
          <div className="text-[10px] text-gray-400 truncate">{match.home_team}</div>
        </div>

        <div className="w-1/3 text-center text-white text-sm md:text-base font-bold">
          {match.home_score} - {match.away_score}
        </div>

        <div className="w-1/3 truncate text-right">
          <div className="text-[12px] md:text-sm font-semibold text-white leading-tight">{abbreviate(match.away_team)}</div>
          <div className="text-[10px] text-gray-400 truncate">{match.away_team}</div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-1 text-[10px] md:text-xs text-gray-300">
        <span>
          {statusTranslations[match.status] || match.status}
          {match.time && ` - ${match.time}`}
        </span>
        {isLive(match) && (
          <span className="flex items-center gap-1 text-red-500 font-medium animate-pulse">
            <span className="h-2 w-2 bg-red-500 rounded-full" />
            En Vivo
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className={`${horizontal ? "flex gap-3 overflow-x-auto scrollbar-hide" : "space-y-4"}`}>
      {liveMatches.length > 0 && (
        <div>
          {!horizontal && (
            <h2 className="text-sm md:text-lg font-semibold text-white mb-2">⚽ En Vivo</h2>
          )}
          <div className={horizontal ? "flex gap-3" : "space-y-2"}>
            {liveMatches.map((match) => MatchCard(match))}
          </div>
        </div>
      )}

      {!horizontal && finishedMatches.length > 0 && (
        <div>
          <h2 className="text-sm md:text-lg font-semibold text-white mt-4 mb-2">📋 Finalizados</h2>
          <div className="space-y-2">
            {finishedMatches.map((match) => MatchCard(match))}
          </div>
        </div>
      )}
    </div>
  );
}
