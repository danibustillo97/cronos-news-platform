import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos de Servicio | Nexus News',
  description: 'Términos y condiciones de uso de Nexus News.',
};

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Términos de Servicio
        </h1>
        
        <p className="text-gray-600 mb-8">
          Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <section className="space-y-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Aceptación de Términos</h2>
            <p className="text-gray-700 leading-relaxed">
              Al acceder y usar Nexus News, aceptas cumplir con estos términos. Si no estás de acuerdo, 
              no utilices nuestros servicios.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Descripción del Servicio</h2>
            <p className="text-gray-700 leading-relaxed">
              Nexus News proporciona herramientas de IA para crear y gestionar contenido de noticias 
              deportivas, incluyendo la capacidad de publicar directamente en TikTok con autorización del usuario.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Cuentas de Usuario</h2>
            <p className="text-gray-700 leading-relaxed">
              Eres responsable de mantener la seguridad de tu cuenta. Notifícanos inmediatamente de 
              cualquier uso no autorizado. Debes tener al menos 13 años para usar el servicio.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Contenido y Propiedad Intelectual</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>Conservas los derechos sobre el contenido que creas.</li>
              <li>Nos otorgas licencia para almacenar y procesar tu contenido para brindar el servicio.</li>
              <li>No uses contenido que infrinja derechos de terceros.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Uso Prohibido</h2>
            <p className="text-gray-700 leading-relaxed">
              No puedes usar el servicio para:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-4">
              <li>Crear o distribuir contenido ilegal, ofensivo o dañino.</li>
              <li>Violar los términos de TikTok u otras plataformas.</li>
              <li>Realizar actividades fraudulentas o de spam.</li>
              <li>Intentar acceder sin autorización a sistemas de terceros.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Integración con TikTok</h2>
            <p className="text-gray-700 leading-relaxed">
              Al conectar tu cuenta de TikTok:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-4">
              <li>Cumples con los <a href="https://www.tiktok.com/legal/terms-of-service" className="text-blue-600 hover:underline">Términos de Servicio de TikTok</a>.</li>
              <li>Eres responsable del contenido que publiques en TikTok a través de nuestro servicio.</li>
              <li>Podemos revocar la integración si violas las políticas de TikTok.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Limitación de Responsabilidad</h2>
            <p className="text-gray-700 leading-relaxed">
              El servicio se proporciona "tal cual". No somos responsables por daños indirectos, 
              pérdida de datos o problemas con plataformas de terceros como TikTok.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Modificaciones</h2>
            <p className="text-gray-700 leading-relaxed">
              Podemos modificar estos términos en cualquier momento. Los cambios entran en vigor 
              al publicarse. El uso continuado del servicio constituye aceptación.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Terminación</h2>
            <p className="text-gray-700 leading-relaxed">
              Podemos suspender o terminar tu cuenta por violación de estos términos. 
              Puedes eliminar tu cuenta en cualquier momento desde la configuración.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Contacto</h2>
            <p className="text-gray-700 leading-relaxed">
              Para preguntas sobre estos términos: <a href="mailto:legal@nexusnews.info" className="text-blue-600 hover:underline">legal@nexusnews.info</a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
