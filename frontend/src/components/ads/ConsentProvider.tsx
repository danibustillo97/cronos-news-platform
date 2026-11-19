'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type ConsentChoice = 'accepted' | 'rejected'

interface ConsentContextValue {
  choice: ConsentChoice | null
  setChoice: (choice: ConsentChoice) => void
}

const ConsentContext = createContext<ConsentContextValue>({
  choice: null,
  setChoice: () => undefined,
})

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ConsentChoice | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem('cronos_ad_consent')
    if (stored === 'accepted' || stored === 'rejected') setChoiceState(stored)
  }, [])

  const setChoice = (next: ConsentChoice) => {
    window.localStorage.setItem('cronos_ad_consent', next)
    setChoiceState(next)
  }

  return (
    <ConsentContext.Provider value={{ choice, setChoice }}>
      {children}
    </ConsentContext.Provider>
  )
}

export function useConsent() {
  return useContext(ConsentContext)
}
