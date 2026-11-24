import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

export const supabase: SupabaseClient = isSupabaseConfigured && supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : createMissingSupabaseClient()

function createMissingSupabaseClient(): SupabaseClient {
  const missingError = () => new Error(
    'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required'
  )

  const queryChain = new Proxy({}, {
    get(_target, property) {
      if (property === 'then') {
        return (resolve: (value: { data: null; error: Error }) => unknown) =>
          resolve({ data: null, error: missingError() })
      }
      if (property === 'execute') {
        return async () => ({ data: null, error: missingError() })
      }
      return () => queryChain
    },
  })

  const auth = new Proxy({}, {
    get(_target, property) {
      if (property === 'getSession' || property === 'getUser') {
        return async () => ({ data: { session: null, user: null }, error: missingError() })
      }
      if (property === 'signOut') {
        return async () => ({ error: missingError() })
      }
      if (property === 'signInWithPassword') {
        return async () => ({ data: { session: null, user: null }, error: missingError() })
      }
      return () => undefined
    },
  })

  // Inert Realtime channel: chainable .on(...).subscribe(), never emits.
  const createChannelStub = (): unknown => {
    const channel: Record<string, unknown> = {}
    channel.on = () => channel
    channel.subscribe = () => channel
    channel.unsubscribe = async () => 'ok'
    channel.send = async () => 'error'
    return channel
  }

  return new Proxy({}, {
    get(_target, property) {
      if (property === 'auth') return auth
      if (property === 'from') return () => queryChain
      if (property === 'rpc') return async () => ({ data: null, error: missingError() })
      if (property === 'channel') return createChannelStub
      if (property === 'removeChannel') return async () => 'ok'
      if (property === 'removeAllChannels') return async () => []
      if (property === 'getChannels') return () => []
      return undefined
    },
  }) as SupabaseClient
}
