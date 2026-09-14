'use client';

import { createContext, useContext } from 'react';
import type { StudioApi } from '@/studio/orchestration/useStudio';

export const StudioContext = createContext<StudioApi | null>(null);

export const useStudioContext = (): StudioApi => {
    const ctx = useContext(StudioContext);
    if (!ctx) throw new Error('useStudioContext must be used inside <SocialMedia>');
    return ctx;
};
