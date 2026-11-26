import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', position: 'relative',
        overflow: 'hidden', padding: '66px 76px',
        background: 'radial-gradient(circle at 88% 50%, #24200D 0%, #0B0D0F 54%)',
        color: '#F4F4F0', fontFamily: 'Arial, Helvetica, sans-serif',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '82%', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ width: 66, height: 66, borderRadius: 18, background: '#15191D', border: '1px solid #3A3F43', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 128 128" fill="none">
                <path d="M25 25 L59 59" stroke="#F4F4F0" strokeWidth="10" strokeLinecap="round" />
                <path d="M25 103 L59 69" stroke="#F4F4F0" strokeWidth="10" strokeLinecap="round" />
                <path d="M70 64 H103" stroke="#FACC15" strokeWidth="10" strokeLinecap="round" />
                <circle cx="64" cy="64" r="9" fill="#FACC15" />
                <circle cx="64" cy="64" r="3" fill="#0B0D0F" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 25, fontWeight: 900, letterSpacing: 4 }}>NEXUS NEWS</div>
              <div style={{ fontSize: 12, color: '#A7A9A6', letterSpacing: 3, fontWeight: 700 }}>MEDIO DIGITAL DEPORTIVO</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 4, color: '#FACC15' }}>FÚTBOL · DATOS · CONTEXTO</div>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: 88, lineHeight: 0.88, fontWeight: 900, letterSpacing: -4 }}>
              <span>NEXUS</span><span style={{ color: '#FACC15' }}>NEWS</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 31, fontWeight: 600, color: '#E5E5E0' }}>El fútbol, más allá del marcador.</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, color: '#A7A9A6' }}>COLOMBIA Y EL MUNDO / ACTUALIDAD / DEBATE</div>
        </div>
        <div style={{ position: 'absolute', right: -84, top: 115, width: 460, height: 460, borderRadius: 230, border: '1px solid rgba(250,204,21,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: 300, height: 300 }}>
            <div style={{ position: 'absolute', left: 38, top: 42, width: 112, height: 14, borderRadius: 8, background: '#F4F4F0', transform: 'rotate(45deg)' }} />
            <div style={{ position: 'absolute', left: 38, top: 218, width: 112, height: 14, borderRadius: 8, background: '#F4F4F0', transform: 'rotate(-45deg)' }} />
            <div style={{ position: 'absolute', left: 160, top: 144, width: 105, height: 14, borderRadius: 8, background: '#FACC15' }} />
            <div style={{ position: 'absolute', left: 142, top: 128, width: 46, height: 46, borderRadius: 23, background: '#FACC15', border: '8px solid #0B0D0F' }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
