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
  const score = Math.round(pct * 100);
  const strokeWidth = 14;
  const radius = (size - 30) / 2;
  const arcLength = Math.PI * radius;
  const offset = arcLength * (1 - pct);

  const color = pct >= 0.8 ? "#16a34a" : pct >= 0.5 ? "#ca8a04" : "#f97316";

  const svgWidth = size;
  const svgHeight = radius + 40;
  const cx = svgWidth / 2;
  const cy = svgHeight - 5;
  const x1 = cx - radius;
  const x2 = cx + radius;

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
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute top-20 text-6xl font-bold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}
