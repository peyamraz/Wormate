import { useEffect, useRef } from 'react';
import { getWormTube, getStripeTube, getFlagTube } from './gameArt';
import type { FlagSkin, WormPattern } from './constants';

// Mağaza önizlemesi oyundaki dilimlerin ta kendisidir.
export function SkinPreview({ color, pattern }: { color: string; pattern: WormPattern }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 48, 48);
    if (pattern === 'stripes') {
      // Halka ritmi: yarım açık + yarım koyu.
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, 24, 48); ctx.clip();
      ctx.drawImage(getStripeTube(color, 0), 0, 0, 48, 48);
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.rect(24, 0, 24, 48); ctx.clip();
      ctx.drawImage(getStripeTube(color, 1), 0, 0, 48, 48);
      ctx.restore();
    } else if (pattern.startsWith('flag-')) {
      // Bant ritmi + amblem: üç dilim yan yana.
      const f = pattern as FlagSkin;
      [0, 1, 6].forEach((k, j) => ctx.drawImage(getFlagTube(f, k), j * 16, 14, 16, 20));
    } else {
      ctx.drawImage(getWormTube(color, pattern), 0, 0, 48, 48);
    }
  }, [color, pattern]);
  return <canvas ref={ref} width={48} height={48} className="mx-auto h-8 w-8" aria-hidden="true" />;
}
