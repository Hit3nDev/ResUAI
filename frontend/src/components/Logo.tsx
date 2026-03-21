// ResUAI brand logo — inline SVG, no image dependency
// Matches the teal→cyan→blue gradient wordmark from brand reference.
export default function ResUAILogo({ size = 32 }: { size?: number }) {
  const h = Math.round(size * 0.72);
  return (
    <svg
      width={size + 80}
      height={h}
      viewBox={`0 0 ${size + 80} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#00C896" />
          <stop offset="55%"  stopColor="#00D4FF" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
        {/* Glow filter */}
        <filter id="logo-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Icon — rounded rectangle with 3 lines */}
      <rect
        x="1" y="1"
        width={size - 2}
        height={h - 2}
        rx={size * 0.18}
        ry={size * 0.18}
        stroke="url(#logo-grad)"
        strokeWidth="2"
        fill="none"
        filter="url(#logo-glow)"
      />
      {/* Three horizontal lines inside icon */}
      {[0.32, 0.52, 0.70].map((yRatio, i) => (
        <line
          key={i}
          x1={size * 0.26}
          y1={h * yRatio}
          x2={size * 0.74}
          y2={h * yRatio}
          stroke="url(#logo-grad)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}

      {/* Wordmark: "Resu" in teal, "AI" in blue */}
      <text
        x={size + 10}
        y={h * 0.73}
        fontFamily="'Inter', 'Helvetica', sans-serif"
        fontWeight="800"
        fontSize={h * 0.65}
        fill="url(#logo-grad)"
        letterSpacing="-0.03em"
        filter="url(#logo-glow)"
      >
        Resu<tspan fill="#0EA5E9">AI</tspan>
      </text>
    </svg>
  );
}
