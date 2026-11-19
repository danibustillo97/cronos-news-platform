import { Metadata } from 'next';
import ModernNavbar from '@/components/ui/ModernNavbar';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description: 'Política de privacidad de Nexus News.',
};

export default function PrivacyPolicy() {
  return (
    <>
      <ModernNavbar />
      <main className="min-h-screen bg-white pt-20">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            Política de Privacidad
          </h1>
          <p className="text-neutral-500 mb-8">Última actualización: 11 de mayo de 2026</p>

          <div className="space-y-6 text-neutral-700 leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">1. Quiénes somos</h2>
              <p className="mb-2">
                Nexus News es una plataforma de creación de contenido de noticias deportivas. 
                Operamos desde Puerto Colombia, Atlántico, Colombia.
              </p>
              <p>
                <strong className="text-neutral-900">Contacto:</strong><br />
                Email: danibustillo97@gmail.com<br />
                Teléfono: +57 300 647 6527<br />
                Dirección: Cra 13 # 10-25, Puerto Colombia, Atlántico, Colombia
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">2. Información que recopilamos</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Información de registro: nombre, correo electrónico, foto de perfil.</li>
                <li>Información de TikTok: open_id, nombre de usuario, avatar público y tokens de acceso (solo si conectas tu cuenta).</li>
                <li>Contenido que creas: videos, imágenes, textos.</li>
                <li>Datos técnicos: dirección IP, navegador, cookies esenciales.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">3. Integración con TikTok</h2>
              <p className="mb-2">
                Cuando conectas tu cuenta de TikTok:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Solo solicitamos permisos mínimos: video.upload y user.info.basic.</li>
                <li>No accedemos a tu contraseña. Usamos OAuth 2.0 seguro.</li>
                <li>Los tokens expiran y puedes revocarlos desde TikTok.</li>
                <li>Solo publicamos contenido con tu autorización explícita.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">4. Tus derechos</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Acceder a tus datos personales.</li>
                <li>Corregir información inexacta.</li>
                <li>Solicitar eliminación de tu cuenta.</li>
                <li>Desconectar integración con TikTok.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">5. Contacto</h2>
              <p>
                Para preguntas sobre privacidad:<br />
                danibustillo97@gmail.com | +57 300 647 6527
              </p>
            </section>

            <div className="border-t border-neutral-200 pt-6 mt-8 text-sm text-neutral-500">
              <p>
                Esta política cumple con GDPR, CCPA y la Ley 1581 de 2012 de Colombia.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-neutral-200 mt-8 py-3">
          <div className="flex justify-center space-x-4 text-xs text-neutral-500">
            <Link href="/" className="hover:text-red-600 transition">Inicio</Link>
            <Link href="/privacy" className="text-red-600">Privacidad</Link>
            <Link href="/terms" className="hover:text-red-600 transition">Términos</Link>
          </div>
        </footer>
      </main>
    </>
  );
}
