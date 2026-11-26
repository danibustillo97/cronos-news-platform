import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0D0F',
          borderRadius: 38,
        }}
      >
        <svg width="144" height="144" viewBox="0 0 128 128" fill="none">
          <path d="M25 25 L59 59" stroke="#F4F4F0" strokeWidth="10" strokeLinecap="round" />
          <path d="M25 103 L59 69" stroke="#F4F4F0" strokeWidth="10" strokeLinecap="round" />
          <path d="M70 64 H103" stroke="#FACC15" strokeWidth="10" strokeLinecap="round" />
          <circle cx="64" cy="64" r="9" fill="#FACC15" />
          <circle cx="64" cy="64" r="3" fill="#0B0D0F" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
