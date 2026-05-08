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
            {/*
             * LAYOUT: 3 filas fijas = TopBar | Main | Timeline
             * Nada fuera de viewport. Sin scroll de página.
             */}
            <div
                className="w-full bg-[#070708] overflow-hidden"
                style={{
                    height: '100dvh',
                    display: 'grid',
                    gridTemplateRows: 'auto 1fr auto',
                }}
            >
                <TopBar />
                <div className="flex overflow-hidden min-h-0">
                    <Sidebar />
                    <WorkArea />
                </div>
            </div>
        </StudioContext.Provider>
    );
}
