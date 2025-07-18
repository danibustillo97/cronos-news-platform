"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Goal,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
} from "lucide-react";

export default function Navbar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = 56);

    const lines = Array.from({ length: 5 }, (_, i) => ({
      offset: i * 25,
      speed: 0.6 + Math.random(),
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(212, 175, 55, 0.15)";
      ctx.lineWidth = 1.2;

      lines.forEach(({ offset, speed }) => {
        ctx.beginPath();
        for (let x = 0; x <= width; x += 10) {
          const y =
            Math.sin((x + offset) * 0.01 + performance.now() * 0.002 * speed) * 6 +
            height / 2;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      requestAnimationFrame(draw);
    };

    draw();
    window.addEventListener("resize", () => {
      canvas.width = window.innerWidth;
    });
  }, []);

  return (
    <header className="fixed top-0 left-0 w-full z-50 shadow-md bg-[#0D0D0D]">
      {/* Fondo animado */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-[56px] z-0 pointer-events-none"
      />

      {/* Contenido */}
      <div className="relative z-10 flex items-center justify-between px-6 h-[56px] max-w-7xl mx-auto">
        {/* Logo refinado */}
        <div className="flex items-center space-x-1 text-lg font-extrabold">
          <span className="text-white tracking-wide">Estadio</span>
          <span className="text-[#D4AF37]">360</span>
        </div>

        {/* Fútbol link */}
        <nav className="flex items-center space-x-6 text-sm font-medium">
          <Link
            href="/"
            className="flex items-center gap-1 text-white hover:text-[#D4AF37] transition-all duration-200"
          >
            <Goal size={16} /> Fútbol
          </Link>
        </nav>

        {/* Redes sociales */}
        <div className="flex items-center space-x-4 text-white">
          <Link
            href="https://facebook.com"
            target="_blank"
            className="hover:text-[#D4AF37] transition"
          >
            <Facebook size={16} />
          </Link>
          <Link
            href="https://twitter.com"
            target="_blank"
            className="hover:text-[#D4AF37] transition"
          >
            <Twitter size={16} />
          </Link>
          <Link
            href="https://instagram.com"
            target="_blank"
            className="hover:text-[#D4AF37] transition"
          >
            <Instagram size={16} />
          </Link>
          <Link
            href="https://youtube.com"
            target="_blank"
            className="hover:text-[#D4AF37] transition"
          >
            <Youtube size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}
