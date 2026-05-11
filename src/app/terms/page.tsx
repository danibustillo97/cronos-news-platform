import { Metadata } from 'next';
import ModernNavbar from '@/components/ui/ModernNavbar';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Términos de Servicio',
  description: 'Términos y condiciones de uso de Nexus News.',
};

export default function TermsOfService() {
  return (
    <>
      <ModernNavbar />
      <main className="min-h-screen bg-white pt-20">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            Términos de Servicio
          </h1>
          <p className="text-neutral-500 mb-8">Última actualización: 11 de mayo de 2026</p>

          <div className="space-y-6 text-neutral-700 leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">1. Aceptación</h2>
              <p>
                Al usar Nexus News, aceptas estos términos. Si no estás de acuerdo, no uses el servicio.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">2. Descripción del servicio</h2>
              <p>
                Nexus News proporciona herramientas de IA para crear noticias deportivas y publicar 
                contenido en TikTok con tu autorización.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">3. Integración con TikTok</h2>
              <p className="mb-2">Al conectar tu cuenta de TikTok:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Cumples con los Términos de Servicio de TikTok.</li>
                <li>Eres responsable del contenido que publiques.</li>
                <li>Podemos revocar la integración si violas políticas de TikTok.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">4. Cuentas de usuario</h2>
              <p>
                Eres responsable de mantener la seguridad de tu cuenta. Debes tener al menos 13 años 
                para usar el servicio.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">5. Propiedad intelectual</h2>
              <p>
                Conservas los derechos sobre el contenido que creas. Nosotros conservamos los derechos 
                sobre nuestra plataforma y tecnología.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">6. Uso prohibido</h2>
              <p className="mb-2">No puedes usar el servicio para:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Crear contenido ilegal, ofensivo o difamatorio.</li>
                <li>Infringir derechos de propiedad intelectual.</li>
                <li>Realizar spam o actividades fraudulentas.</li>
                <li>Violar los términos de TikTok u otras plataformas.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">7. Limitación de responsabilidad</h2>
              <p>
                El servicio se proporciona "tal cual". No somos responsables por problemas con 
                plataformas de terceros como TikTok.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">8. Ley aplicable</h2>
              <p>
                Estos términos se rigen por las leyes de Colombia. Cualquier disputa se resolverá 
                en los tribunales de Barranquilla, Atlántico.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-red-600 mb-3">9. Contacto</h2>
              <p>
                Para preguntas sobre estos términos:<br />
                danibustillo97@gmail.com | +57 300 647 6527<br />
                Cra 13 # 10-25, Puerto Colombia, Atlántico, Colombia
              </p>
            </section>

            <div className="border-t border-neutral-200 pt-6 mt-8 text-sm text-neutral-500">
              <p>
                Estos términos cumplen con la legislación colombiana, GDPR, y requisitos de TikTok Developer Platform.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-neutral-200 mt-8 py-3">
          <div className="flex justify-center space-x-4 text-xs text-neutral-500">
            <Link href="/" className="hover:text-red-600 transition">Inicio</Link>
            <Link href="/privacy" className="hover:text-red-600 transition">Privacidad</Link>
            <Link href="/terms" className="text-red-600">Términos</Link>
          </div>
        </footer>
      </main>
    </>
  );
}
