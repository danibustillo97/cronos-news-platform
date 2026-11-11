
'use client'

import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Fingerprint,
  Activity,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (loading) return

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        if (error.message.toLowerCase().includes('invalid login')) {
          throw new Error('Correo electrónico o contraseña incorrectos.')
        }

        if (error.message.toLowerCase().includes('email not confirmed')) {
          throw new Error('Debes confirmar tu correo electrónico.')
        }

        throw new Error('No fue posible iniciar sesión. Inténtalo nuevamente.')
      }

      if (data.session) {
        router.replace('/admin')
        router.refresh()
      } else {
        throw new Error('No se pudo establecer una sesión.')
      }
    } catch (err: unknown) {
      console.error('Authentication error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error inesperado.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08080C] text-white selection:bg-violet-500/30">

      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-violet-700/[0.12] blur-[150px]" />
        <div className="absolute -bottom-60 -right-40 h-[700px] w-[700px] rounded-full bg-red-600/[0.08] blur-[160px]" />

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#08080C]/20 to-[#08080C]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
            <ShieldCheck size={20} className="text-violet-400" />
          </div>

          <div>
            <p className="text-sm font-bold tracking-[0.18em] text-white">
              NEXUS
            </p>
            <p className="text-[9px] tracking-[0.25em] text-neutral-500">
              ADMINISTRATION
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <span className="text-[10px] font-medium tracking-wider text-neutral-400">
            SECURE ENVIRONMENT
          </span>
        </div>
      </header>

      {/* Main */}
      <section className="relative z-10 flex min-h-[calc(100vh-100px)] items-center justify-center px-5 pb-12 pt-4">

        <div className="grid w-full max-w-[1120px] items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">

          {/* Left editorial section */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            className="hidden lg:block"
          >
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/[0.06] px-3 py-2">
              <Sparkles size={13} className="text-violet-400" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">
                Editorial Intelligence
              </span>
            </div>

            <h1 className="max-w-xl text-5xl font-semibold leading-[1.12] tracking-[-0.045em] xl:text-6xl">
              Controla.
              <br />
              Crea.
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-rose-400 bg-clip-text text-transparent">
                Transforma.
              </span>
            </h1>

            <p className="mt-7 max-w-md text-[15px] leading-7 text-neutral-400">
              Un espacio centralizado para gestionar contenido,
              operaciones editoriales y herramientas de administración.
            </p>

            {/* Feature cards */}
            <div className="mt-12 grid max-w-lg grid-cols-2 gap-3">

              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
                  <Activity size={17} className="text-violet-400" />
                </div>

                <p className="text-sm font-semibold text-white">
                  Control editorial
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Gestión centralizada
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10">
                  <Fingerprint size={17} className="text-rose-400" />
                </div>

                <p className="text-sm font-semibold text-white">
                  Acceso seguro
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Identidad protegida
                </p>
              </div>

            </div>

            <div className="mt-12 flex items-center gap-3 text-xs text-neutral-600">
              <div className="h-px w-10 bg-neutral-800" />
              <span>BUILT FOR MODERN MEDIA OPERATIONS</span>
            </div>
          </motion.div>

          {/* Login card */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="mx-auto w-full max-w-[440px]"
          >
            <div className="relative overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#111116]/90 p-7 shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:p-10">

              {/* Card glow */}
              <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-600/[0.10] blur-[90px]" />

              <div className="relative">

                {/* Mobile brand */}
                <div className="mb-8 flex items-center gap-3 lg:hidden">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-900">
                    <ShieldCheck size={23} />
                  </div>

                  <span className="text-lg font-black tracking-widest">
                    NEXUS
                  </span>
                </div>

                <div className="mb-8">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/[0.10]">
                    <LockKeyhole size={21} className="text-violet-300" />
                  </div>

                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-violet-400">
                    Administrative access
                  </p>

                  <h2 className="text-3xl font-semibold tracking-tight text-white">
                    Bienvenido.
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    Ingresa tus credenciales para acceder al panel administrativo.
                  </p>
                </div>

                {/* Error */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -8 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-5 flex items-start gap-3 overflow-hidden rounded-xl border border-red-500/20 bg-red-500/[0.08] p-3"
                    >
                      <AlertCircle size={17} className="mt-0.5 shrink-0 text-red-400" />

                      <p className="text-xs leading-5 text-red-300">
                        {error}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-5">

                  {/* Email */}
                  <div className="space-y-2">
                    <label
                      htmlFor="admin-email"
                      className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400"
                    >
                      Correo electrónico
                    </label>

                    <div className="group relative">
                      <Mail
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 transition-colors group-focus-within:text-violet-400"
                      />

                      <input
                        id="admin-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@tudominio.com"
                        autoComplete="username"
                        required
                        disabled={loading}
                        className="h-[54px] w-full rounded-xl border border-white/[0.09] bg-black/30 pl-12 pr-4 text-sm text-white outline-none transition-all placeholder:text-neutral-700 hover:border-white/15 focus:border-violet-500/60 focus:bg-black/50 focus:ring-4 focus:ring-violet-500/[0.08] disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="admin-password"
                        className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400"
                      >
                        Contraseña
                      </label>
                    </div>

                    <div className="group relative">
                      <LockKeyhole
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 transition-colors group-focus-within:text-violet-400"
                      />

                      <input
                        id="admin-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Introduce tu contraseña"
                        autoComplete="current-password"
                        required
                        disabled={loading}
                        className="h-[54px] w-full rounded-xl border border-white/[0.09] bg-black/30 pl-12 pr-12 text-sm text-white outline-none transition-all placeholder:text-neutral-700 hover:border-white/15 focus:border-violet-500/60 focus:bg-black/50 focus:ring-4 focus:ring-violet-500/[0.08] disabled:opacity-50"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 transition-colors hover:text-white"
                      >
                        {showPassword
                          ? <EyeOff size={17} />
                          : <Eye size={17} />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || !email.trim() || !password}
                    className="group relative mt-3 flex h-[56px] w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-bold text-white shadow-[0_8px_30px_rgba(124,58,237,0.22)] transition-all hover:from-violet-500 hover:to-purple-500 hover:shadow-[0_8px_35px_rgba(124,58,237,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Verificando acceso...
                      </>
                    ) : (
                      <>
                        Iniciar sesión
                        <ArrowRight
                          size={18}
                          className="transition-transform group-hover:translate-x-1"
                        />
                      </>
                    )}
                  </button>

                </form>

                {/* Footer card */}
                <div className="mt-8 border-t border-white/[0.07] pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={15} className="text-emerald-500" />
                      <span className="text-[10px] font-medium tracking-wide text-neutral-500">
                        Conexión protegida
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-neutral-600">
                      Supabase Auth
                      <ChevronRight size={12} />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Bottom footer */}
            <div className="mt-6 flex flex-col items-center justify-between gap-3 px-2 text-[10px] text-neutral-600 sm:flex-row">
              <span>© {new Date().getFullYear()} Nexus Administration</span>
              <span className="tracking-wider">PRIVATE ACCESS · AUTHORIZED USERS ONLY</span>
            </div>

          </motion.div>
        </div>
      </section>
    </main>
  )
}
