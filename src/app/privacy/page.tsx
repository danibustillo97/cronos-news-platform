import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad | Nexus News',
  description: 'Cómo manejamos y protegemos tu información personal en Nexus News.',
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Política de Privacidad
          </h1>
          <p className="text-gray-500">Última actualización: 11 de mayo de 2026</p>
        </div>
        
        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Quiénes somos</h2>
            <p className="mb-3">
              Nexus News es una plataforma de creación de contenido de noticias deportivas. 
              Operamos desde Puerto Colombia, Atlántico, Colombia, y nos comprometemos a proteger 
              la información de nuestros usuarios.
            </p>
            <p>
              <strong>Datos de contacto:</strong><br />
              Email: danibustillo97@gmail.com<br />
              Teléfono: +57 300 647 6527<br />
              Dirección: Cra 13 # 10-25, Puerto Colombia, Atlántico, Colombia
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Información que recopilamos</h2>
            <p className="mb-3">
              Cuando usas nuestra plataforma, podemos recopilar:
            </p>
            <ul className="list-disc pl-5 space-y-2 mb-3">
              <li><strong>Información de registro:</strong> nombre, correo electrónico y foto de perfil cuando creas una cuenta.</li>
              <li><strong>Información de TikTok:</strong> si decides conectar tu cuenta, recibimos tu open_id, nombre de usuario, avatar público y tokens de acceso para publicar contenido en tu nombre.</li>
              <li><strong>Contenido que creas:</strong> videos, imágenes, textos y scripts que generas usando nuestras herramientas.</li>
              <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador, sistema operativo y cookies necesarias para el funcionamiento del sitio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Cómo usamos tu información</h2>
            <p className="mb-3">
              Utilizamos la información que recopilamos para:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Proporcionarte acceso a nuestras herramientas de creación de contenido.</li>
              <li>Publicar videos en TikTok cuando nos des permiso explícito.</li>
              <li>Mejorar nuestros algoritmos de IA para generar mejores noticias deportivas.</li>
              <li>Comunicarnos contigo sobre actualizaciones o cambios en el servicio.</li>
              <li>Cumplir con obligaciones legales y proteger nuestros derechos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Integración con TikTok</h2>
            <p className="mb-3">
              Nuestra plataforma se integra con TikTok para permitirte publicar contenido directamente. 
              Cuando conectas tu cuenta de TikTok:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Solo solicitamos los permisos mínimos necesarios: publicación de videos (video.upload) e información básica del perfil (user.info.basic).</li>
              <li>No accedemos ni almacenamos tu contraseña de TikTok. Usamos OAuth 2.0, un protocolo seguro de autenticación.</li>
              <li>Los tokens de acceso tienen fecha de expiración y puedes revocarlos en cualquier momento desde la configuración de tu cuenta de TikTok.</li>
              <li>Solo publicamos contenido cuando tú lo autorizas explícitamente.</li>
              <li>Respetamos los Términos de Servicio y la Política de Privacidad de TikTok.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Cómo protegemos tu información</h2>
            <p className="mb-3">
              Implementamos medidas de seguridad para proteger tus datos:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Todas las comunicaciones entre tu navegador y nuestros servidores están encriptadas con SSL/TLS.</li>
              <li>Almacenamos los datos en servidores seguros con acceso restringido.</li>
              <li>Los tokens de acceso de TikTok están encriptados en nuestra base de datos.</li>
              <li>Monitoreamos regularmente nuestros sistemas en busca de vulnerabilidades.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Con quién compartimos tu información</h2>
            <p className="mb-3">
              No vendemos tu información personal. Solo la compartimos en estos casos:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Con TikTok:</strong> cuando publicas contenido, siguiendo sus términos y políticas.</li>
              <li><strong>Proveedores de servicios:</strong> solo empresas que nos ayudan a operar (hosting, análisis), con acuerdos de confidencialidad.</li>
              <li><strong>Requerimientos legales:</strong> si una autoridad competente nos lo solicita conforme a la ley.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Tus derechos</h2>
            <p className="mb-3">
              Dependiendo de tu ubicación, tienes derechos sobre tu información personal:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Acceder:</strong> puedes solicitar una copia de los datos que tenemos sobre ti.</li>
              <li><strong>Corregir:</strong> puedes actualizar tu información si es inexacta.</li>
              <li><strong>Eliminar:</strong> puedes solicitar que eliminemos tu cuenta y todos tus datos.</li>
              <li><strong>Retirar consentimiento:</strong> puedes desconectar tu cuenta de TikTok en cualquier momento.</li>
              <li><strong>Oponerte:</strong> puedes oponerte al procesamiento de tus datos para ciertos fines.</li>
            </ul>
            <p className="mt-3">
              Para ejercer estos derechos, contáctanos en danibustillo97@gmail.com.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Cookies</h2>
            <p>
              Usamos cookies esenciales para que el sitio funcione correctamente (inicio de sesión, preferencias) 
              y cookies de análisis para entender cómo usas la plataforma y mejorarla. Puedes configurar tu 
              navegador para bloquear cookies, aunque algunas funciones podrían no funcionar correctamente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Cambios a esta política</h2>
            <p>
              Podemos actualizar esta política ocasionalmente. Te notificaremos de cambios importantes 
              por correo electrónico o con un aviso visible en el sitio. Te recomendamos revisar esta 
              página periódicamente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contacto</h2>
            <p className="mb-2">
              Si tienes preguntas sobre esta política de privacidad o sobre cómo manejamos tus datos:
            </p>
            <p>
              <strong>Daniel Bustillo</strong><br />
              Email: danibustillo97@gmail.com<br />
              Teléfono: +57 300 647 6527<br />
              Dirección: Cra 13 # 10-25, Puerto Colombia, Atlántico, Colombia
            </p>
          </section>

          <div className="border-t pt-6 mt-8 text-sm text-gray-500">
            <p>
              Esta política cumple con la Ley de Protección de Datos Personales de Colombia, 
              el GDPR de la Unión Europea y los requisitos de la TikTok Developer Platform.
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}
