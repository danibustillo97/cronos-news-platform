# NEXUS — Deployment Architecture

**Fecha:** 2026-09-15
**Alcance:** arquitectura de ejecución local vs. producción. La migración física de NEXUS ya terminó (ver `docs/NEXUS_ARCHITECTURE_BASELINE.md`) — este documento no reorganiza nada, define cómo NEXUS corre en cada entorno.
**Estado real, no aspiracional:** ningún recurso de AWS existe, ningún deployment automático corre desde este repo salvo (probablemente) la integración nativa de Vercel con GitHub — verificado por ausencia total de Terraform/CDK/CloudFormation/Dockerfile/SDK de AWS en todo el workspace (`grep` exhaustivo, cero resultados).

---

## Principio fundamental: tres conceptos que no se confunden

| Concepto | Qué es | Comando |
|---|---|---|
| **Workspace** | Dónde vive el código — `NEXUS/` (ya consolidado, no se vuelve a mover) | — |
| **Local Development** | Cómo se ejecuta todo en la máquina de desarrollo | `nexus up` |
| **Production Deployment** | Cómo se publica NEXUS al mundo — independiente de cómo corre localmente | `nexus production` |

`nexus up` **nunca** implica deployment. `nexus production` **nunca** arranca servicios locales. Están separados a nivel de código (`Cmd-Up` vs `Cmd-Production` en `nexus.ps1`), no solo de intención.

## 1. Workspace

```
NEXUS/                  repo git propio, .claude propio
├── frontend/           Next.js 15 — despliega independiente (Vercel o AWS)
├── backend/            FastAPI — despliega a AWS (sin target real todavía)
├── automation/         repo git + .claude propios, nested — despliega a AWS (sin target real todavía)
│   ├── src/, lab/, runtime/
├── infrastructure/
│   ├── database/       SQL de Supabase
│   ├── docker/         nginx — SOLO desarrollo local
│   └── deployment/     deployment.example.yml — template, no ejecuta nada todavía
└── nexus.ps1           CLI: local dev (up/down/...) + producción (production)
```

## 2. Local Development

Intacto, sin cambios de esta tarea salvo lo documentado en §17:

- **Nginx** → Docker (único servicio containerizado)
- **Frontend** → nativo (`npm run dev`, puerto 3000)
- **Backend** → nativo (venv + uvicorn `--reload`, puerto 8000)
- **Automation (Local Runtime)** → nativo (venv + uvicorn, puerto 8801)
- **LAB** → nativo, sin daemon (CLI invocado bajo demanda)
- **Database** → Supabase remoto (no hay Postgres local, nunca lo hubo)

`nexus up` arranca los que aplican y verifica los 6 con checks reales (ver `nexus.ps1`, `Get-ServiceStatus`). `nexus.local` resuelve vía hosts file local (`127.0.0.1 nexus.local`, ya configurado en esta máquina) — nginx escucha en `nexus.local` y `localhost` por igual.

## 3. Vercel (frontend)

**Auditoría real, con evidencia:**

- **Package manager:** npm (`package-lock.json` presente, sin `pnpm-lock.yaml`/`yarn.lock`).
- **`next.config.ts`:** limpio — solo `images.remotePatterns` (dominios de imágenes externas) y `typescript.ignoreBuildErrors`. Sin rewrites/redirects/proxy hacia localhost.
- **Sin middleware** (`middleware.ts` no existe).
- **`next build` corre limpio** (verificado en esta tarea): genera las 20 rutas, incluyendo `/` como página estática — `generateMetadata()` (ver `layout.tsx`) intentó alcanzar el backend y cayó correctamente a sus valores de fallback cuando no lo encontró, exactamente el comportamiento que necesita un build en un runner sin backend local.
- **Rutas API de Next.js** (`src/app/api/{tiktok,tts,import-article,proxy-image,news}/`) — server-side, corren como serverless functions en Vercel sin cambios, ninguna depende de un proceso Python local ni de Nginx.

**Hallazgo real y corregido en esta tarea:** 5 archivos tenían `http://localhost:8000` **hardcodeado sin variable de entorno** — hubieran roto en cualquier deploy real (Vercel intentando conectar a `localhost:8000` del propio servidor de Vercel, que no existe):

- `components/news/NewsFeed.tsx`
- `components/widgets/LiveScoresWidget.tsx`
- `app/admin/lib/api.ts` (2 funciones)
- `app/admin/editor/[id]/page.tsx`

Corregidos para usar `apiUrl()` de `src/studio/lab/api-client.ts` (que ya lee `NEXT_PUBLIC_API_BASE_URL`, con fallback a `localhost:8000` solo si la variable no está seteada — correcto para dev, **obligatorio configurar en Vercel para producción**).

**Hallazgo real y corregido:** `src/lib/supabaseClient.ts` tenía URL + anon key de Supabase hardcodeadas en el código fuente (ya documentado como deuda técnica en `obsidian-vault/Supabase.md`). Ahora lee `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` con los mismos valores como fallback — permite apuntar a un proyecto Supabase distinto por ambiente sin tocar código.

**Hallazgo real y corregido:** CORS del backend (`backend/app/presentation/main.py`) aceptaba únicamente `http://localhost:3000` — cualquier frontend real en Vercel habría sido rechazado por el navegador. Ahora acepta los orígenes locales de siempre (`localhost:3000`, `nexus.local`, `localhost`) más `CORS_ALLOWED_ORIGINS` (env var, coma-separado) para orígenes reales de producción.

**Falso positivo descartado:** las dos referencias a `localhost` en `src/app/api/import-article/route.ts` y `src/app/api/tiktok/debug/route.ts` son guardas de seguridad reales (SSRF-prevention y diagnóstico de config), no dependencias rotas — no se tocaron.

**Conclusión:** el frontend está listo para `git push → Vercel build → deploy` siempre que se configuren las env vars reales (`NEXT_PUBLIC_API_BASE_URL` apuntando al backend real, `NEXT_PUBLIC_SUPABASE_*`, `TIKTOK_*`) en el dashboard de Vercel — nada de esto se puede verificar desde esta máquina sin acceso a ese dashboard, así que queda pendiente de que el usuario lo confirme ahí.

## 4. AWS

**Estado real (auditado, no supuesto):** cero infraestructura. `grep` exhaustivo sobre todo el workspace no encontró:

- Ningún archivo `.tf`, `cdk.json`, plantilla de CloudFormation, ni `serverless.yml`.
- Ningún `Dockerfile` (en ningún servicio — ni backend, ni automation, ni frontend).
- Ninguna referencia a `boto3` (Python) ni `@aws-sdk`/`aws-sdk` (Node) en ningún `import`.
- Ninguna región, cuenta, ni configuración de IAM referenciada en ningún archivo.

**No se creó nada de esto en esta tarea**, por instrucción explícita ("no crear infraestructura AWS ficticia"). `infrastructure/deployment/deployment.example.yml` es un **template de configuración**, no un plan de Terraform — declara intención (qué componente va a qué provider), no recursos.

**Lo que hace falta antes de que "AWS" sea real** (no implementado, solo listado):

1. Un Dockerfile por servicio desplegable (backend, automation/runtime — LAB no corre como servicio, ver §8) — hoy ninguno existe.
2. Una decisión de compute target (ECS/Fargate, Lambda, EC2 — no hay evidencia de preferencia en ningún documento existente).
3. Definición de red (VPC, si el backend necesita estar en la misma red que RDS/Supabase no aplica al ser Supabase externo) y de secrets (Secrets Manager vs Parameter Store).
4. Un pipeline de CI/CD real (hoy no existe ninguno para `backend`/`automation` — ver §15).

## 5. Nginx

**Rol exclusivo: reverse proxy de LOCAL DEVELOPMENT.** No se asume que Nginx es el gateway de producción — decisión explícita del usuario, documentada acá para que nadie la reabra sin querer. Si en el futuro se decide usar Nginx en AWS (ej. como sidecar o como Application Load Balancer + Nginx en ECS), es una decisión de infraestructura de producción nueva, separada de `infrastructure/docker/docker-compose.yml` (que sigue siendo solo-local).

## 6. Backend

FastAPI nativo en local (§2). En producción: target AWS, sin implementación todavía (§4). El código ya está preparado para correr fuera de local sin cambios:

- `app/infrastructure/persistence/supabase/client.py` — el parser manual de `.env` **nunca sobrescribe una variable de entorno real ya seteada** (`if key not in os.environ`), así que en cualquier plataforma de producción (que setea env vars reales, no un archivo `.env`) este código funciona sin modificación.
- CORS ahora configurable vía `CORS_ALLOWED_ORIGINS` (§3, corregido en esta tarea).
- `RUNTIME_BASE_URL` y `LAB_WORKSPACE_PATH` ya eran configurables por env var desde antes (ver `backend/.env.example`, nuevo en esta tarea).

## 7. Automation

Subsistema de NEXUS, no proyecto independiente conceptualmente (ya establecido en la auditoría de arquitectura) — pero **repo y `.claude` separados a propósito**, eso no cambia. En local: nativo (§2). En producción: target AWS, sin implementación (§4). Su responsabilidad productiva (scraper legado corriendo por GitHub Actions cron, ver `automation/.github/workflows/scraper.yml`) **ya está en producción hoy**, fuera de AWS — sigue así sin cambios; migrarlo es una decisión de Fase R1 del roadmap de arquitectura, no de este documento.

## 8. LAB

**No es un servicio desplegable** — es un CLI sin daemon, invocado bajo demanda (por skills de Claude Code o por el Local Runtime). No tiene "deployment" en el sentido de un proceso corriendo 24/7; su "producción" es que `automation/lab/.venv` exista y `lab.cli` sea invocable donde sea que corra Automation/Runtime. Por eso `deployment.example.yml` lo lista como componente de Automation, no como un target independiente.

## 9. Environment Profiles

**No se creó una carpeta `config/local|staging|production` nueva.** Se evaluó y se descartó — habría sido un segundo sistema de configuración paralelo al que ya existe y funciona (cada servicio ya tiene su propio `.env`, y el parser de `client.py` ya prioriza variables de entorno reales sobre el archivo). Duplicarlo violaría la regla explícita de "no crear infraestructura paralela".

**Solución real, ya funcionando, ahora documentada:**

- Cada servicio tiene su propio `.env` (gitignored) + un `.env.example` nuevo (frontend, backend, automation, automation/runtime — los 4 creados en esta tarea) que documenta **nombres** de variables, nunca valores reales.
- La diferencia entre LOCAL / STAGING / PRODUCTION es: **qué archivo `.env` se usa localmente vs. qué variables de entorno reales setea la plataforma de hosting** (Vercel dashboard, o el compute de AWS el día que exista) — no un mecanismo de código nuevo.
- `infrastructure/deployment/deployment.yml` (no versionado, copia de `.example.yml`) es donde se declara **qué se despliega dónde**, separado de los secretos (que siguen viviendo en cada `.env`/dashboard de plataforma).

Ver `docs/NEXUS_ENVIRONMENT_MATRIX.md` para la matriz completa.

## 10. Deployment Providers

Abstracción mínima, real, no un framework: `infrastructure/deployment/deployment.example.yml` declara `provider: aws` a nivel global (backend/automation/lab) y un `frontend.provider` independiente (`vercel` o `aws`) — exactamente la separación que pidió el usuario ("no asumir que Frontend siempre debe ir a AWS"). `nexus production` lee este archivo y lo refleja; no existen dos sistemas de deployment compitiendo porque **solo existe este uno**, y hoy no ejecuta nada real (§14).

## 11. `nexus up`

Sin cambios de significado: **arranca el entorno de desarrollo local.** Nunca toca producción, nunca lee `deployment.yml`. Ver §2.

## 12. `nexus production`

Nuevo comando (agregado en esta tarea). Significa **"mostrar/preparar el plan de deployment a producción"**, nunca "arrancar servicios locales" — imposible de confundir con `up` a nivel de código (funciones separadas, `Cmd-Up` nunca llama a `Cmd-Production` ni viceversa).

```
.\nexus.ps1 production -DryRun
.\nexus.ps1 production -DryRun -ExcludeFrontend
.\nexus.ps1 production -DryRun -Provider aws
.\nexus.ps1 production               # sin -DryRun: muestra el plan igual, y se niega a continuar
```

Sin `-DryRun`, el comando **muestra el plan y se detiene** — no hay ningún modo que ejecute un deployment real todavía (§14).

## 13. Dry Run

`nexus production -DryRun` es hoy el **único modo funcional** del comando. Imprime:

```
Provider:
  aws

Components:
  [YES]  Backend
  [YES]  Automation
  [YES]  LAB
  [YES]  Frontend (provider: vercel)

Environment:
  production

Risks:
  - No Terraform/CDK/CloudFormation exists...
  - No Dockerfile exists...
  - No CI/CD pipeline deploys this repo...
```

Nunca escribe, nunca llama a ninguna API de AWS/Vercel, nunca modifica nada — es lectura de `deployment.yml` (o `.example.yml` si no existe) + verificación honesta de qué infraestructura real falta.

## 14. Secrets

Ninguno se centralizó ni se movió en esta tarea — siguen viviendo donde ya vivían (cada `.env` local, y el dashboard de cada plataforma de hosting en producción). Lo único nuevo es la **documentación de qué nombres de variable existen** (los 4 `.env.example`). Riesgo ya conocido y sin resolver (ver baseline §14): `automation/.env` sigue trackeado en git con credenciales reales — pendiente de rotación, decisión del usuario.

## 15. CI/CD

**No existe ningún pipeline de CI/CD en `NEXUS/` (frontend/backend).** El único workflow de GitHub Actions en todo el workspace es `automation/.github/workflows/scraper.yml` (cron del scraper legado, sin relación con deployment de frontend/backend). El deployment de `nexusnews.info` a Vercel, si está activo, ocurre vía la integración nativa GitHub↔Vercel (auto-deploy on push) — **no verificable desde esta máquina** sin acceso al dashboard de Vercel del usuario. No se creó, modificó, ni asumió ningún workflow nuevo en esta tarea.

## 16. Production Topology

Estado real, no aspiracional:

```
HOY (verificado):                          FUTURO (declarado en deployment.example.yml, sin implementar):

Frontend → Vercel (nexusnews.info,          Frontend → Vercel (sin cambios) O AWS (configurable)
  probablemente auto-deploy, sin            Backend → AWS (target declarado, sin Dockerfile/IaC todavía)
  confirmar desde acá)                      Automation → AWS (ídem)
Backend → ninguno (no corre en              LAB → no es un deployment target propio (ver §8)
  ningún lado fuera de local)
Automation (scraper legado) → cron
  de GitHub Actions (no AWS, no local)
LAB/Runtime → ninguno (solo local)
```

La brecha entre columnas es exactamente lo que las Fases del roadmap de arquitectura (`docs/NEXUS_ROADMAP.md`) y una futura extensión de este documento (cuando exista IaC real) tendrían que cerrar — no se cierra en esta tarea, por instrucción explícita.
