'use client'

import Image from 'next/image'

type BrandLockupProps = {
  size?: number
  className?: string
  nameClassName?: string
  subLabelClassName?: string
  priority?: boolean
}

/**
 * Identidad NEXUS News.
 * El símbolo representa distintas señales que convergen en un único punto editorial.
 */
export default function BrandLockup({
  size = 30,
  className = '',
  nameClassName = 'text-[17px] font-extrabold tracking-tight text-[var(--nx-ink)]',
  subLabelClassName = 'mt-0.5 text-[8px] font-bold uppercase tracking-[0.22em] text-[var(--nx-muted)]',
  priority = false,
}: BrandLockupProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src="/brand/nexus-symbol.svg"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        priority={priority}
        unoptimized
        className="shrink-0 rounded-[9px]"
      />
      <span className="flex flex-col leading-none">
        <span className={nameClassName}>NEXUS</span>
        <span className={subLabelClassName}>NEWS</span>
      </span>
    </span>
  )
}
