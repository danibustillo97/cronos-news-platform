import { useMemo, useRef, useState } from 'react';
import { createScriptEngine } from './script.engine';
import type { NewsItem, ScriptSegment } from '@/studio/shared/types';

export const useScript = (initialScript: ScriptSegment[] = []) => {
  const engineRef = useRef(createScriptEngine());
  const [videoScript, setVideoScript] = useState<ScriptSegment[]>(initialScript);

  const generateVideoScript = (title: string, selectedNews: NewsItem | null) => {
    const script = engineRef.current.generateFromNews(title, selectedNews);
    setVideoScript(script);
  };

  const normalizedScript = useMemo(() => engineRef.current.normalizeScript(videoScript), [videoScript]);

  return {
    videoScript: normalizedScript,
    setVideoScript,
    generateVideoScript,
  };
};
