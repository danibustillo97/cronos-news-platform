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

export default function LiveScoresWidget() {
  const [matches, setMatches] = useState<MatchResult[]>([]);

  useEffect(() => {
    async function fetchMatches() {
      try {
        const res = await fetch("http://localhost:8000/api/match-results");
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

  const liveStatuses = [ "Halftime", "Second Half", "First Half"];
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
      className="bg-neutral-900 text-white rounded-2xl px-4 py-3 shadow-md hover:shadow-lg transition-all duration-300 animate-fade-in border border-neutral-700"
    >
      <div className="flex justify-between items-center text-neutral-400 text-xs mb-2">
        <span className="uppercase truncate font-medium">
          {match.league.replace(/\.\d+$/, "")}
        </span>
        <span>{formatDate(match.date)}</span>
      </div>

      <div className="flex justify-between items-center mb-1 gap-2">
        <div className="flex flex-col w-1/3 truncate text-left">
          <span className="text-xl font-bold">{abbreviate(match.home_team)}</span>
          <span className="text-xs text-neutral-300 truncate">{match.home_team}</span>
        </div>

        <div className="text-lg font-bold text-center w-1/3">
          {match.home_score} - {match.away_score}
        </div>

        <div className="flex flex-col w-1/3 text-right truncate">
          <span className="text-xl font-bold">{abbreviate(match.away_team)}</span>
          <span className="text-xs text-neutral-300 truncate">{match.away_team}</span>
        </div>
      </div>

      <div className="mt-2 flex justify-between text-xs items-center">
        <span className="text-white">
          {statusTranslations[match.status] || match.status}
          {match.time && ` - ${match.time}`}
        </span>
        {isLive(match) && (
          <span className="flex items-center gap-1 text-red-500 font-medium animate-pulse">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            En Vivo
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {liveMatches.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-black mb-3">⚽ En Vivo</h2>
          <div className="space-y-3">
            {liveMatches.map((match) => MatchCard(match))}
          </div>
        </div>
      )}

      {finishedMatches.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-black mt-4 mb-3">
            📋 Finalizados
          </h2>
          <div className="space-y-3">
            {finishedMatches.map((match) => MatchCard(match))}
          </div>
        </div>
      )}
    </div>
  );
}
