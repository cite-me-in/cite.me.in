import { useEffect, useState } from "react";
import CATEGORIES from "~/lib/aiLegibility/criteria";
import type { ScanResult } from "~/lib/aiLegibility/types";
import scoreColor from "~/lib/scoreColor";

const GAP = 8;

export default function RadialGauge({
  summary,
  size = 200,
}: {
  summary: ScanResult["summary"];
  size?: number;
}) {
  const totalPassed = Object.values(summary).reduce((a, c) => a + c.passed, 0);
  const totalChecks = Object.values(summary).reduce((a, c) => a + c.total, 0);
  const overallPct = totalChecks > 0 ? totalPassed / totalChecks : 0;
  const [animT, setAnimT] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const dur = 500;
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      setAnimT(t);
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
  const arcLength = Math.PI * radius;
  const totalSegLen = arcLength - GAP * (CATEGORIES.length - 1);

  const segments = CATEGORIES.map((cat) => {
    const s = summary[cat.key];
    const segLen = (s.total / totalChecks) * totalSegLen;
    const filledLen = s.total > 0 ? (s.passed / s.total) * segLen : 0;
    return { cat, segLen, filledLen };
  });

  let offset = 0;
  const segArcs: {
    bgDashArray: string;
    fillDashArray: string;
    dashOffset: number;
    gaugeColor: string;
    gapBefore: number;
    segLen: number;
  }[] = [];
  for (const seg of segments) {
    const dashOffset = arcLength - offset;
    const bgDashArray = `${seg.segLen} ${arcLength - seg.segLen}`;
    const fillLen = seg.filledLen * animT;
    const fillDashArray = `${fillLen} ${arcLength - fillLen}`;
    const startPos = offset;
    offset += seg.segLen + GAP;
    segArcs.push({
      bgDashArray,
      fillDashArray,
      dashOffset,
      gaugeColor: seg.cat.gaugeColor,
      gapBefore: startPos,
      segLen: seg.segLen,
    });
  }

  const x1 = cx - radius;
  const x2 = cx + radius;
  const pct = overallPct * 100;
  const overallColor = scoreColor(pct);
  const numTop = cy - radius / 2 - 18 + 18;
  const arcPath = `M ${x1} ${cy} A ${radius} ${radius} 0 0 1 ${x2} ${cy}`;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={svgWidth} height={svgHeight}>
        {segArcs.map((segArc, i) => (
          <g key={i}>
            <path
              d={arcPath}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              strokeDasharray={segArc.bgDashArray}
              strokeDashoffset={segArc.dashOffset}
            />
            <path
              d={arcPath}
              fill="none"
              stroke={segArc.gaugeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              strokeDasharray={segArc.fillDashArray}
              strokeDashoffset={segArc.dashOffset}
            />
          </g>
        ))}
      </svg>
      <span
        className="absolute text-6xl font-bold tabular-nums"
        style={{ color: overallColor, top: numTop }}
      >
        {Math.round(overallPct * animT * 100)}
      </span>
    </div>
  );
}
