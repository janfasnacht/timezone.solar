interface IconProps {
  size?: number
  strokeWidth?: number
}

export function CardIcon({ size = 16, strokeWidth = 1.2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M5 6.5h6M5 9h4" />
    </svg>
  )
}

export function MapIcon({ size = 16, strokeWidth = 1.2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 3.5l4-1.5v10.5l-4 1.5V3.5zM5.5 2l5 2v10.5l-5-2V2zM10.5 4l4-1.5v10.5l-4 1.5V4z" />
    </svg>
  )
}
