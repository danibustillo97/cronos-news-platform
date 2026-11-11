'use client'

// Resuelve category_id -> nombre real contra /api/categories (ya
// existente, sin cambios) -- compartido entre ContentSelector y
// StudioShell para no repetir el mismo fetch.

import { useEffect, useState } from 'react'
import { apiUrl } from '@/studio/lab/api-client'

interface CategoryOption { id: string; name: string }

export function useCategoryNames() {
  const [names, setNames] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    let cancelled = false
    fetch(apiUrl('/api/categories'))
      .then((res) => (res.ok ? res.json() : { groups: [] }))
      .then((data: { groups: { categories: CategoryOption[] }[] }) => {
        if (cancelled) return
        const map = new Map<string, string>()
        for (const group of data.groups ?? []) {
          for (const c of group.categories ?? []) map.set(c.id, c.name)
        }
        setNames(map)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  return names
}
