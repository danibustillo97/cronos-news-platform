"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Bell, Check, ChevronDown, CircleAlert, Clock3, LogOut, Radio,
  ShieldCheck, X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useProduction } from "@/studio/lab/ProductionContext";

interface AdminTopBarProps {
  title: string;
  user: User | null;
  onLogout: () => void;
}

function initials(email: string | undefined): string {
  if (!email) return "NX";
  const name = email.split("@")[0];
  return name.slice(0, 2).toUpperCase();
}

export default function AdminTopBar({ title, user, onLogout }: AdminTopBarProps) {
  const {
    activeStory,
    activeProductions,
    openProduction,
    runtimeConnected,
    setActiveView,
    workspace,
  } = useProduction();
  const [openMenu, setOpenMenu] = useState<"activity" | "account" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const runningProductions = activeProductions.filter(({ production }) =>
    production.status === "RUNNING" || production.status === "PENDING"
  );
  const failedProductions = activeProductions.filter(({ production }) => production.status === "FAILED");
  const needsReview = workspace?.compositions.some((composition) => composition.status === "READY_FOR_REVIEW") ?? false;
  const runtimeAlert = runtimeConnected === false;
  const activityCount = runningProductions.length + failedProductions.length + Number(needsReview) + Number(runtimeAlert);

  useEffect(() => {
    if (!openMenu) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);

  const followProduction = (storyId: string, headline: string | null) => {
    openProduction(storyId, headline);
    setActiveView("dashboard");
    setOpenMenu(null);
  };

  const followReview = () => {
    setActiveView("nexus_studio");
    setOpenMenu(null);
  };

  const runtimeLabel = runtimeConnected === true
    ? "Motor conectado"
    : runtimeConnected === false
      ? "Motor desconectado"
      : "Conectando motor";

  return (
    <header className="relative z-40 flex h-[62px] flex-shrink-0 items-center justify-between border-b border-white/[0.055] bg-[#080809]/90 px-4 backdrop-blur-2xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-neutral-100 sm:text-[15px]">
              {title}
            </h1>
            {activeStory?.title && (
              <>
                <span className="hidden text-neutral-700 sm:inline">/</span>
                <span className="hidden max-w-[min(34vw,420px)] truncate text-[12px] text-neutral-400 sm:inline">
                  {activeStory.title}
                </span>
              </>
            )}
          </div>
          <p className="mt-0.5 truncate text-[10px] text-neutral-600 sm:hidden">
            {activeStory?.title ?? "Centro de operaciones"}
          </p>
        </div>
      </div>

      <div ref={menuRef} className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
        <div
          title={runtimeLabel}
          className={`hidden h-8 items-center gap-2 rounded-full border px-3 text-[10px] font-medium sm:inline-flex ${
            runtimeConnected === true
              ? "border-emerald-400/[0.12] bg-emerald-400/[0.04] text-emerald-200/80"
              : runtimeConnected === false
                ? "border-amber-400/[0.12] bg-amber-400/[0.04] text-amber-200/80"
                : "border-white/[0.07] bg-white/[0.025] text-neutral-400"
          }`}
          role="status"
          aria-live="polite"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${
            runtimeConnected === true ? "bg-emerald-400" : runtimeConnected === false ? "bg-amber-400" : "animate-pulse bg-neutral-400"
          }`} />
          {runtimeLabel}
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label={`Actividad${activityCount ? `, ${activityCount} elementos` : ""}`}
            aria-expanded={openMenu === "activity"}
            onClick={() => setOpenMenu(openMenu === "activity" ? null : "activity")}
            className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
              openMenu === "activity"
                ? "border-white/[0.13] bg-white/[0.08] text-white"
                : "border-transparent text-neutral-400 hover:border-white/[0.08] hover:bg-white/[0.045] hover:text-neutral-100"
            }`}
          >
            <Bell size={15} strokeWidth={1.8} />
            {activityCount > 0 && (
              <span className="absolute right-1 top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full border-2 border-[#080809] bg-red-400 px-0.5 text-[8px] font-semibold leading-none text-white">
                {activityCount > 9 ? "9+" : activityCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {openMenu === "activity" && (
              <motion.section
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                aria-label="Actividad reciente"
                className="absolute right-0 top-[calc(100%+12px)] w-[min(360px,calc(100vw-88px))] overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#111113]/[0.98] shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
                  <div>
                    <p className="text-[12px] font-semibold text-neutral-100">Actividad</p>
                    <p className="mt-0.5 text-[10px] text-neutral-500">
                      {activityCount ? `${activityCount} elementos de actividad` : "Estado de la operación"}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Cerrar actividad"
                    onClick={() => setOpenMenu(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="max-h-[min(380px,65vh)] overflow-y-auto p-2">
                  {needsReview && (
                    <button
                      type="button"
                      onClick={followReview}
                      className="flex w-full items-start gap-3 rounded-[14px] px-3 py-3 text-left transition-colors hover:bg-white/[0.045]"
                    >
                      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-400/[0.09] text-amber-300">
                        <CircleAlert size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-medium text-neutral-200">Revisión pendiente</span>
                        <span className="mt-1 block truncate text-[10px] text-neutral-500">
                          {workspace?.story.headline ?? "Una producción está lista para revisión."}
                        </span>
                      </span>
                      <ArrowRightIcon />
                    </button>
                  )}

                  {failedProductions.slice(0, 4).map(({ production, storyHeadline }) => (
                    <button
                      type="button"
                      key={production.id}
                      onClick={() => followProduction(production.storyId, storyHeadline)}
                      className="flex w-full items-start gap-3 rounded-[14px] px-3 py-3 text-left transition-colors hover:bg-white/[0.045]"
                    >
                      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-red-400/[0.09] text-red-300">
                        <CircleAlert size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-medium text-neutral-200">Producción requiere atención</span>
                        <span className="mt-1 block truncate text-[10px] text-neutral-500">{storyHeadline ?? "Historia sin título"}</span>
                      </span>
                      <ArrowRightIcon />
                    </button>
                  ))}

                  {runningProductions.slice(0, 5).map(({ production, storyHeadline }) => (
                    <button
                      type="button"
                      key={production.id}
                      onClick={() => followProduction(production.storyId, storyHeadline)}
                      className="flex w-full items-start gap-3 rounded-[14px] px-3 py-3 text-left transition-colors hover:bg-white/[0.045]"
                    >
                      <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${
                        production.status === "RUNNING"
                          ? "bg-sky-400/[0.08] text-sky-300"
                          : "bg-white/[0.05] text-neutral-400"
                      }`}>
                        {production.status === "RUNNING" ? <Radio size={15} /> : <Clock3 size={15} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-medium text-neutral-200">
                          {production.status === "RUNNING" ? "Producción en curso" : "Producción en espera"}
                        </span>
                        <span className="mt-1 block truncate text-[10px] text-neutral-500">{storyHeadline ?? "Historia sin título"}</span>
                      </span>
                      <ArrowRightIcon />
                    </button>
                  ))}

                  {runtimeAlert && (
                    <div className="flex items-start gap-3 rounded-[14px] px-3 py-3">
                      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-400/[0.08] text-amber-300">
                        <Radio size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-medium text-neutral-200">Motor de producción desconectado</span>
                        <span className="mt-1 block text-[10px] text-neutral-500">Las tareas de producción podrían no avanzar.</span>
                      </span>
                    </div>
                  )}

                  {activityCount === 0 && (
                    <div className="flex flex-col items-center px-5 py-8 text-center">
                      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/[0.06] text-emerald-300">
                        <Check size={17} />
                      </span>
                      <p className="text-[11px] font-medium text-neutral-300">Sin actividad pendiente</p>
                      <p className="mt-1 text-[10px] text-neutral-600">No hay producciones ni revisiones para atender.</p>
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        <div className="mx-0.5 h-5 w-px bg-white/[0.08]" />

        <div className="relative">
          <button
            type="button"
            aria-label="Abrir cuenta"
            aria-expanded={openMenu === "account"}
            onClick={() => setOpenMenu(openMenu === "account" ? null : "account")}
            className={`flex h-9 items-center gap-2 rounded-full border py-1 pl-1 pr-2 transition-colors sm:pr-2.5 ${
              openMenu === "account"
                ? "border-white/[0.13] bg-white/[0.07]"
                : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.04]"
            }`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-red-300/[0.14] bg-gradient-to-br from-red-400/[0.16] to-white/[0.04] text-[9px] font-semibold tracking-wide text-red-100">
              {initials(user?.email)}
            </span>
            <span className="hidden max-w-[140px] truncate text-[10px] font-medium text-neutral-300 md:block">
              {user?.email ?? "Administrador"}
            </span>
            <ChevronDown size={12} className="hidden text-neutral-500 sm:block" />
          </button>

          <AnimatePresence>
            {openMenu === "account" && (
              <motion.section
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                aria-label="Cuenta de administrador"
                className="absolute right-0 top-[calc(100%+12px)] w-[min(280px,calc(100vw-88px))] overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#111113]/[0.98] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
              >
                <div className="flex items-center gap-3 rounded-[14px] px-3 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-red-300/[0.14] bg-gradient-to-br from-red-400/[0.16] to-white/[0.04] text-[10px] font-semibold text-red-100">
                    {initials(user?.email)}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-200">
                      Administrador <ShieldCheck size={12} className="text-emerald-300" />
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-neutral-500">{user?.email ?? "Sesión activa"}</span>
                  </span>
                </div>
                <div className="my-1 h-px bg-white/[0.06]" />
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onLogout();
                  }}
                  className="flex h-10 w-full items-center gap-2.5 rounded-[13px] px-3 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-red-400/[0.07] hover:text-red-200"
                >
                  <LogOut size={14} />
                  Cerrar sesión
                </button>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

function ArrowRightIcon() {
  return <span aria-hidden="true" className="mt-2 text-[12px] text-neutral-600">→</span>;
}
