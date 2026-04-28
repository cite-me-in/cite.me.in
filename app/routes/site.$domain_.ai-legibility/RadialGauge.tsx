import { useEffect, useState } from "react";
import CATEGORIES from "~/lib/aiLegibility/criteria";

export default function RadialGauge({
  summary,
  size = 200,
}: {
  summary: Record<
    "discovered" | "trusted" | "welcomed",
    { passed: number; total: number }
  >;
  size?: number;
}) {
  const totalPassed = Object.values(summary).reduce((a, c) => a + c.passed, 0);
  const totalChecks = Object.values(summary).reduce((a, c) => a + c.total, 0);
  const overallPct = totalChecks > 0 ? totalPassed / totalChecks : 0;
  const [animPct, setAnimPct] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const dur = 500;
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / dur, 1);
      setAnimPct(t * overallPct);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [overallPct]);

  const strokeWidth = 14;
  const radius = (size - 30) / 2;
  const svgWidth = size;
  const svgHeight = radius + 40;
  const cx = svgWidth / 2;
  const cy = svgHeight - 5;
  const x1 = cx - radius;
  const x2 = cx + radius;
  const arcLength = Math.PI * radius;

  const segments = CATEGORIES.map((cat) => {
    const s = summary[cat.key];
    const segmentArcLength = (s.total / totalChecks) * arcLength;
    const filledArcLength = s.total > 0 ? (s.passed / s.total) * segmentArcLength : 0;
    return { cat, segmentArcLength, filledArcLength };
  });

  const numTop = cy - radius / 2 - 18 + 18;

  const overallColor = overallPct === 1
    ? "#16a34a"
    : overallPct > 0.5
      ? "#f97316"
      : "#dc2626";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={svgWidth} height={svgHeight}>
        {/* Background arc */}
        <path
          d={`M ${x1} ${cy} A ${radius} ${radius} 0 0 1 ${x2} ${cy}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />
        {/* Segmented filled arcs using dasharray/dashoffset */}
        {(() => {
          let offset = 0;
          return segments.map((seg, i) => {
            const startOffset = arcLength - offset - seg.segmentArcLength;
            const filledOffset = arcLength - offset - seg.filledArcLength * animPct;
            offset += seg.segmentArcLength;
            return (
              <g key={i}>
                {/* Filled portion for this segment */}
                <path
                  d={`M ${x1} ${cy} A ${radius} ${radius} 0 0 1 ${x2} ${cy}`}
                  fill="none"
                  stroke={seg.cat.gaugeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${seg.segmentArcLength} ${arcLength - seg.segmentArcLength}`}
                  strokeDashoffset={filledOffset}
                  strokeLinecap="butt"
                />
              </g>
            );
          });
        })()}
      </svg>
      <span
        className="absolute text-5xl font-bold"
        style={{ color: overallColor, top: numTop }}
      >
        {Math.round(animPct * 100)}
      </span>
    </div>
  );
}
