import { useEffect, useRef } from 'react';
import { getWormSegment } from './gameArt';
import type { WormPattern } from './constants';

// Mağaza önizlemesi oyundaki sprite'ın ta kendisidir: ne görüyorsan onu kuşanırsın.
export function SkinPreview({ color, pattern }: { color: string; pattern: WormPattern }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 48, 48);
    ctx.drawImage(getWormSegment(color, pattern), 0, 0, 48, 48);
  }, [color, pattern]);
  return <canvas ref={ref} width={48} height={48} className="mx-auto h-8 w-8" aria-hidden="true" />;
}
