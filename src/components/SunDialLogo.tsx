interface SunDialLogoProps {
  onClick: () => void
}

export function SunDialLogo({ onClick }: SunDialLogoProps) {
  const size = 80
  const center = size / 2
  const radius = 34
  const tickOuter = 32
  const tickInner = 27

  return (
    <button
      onClick={onClick}
      className="transition-opacity hover:opacity-70"
      aria-label="Reset — timezone.solar"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          className="stroke-foreground"
          strokeWidth={2}
        />

        {/* 12 hour tick marks */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180)
          const x1 = center + tickInner * Math.cos(angle)
          const y1 = center + tickInner * Math.sin(angle)
          const x2 = center + tickOuter * Math.cos(angle)
          const y2 = center + tickOuter * Math.sin(angle)
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className="stroke-foreground"
              strokeWidth={i % 3 === 0 ? 2 : 1}
            />
          )
        })}

        {/* Gnomon shadow — triangular wedge in accent color */}
        <polygon
          points={`${center},${center} ${center + 8},${center + 20} ${center - 8},${center + 20}`}
          className="fill-accent/40"
        />

        {/* Gnomon — vertical line */}
        <line
          x1={center}
          y1={center}
          x2={center}
          y2={center - 22}
          className="stroke-foreground"
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle
          cx={center}
          cy={center}
          r={2.5}
          className="fill-foreground"
        />
      </svg>
    </button>
  )
}
