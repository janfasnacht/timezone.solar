interface CityIconProps {
  svgCitiesSlug: string
}

export function CityIcon({ svgCitiesSlug }: CityIconProps) {
  return (
    <div
      className="pointer-events-none absolute right-[2rem] bottom-[2rem] h-[2.5rem] w-[2.5rem]"
      aria-hidden="true"
      style={{
        maskImage: `url(/icons/${svgCitiesSlug}.svg)`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskImage: `url(/icons/${svgCitiesSlug}.svg)`,
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        backgroundColor: 'var(--color-city-icon)',
      }}
    />
  )
}
