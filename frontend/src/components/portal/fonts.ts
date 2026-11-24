// Tipografía del portal: Inter (variable), autoalojada por next/font, solo
// para los wrappers .nx-portal (el admin y el artículo no cambian).
import { Inter } from 'next/font/google'

export const portalFont = Inter({ subsets: ['latin'], display: 'swap', fallback: ['system-ui', 'Segoe UI', 'Arial', 'sans-serif'] })
