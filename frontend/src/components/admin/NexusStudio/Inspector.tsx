'use client'

// Sección 32: todo editable sobre el clip seleccionado -- Position/Scale/
// Rotation/Opacity/Duration/Focal point/Text/Volumen. Sin selección,
// estado vacío elegante (nunca un formulario con campos deshabilitados
// fingiendo que hay algo que editar).

import type { ClipTransform, StudioClip } from '@/types/studio'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-white/40 mb-1">{label}</span>
      {children}
    </label>
  )
}

function Slider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-red-600"
      />
      <span className="text-[11px] tabular-nums text-white/60 w-12 text-right">{value.toFixed(2)}</span>
    </div>
  )
}

export default function Inspector({
  clip, onUpdateClip, onUpdateTransform,
}: {
  clip: StudioClip | null
  onUpdateClip: (patch: Partial<StudioClip>) => void
  onUpdateTransform: (patch: Partial<ClipTransform>) => void
}) {
  if (!clip) {
    return (
      <div className="h-full flex items-center justify-center text-center px-4">
        <p className="text-xs text-white/30">Seleccioná un clip en el timeline para editarlo.</p>
      </div>
    )
  }

  return (
    <div className="p-3 overflow-y-auto h-full">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/50 mb-3">Inspector</h3>

      <Field label="Duración (ms)">
        <input
          type="number" min={100} value={clip.durationMs}
          onChange={(e) => onUpdateClip({ durationMs: Math.max(100, Number(e.target.value)) })}
          className="w-full bg-white/5 border border-white/10 rounded-sm px-2 py-1 text-xs text-white"
        />
      </Field>

      {clip.track === 'TEXT' && (
        <Field label="Texto">
          <textarea
            value={clip.text ?? ''} rows={3}
            onChange={(e) => onUpdateClip({ text: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-sm px-2 py-1 text-xs text-white resize-none"
          />
        </Field>
      )}

      <Field label="Posición X"><Slider value={clip.transform.x} min={-0.5} max={0.5} step={0.01} onChange={(x) => onUpdateTransform({ x })} /></Field>
      <Field label="Posición Y"><Slider value={clip.transform.y} min={-0.5} max={0.5} step={0.01} onChange={(y) => onUpdateTransform({ y })} /></Field>
      <Field label="Escala"><Slider value={clip.transform.scale} min={0.5} max={2} step={0.01} onChange={(scale) => onUpdateTransform({ scale })} /></Field>
      <Field label="Rotación (°)"><Slider value={clip.transform.rotation} min={-45} max={45} step={1} onChange={(rotation) => onUpdateTransform({ rotation })} /></Field>
      <Field label="Opacidad"><Slider value={clip.transform.opacity} min={0} max={1} step={0.01} onChange={(opacity) => onUpdateTransform({ opacity })} /></Field>

      {clip.track === 'IMAGE' && (
        <>
          <Field label="Foco horizontal (crop)"><Slider value={clip.transform.focalX} min={0} max={1} step={0.01} onChange={(focalX) => onUpdateTransform({ focalX })} /></Field>
          <Field label="Foco vertical (crop)"><Slider value={clip.transform.focalY} min={0} max={1} step={0.01} onChange={(focalY) => onUpdateTransform({ focalY })} /></Field>
        </>
      )}

      {(clip.track === 'VOICE' || clip.track === 'MUSIC' || clip.track === 'SFX') && (
        <Field label="Volumen">
          <Slider value={clip.muted ? 0 : 1} min={0} max={1} step={1} onChange={(v) => onUpdateClip({ muted: v === 0 })} />
        </Field>
      )}

      {clip.sourcePlaceholderId && (
        <p className="text-[10px] text-white/30 mt-4 pt-3 border-t border-white/10">
          Fuente: {clip.sourcePlaceholderId}
        </p>
      )}
    </div>
  )
}
