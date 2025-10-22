'use client'

import { motion } from 'framer-motion'
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'

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
  "Real Betis": "https://logos-world.net/wp-content/uploads/2020/06/Real-Betis-Logo.png",
  "Osasuna": "https://logos-world.net/wp-content/uploads/2020/06/Osasuna-Logo.png",
  "Getafe": "https://logos-world.net/wp-content/uploads/2020/06/Getafe-Logo.png",
  "Celta Vigo": "https://logos-world.net/wp-content/uploads/2020/06/Celta-Vigo-Logo.png",
  "Espanyol": "https://logos-world.net/wp-content/uploads/2020/06/Espanyol-Logo.png",
  "Mallorca": "https://logos-world.net/wp-content/uploads/2020/06/Mallorca-Logo.png",
  "Cadiz": "https://logos-world.net/wp-content/uploads/2020/06/Cadiz-Logo.png",
  "Elche": "https://logos-world.net/wp-content/uploads/2020/06/Elche-Logo.png",
  "Almeria": "https://logos-world.net/wp-content/uploads/2020/06/Almeria-Logo.png",
  "Valladolid": "https://logos-world.net/wp-content/uploads/2020/06/Valladolid-Logo.png",
  "Girona": "https://logos-world.net/wp-content/uploads/2020/06/Girona-Logo.png",
  "Las Palmas": "https://logos-world.net/wp-content/uploads/2020/06/Las-Palmas-Logo.png"
};

const getTeamLogo = (teamName: string): string => {
  return teamLogos[teamName] || `https://via.placeholder.com/24x24/374151/ffffff?text=${teamName.charAt(0)}`;
};

const dummyTable = [
  { team: 'Real Madrid', pts: 85, played: 34, won: 28, drawn: 1, lost: 5, form: 'WWWWW', gd: 45 },
  { team: 'Barcelona', pts: 80, played: 34, won: 25, drawn: 5, lost: 4, form: 'WWLWW', gd: 38 },
  { team: 'Atletico Madrid', pts: 75, played: 34, won: 23, drawn: 6, lost: 5, form: 'WDWWW', gd: 32 },
  { team: 'Sevilla', pts: 70, played: 34, won: 21, drawn: 7, lost: 6, form: 'WWDWW', gd: 28 },
  { team: 'Real Sociedad', pts: 65, played: 34, won: 19, drawn: 8, lost: 7, form: 'LWWWD', gd: 22 },
  { team: 'Villarreal', pts: 60, played: 34, won: 17, drawn: 9, lost: 8, form: 'WDWLW', gd: 18 },
  { team: 'Real Betis', pts: 55, played: 34, won: 16, drawn: 7, lost: 11, form: 'LWWLD', gd: 12 },
  { team: 'Athletic Bilbao', pts: 50, played: 34, won: 14, drawn: 8, lost: 12, form: 'WLDWL', gd: 8 }
];

const getPositionColor = (position: number) => {
  if (position <= 4) return 'text-green-400' // Champions League
  if (position <= 6) return 'text-blue-400' // Europa League
  if (position >= 7) return 'text-red-400' // Relegation
  return 'text-gray-400'
}

const getFormIcon = (result: string) => {
  switch (result) {
    case 'W': return <TrendingUp className="w-2 h-2 text-green-400" />
    case 'L': return <TrendingDown className="w-2 h-2 text-red-400" />
    case 'D': return <Minus className="w-2 h-2 text-yellow-400" />
    default: return null
  }
}

const OptimizedStandingsWidget = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-gray-800/50 border border-gray-700 rounded-lg p-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-white">LaLiga</span>
        </div>
        <div className="text-xs text-gray-400">J34</div>
      </div>

      {/* Teams - Ultra Compact */}
      <div className="space-y-1">
        {dummyTable.map((team, i) => (
          <motion.div
            key={team.team}
            whileHover={{ scale: 1.01, x: 2 }}
            className={`flex items-center justify-between p-2 rounded-lg transition-all duration-300 ${
              i < 4 ? 'bg-green-500/10 border border-green-500/20' : 
              i < 6 ? 'bg-blue-500/10 border border-blue-500/20' :
              'bg-red-500/10 border border-red-500/20'
            }`}
          >
            {/* Left: Position + Team */}
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                i === 0 ? 'bg-yellow-500 text-black' :
                i === 1 ? 'bg-gray-400 text-black' :
                i === 2 ? 'bg-orange-500 text-white' :
                i < 4 ? 'bg-green-500 text-white' :
                i < 6 ? 'bg-blue-500 text-white' :
                'bg-red-500 text-white'
              }`}>
                {i + 1}
              </div>
              
              <img
                src={getTeamLogo(team.team)}
                alt={team.team}
                className="w-3 h-3 rounded-full object-cover flex-shrink-0"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://via.placeholder.com/12x12/374151/ffffff?text=${team.team.charAt(0)}`;
                }}
              />
              
              <span className="text-xs font-semibold text-white truncate">
                {team.team.length > 8 ? team.team.substring(0, 8) + '...' : team.team}
              </span>
            </div>

            {/* Right: Stats */}
            <div className="flex items-center space-x-2 text-xs">
              <div className="text-gray-300 w-4 text-center">{team.played}</div>
              <div className="text-gray-300 w-6 text-center">
                {team.gd > 0 ? '+' : ''}{team.gd}
              </div>
              <div className={`text-sm font-bold ${getPositionColor(i + 1)} w-6 text-right`}>
                {team.pts}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Legend - Ultra Compact */}
      <div className="mt-3 pt-2 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
              <span>UCL</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
              <span>UEL</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
              <span>Desc</span>
            </div>
          </div>
          <div className="text-yellow-400 font-medium">
            Live
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default OptimizedStandingsWidget
