-- NEXUS Studio -- Phase 1 project persistence.
--
-- One row per PROJECT VERSION (never overwritten in place once a new
-- version is duplicated -- see StudioProject.duplicate() in
-- backend/app/domain/studio/entities.py). `content` holds the real
-- scenes/clips tree as jsonb -- same pragmatic convention already used by
-- `compositions.content` in cronos_platform_schema.sql, not normalized
-- Scene/Track/Clip tables (see the approved NEXUS Studio Phase 1 plan for
-- the reasoning).
CREATE TABLE IF NOT EXISTS public.studio_projects (
    id UUID PRIMARY KEY,
    source_artifact_id UUID NOT NULL REFERENCES public.artifacts(id),
    mode TEXT NOT NULL CHECK (mode IN ('IMAGE', 'REEL', 'LIVE')),
    template_id TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('REEL_9X16', 'FEED_4X5', 'SQUARE_1X1', 'LANDSCAPE_16X9')),
    status TEXT NOT NULL CHECK (status IN ('DRAFT', 'READY')),
    version INTEGER NOT NULL,
    parent_project_id UUID REFERENCES public.studio_projects(id),
    title TEXT NOT NULL DEFAULT '',
    content JSONB NOT NULL DEFAULT '{"scenes": []}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_projects_source_artifact_id ON public.studio_projects(source_artifact_id);
