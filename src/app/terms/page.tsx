import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos de Servicio | Nexus News',
  description: 'Términos y condiciones de uso de Nexus News.',
};

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Términos de Servicio
          </h1>
          <p className="text-gray-500">Última actualización: 11 de mayo de 2026</p>
        </div>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Aceptación de los términos</h2>
            <p>
              Al acceder y usar Nexus News, confirmas que has leído, entendido y aceptas cumplir 
              con estos términos de servicio. Si no estás de acuerdo con alguna parte de estos términos, 
              no debes usar nuestra plataforma. Estos términos constituyen un acuerdo legal entre tú y Nexus News.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Descripción del servicio</h2>
            <p className="mb-3">
              Nexus News es una plataforma que utiliza inteligencia artificial para ayudar a crear 
              y gestionar contenido de noticias deportivas. Nuestros servicios incluyen:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Generación automática de guiones y noticias deportivas usando IA.</li>
              <li>Herramientas para grabar y editar videos de noticias.</li>
              <li>Integración con TikTok para publicar contenido directamente en tu cuenta.</li>
              <li>Gestión de contenido y programación de publicaciones.</li>
            </ul>
            <p className="mt-3">
              Nos reservamos el derecho de modificar, suspender o discontinuar cualquier parte del 
              servicio en cualquier momento, con o sin previo aviso.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Registro y cuentas de usuario</h2>
            <p className="mb-3">
              Para usar ciertas funciones de Nexus News, necesitas crear una cuenta. Al hacerlo, 
              aceptas proporcionar información precisa, actual y completa. Eres responsable de:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Mantener la confidencialidad de tu contraseña y credenciales de acceso.</li>
              <li>Notificarnos inmediatamente sobre cualquier uso no autorizado de tu cuenta.</li>
              <li>Asegurarte de que tu cuenta no sea usada por personas menores de 13 años.</li>
              <li>Todas las actividades que ocurran bajo tu cuenta, autorizadas o no.</li>
            </ul>
            <p className="mt-3">
              Nos reservamos el derecho de suspender o eliminar cuentas que violen estos términos 
              o que presenten actividad sospechosa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Integración con TikTok</h2>
            <p className="mb-3">
              Nexus News se integra con la plataforma TikTok para permitirte publicar contenido. 
              Al usar esta función, entiendes y aceptas que:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Debes cumplir con los <a href="https://www.tiktok.com/legal/terms-of-service" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Términos de Servicio de TikTok</a>, 
                sus <a href="https://www.tiktok.com/legal/privacy-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Políticas de Privacidad</a> y las <a href="https://www.tiktok.com/legal/community-guidelines" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Normas de la Comunidad</a>.</li>
              <li>Eres el único responsable del contenido que publiques en TikTok a través de nuestra plataforma.</li>
              <li>El contenido publicado debe cumplir con todas las leyes aplicables y no infringir derechos de terceros.</li>
              <li>Podemos revocar la integración con TikTok si detectamos violaciones de las políticas de TikTok.</li>
              <li>TikTok puede suspender o eliminar tu cuenta independientemente de Nexus News.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Propiedad intelectual</h2>
            <p className="mb-3">
              <strong>Tu contenido:</strong> Tú conservas todos los derechos sobre el contenido que 
              creas usando Nexus News. Al usar nuestros servicios, nos otorgas una licencia limitada 
              para almacenar, procesar y publicar tu contenido según tus instrucciones.
            </p>
            <p className="mb-3">
              <strong>Nuestra plataforma:</strong> Todo el software, diseños, logotipos, textos y 
              tecnología de Nexus News son propiedad nuestra y están protegidos por leyes de 
              propiedad intelectual. No puedes copiar, modificar o distribuir nuestro código o 
              diseños sin autorización expresa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Contenido prohibido</h2>
            <p className="mb-3">
              No puedes usar Nexus News para crear, almacenar o distribuir contenido que:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Sea ilegal, difamatorio, obsceno, abusivo o amenazante.</li>
              <li>Infrinja derechos de autor, marcas comerciales u otros derechos de propiedad intelectual.</li>
              <li>Contenga información falsa o engañosa que pueda dañar a terceros.</li>
              <li>Promueva violencia, discriminación o actividades ilegales.</li>
              <li>Sea spam, malware o tenga como objetido interrumpir nuestros servicios.</li>
              <li>Viole los términos de servicio de plataformas de terceros como TikTok.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Limitación de responsabilidad</h2>
            <p className="mb-3">
              Nexus News se proporciona "tal cual" y "según disponibilidad". No garantizamos que:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>El servicio será ininterrumpido, oportuno, seguro o libre de errores.</li>
              <li>Los resultados obtenidos del uso del servicio serán precisos o confiables.</li>
              <li>La integración con TikTok u otras plataformas funcionará permanentemente.</li>
            </ul>
            <p className="mt-3">
              En ningún caso seremos responsables por daños indirectos, incidentales, especiales 
              o consecuentes que resulten del uso o la imposibilidad de usar nuestros servicios.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Modificaciones a los términos</h2>
            <p>
              Podemos modificar estos términos en cualquier momento. Los cambios entrarán en vigor 
              inmediatamente después de su publicación en esta página. Te notificaremos sobre cambios 
              significativos por correo electrónico o mediante un aviso en la plataforma. El uso 
              continuado de Nexus News después de los cambios constituye tu aceptación de los nuevos términos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Terminación</h2>
            <p>
              Podemos suspender o terminar tu acceso a Nexus News inmediatamente, sin previo aviso 
              ni responsabilidad, por cualquier razón, incluyendo violación de estos términos. 
              Tú puedes dejar de usar el servicio en cualquier momento. Al terminar, tu derecho de 
              usar el servicio cesará inmediatamente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Ley aplicable</h2>
            <p>
              Estos términos se regirán e interpretarán de acuerdo con las leyes de la República 
              de Colombia. Cualquier disputa relacionada con estos términos se resolverá en los 
              tribunales competentes de Barranquilla, Atlántico, Colombia.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contacto</h2>
            <p className="mb-3">
              Si tienes preguntas sobre estos términos de servicio, contáctanos:
            </p>
            <p>
              <strong>Daniel Bustillo - Nexus News</strong><br />
              Email: danibustillo97@gmail.com<br />
              Teléfono: +57 300 647 6527<br />
              Dirección: Cra 13 # 10-25, Puerto Colombia, Atlántico, Colombia
            </p>
          </section>

          <div className="border-t pt-6 mt-8 text-sm text-gray-500">
            <p>
              Estos términos cumplen con la legislación colombiana, el GDPR de la Unión Europea 
              y los requisitos de plataformas de terceros incluyendo TikTok Developer Platform.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
