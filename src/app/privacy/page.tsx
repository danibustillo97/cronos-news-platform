import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad | Nexus News',
  description: 'Política de privacidad de Nexus News - Cómo protegemos y utilizamos tu información personal.',
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Política de Privacidad
        </h1>
        
        <p className="text-gray-600 mb-8">
          Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <section className="space-y-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introducción</h2>
            <p className="text-gray-700 leading-relaxed">
              Nexus News ("nosotros", "nuestro" o "la empresa") se compromete a proteger tu privacidad. 
              Esta política explica cómo recopilamos, usamos, almacenamos y protegemos tu información personal 
              cuando utilizas nuestro sitio web y servicios relacionados.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Información que Recopilamos</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Podemos recopilar los siguientes tipos de información:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li><strong>Información de cuenta:</strong> nombre, correo electrónico, foto de perfil cuando te registras.</li>
              <li><strong>Información de TikTok:</strong> solo si conectas tu cuenta de TikTok, incluyendo tu open_id, nombre de usuario y avatar público.</li>
              <li><strong>Contenido generado:</strong> videos, imágenes y texto que crees usando nuestros servicios.</li>
              <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador, dispositivo, y cookies necesarias para el funcionamiento.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Cómo Usamos tu Información</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Utilizamos tu información para:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>Proveer y mantener nuestros servicios de creación de contenido.</li>
              <li>Publicar contenido en TikTok cuando autorices explícitamente la conexión.</li>
              <li>Mejorar nuestros algoritmos de IA para generación de contenido.</li>
              <li>Enviar notificaciones sobre tu cuenta y actualizaciones del servicio.</li>
              <li>Cumplir con obligaciones legales y proteger nuestros derechos.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Integración con TikTok</h2>
            <p className="text-gray-700 leading-relaxed">
              Cuando conectas tu cuenta de TikTok:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-4">
              <li>Solo solicitamos los permisos mínimos necesarios: publicación de videos e información básica del perfil.</li>
              <li>No accedemos a tu contraseña de TikTok (usamos OAuth seguro).</li>
              <li>Puedes desconectar tu cuenta en cualquier momento desde la configuración.</li>
              <li>Respetamos los Términos de Servicio y Política de Privacidad de TikTok.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Protección de Datos</h2>
            <p className="text-gray-700 leading-relaxed">
              Implementamos medidas de seguridad técnicas y organizativas para proteger tu información:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-4">
              <li>Encriptación SSL/TLS para todas las comunicaciones.</li>
              <li>Almacenamiento seguro en servidores con acceso restringido.</li>
              <li>Tokens de acceso con expiración para integraciones con terceros.</li>
              <li>Monitoreo continuo de seguridad.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Compartir Información</h2>
            <p className="text-gray-700 leading-relaxed">
              No vendemos ni alquilamos tu información personal. Solo compartimos datos con:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-4">
              <li><strong>Proveedores de servicios:</strong> hosting, análisis, y procesamiento de pagos (solo lo necesario).</li>
              <li><strong>TikTok:</strong> cuando publicas contenido, siguiendo su API y términos.</li>
              <li><strong>Obligaciones legales:</strong> cuando sea requerido por ley o para proteger nuestros derechos.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Tus Derechos</h2>
            <p className="text-gray-700 leading-relaxed">
              Tienes derecho a:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-4">
              <li>Acceder a tu información personal.</li>
              <li>Corregir datos inexactos.</li>
              <li>Solicitar la eliminación de tu cuenta y datos.</li>
              <li>Retirar el consentimiento de integraciones (TikTok).</li>
              <li>Oponerte al procesamiento de tus datos.</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Para ejercer estos derechos, contacta: <a href="mailto:privacy@nexusnews.info" className="text-blue-600 hover:underline">privacy@nexusnews.info</a>
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cookies</h2>
            <p className="text-gray-700 leading-relaxed">
              Usamos cookies esenciales para el funcionamiento del sitio y cookies de análisis para mejorar 
              la experiencia. Puedes configurar tu navegador para rechazar cookies, pero algunas 
              funcionalidades podrían no funcionar correctamente.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Cambios a esta Política</h2>
            <p className="text-gray-700 leading-relaxed">
              Podemos actualizar esta política periódicamente. Te notificaremos de cambios significativos 
              mediante correo electrónico o aviso en el sitio. El uso continuo de nuestros servicios 
              después de los cambios constituye aceptación de la nueva política.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Contacto</h2>
            <p className="text-gray-700 leading-relaxed">
              Para preguntas sobre esta política de privacidad:
            </p>
            <div className="mt-4 space-y-2 text-gray-700">
              <p><strong>Email:</strong> <a href="mailto:privacy@nexusnews.info" className="text-blue-600 hover:underline">privacy@nexusnews.info</a></p>
              <p><strong>Dirección:</strong> Nexus News, Calle Principal 123, Ciudad, País</p>
            </div>
          </div>

          <div className="border-t pt-8 mt-8">
            <p className="text-sm text-gray-500">
              Esta política cumple con GDPR (UE), CCPA (California), y las políticas de plataformas de 
              terceros incluyendo TikTok Developer Platform.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
