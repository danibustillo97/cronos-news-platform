import type { Metadata } from 'next'
import { Suspense } from 'react'
import CompareClient from './CompareClient'

export const metadata: Metadata = {
  title: 'Comparar jugadores',
  description: 'Compara a dos futbolistas estadística por estadística, por temporada y competición.',
}

export default function ComparePage() {
  return (
    <Suspense>
      <CompareClient />
    </Suspense>
  )
}
