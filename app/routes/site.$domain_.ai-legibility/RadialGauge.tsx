import { useEffect, useMemo, useState } from "react";

export default function RadialGauge({
  passed,
  total,
  size = 200,
}: {
  passed: number;
  total: number;
  size?: number;
}) {
  const pct = total > 0 ? passed / total : 0;
  const [animPct, setAnimPct] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const dur = 500;
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / dur, 1);
      setAnimPct(t * pct);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  const strokeWidth = 14;
  const radius = (size - 30) / 2;
  const arcLength = Math.PI * radius;
  const offset = arcLength * (1 - animPct);
  const displayScore = Math.round(animPct * 100);

  const color = useMemo(
    () => lerpColor("#f97316", "#16a34a", animPct),
    [animPct],
  );

  const svgWidth = size;
  const svgHeight = radius + 40;
  const cx = svgWidth / 2;
  const cy = svgHeight - 5;
  const x1 = cx - radius;
  const x2 = cx + radius;

  const numTop = cy - radius / 2 - 18 + 18;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={svgWidth} height={svgHeight}>
        <path
          d={`M ${x1} ${cy} A ${radius} ${radius} 0 0 1 ${x2} ${cy}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={`M ${x1} ${cy} A ${radius} ${radius} 0 0 1 ${x2} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={arcLength}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute text-5xl font-bold"
        style={{ color, top: numTop }}
      >
        {displayScore}
      </span>
    </div>
  );
}

function lerpColor(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bv = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bv})`;
}

function hexToRgb(hex: string) {
  const v = parseInt(hex.replace("#", ""), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}
