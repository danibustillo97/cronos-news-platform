'use client'

// Real light/dark toggle for the public portal's browsing chrome (navbar,
// feed, cards) -- defaults to dark (the "dark editorial" identity:
// #0B0B0B background, premium-magazine feel) per the 2026-09 redesign
// brief, persisted per-visitor from there. The article reading experience
// (ArticleContent.tsx / the "floating window") stays deliberately
// theme-independent -- explicitly asked to stay unchanged.

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggleTheme: () => {} })

const STORAGE_KEY = 'nexus-portal-theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') setTheme(stored)
    } catch {
      // private mode / blocked storage -- silently keep the default
    }
  }, [])

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try { window.localStorage.setItem(STORAGE_KEY, next) } catch {}
      return next
    })
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function usePortalTheme() {
  return useContext(ThemeContext)
}
