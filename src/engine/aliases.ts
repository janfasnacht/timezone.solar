/** City/region aliases -> canonical city names for resolver lookup
 *  Migrated to Entity.aliases in entities.ts — kept as empty export for compatibility */
export const CITY_ALIASES: Record<string, string> = {}

/** US states -> IANA timezone (for the primary/most populous city) */
export const US_STATE_TIMEZONES: Record<string, string> = {
  'california': 'America/Los_Angeles',
  'ca': 'America/Los_Angeles',
  'oregon': 'America/Los_Angeles',
  'washington state': 'America/Los_Angeles',
  'nevada': 'America/Los_Angeles',
  'new york state': 'America/New_York',
  'massachusetts': 'America/New_York',
  'florida': 'America/New_York',
  'georgia': 'America/New_York',
  'pennsylvania': 'America/New_York',
  'virginia': 'America/New_York',
  'north carolina': 'America/New_York',
  'south carolina': 'America/New_York',
  'new jersey': 'America/New_York',
  'connecticut': 'America/New_York',
  'maryland': 'America/New_York',
  'maine': 'America/New_York',
  'vermont': 'America/New_York',
  'new hampshire': 'America/New_York',
  'rhode island': 'America/New_York',
  'delaware': 'America/New_York',
  'ohio': 'America/New_York',
  'michigan': 'America/New_York',
  'west virginia': 'America/New_York',
  'illinois': 'America/Chicago',
  'texas': 'America/Chicago',
  'minnesota': 'America/Chicago',
  'wisconsin': 'America/Chicago',
  'iowa': 'America/Chicago',
  'missouri': 'America/Chicago',
  'arkansas': 'America/Chicago',
  'louisiana': 'America/Chicago',
  'mississippi': 'America/Chicago',
  'alabama': 'America/Chicago',
  'tennessee': 'America/Chicago',
  'kansas': 'America/Chicago',
  'nebraska': 'America/Chicago',
  'oklahoma': 'America/Chicago',
  'indiana': 'America/New_York',
  'colorado': 'America/Denver',
  'arizona': 'America/Phoenix',
  'utah': 'America/Denver',
  'montana': 'America/Denver',
  'wyoming': 'America/Denver',
  'new mexico': 'America/Denver',
  'idaho': 'America/Boise',
  'hawaii': 'Pacific/Honolulu',
  'alaska': 'America/Anchorage',
  // Informal region names
  'east coast': 'America/New_York',
  'west coast': 'America/Los_Angeles',
  'midwest': 'America/Chicago',
  'mountain': 'America/Denver',
  'pacific': 'America/Los_Angeles',
  'eastern': 'America/New_York',
  'central': 'America/Chicago',
  'mountain time': 'America/Denver',
  'pacific time': 'America/Los_Angeles',
  'eastern time': 'America/New_York',
  'central time': 'America/Chicago',
}

/**
 * Subnational abbreviations, mapped to the `province` value on a city row.
 * Only valid trailing a city name: several are ordinary English words.
 */
export const SUBNATIONAL_ABBREVIATIONS: Record<string, string> = {
  // United States
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california',
  co: 'colorado', ct: 'connecticut', de: 'delaware', fl: 'florida', ga: 'georgia',
  hi: 'hawaii', id: 'idaho', il: 'illinois', in: 'indiana', ia: 'iowa',
  ks: 'kansas', ky: 'kentucky', la: 'louisiana', me: 'maine', md: 'maryland',
  ma: 'massachusetts', mi: 'michigan', mn: 'minnesota', ms: 'mississippi',
  mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada', nh: 'new hampshire',
  nj: 'new jersey', nm: 'new mexico', ny: 'new york', nc: 'north carolina',
  nd: 'north dakota', oh: 'ohio', ok: 'oklahoma', or: 'oregon', pa: 'pennsylvania',
  ri: 'rhode island', sc: 'south carolina', sd: 'south dakota', tn: 'tennessee',
  tx: 'texas', ut: 'utah', vt: 'vermont', va: 'virginia', wa: 'washington',
  wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming', dc: 'district of columbia',
  // Australia
  nsw: 'new south wales', vic: 'victoria', qld: 'queensland', tas: 'tasmania',
  nt: 'northern territory', act: 'australian capital territory',
  // Canada
  on: 'ontario', qc: 'quebec', bc: 'british columbia', ab: 'alberta',
  sk: 'saskatchewan', mb: 'manitoba', ns: 'nova scotia', nb: 'new brunswick',
  nl: 'newfoundland and labrador', pe: 'prince edward island', yt: 'yukon',
}
