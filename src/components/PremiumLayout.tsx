'use client'

import { FC, ReactNode, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
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
  Zap
} from 'lucide-react'
import LiveScoresWidget from '@/components/widgets/LiveScoresWidget'
import StandingsWidget from '@/components/widgets/StandingsWidget'
import RadioBar from '@/components/common/RadioBar'

interface Props {
  children: ReactNode
}

const PremiumLayout: FC<Props> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const navigation = [
    { name: 'Inicio', href: '/', icon: Home, active: true },
    { name: 'Noticias', href: '/noticias', icon: Newspaper },
    { name: 'Ligas', href: '/ligas', icon: Trophy },
    { name: 'Configuración', href: '/configuracion', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 glass border-b border-yellow-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo Premium */}
            <div className="flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
              >
                <Menu className="w-6 h-6 text-white" />
              </motion.button>
              
              <Link href="/" className="flex items-center space-x-3 group">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow"
                >
                  <span className="text-black font-black text-lg">S</span>
                </motion.div>
                <div>
                  <h1 className="text-xl font-black text-white group-hover:text-yellow-400 transition-colors">
                    SportPulse
                  </h1>
                  <p className="text-xs text-gray-400 font-medium">Premium Sports</p>
                </div>
              </Link>
            </div>

            {/* Navigation Desktop */}
            <nav className="hidden lg:flex items-center space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                    item.active
                      ? 'bg-yellow-500 text-black shadow-glow'
                      : 'text-gray-300 hover:text-yellow-400 hover:bg-gray-800/50'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              {/* Search */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSearchOpen(!searchOpen)}
                className="p-2 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
              >
                <Search className="w-5 h-5 text-gray-400" />
              </motion.button>

              {/* Notifications */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative p-2 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
              >
                <Bell className="w-5 h-5 text-gray-400" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
              </motion.button>

              {/* User Profile */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center space-x-2 p-2 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
                  <User className="w-4 h-4 text-black" />
                </div>
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Premium Sidebar */}
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
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 h-full w-80 glass border-r border-yellow-500/20 z-50 lg:hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                        <span className="text-black font-black text-lg">S</span>
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white">SportPulse</h2>
                        <p className="text-xs text-gray-400">Premium Sports</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="p-2 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <nav className="space-y-2">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 ${
                          item.active
                            ? 'bg-yellow-500 text-black shadow-glow'
                            : 'text-gray-300 hover:text-yellow-400 hover:bg-gray-800/50'
                        }`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="w-5 h-5" />
                        <span>{item.name}</span>
                      </Link>
                    ))}
                  </nav>

                  {/* Live Scores in Mobile */}
                  <div className="mt-8">
                    <h3 className="text-sm font-bold text-yellow-400 mb-4 flex items-center space-x-2">
                      <Zap className="w-4 h-4" />
                      <span>En Vivo</span>
                    </h3>
                    <LiveScoresWidget />
                  </div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-96 glass border-r border-yellow-500/20 min-h-screen overflow-y-auto custom-scroll">
          <div className="p-4">
            {/* Live Scores */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-yellow-400 mb-3 flex items-center space-x-2">
                <Zap className="w-5 h-5" />
                <span>En Vivo</span>
              </h3>
              <LiveScoresWidget />
            </div>

            {/* Standings */}
            <div>
              <h3 className="text-lg font-bold text-yellow-400 mb-3 flex items-center space-x-2">
                <Trophy className="w-5 h-5" />
                <span>LaLiga</span>
              </h3>
              <StandingsWidget />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen pb-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {children}
            </motion.div>
          </div>
        </main>

        {/* Right Sidebar Desktop */}
        <aside className="hidden xl:block w-80 glass border-l border-yellow-500/20 min-h-screen overflow-y-auto custom-scroll">
          <div className="p-4">
            {/* Trending */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-yellow-400 mb-3 flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Tendencia</span>
              </h3>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <motion.div
                    key={i}
                    whileHover={{ scale: 1.02 }}
                    className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-yellow-500/30 transition-all duration-300"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 rounded-lg gradient-primary flex items-center justify-center text-black font-bold text-xs">
                        {i}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white line-clamp-2">
                          Noticia trending #{i}
                        </h4>
                        <p className="text-xs text-gray-400 mt-1">Hace {i}h</p>
                      </div>
                      <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div>
              <h3 className="text-lg font-bold text-yellow-400 mb-3">Estadísticas</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-yellow-400">24</div>
                  <div className="text-xs text-gray-400">Partidos</div>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-blue-400">156</div>
                  <div className="text-xs text-gray-400">Noticias</div>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-400">89</div>
                  <div className="text-xs text-gray-400">Ligas</div>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-purple-400">1.2K</div>
                  <div className="text-xs text-gray-400">Usuarios</div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

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
              className="w-full max-w-2xl mx-4 glass rounded-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center space-x-4">
                <Search className="w-6 h-6 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar noticias, equipos, jugadores..."
                  className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-lg"
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

      {/* Radio Bar */}
      <RadioBar />
    </div>
  )
}

export default PremiumLayout
