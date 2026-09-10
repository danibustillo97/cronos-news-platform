'use client';

import React from 'react';
import { useStudio } from '@/studio/orchestration';
import { StudioContext } from './context';
import { TopBar, DS } from './TopBar';
import { LibraryPanel } from './LibraryPanel';
import { WorkArea } from './WorkArea';

export default function SocialMedia() {
    const studio = useStudio();

    return (
        <StudioContext.Provider value={studio}>
            <div className="w-full h-full overflow-hidden" style={{ background: DS.bg }}>
                <TopBar />
                <div className="flex overflow-hidden" style={{ height: 'calc(100% - 48px)' }}>
                    <LibraryPanel />
                    <WorkArea />
                </div>
            </div>
        </StudioContext.Provider>
    );
}
