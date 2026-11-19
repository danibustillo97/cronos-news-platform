// Translates validate_artifact()'s real, technical ValidationIssue
// (check + detail, see backend/app/domain/artifact/validation.py) into a
// clean editorial message. Every branch here matches an exact real
// message that validator produces -- nothing invented. If a message
// doesn't match any known pattern (e.g. validation.py changes later),
// the raw detail is still shown, translated as little as needed, never
// hidden -- section 30's "never invent, but never hide a real signal"
// rule cuts both ways.

export interface FriendlyWarning {
  title: string;
  description: string;
}

const CHECK_LABEL: Record<string, string> = {
  title: "Título",
  excerpt: "Bajada",
  summary: "Resumen",
  content_html: "Cuerpo",
  seo_title: "SEO · Título",
  seo_description: "SEO · Descripción",
  slug: "SEO · Slug",
  sources: "Fuentes",
  category: "Categoría",
  evidence: "Evidencia",
  multimedia: "Multimedia",
};

function charsOverPattern(detail: string, max: number, label: string): FriendlyWarning | null {
  const m = detail.match(/is (\d+) chars/);
  if (!m) return null;
  return { title: label, description: `${m[1]} / ${max} caracteres -- demasiado largo` };
}

export function friendlyWarning(check: string, detail: string): FriendlyWarning {
  const label = CHECK_LABEL[check] ?? check;

  if (detail.includes("is empty")) {
    return { title: label, description: "Falta contenido -- este campo está vacío" };
  }

  if (check === "title") {
    const r = charsOverPattern(detail, 70, "Título demasiado largo");
    if (r) return r;
  }
  if (check === "seo_title") {
    const r = charsOverPattern(detail, 60, "Título SEO demasiado largo");
    if (r) return r;
  }
  if (check === "seo_description") {
    const m = detail.match(/is (\d+) chars, outside (\d+)-(\d+)/);
    if (m) {
      const [, chars, min, max] = m;
      const charsNum = Number(chars);
      return {
        title: "Descripción SEO fuera de rango",
        description: charsNum < Number(min)
          ? `${chars} / ${min}-${max} caracteres -- demasiado corta`
          : `${chars} / ${min}-${max} caracteres -- demasiado larga`,
      };
    }
  }
  if (check === "slug") {
    return { title: "Slug inválido", description: "Debe usar minúsculas y guiones, sin espacios ni símbolos" };
  }
  if (check === "sources") {
    return { title: "Sin fuentes", description: "No hay fuentes reales registradas para este artículo" };
  }
  if (check === "category") {
    return { title: "Categoría", description: "No se pudo asignar una categoría real -- elegí una manualmente" };
  }
  if (check === "evidence") {
    const m = detail.match(/^(\d+) claim/);
    if (m) {
      const n = Number(m[1]);
      return { title: "Afirmación sin verificar", description: `${n} afirmación${n === 1 ? "" : "es"} requiere${n === 1 ? "" : "n"} revisión` };
    }
    if (detail.includes("no claims recorded")) {
      return { title: "Sin evidencia", description: "No hay afirmaciones registradas para trazar a las fuentes" };
    }
  }
  if (check === "multimedia") {
    return { title: "Falta imagen destacada", description: "El artículo no declaró una imagen destacada" };
  }
  if (check === "content_html") {
    if (detail.includes("must be wrapped")) return { title: "Cuerpo", description: "Estructura HTML inválida -- falta el contenedor del artículo" };
    if (detail.includes("no <p>")) return { title: "Cuerpo", description: "El cuerpo no tiene párrafos" };
    if (detail.includes("non-standard tags")) return { title: "Cuerpo", description: "El cuerpo usa etiquetas no permitidas" };
  }

  // Real signal, unrecognized shape -- show it plainly rather than hide it.
  return { title: label, description: detail };
}
