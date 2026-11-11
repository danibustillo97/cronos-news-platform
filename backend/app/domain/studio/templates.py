"""Template system as DATA (section 19) -- never a hardcoded component
per plantilla. A Template owns one or more TemplateVersion snapshots; a
StudioProject always records which version it was built with
(`template_id` + the version baked into `Template.latest_version` at the
moment `CreateStudioProject` runs is copied nowhere -- the frontend
resolves `template_id` against whatever `GET /api/studio/templates`
currently returns, and an existing project simply keeps using the
element tree of the version it references). Real design system, not a
screenshot: each TemplateElement is a positioned, styled slot the
frontend's canvas renderer (services/canvas/*, already real) fills with
this project's real content -- headline, category, image, logo,
metadata, accent, background, footer branding (section 5).

Position/size are fractions of the canvas (0..1), not pixels -- the same
element tree works across every CompositionFormat (9:16/4:5/1:1/16:9)
without a per-format copy; FormatSwitcher (section 12) is what adapts.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from app.domain.studio.entities import TrackType

PREMIUM_EDITORIAL_ACCENTS = {
    "red": "#D84A52",
    "purple": "#9466D8",
    "green": "#358F69",
}


class TemplateElementKind(str, Enum):
    HEADLINE = "HEADLINE"
    SUBTITLE = "SUBTITLE"
    CATEGORY_PILL = "CATEGORY_PILL"
    IMAGE = "IMAGE"
    LOGO = "LOGO"
    METADATA = "METADATA"
    ACCENT_BAR = "ACCENT_BAR"
    BACKGROUND = "BACKGROUND"
    FOOTER_BRANDING = "FOOTER_BRANDING"


@dataclass(frozen=True)
class TemplateSafeArea:
    """Typography-safe margin this template itself recommends, as a
    fraction of canvas size per edge -- distinct from (and typically
    tighter/more conservative than) the platform-chrome safe area in
    distribution/safe_area.py, which is about where a PLATFORM's own UI
    can sit, not where this design wants text to start."""
    top: float = 0.05
    right: float = 0.05
    bottom: float = 0.05
    left: float = 0.05


@dataclass(frozen=True)
class TemplateElement:
    id: str
    kind: TemplateElementKind
    track: TrackType
    x: float
    y: float
    width: float
    height: float
    # Style hints -- real values the frontend canvas toolkit
    # (services/canvas/{text,logo,sponsor}.ts, already real) reads
    # directly; never invented per-element free-form CSS.
    font_role: str | None = None      # "display" | "body" | "caption" | "metadata"
    color_role: str | None = None     # "ink" | "white" | "accent" | "muted"
    z_index: int = 0


@dataclass(frozen=True)
class TemplateVersion:
    version: int
    elements: list[TemplateElement]
    safe_area: TemplateSafeArea = field(default_factory=TemplateSafeArea)


@dataclass(frozen=True)
class TemplatePreset:
    """A named starting point (spec section 5's 9 plantillas) -- one
    Template id, versioned independently of any project that uses it
    (section 19's "NEXUS EDITORIAL v1"/"v2": existing projects keep the
    version they were created with). `accent_color` is what actually makes
    each of the 9 presets look like a distinct plantilla today -- the
    structural layout (_standard_editorial_elements) is deliberately
    shared (section 6: "debe parecer una pieza de medio profesional", one
    consistent NEXUS system, not nine unrelated designs), same as how a
    real newsroom color-codes categories (breaking red, sports green,
    business blue...) without redesigning the whole page per section."""
    id: str
    name: str
    description: str
    accent_color: str
    versions: list[TemplateVersion]

    @property
    def latest_version(self) -> TemplateVersion:
        return max(self.versions, key=lambda v: v.version)


def _standard_editorial_elements() -> list[TemplateElement]:
    """The common real layout every NEXUS template variant starts from:
    full-bleed image background, category pill top-left, headline lower
    third, logo + footer branding. Category-specific templates below
    only change color_role/accent treatment, not the structural slots --
    keeps every plantilla visually a NEXUS piece, not nine unrelated
    designs (section 6: "debe parecer una pieza de medio profesional")."""
    return [
        TemplateElement("bg", TemplateElementKind.BACKGROUND, TrackType.IMAGE, x=0, y=0, width=1, height=1, z_index=0),
        TemplateElement(
            "accent", TemplateElementKind.ACCENT_BAR, TrackType.OVERLAY,
            x=0, y=0.62, width=1, height=0.006, color_role="accent", z_index=1,
        ),
        TemplateElement(
            "category", TemplateElementKind.CATEGORY_PILL, TrackType.OVERLAY,
            x=0.06, y=0.66, width=0.4, height=0.05, font_role="caption", color_role="accent", z_index=2,
        ),
        TemplateElement(
            "headline", TemplateElementKind.HEADLINE, TrackType.TEXT,
            x=0.06, y=0.72, width=0.88, height=0.2, font_role="display", color_role="white", z_index=2,
        ),
        TemplateElement(
            "metadata", TemplateElementKind.METADATA, TrackType.OVERLAY,
            x=0.06, y=0.93, width=0.6, height=0.04, font_role="metadata", color_role="muted", z_index=2,
        ),
        TemplateElement(
            "logo", TemplateElementKind.LOGO, TrackType.BRANDING,
            x=0.83, y=0.03, width=0.12, height=0.05, z_index=3,
        ),
    ]


def _template(id: str, name: str, description: str, accent_color: str) -> TemplatePreset:
    return TemplatePreset(
        id=id, name=name, description=description, accent_color=accent_color,
        versions=[TemplateVersion(version=1, elements=_standard_editorial_elements())],
    )


def _premium_editorial_template(id: str, name: str, accent_color: str) -> TemplatePreset:
    elements = [
        TemplateElement("background", TemplateElementKind.BACKGROUND, TrackType.IMAGE, 0, 0, 1, 1, z_index=0),
        TemplateElement("feature-image", TemplateElementKind.IMAGE, TrackType.IMAGE, 0.067, 0.105, 0.866, 0.378, z_index=1),
        TemplateElement("category", TemplateElementKind.CATEGORY_PILL, TrackType.OVERLAY, 0.067, 0.04, 0.42, 0.05, "caption", "accent", 2),
        TemplateElement("status", TemplateElementKind.METADATA, TrackType.OVERLAY, 0.72, 0.04, 0.21, 0.05, "caption", "muted", 2),
        TemplateElement("accent", TemplateElementKind.ACCENT_BAR, TrackType.OVERLAY, 0.067, 0.52, 0.12, 0.008, color_role="accent", z_index=3),
        TemplateElement("headline", TemplateElementKind.HEADLINE, TrackType.TEXT, 0.067, 0.55, 0.866, 0.19, "display", "white", 4),
        TemplateElement("summary", TemplateElementKind.SUBTITLE, TrackType.TEXT, 0.067, 0.74, 0.866, 0.12, "body", "muted", 5),
        TemplateElement("metadata", TemplateElementKind.METADATA, TrackType.OVERLAY, 0.067, 0.87, 0.866, 0.04, "metadata", "muted", 6),
        TemplateElement("read-action", TemplateElementKind.FOOTER_BRANDING, TrackType.OVERLAY, 0.067, 0.93, 0.866, 0.04, "caption", "accent", 7),
    ]
    return TemplatePreset(
        id=id, name=name, description="Diseño editorial premium para publicaciones 4:5",
        accent_color=accent_color, versions=[TemplateVersion(version=1, elements=elements)],
    )


# Section 5's 9 plantillas iniciales -- mismo sistema estructural real
# (_standard_editorial_elements) en las nueve, diferenciadas por un
# accent_color real y distinto cada una (lo que el editor realmente ve
# cambiar al elegir una plantilla: la franja de acento, la píldora de
# categoría). Colores editoriales convencionales por sección, nunca
# arbitrarios.
SEED_TEMPLATES: list[TemplatePreset] = [
    _premium_editorial_template("nexus_editorial_premium_red", "Premium Editorial · Rojo", PREMIUM_EDITORIAL_ACCENTS["red"]),
    _premium_editorial_template("nexus_editorial_premium_purple", "Premium Editorial · Morado", PREMIUM_EDITORIAL_ACCENTS["purple"]),
    _premium_editorial_template("nexus_editorial_premium_green", "Premium Editorial · Verde", PREMIUM_EDITORIAL_ACCENTS["green"]),
    _template("nexus_editorial", "NEXUS Editorial", "Plantilla base -- cualquier categoría", "#E50914"),
    _template("nexus_breaking", "NEXUS Breaking", "Última hora -- máxima urgencia visual", "#FF3B1D"),
    _template("nexus_deportes", "NEXUS Deportes", "Fútbol y deportes", "#16A34A"),
    _template("nexus_economia", "NEXUS Economía", "Economía y negocios", "#CA8A04"),
    _template("nexus_mundo", "NEXUS Mundo", "Internacional", "#2563EB"),
    _template("nexus_local", "NEXUS Local", "Cerca de ti / cobertura local", "#EA580C"),
    _template("nexus_explicador", "NEXUS Explicador", "Contexto y análisis", "#7C3AED"),
    _template("nexus_historia", "NEXUS Historia", "Perspectiva / historia larga", "#0891B2"),
    _template("nexus_resultados", "NEXUS Resultados", "Resultados y marcadores deportivos", "#15803D"),
]


def find_template(template_id: str) -> TemplatePreset | None:
    return next((t for t in SEED_TEMPLATES if t.id == template_id), None)
