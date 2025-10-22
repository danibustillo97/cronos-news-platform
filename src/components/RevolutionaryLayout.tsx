'use client'

import { FC, ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import OptimizedLiveScoresWidget from '@/components/widgets/OptimizedLiveScoresWidget'
import OptimizedStandingsWidget from '@/components/widgets/OptimizedStandingsWidget'
import { 
  Home, 
  Newspaper, 
  Trophy, 
  Settings, 
  Menu, 
  X, 
  Search,
  Bell,
  User,
  TrendingUp,
  Star,
  Zap,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Heart,
  Share2,
  MessageCircle,
  Bookmark,
  Filter,
  Grid,
  List,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  ThumbsUp
} from 'lucide-react'

interface Props {
  children: ReactNode
}

const RevolutionaryLayout: FC<Props> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [radioPlaying, setRadioPlaying] = useState(false)
  const [radioVolume, setRadioVolume] = useState(0.8)
  const [radioMuted, setRadioMuted] = useState(false)
  const [activeTab, setActiveTab] = useState('live')

  const navigation = [
    { name: 'Inicio', href: '/', icon: Home, active: true },
    { name: 'Noticias', href: '/noticias', icon: Newspaper },
    { name: 'Ligas', href: '/ligas', icon: Trophy },
    { name: 'Configuración', href: '/configuracion', icon: Settings },
  ]

  const tabs = [
    { id: 'live', name: 'En Vivo', icon: Zap, color: 'text-red-500' },
    { id: 'scores', name: 'Resultados', icon: Trophy, color: 'text-yellow-500' },
    { id: 'standings', name: 'Clasificaciones', icon: TrendingUp, color: 'text-blue-500' },
    { id: 'trending', name: 'Tendencia', icon: Star, color: 'text-purple-500' }
  ]

  // Mock data for demonstration
  const liveMatches = [
    { id: 1, home: 'Real Madrid', away: 'Barcelona', homeScore: 2, awayScore: 1, time: '78\'', status: 'live', league: 'LaLiga' },
    { id: 2, home: 'Man City', away: 'Liverpool', homeScore: 1, awayScore: 0, time: '45\'', status: 'live', league: 'Premier' },
    { id: 3, home: 'PSG', away: 'Bayern', homeScore: 0, awayScore: 0, time: '15\'', status: 'live', league: 'Champions' }
  ]

  const trendingNews = [
    { id: 1, title: 'Messi marca gol histórico en el Clásico', likes: 12500, comments: 340, shares: 890, time: '2h' },
    { id: 2, title: 'Real Madrid gana el Clásico 2-1', likes: 8900, comments: 210, shares: 450, time: '3h' },
    { id: 3, title: 'Mbappé anuncia renovación con PSG', likes: 15600, comments: 890, shares: 1200, time: '5h' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900">
      {/* Revolutionary Header */}
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-yellow-500/30 shadow-2xl"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo Section */}
            <div className="flex items-center space-x-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-3 rounded-2xl bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 hover:from-yellow-500/30 hover:to-yellow-600/30 transition-all duration-300"
              >
                <Menu className="w-6 h-6 text-yellow-400" />
              </motion.button>
              
              <Link href="/" className="flex items-center space-x-4 group">
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.8, type: "spring" }}
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 flex items-center justify-center shadow-2xl shadow-yellow-500/30"
                >
                  <span className="text-black font-black text-2xl">⚽</span>
                </motion.div>
                <div>
                  <h1 className="text-xl font-black text-white group-hover:text-yellow-400 transition-colors">
                    SportPulse
                  </h1>
                  <p className="text-xs text-gray-400 font-medium">Sports</p>
                </div>
              </Link>
            </div>

            {/* Navigation */}
            <nav className="hidden lg:flex items-center space-x-2">
              {navigation.map((item) => (
                <motion.div
                  key={item.name}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link
                    href={item.href}
                    className={`flex items-center space-x-3 px-6 py-3 rounded-2xl font-bold transition-all duration-300 ${
                      item.active
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-2xl shadow-yellow-500/30'
                        : 'text-gray-300 hover:text-yellow-400 hover:bg-gray-800/50'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                </motion.div>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSearchOpen(!searchOpen)}
                className="p-3 rounded-2xl bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-300"
              >
                <Search className="w-5 h-5 text-gray-400" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative p-3 rounded-2xl bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-300"
              >
                <Bell className="w-5 h-5 text-gray-400" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center space-x-3 p-3 rounded-2xl bg-gradient-to-r from-gray-800/50 to-gray-700/50 hover:from-gray-700/50 hover:to-gray-600/50 transition-all duration-300"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                  <User className="w-4 h-4 text-black" />
                </div>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="flex">
        {/* Revolutionary Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -400 }}
                animate={{ x: 0 }}
                exit={{ x: -400 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 h-full w-96 bg-black/90 backdrop-blur-xl border-r border-yellow-500/30 z-50 lg:hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-2xl shadow-yellow-500/30">
                        <span className="text-black font-black text-xl">⚽</span>
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white">SportPulse</h2>
                        <p className="text-sm text-gray-400">Revolutionary Sports</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="p-3 rounded-2xl bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <nav className="space-y-3">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center space-x-4 px-4 py-4 rounded-2xl font-bold transition-all duration-300 ${
                          item.active
                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-2xl shadow-yellow-500/30'
                            : 'text-gray-300 hover:text-yellow-400 hover:bg-gray-800/50'
                        }`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="w-5 h-5" />
                        <span>{item.name}</span>
                      </Link>
                    ))}
                  </nav>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-80 bg-black/50 backdrop-blur-xl border-r border-yellow-500/30 min-h-screen overflow-y-auto custom-scroll">
          <div className="p-4">
            {/* Tabs */}
            <div className="mb-6">
              <div className="flex space-x-2 mb-4">
                {tabs.map((tab) => (
                  <motion.button
                    key={tab.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-sm transition-all duration-300 ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/30'
                        : 'text-gray-400 hover:text-yellow-400 hover:bg-gray-800/50'
                    }`}
                  >
                    <tab.icon className={`w-4 h-4 ${tab.color}`} />
                    <span>{tab.name}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Content based on active tab */}
            <AnimatePresence mode="wait">
              {activeTab === 'live' && (
                <motion.div
                  key="live"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-red-500" />
                    <span>En Vivo</span>
                  </h3>
                  <OptimizedLiveScoresWidget />
                </motion.div>
              )}

              {activeTab === 'scores' && (
                <motion.div
                  key="scores"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <span>Resultados</span>
                  </h3>
                  <OptimizedLiveScoresWidget />
                </motion.div>
              )}

              {activeTab === 'standings' && (
                <motion.div
                  key="standings"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span>Clasificaciones</span>
                  </h3>
                  <OptimizedStandingsWidget />
                </motion.div>
              )}

              {activeTab === 'trending' && (
                <motion.div
                  key="trending"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Star className="w-4 h-4 text-purple-500" />
                    <span>Tendencia</span>
                  </h3>
                  {trendingNews.map((news, index) => (
                    <motion.div
                      key={news.id}
                      whileHover={{ scale: 1.02, x: 4 }}
                      className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 hover:border-purple-500/30 transition-all duration-300"
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-4 h-4 rounded bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                          {index + 1}
                        </div>
                        <span className="text-xs text-gray-400">{news.time}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-2 line-clamp-2">{news.title}</h4>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            <Heart className="w-3 h-3" />
                            <span>{news.likes.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MessageCircle className="w-3 h-3" />
                            <span>{news.comments}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Share2 className="w-3 h-3" />
                            <span>{news.shares}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen pb-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>

      {/* Compact Radio Bar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-yellow-500/30 shadow-lg"
      >
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Radio Info */}
            <div className="flex items-center space-x-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setRadioPlaying(!radioPlaying)}
                className="w-10 h-10 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30"
              >
                {radioPlaying ? <Pause className="w-5 h-5 text-black" /> : <Play className="w-5 h-5 text-black" />}
              </motion.button>

              <div>
                <h3 className="text-sm font-bold text-white">SportPulse Radio</h3>
                <div className="flex items-center space-x-1">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-red-500 font-bold">EN VIVO</span>
                </div>
              </div>
            </div>

            {/* Visualizer */}
            <AnimatePresence>
              {radioPlaying && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center space-x-1"
                >
                  {[0.3, 0.5, 0.4, 0.6, 0.35, 0.4, 0.3, 0.5].map((duration, i) => (
                    <motion.div
                      key={i}
                      animate={{ scaleY: [0.4, 1, 0.4] }}
                      transition={{
                        duration: duration,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                      className="w-1 h-4 bg-gradient-to-t from-yellow-500 to-yellow-400 rounded-full"
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls */}
            <div className="flex items-center space-x-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setRadioMuted(!radioMuted)}
                className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
              >
                {radioMuted ? <VolumeX className="w-4 h-4 text-gray-400" /> : <Volume2 className="w-4 h-4 text-gray-400" />}
              </motion.button>

              <div className="flex items-center space-x-2">
                <VolumeX className="w-3 h-3 text-gray-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={radioMuted ? 0 : radioVolume}
                  onChange={(e) => setRadioVolume(parseFloat(e.target.value))}
                  className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <Volume2 className="w-3 h-3 text-gray-400" />
              </div>

              <div className="text-xs text-gray-400 font-medium">
                {Math.round((radioMuted ? 0 : radioVolume) * 100)}%
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl mx-4 bg-black/90 backdrop-blur-xl rounded-2xl p-6 border border-yellow-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center space-x-4">
                <Search className="w-6 h-6 text-yellow-400" />
                <input
                  type="text"
                  placeholder="Buscar noticias, equipos, jugadores..."
                  className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-lg font-medium"
                  autoFocus
                />
                <button
                  onClick={() => setSearchOpen(false)}
                  className="p-2 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default RevolutionaryLayout
