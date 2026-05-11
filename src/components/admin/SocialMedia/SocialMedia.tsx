'use client';

import React from 'react';
import { useStudio } from '@/studio/orchestration';
import { StudioContext } from './context';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { WorkArea } from './WorkArea';

export default function SocialMedia() {
    const studio = useStudio();

    return (
        <StudioContext.Provider value={studio}>
            <div className="w-full h-full overflow-hidden" style={{ background: '#070708' }}>
                <TopBar />
                <div className="flex overflow-hidden" style={{ height: 'calc(100% - 48px)' }}>
                    <Sidebar />
                    <WorkArea />
                </div>
            </div>
        </StudioContext.Provider>
    );
}
