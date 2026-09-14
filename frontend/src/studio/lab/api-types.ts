// TypeScript mirrors of the FastAPI backend's camelCase response DTOs
// (backend/app/presentation/schemas.py). The frontend never defines its
// own business types beyond this thin wire-shape mirror — no editorial
// logic, no LAB parsing, nothing computed here (rule #16: "frontend thin").

export interface StoryDTO {
  id: string;
  headline: string;
  summary: string | null;
  status: 'DISCOVERED' | 'IN_PRODUCTION' | 'PRODUCED' | 'PUBLISHED';
  categoryIds: string[];
  sourceCount: number;
}

export interface ProductionStageDTO {
  id: string;
  label: string;
  done: boolean;
  detail: string | null;
}

export interface ProductionDTO {
  id: string;
  storyId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  stages: ProductionStageDTO[];
  progress: number;
  errors: string[];
  startedAt: string;
  completedAt: string | null;
}

export interface CompositionContentDTO {
  angle: string | null;
  hook: string | null;
  script: { section: string; text: string }[];
  narrativeSummary: string | null;
  mediaSummary: string | null;
  assetRefs: string[];
  finalAssetUrl: string | null;
}

export interface CompositionDTO {
  id: string;
  storyId: string;
  productionId: string;
  kind: string;
  status: 'DRAFT' | 'READY_FOR_REVIEW' | 'APPROVED' | 'REJECTED';
  content: CompositionContentDTO;
  targetPlatforms: string[];
}

export interface DistributionPlanDTO {
  id: string;
  compositionId: string;
  platform: 'WEB' | 'TIKTOK' | 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE';
  format: string;
  status: 'NOT_CONNECTED' | 'READY' | 'PENDING' | 'PUBLISHED' | 'FAILED';
  copy: string | null;
  publicationUrl: string | null;
  failureReason: string | null;
}

export interface ActiveProductionItemDTO {
  production: ProductionDTO;
  storyHeadline: string | null;
}

export interface ActiveProductionsDTO {
  items: ActiveProductionItemDTO[];
}

export interface StoryWorkspaceDTO {
  story: StoryDTO;
  production: ProductionDTO | null;
  compositions: CompositionDTO[];
  distributionPlans: Record<string, DistributionPlanDTO[]>;
}

export interface NewsDTO {
  id: string;
  headline: string;
  summary: string | null;
  category: string | null;
  source: string | null;
  sourceUrl: string | null;
  ingestedAt: string;
  legacyWebStatus: string | null;
}

export interface NewsWorkspaceItemDTO {
  news: NewsDTO;
  bucket: 'NEW' | 'PREPARING' | 'PUBLISHED';
  storyId: string | null;
  storyStatus: string | null;
}

export interface NewsWorkspaceDTO {
  items: NewsWorkspaceItemDTO[];
  counts: Record<string, number>;
}

export interface DiscoveryItemDTO {
  newsId: string;
  headline: string;
  category: string | null;
  score: number;
  reasons: { factor: string; weight: number; explanation: string }[];
}

export interface CategoryGroupDTO {
  id: string; name: string; slug: string; sortOrder: number; active: boolean;
  categories: { id: string; name: string; slug: string; sortOrder: number; active: boolean; topics: { id: string; name: string; slug: string }[] }[];
}

export type ApiErrorBody = { error: string; message?: string; relation?: string };
