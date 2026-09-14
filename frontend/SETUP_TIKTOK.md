# Configuración TikTok Developer para Cronos News

## 1. Crear App en TikTok Developer

1. Ve a https://developers.tiktok.com/
2. Inicia sesión con tu cuenta TikTok
3. Click en "My Apps" → "Create App"
4. Selecciona "Web" como plataforma
5. Completa la información básica

## 2. Configurar credenciales

En el panel de TikTok Developer, ve a **Settings > Basic**:

- **Client Key**: Se muestra en la página, copia el valor
- **Client Secret**: Click "Show" para revelarlo

## 3. Configurar Redirect URI

En **Auth > Redirect domains**, añade:

```
https://tu-dominio.com/api/tiktok/callback
```

**Importante**: Debe coincidir exactamente con tu dominio de producción.
No funciona con localhost para apps en producción.

## 4. Configurar scopes

En **Products > Content Posting**, activa:
- `video.upload`
- `user.info.basic`

## 5. Crear archivo .env.local

En la raíz del proyecto, crea `.env.local`:

```bash
# TikTok Developer API
TIKTOK_CLIENT_KEY=awxxxxxxxxxxxxxxxxx  # Tu Client Key real
TIKTOK_CLIENT_SECRET=xxxxxxxxxxxxxxx   # Tu Client Secret real  
TIKTOK_REDIRECT_URI=https://tudominio.com/api/tiktok/callback

# Opcional: modo demo para pruebas sin credenciales
# TIKTOK_DEMO_MODE=true
```

## 6. Verificar configuración

Visita en tu navegador:
```
https://tu-dominio.com/api/tiktok/debug
```

Debería mostrar:
```json
{
  "configured": true,
  "checks": {
    "clientKey": { "exists": true, "valid": true },
    "clientSecret": { "exists": true, "valid": true },
    "redirectUri": { "exists": true, "valid": true }
  }
}
```

## 7. Probar conexión

1. Ve al Admin Studio → Tab TikTok
2. Click "Conectar TikTok"
3. Autoriza la app
4. ¡Listo!

## Solución de problemas

### Error: "client_key"
- Verifica que TIKTOK_CLIENT_KEY esté en .env.local
- El key debe tener ~20 caracteres
- No uses el Client Key de otro proyecto

### Error: "redirect_uri"
- El URI debe estar registrado en TikTok Developer
- Debe usar https:// (no http://)
- Debe coincidir exactamente (sin trailing slash)

### Error: "code_challenge"
- PKCE está implementado automáticamente
- No requiere configuración adicional

### Error: App not approved
- Las apps nuevas necesitan aprobación de TikTok
- Durante desarrollo, el dueño de la app puede autorizar
- Ve a "Testers" en TikTok Developer para añadir cuentas

## Modo Demo

Si quieres probar la UI sin credenciales:

```bash
TIKTOK_DEMO_MODE=true
```

En el panel de TikTok aparecerá "Modo Demo" que simula la conexión.
