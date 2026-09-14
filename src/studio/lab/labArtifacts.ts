/**
 * Parsing + shape-detection for the real JSON artifacts CRONOS LAB exports
 * per story (RPA_NEWS_SCRIPT/lab/workspace/exports/<story_id>/). LAB has no
 * API and this frontend never talks to it directly — a human exports the
 * package on disk and loads the real files here. Nothing in this module
 * invents data: a field is populated only when a real file with that shape
 * was loaded, everything else stays null and the UI must say so honestly.
 */

export interface EditorialContext {
  headline?: string;
  whatHappened?: string;
  angle?: string;
  narrativeStrength?: string;
  whyItMatters?: string;
  recommendedFormats?: { format: string; reason?: string }[];
}

export interface ResearchContext {
  contextNeeds: { question: string; status: string; answer: string | null }[];
}

export interface FactCheckContext {
  claims: { claim: string; classification: string }[];
}

export interface StoryConcept {
  title: string;
  summary: string;
  angle?: string;
  provenance?: string;
}

export interface StoryConcepts {
  hasStory: boolean;
  reasonIfNot: string | null;
  concepts: StoryConcept[];
}

export interface LabHook {
  text: string;
  strategy?: string;
}

export interface ScriptSection {
  section: string;
  text: string;
}

export interface ScenePlanScene {
  sceneNumber: number;
  narrativePurpose: string;
  textOverlay: string;
  durationEstimateSeconds: number;
  requiredMediaType: string;
}

export interface NarrativeBeat {
  order: number;
  emotion: string;
  emotionalIntensity: string;
  narrativeFunction: string;
  pacingIntention: string;
}

export interface NarrativeDirection {
  narrativeDirectionId: string | null;
  beats: NarrativeBeat[];
}

export interface AudioPlan {
  tracks: { role: string; beatId: string }[];
  silenceWindows: { beatId: string; treatment: string }[];
  duckingOrder: string[] | null;
}

export interface MediaBlueprintScene {
  sceneId: string;
  mediaType: string;
  generationRequired: boolean;
  assetIds: string[];
}

export interface MediaBlueprint {
  scenes: MediaBlueprintScene[];
}

export interface AssemblyShot {
  shotId: string;
  sceneId: string;
  disposition: string;
  durationSeconds: number;
}

export interface AssemblyPlan {
  assemblyPlanId: string;
  renderPlanId: string | null;
  animationPlanId: string | null;
  narrativeDirectionId: string | null;
  audioPlanId: string | null;
  declaredDurationSeconds: number;
  includedDurationSeconds: number;
  shots: AssemblyShot[];
  outputStatus: string | null;
  outputPath: string | null;
}

export interface RegistryAsset {
  assetId: string;
  sceneId: string;
  provenance: string;
  provider: string | null;
  filename: string | null;
}

export interface StageRef {
  id: string;
  totalDurationSeconds: number | null;
}

export interface LabArtifacts {
  storyId: string | null;
  research: ResearchContext | null;
  factCheck: FactCheckContext | null;
  editorial: EditorialContext | null;
  concepts: StoryConcepts | null;
  hooks: LabHook[] | null;
  script: ScriptSection[] | null;
  scenePlan: ScenePlanScene[] | null;
  narrative: NarrativeDirection | null;
  audio: AudioPlan | null;
  mediaBlueprint: MediaBlueprint | null;
  sequence: StageRef | null;
  animation: StageRef | null;
  render: StageRef | null;
  assembly: AssemblyPlan | null;
  assets: RegistryAsset[] | null;
}

export const EMPTY_LAB_ARTIFACTS: LabArtifacts = {
  storyId: null, research: null, factCheck: null, editorial: null, concepts: null,
  hooks: null, script: null, scenePlan: null, narrative: null, audio: null,
  mediaBlueprint: null, sequence: null, animation: null, render: null, assembly: null, assets: null,
};

export interface LoadedImage {
  assetId: string | null;
  filename: string;
  url: string;
}

export interface ParsedLabPackage {
  artifacts: Partial<LabArtifacts>;
  images: LoadedImage[];
  videoFiles: File[];
  storyId: string | null;
  recognizedCount: number;
  unrecognized: string[];
}

/** Detects the shape of one parsed JSON document and maps it onto LabArtifacts. Exported so the
 * server-side filesystem adapter (src/server/infrastructure/lab) can reuse the same shape-detection
 * instead of re-implementing it — this is the one place that understands LAB's real export format. */
export function detectDoc(d: any): { key: keyof LabArtifacts; value: any; storyId: string | null } | null {
  if (Array.isArray(d)) {
    if (d.every((a: any) => a?.asset_id && a?.provenance)) {
      const assets: RegistryAsset[] = d.map((a: any) => ({
        assetId: a.asset_id, sceneId: a.scene_id, provenance: a.provenance,
        provider: a.provider ?? null, filename: a.filename ?? null,
      }));
      return { key: 'assets', value: assets, storyId: d[0]?.story_id ?? null };
    }
    return null;
  }

  if (Array.isArray(d?.context_needs)) {
    return {
      key: 'research',
      value: { contextNeeds: d.context_needs.map((c: any) => ({ question: c.question, status: c.status, answer: c.answer ?? null })) },
      storyId: d.item_id ?? null,
    };
  }

  if (Array.isArray(d?.claims)) {
    return {
      key: 'factCheck',
      value: { claims: d.claims.map((c: any) => ({ claim: c.claim, classification: c.classification })) },
      storyId: d.item_id ?? null,
    };
  }

  if (typeof d?.has_story === 'boolean' && Array.isArray(d?.concepts)) {
    return {
      key: 'concepts',
      value: {
        hasStory: d.has_story, reasonIfNot: d.reason_if_not ?? null,
        concepts: d.concepts.map((c: any) => ({ title: c.title, summary: c.summary, angle: c.angle, provenance: c.provenance })),
      },
      storyId: d.item_id ?? null,
    };
  }

  if (Array.isArray(d?.hooks)) {
    return {
      key: 'hooks',
      value: d.hooks.map((h: any) => ({ text: h.text, strategy: h.strategy })),
      storyId: d.item_id ?? null,
    };
  }

  if (Array.isArray(d?.sections)) {
    return {
      key: 'script',
      value: d.sections.map((s: any) => ({ section: s.section, text: s.text })),
      storyId: d.item_id ?? null,
    };
  }

  if (Array.isArray(d?.scenes) && d.scenes.every((s: any) => typeof s?.scene_number === 'number')) {
    return {
      key: 'scenePlan',
      value: d.scenes.map((s: any) => ({
        sceneNumber: s.scene_number, narrativePurpose: s.narrative_purpose,
        textOverlay: s.text_overlay, durationEstimateSeconds: s.duration_estimate_seconds,
        requiredMediaType: s.required_media_type,
      })),
      storyId: d.item_id ?? null,
    };
  }

  if (typeof d?.headline === 'string') {
    return { key: 'editorial', value: { headline: d.headline, whatHappened: d.what_happened }, storyId: d.item_id ?? null };
  }
  if (typeof d?.why_it_matters === 'string') {
    return { key: 'editorial', value: { angle: d.angle, narrativeStrength: d.narrative_strength, whyItMatters: d.why_it_matters }, storyId: d.item_id ?? null };
  }
  if (Array.isArray(d?.recommended_formats)) {
    return { key: 'editorial', value: { recommendedFormats: d.recommended_formats }, storyId: d.item_id ?? null };
  }

  if (Array.isArray(d?.beats)) {
    return {
      key: 'narrative',
      value: {
        narrativeDirectionId: d.narrative_direction_id ?? null,
        beats: d.beats.map((b: any) => ({
          order: b.order, emotion: b.emotion, emotionalIntensity: b.emotional_intensity,
          narrativeFunction: b.narrative_function, pacingIntention: b.pacing_intention,
        })),
      },
      storyId: d.story_id ?? null,
    };
  }

  if (Array.isArray(d?.tracks)) {
    return {
      key: 'audio',
      value: {
        tracks: d.tracks.map((t: any) => ({ role: t.role, beatId: t.beat_id })),
        silenceWindows: (d.silence_windows ?? []).map((s: any) => ({ beatId: s.beat_id, treatment: s.treatment })),
        duckingOrder: d.ducking_rules?.priority_order ?? null,
      },
      storyId: d.story_id ?? null,
    };
  }

  if (Array.isArray(d?.scenes) && d.scenes.every((s: any) => s?.media_requirement)) {
    return {
      key: 'mediaBlueprint',
      value: {
        scenes: d.scenes.map((s: any) => ({
          sceneId: s.scene_id, mediaType: s.media_requirement?.media_type,
          generationRequired: Boolean(s.media_requirement?.generation_required), assetIds: s.assets ?? [],
        })),
      },
      storyId: d.story_id ?? null,
    };
  }

  if (Array.isArray(d?.shots) && typeof d?.declared_total_duration_seconds === 'number') {
    return {
      key: 'assembly',
      value: {
        assemblyPlanId: d.assembly_plan_id, renderPlanId: d.render_plan_id ?? null,
        animationPlanId: d.animation_plan_id ?? null, narrativeDirectionId: d.narrative_direction_id ?? null,
        audioPlanId: d.audio_plan_id ?? null, declaredDurationSeconds: d.declared_total_duration_seconds,
        includedDurationSeconds: d.included_duration_seconds,
        shots: d.shots.map((s: any) => ({ shotId: s.shot_id, sceneId: s.scene_id, disposition: s.disposition, durationSeconds: s.duration_seconds })),
        outputStatus: d.output?.status ?? null, outputPath: d.output?.relative_path ?? null,
      },
      storyId: d.story_id ?? null,
    };
  }

  // sequence / animation / render — kept as lightweight presence refs, no dedicated UI per user's own
  // instruction that these planning artifacts don't need individual screens.
  if (typeof d?.render_plan_id === 'string' && typeof d?.animation_plan_id === 'string' && Array.isArray(d?.shots)) {
    return { key: 'render', value: { id: d.render_plan_id, totalDurationSeconds: null }, storyId: d.story_id ?? null };
  }
  if (typeof d?.animation_plan_id === 'string' && typeof d?.sequence_id === 'string' && Array.isArray(d?.shots)) {
    return { key: 'animation', value: { id: d.animation_plan_id, totalDurationSeconds: d.total_duration_seconds ?? null }, storyId: d.story_id ?? null };
  }
  if (typeof d?.sequence_id === 'string' && Array.isArray(d?.shots)) {
    return { key: 'sequence', value: { id: d.sequence_id, totalDurationSeconds: d.total_duration_seconds ?? null }, storyId: d.story_id ?? null };
  }

  return null;
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/** Parses a batch of real files (any combination/order) into partial LabArtifacts + media. */
export async function parseLabFiles(files: File[]): Promise<ParsedLabPackage> {
  const artifacts: Partial<LabArtifacts> = {};
  const images: LoadedImage[] = [];
  const videoFiles: File[] = [];
  const unrecognized: string[] = [];
  let storyId: string | null = null;
  let recognizedCount = 0;
  let pendingAssets: RegistryAsset[] | null = null;

  for (const file of files) {
    if (IMAGE_EXT.test(file.name)) {
      images.push({ assetId: null, filename: file.name, url: URL.createObjectURL(file) });
      recognizedCount++;
      continue;
    }
    if (VIDEO_EXT.test(file.name)) {
      videoFiles.push(file);
      recognizedCount++;
      continue;
    }
    if (!file.name.toLowerCase().endsWith('.json')) {
      unrecognized.push(file.name);
      continue;
    }

    try {
      const text = await file.text();
      const doc = JSON.parse(text);
      const detected = detectDoc(doc);
      if (!detected) {
        unrecognized.push(file.name);
        continue;
      }
      if (detected.storyId) storyId = detected.storyId;
      if (detected.key === 'editorial') {
        artifacts.editorial = { ...(artifacts.editorial ?? {}), ...detected.value };
      } else if (detected.key === 'assets') {
        pendingAssets = detected.value;
      } else {
        (artifacts as any)[detected.key] = detected.value;
      }
      recognizedCount++;
    } catch {
      unrecognized.push(file.name);
    }
  }

  if (pendingAssets) {
    artifacts.assets = pendingAssets;
    // Match uploaded image files to their registered asset by filename, so the
    // real image carries its LAB provenance instead of being a bare blob.
    for (const img of images) {
      const match = pendingAssets.find(a => a.filename === img.filename);
      if (match) img.assetId = match.assetId;
    }
  }

  return { artifacts, images, videoFiles, storyId, recognizedCount, unrecognized };
}

export interface StageStatus {
  id: string;
  label: string;
  done: boolean;
  detail: string | null;
}

/** Real, derived production checklist — never a fabricated progress bar. */
export function computeStages(a: LabArtifacts): StageStatus[] {
  const stages: StageStatus[] = [
    {
      id: 'research', label: 'Investigación',
      done: Boolean(a.research || a.factCheck),
      detail: a.research ? `${a.research.contextNeeds.length} pregunta(s) de contexto` : a.factCheck ? `${a.factCheck.claims.length} claim(s) verificados` : null,
    },
    {
      id: 'editorial', label: 'Inteligencia editorial',
      done: Boolean(a.editorial),
      detail: a.editorial?.headline ?? null,
    },
    {
      id: 'story', label: 'Story',
      done: Boolean(a.concepts),
      detail: a.concepts ? (a.concepts.hasStory ? `${a.concepts.concepts.length} concepto(s) creativos` : a.concepts.reasonIfNot) : null,
    },
    {
      id: 'hooks', label: 'Hooks',
      done: Boolean(a.hooks?.length),
      detail: a.hooks ? `${a.hooks.length} hook(s) reales` : null,
    },
    {
      id: 'script', label: 'Guion',
      done: Boolean(a.script?.length || a.scenePlan?.length),
      detail: a.scenePlan ? `${a.scenePlan.length} escenas` : a.script ? `${a.script.length} secciones` : null,
    },
    {
      id: 'narrative', label: 'Narrativa',
      done: Boolean(a.narrative?.beats?.length),
      detail: a.narrative ? `${a.narrative.beats.length} beats emocionales` : null,
    },
    {
      id: 'audio', label: 'Audio',
      done: Boolean(a.audio?.tracks?.length),
      detail: a.audio ? `${a.audio.tracks.length} pista(s)` : null,
    },
    {
      id: 'media', label: 'Media',
      done: Boolean(a.mediaBlueprint?.scenes?.length),
      detail: a.mediaBlueprint ? `${a.mediaBlueprint.scenes.length} decisiones de medio` : null,
    },
    {
      id: 'assets', label: 'Assets',
      done: Boolean(a.assets?.length),
      detail: a.assets ? `${a.assets.length} asset(s) generados` : null,
    },
    {
      id: 'sequence', label: 'Sequence',
      done: Boolean(a.sequence),
      detail: a.sequence ? a.sequence.id : null,
    },
    {
      id: 'animation', label: 'Animation',
      done: Boolean(a.animation),
      detail: a.animation ? a.animation.id : null,
    },
    {
      id: 'render', label: 'Render',
      done: Boolean(a.render) || Boolean(a.assembly?.shots.some(s => s.disposition === 'INCLUDED')),
      detail: a.render ? a.render.id : (a.assembly ? `${a.assembly.shots.filter(s => s.disposition === 'INCLUDED').length} shot(s) renderizados` : null),
    },
    {
      id: 'assembly', label: 'Assembly',
      done: Boolean(a.assembly),
      detail: a.assembly ? `${a.assembly.includedDurationSeconds}s de ${a.assembly.declaredDurationSeconds}s declarados` : null,
    },
  ];
  return stages;
}
