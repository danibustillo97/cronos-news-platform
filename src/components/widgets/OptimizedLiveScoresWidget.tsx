'use client';
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

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

interface OptimizedLiveScoresWidgetProps {
  horizontal?: boolean;
}

// Mapeo de equipos a escudos
const teamLogos: Record<string, string> = {
  "Real Madrid": "https://logos-world.net/wp-content/uploads/2020/06/Real-Madrid-Logo.png",
  "Barcelona": "https://logos-world.net/wp-content/uploads/2020/06/Barcelona-Logo.png",
  "Atletico Madrid": "https://logos-world.net/wp-content/uploads/2020/06/Atletico-Madrid-Logo.png",
  "Sevilla": "https://logos-world.net/wp-content/uploads/2020/06/Sevilla-Logo.png",
  "Valencia": "https://logos-world.net/wp-content/uploads/2020/06/Valencia-Logo.png",
  "Villarreal": "https://logos-world.net/wp-content/uploads/2020/06/Villarreal-Logo.png",
  "Real Sociedad": "https://logos-world.net/wp-content/uploads/2020/06/Real-Sociedad-Logo.png",
  "Athletic Bilbao": "https://logos-world.net/wp-content/uploads/2020/06/Athletic-Bilbao-Logo.png",
  "Manchester United": "https://logos-world.net/wp-content/uploads/2020/06/Manchester-United-Logo.png",
  "Manchester City": "https://logos-world.net/wp-content/uploads/2020/06/Manchester-City-Logo.png",
  "Liverpool": "https://logos-world.net/wp-content/uploads/2020/06/Liverpool-Logo.png",
  "Chelsea": "https://logos-world.net/wp-content/uploads/2020/06/Chelsea-Logo.png",
  "Arsenal": "https://logos-world.net/wp-content/uploads/2020/06/Arsenal-Logo.png",
  "Tottenham": "https://logos-world.net/wp-content/uploads/2020/06/Tottenham-Logo.png",
  "Bayern Munich": "https://logos-world.net/wp-content/uploads/2020/06/Bayern-Munich-Logo.png",
  "Borussia Dortmund": "https://logos-world.net/wp-content/uploads/2020/06/Borussia-Dortmund-Logo.png",
  "PSG": "https://logos-world.net/wp-content/uploads/2020/06/PSG-Logo.png",
  "Juventus": "https://logos-world.net/wp-content/uploads/2020/06/Juventus-Logo.png",
  "AC Milan": "https://logos-world.net/wp-content/uploads/2020/06/AC-Milan-Logo.png",
  "Inter Milan": "https://logos-world.net/wp-content/uploads/2020/06/Inter-Milan-Logo.png",
};

const getTeamLogo = (teamName: string): string => {
  return teamLogos[teamName] || `https://via.placeholder.com/32x32/374151/ffffff?text=${teamName.charAt(0)}`;
};

export default function OptimizedLiveScoresWidget({ horizontal = false }: OptimizedLiveScoresWidgetProps) {
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

  const liveStatuses = ["Halftime", "Second Half", "First Half"];
  const isLive = (match: MatchResult) => liveStatuses.includes(match.status);

  const statusTranslations: Record<string, string> = {
    "First Half": "1T",
    "Second Half": "2T",
    "Halftime": "DES",
    "Delayed": "RET",
    "Full Time": "FIN",
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLeagueIcon = (league: string) => {
    if (league.includes("LaLiga")) return "🇪🇸";
    if (league.includes("Premier")) return "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
    if (league.includes("Bundesliga")) return "🇩🇪";
    if (league.includes("Serie A")) return "🇮🇹";
    if (league.includes("Ligue 1")) return "🇫🇷";
    return "⚽";
  };

  const MatchCard = (match: MatchResult) => (
    <motion.div
      key={match.id}
      whileHover={{ scale: 1.01 }}
      className={`bg-gray-800/50 border border-gray-700 rounded-lg p-3 transition-all duration-300 ${
        horizontal ? "min-w-[160px] w-[160px] shrink-0" : ""
      } ${isLive(match) ? 'border-yellow-500/50 shadow-glow' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1">
          <span className="text-sm">{getLeagueIcon(match.league)}</span>
          <span className="text-xs font-bold text-yellow-400 uppercase truncate">
            {match.league.replace(/\.\d+$/, "").substring(0, 6)}
          </span>
        </div>
        <div className="text-xs text-gray-400">{formatTime(match.date)}</div>
      </div>

      {/* Teams and Score - Ultra Compact */}
      <div className="space-y-1">
        {/* Home Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 flex-1 min-w-0">
            <img
              src={getTeamLogo(match.home_team)}
              alt={match.home_team}
              className="w-4 h-4 rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://via.placeholder.com/16x16/374151/ffffff?text=${match.home_team.charAt(0)}`;
              }}
            />
            <span className="text-xs font-semibold text-white truncate">
              {match.home_team.length > 8 ? match.home_team.substring(0, 8) + '...' : match.home_team}
            </span>
          </div>
          <div className="text-sm font-bold text-white">
            {match.home_score}
          </div>
        </div>

        {/* Away Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 flex-1 min-w-0">
            <img
              src={getTeamLogo(match.away_team)}
              alt={match.away_team}
              className="w-4 h-4 rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://via.placeholder.com/16x16/374151/ffffff?text=${match.away_team.charAt(0)}`;
              }}
            />
            <span className="text-xs font-semibold text-white truncate">
              {match.away_team.length > 8 ? match.away_team.substring(0, 8) + '...' : match.away_team}
            </span>
          </div>
          <div className="text-sm font-bold text-white">
            {match.away_score}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-700">
        <div className="flex items-center space-x-1">
          <span className="text-xs font-medium text-gray-300">
            {statusTranslations[match.status] || match.status}
          </span>
          {match.time && (
            <span className="text-xs text-gray-400">
              {match.time}
            </span>
          )}
        </div>
        {isLive(match) && (
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="flex items-center gap-1 text-red-500 font-bold text-xs"
          >
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
            <span>LIVE</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );

  const liveMatches = matches
    .filter(isLive)
    .slice(0, horizontal ? 4 : 3);

  const finishedMatches = matches
    .filter((m) => m.status === "Full Time")
    .slice(0, horizontal ? 3 : 4);

  return (
    <div className={`${horizontal ? "flex gap-2 overflow-x-auto scrollbar-hide pb-2" : "space-y-2"}`}>
      {liveMatches.length > 0 && (
        <div>
          {!horizontal && (
            <h2 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span>En Vivo</span>
            </h2>
          )}
          <div className={horizontal ? "flex gap-2" : "space-y-2"}>
            {liveMatches.map((match) => MatchCard(match))}
          </div>
        </div>
      )}

      {!horizontal && finishedMatches.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
            <span>📋</span>
            <span>Finalizados</span>
          </h2>
          <div className="space-y-2">
            {finishedMatches.map((match) => MatchCard(match))}
          </div>
        </div>
      )}

      {matches.length === 0 && (
        <div className="text-center py-4">
          <div className="text-gray-500 text-sm">Cargando marcadores...</div>
        </div>
      )}
    </div>
  );
}
