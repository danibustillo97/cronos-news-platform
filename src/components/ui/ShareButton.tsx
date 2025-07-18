'use client'

import { useState } from 'react'
import {
  Share2,
  ClipboardCopy,
  X,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Link
} from 'lucide-react'

interface ShareButtonProps {
  slug: string
}

export function ShareButton({ slug }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = `${window.location.origin}/noticia/${slug}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-yellow-500 transition"
      >
        <Share2 size={16} className="opacity-80" />
        Compartir
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-64 p-4 bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">Compartir</span>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div className="flex gap-3 justify-around mb-3">
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:scale-110 transition"
            >
              <Facebook />
            </a>
            <a
              href={`https://twitter.com/intent/tweet?url=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-500 hover:scale-110 transition"
            >
              <Twitter />
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:scale-110 transition"
            >
              <Linkedin />
            </a>
            <a
              href={`https://www.instagram.com`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-500 hover:scale-110 transition"
            >
              <Instagram />
            </a>
          </div>

          <div className="flex items-center bg-gray-100 rounded-md px-2 py-1 text-sm">
            <Link size={14} className="mr-2 text-gray-500" />
            <span className="truncate">{shareUrl}</span>
            <button onClick={copyToClipboard} className="ml-auto text-gray-500 hover:text-gray-700">
              <ClipboardCopy size={16} />
            </button>
          </div>

          {copied && (
            <p className="text-xs text-green-500 mt-1 text-center">¡Enlace copiado!</p>
          )}
        </div>
      )}
    </div>
  )
}
