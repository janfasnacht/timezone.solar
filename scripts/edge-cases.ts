/**
 * Set 2: Hand-crafted edge cases organized by difficulty dimension.
 * ~120 cases covering 8 dimensions of parser difficulty.
 */

import type { TestCase } from './eval-types.ts'

// Helper to create edge cases with common defaults
function edge(
  input: string,
  expected: {
    source?: string | null
    target?: string | null
    time?: TestCase['expectedTime']
    dateModifier?: TestCase['expectedDateModifier']
    tier?: 1 | 2 | 3
    sourceKind?: TestCase['expectedSourceKind']
    targetKind?: TestCase['expectedTargetKind']
  },
  tags: string[],
  notes: string
): Omit<TestCase, 'id'> {
  return {
    input,
    expectedSource: expected.source ?? null,
    expectedTarget: expected.target ?? null,
    expectedTime: expected.time ?? { type: 'now' },
    expectedDateModifier: expected.dateModifier ?? null,
    expectedTier: expected.tier ?? 1,
    expectedSourceKind: expected.sourceKind,
    expectedTargetKind: expected.targetKind,
    difficultyTags: tags,
    notes,
    set: 'edge',
  }
}

export const edgeCases: Omit<TestCase, 'id'>[] = [
  // =============================================
  // Structural ambiguity (15 cases)
  // =============================================
  edge('Portland', { target: 'Portland', tier: 2 }, ['structural-ambiguity'], 'Portland OR vs Portland ME — ambiguous without context'),
  edge('Georgia', { target: 'Georgia', tier: 2 }, ['structural-ambiguity'], 'Georgia state vs Georgia country'),
  edge('Birmingham', { target: 'Birmingham', tier: 2 }, ['structural-ambiguity'], 'Birmingham UK vs Birmingham AL'),
  edge('Victoria', { target: 'Victoria', tier: 2 }, ['structural-ambiguity'], 'Victoria BC vs Victoria AU vs Victoria Seychelles'),
  edge('Cambridge', { target: 'Cambridge', tier: 2 }, ['structural-ambiguity'], 'Cambridge UK vs Cambridge MA'),
  edge('Richmond', { target: 'Richmond', tier: 2 }, ['structural-ambiguity'], 'Richmond VA vs Richmond BC vs Richmond UK'),
  edge('Springfield', { target: 'Springfield', tier: 2 }, ['structural-ambiguity'], 'Springfield — many US cities with this name'),
  edge('Santiago', { target: 'Santiago', tier: 2 }, ['structural-ambiguity'], 'Santiago Chile vs Santiago de Compostela Spain'),
  edge('Hamilton', { target: 'Hamilton', tier: 2 }, ['structural-ambiguity'], 'Hamilton NZ vs Hamilton ON vs Hamilton Bermuda'),
  edge('London to Portland', { source: 'London', target: 'Portland', tier: 2 }, ['structural-ambiguity'], 'Portland ambiguity in two-city query'),
  edge('3pm Portland to Birmingham', { source: 'Portland', target: 'Birmingham', time: { type: 'absolute', hour: 15, minute: 0 }, tier: 2 }, ['structural-ambiguity'], 'Both cities are ambiguous'),
  edge('Perth', { target: 'Perth', tier: 2 }, ['structural-ambiguity'], 'Perth AU vs Perth Scotland'),
  edge('Newcastle', { target: 'Newcastle', tier: 2 }, ['structural-ambiguity'], 'Newcastle UK vs Newcastle AU'),
  edge('Valencia', { target: 'Valencia', tier: 2 }, ['structural-ambiguity'], 'Valencia Spain vs Valencia Venezuela'),
  edge('Panama', { target: 'Panama', tier: 2 }, ['structural-ambiguity'], 'Panama City vs Panama country'),

  // =============================================
  // Token ambiguity (12 cases)
  // =============================================
  edge('Jan Tokyo', { target: 'Jan Tokyo', tier: 2 }, ['token-ambiguity'], '"Jan" could be a name, abbreviation, or month — parser sees as location'),
  edge('March London', { target: 'March London', tier: 2 }, ['token-ambiguity'], '"March" could be month or part of location name'),
  edge('noon Australia', { target: 'Australia', time: { type: 'absolute', hour: 12, minute: 0 }, tier: 1 }, ['token-ambiguity'], '"noon" is a named time — should parse correctly'),
  edge('midnight Tokyo', { target: 'Tokyo', time: { type: 'absolute', hour: 0, minute: 0 }, tier: 1 }, ['token-ambiguity'], '"midnight" is a named time — should parse correctly'),
  edge('EST to PST', { source: 'EST', target: 'PST', tier: 1 }, ['token-ambiguity'], 'TZ abbreviations as locations — both source and target'),
  edge('IST to London', { source: 'IST', target: 'London', tier: 2 }, ['token-ambiguity'], 'IST is ambiguous: India, Israel, or Ireland Standard Time'),
  edge('Jordan time', { target: 'Jordan time', tier: 2 }, ['token-ambiguity'], '"Jordan" could be country or person name; "time" as noise'),
  edge('Turkey to Greece', { source: 'Turkey', target: 'Greece', tier: 1 }, ['token-ambiguity'], 'Country names that could be other things (turkey the bird)'),
  edge('Nice to Paris', { source: 'Nice', target: 'Paris', tier: 1 }, ['token-ambiguity'], '"Nice" is a city in France but also an English adjective'),
  edge('Mobile to Dallas', { source: 'Mobile', target: 'Dallas', tier: 1 }, ['token-ambiguity'], '"Mobile" is a city in Alabama but also a common English word'),
  edge('Lima to Quito', { source: 'Lima', target: 'Quito', tier: 1 }, ['token-ambiguity'], '"Lima" — city name that looks like it could be something else'),
  edge('Reading to London', { source: 'Reading', target: 'London', tier: 1 }, ['token-ambiguity'], '"Reading" is a city but also a common English word'),

  // =============================================
  // Noise tolerance (20 cases)
  // =============================================
  edge('what time is it in Tokyo', { target: 'Tokyo', tier: 1 }, ['noise-tolerance'], 'Natural language question — noise words should be stripped'),
  edge('what time is 3pm NYC in London', { source: 'NYC', target: 'London', time: { type: 'absolute', hour: 15, minute: 0 }, tier: 1 }, ['noise-tolerance'], 'Question with embedded valid query'),
  edge('can you tell me 3pm NYC to London', { source: 'NYC', target: 'London', time: { type: 'absolute', hour: 15, minute: 0 }, tier: 1 }, ['noise-tolerance'], 'Polite request wrapping valid query'),
  edge('please convert 5pm London to Tokyo', { source: 'London', target: 'Tokyo', time: { type: 'absolute', hour: 17, minute: 0 }, tier: 1 }, ['noise-tolerance'], 'Polite request with "convert"'),
  edge('time in Berlin right now', { target: 'Berlin', tier: 1 }, ['noise-tolerance'], '"time in" prefix and "right now" suffix as noise'),
  edge('current time Tokyo', { target: 'Tokyo', tier: 1 }, ['noise-tolerance'], '"current" as noise word'),
  edge('3pm meeting time Berlin London', { source: 'Berlin', target: 'London', time: { type: 'absolute', hour: 15, minute: 0 }, tier: 2 }, ['noise-tolerance'], '"meeting time" as noise between locations — hard to parse'),
  edge('I need to know what 4pm in NYC is in London', { source: 'NYC', target: 'London', time: { type: 'absolute', hour: 16, minute: 0 }, tier: 1 }, ['noise-tolerance'], 'Long natural language with valid query embedded'),
  edge('convert Tokyo time to EST', { source: 'Tokyo', target: 'EST', tier: 1 }, ['noise-tolerance'], '"convert" and "time" as noise'),
  edge('tell me the time difference between NYC and London', { source: 'NYC', target: 'London', tier: 1 }, ['noise-tolerance'], 'Natural language with "difference between"'),
  edge('when its 3pm in NYC what time is it in London', { source: 'NYC', target: 'London', time: { type: 'absolute', hour: 15, minute: 0 }, tier: 1 }, ['noise-tolerance'], 'Full sentence query'),
  edge('if its 9am in London what time in Tokyo', { source: 'London', target: 'Tokyo', time: { type: 'absolute', hour: 9, minute: 0 }, tier: 1 }, ['noise-tolerance'], 'Conditional phrasing'),
  edge('Berlin time now please', { target: 'Berlin', tier: 1 }, ['noise-tolerance'], 'Noise at end: "time now please"'),
  edge('whats the time in sydney', { target: 'sydney', tier: 1 }, ['noise-tolerance'], 'Contraction and noise words'),
  edge('ok google time in Tokyo', { target: 'Tokyo', tier: 1 }, ['noise-tolerance'], 'Voice assistant prefix as noise'),
  edge('hey what is 2pm est in tokyo', { source: 'est', target: 'tokyo', time: { type: 'absolute', hour: 14, minute: 0 }, tier: 1 }, ['noise-tolerance'], '"hey what is" as noise prefix'),
  edge('i want to schedule a call at 3pm london time for my colleague in mumbai', { source: 'london', target: 'mumbai', time: { type: 'absolute', hour: 15, minute: 0 }, tier: 2 }, ['noise-tolerance'], 'Very long sentence with lots of noise'),
  edge('time zone difference London NYC', { source: 'London', target: 'NYC', tier: 1 }, ['noise-tolerance'], '"time zone difference" as noise prefix'),
  edge('check time for Dubai', { target: 'Dubai', tier: 1 }, ['noise-tolerance'], '"check time for" as noise'),
  edge('show me 6pm Tokyo in Berlin time', { source: 'Tokyo', target: 'Berlin', time: { type: 'absolute', hour: 18, minute: 0 }, tier: 1 }, ['noise-tolerance'], '"show me" prefix and "time" suffix noise'),

  // =============================================
  // Completeness (15 cases)
  // =============================================
  edge('Tokyo', { target: 'Tokyo', tier: 1 }, ['completeness'], 'Single city — valid minimal query'),
  edge('6pm', { target: null, tier: 3 }, ['completeness'], 'Time only, no location — should fail or return null'),
  edge('', { target: null, tier: 3 }, ['completeness'], 'Empty string'),
  edge('   ', { target: null, tier: 3 }, ['completeness'], 'Whitespace only'),
  edge('hi', { target: 'hi', tier: 3 }, ['completeness'], 'Greeting, not a timezone query'),
  edge('asdf', { target: 'asdf', tier: 3 }, ['completeness'], 'Random characters'),
  edge('help', { target: 'help', tier: 3 }, ['completeness'], 'Help request, not a timezone query'),
  edge('to', { target: null, tier: 3 }, ['completeness'], 'Connector only — should return null'),
  edge('3pm to', { target: null, tier: 3 }, ['completeness'], 'Time + connector, no location'),
  edge('to London', { target: 'London', tier: 1 }, ['completeness'], 'Leading connector + city — connector stripped, city valid'),
  edge('London to', { source: null, target: 'London', tier: 2 }, ['completeness'], 'City + trailing connector — partial query'),
  edge('tomorrow', { target: null, tier: 3 }, ['completeness'], 'Date modifier only, no location'),
  edge('now', { target: null, tier: 3 }, ['completeness'], '"now" alone — stripped in preprocessing, returns null'),
  edge('12345', { target: '12345', tier: 3 }, ['completeness'], 'Number string, not a valid query'),
  edge('the', { target: 'the', tier: 3 }, ['completeness'], 'Common word, not a location'),

  // =============================================
  // Typos (15 cases)
  // =============================================
  edge('Londno', { target: 'Londno', tier: 2 }, ['typo'], 'Typo for London — resolver should fuzzy match'),
  edge('Zuric', { target: 'Zuric', tier: 2 }, ['typo'], 'Typo for Zurich'),
  edge('Tokyp', { target: 'Tokyp', tier: 2 }, ['typo'], 'Typo for Tokyo'),
  edge('Sydeny', { target: 'Sydeny', tier: 2 }, ['typo'], 'Typo for Sydney'),
  edge('Berln', { target: 'Berln', tier: 2 }, ['typo'], 'Typo for Berlin'),
  edge('Singaproe', { target: 'Singaproe', tier: 2 }, ['typo'], 'Typo for Singapore'),
  edge('Melborne', { target: 'Melborne', tier: 2 }, ['typo'], 'Typo for Melbourne'),
  edge('Bangkoc', { target: 'Bangkoc', tier: 2 }, ['typo'], 'Typo for Bangkok'),
  edge('Mumabi', { target: 'Mumabi', tier: 2 }, ['typo'], 'Typo for Mumbai'),
  edge('Mosocw', { target: 'Mosocw', tier: 2 }, ['typo'], 'Typo for Moscow'),
  edge('Beuons Aires', { target: 'Beuons Aires', tier: 2 }, ['typo'], 'Typo for Buenos Aires'),
  edge('Tornoto', { target: 'Tornoto', tier: 2 }, ['typo'], 'Typo for Toronto'),
  edge('Londno to Tokyp', { source: 'Londno', target: 'Tokyp', tier: 2 }, ['typo'], 'Both cities have typos'),
  edge('3pm Sydeny to Melborne', { source: 'Sydeny', target: 'Melborne', time: { type: 'absolute', hour: 15, minute: 0 }, tier: 2 }, ['typo'], 'Time + two typo cities'),
  edge('Delhii', { target: 'Delhii', tier: 2 }, ['typo'], 'Typo for Delhi'),

  // =============================================
  // Format mixing (15 cases)
  // =============================================
  edge('3pm EST to London', { source: 'EST', target: 'London', time: { type: 'absolute', hour: 15, minute: 0 }, tier: 1 }, ['format-mixing'], 'TZ abbreviation as source + city as target'),
  edge('CET to JST', { source: 'CET', target: 'JST', tier: 1 }, ['format-mixing'], 'Two TZ abbreviations'),
  edge('15:00 NYC to GMT', { source: 'NYC', target: 'GMT', time: { type: 'absolute', hour: 15, minute: 0 }, tier: 1 }, ['format-mixing'], '24h time + city + TZ abbreviation'),
  edge('PST to IST', { source: 'PST', target: 'IST', tier: 2 }, ['format-mixing'], 'IST is ambiguous — India? Israel? Ireland?'),
  edge('noon EST to London', { source: 'EST', target: 'London', time: { type: 'absolute', hour: 12, minute: 0 }, tier: 1 }, ['format-mixing'], 'Named time + TZ abbreviation + city'),
  edge('Tokyo to PT', { source: 'Tokyo', target: 'PT', tier: 1 }, ['format-mixing'], 'City + informal TZ abbreviation (Pacific Time)'),
  edge('3.30pm London to NYC', { source: 'London', target: 'NYC', time: { type: 'absolute', hour: 15, minute: 30 }, tier: 1 }, ['format-mixing'], 'Dot-separated time format'),
  edge('AEST to Berlin', { source: 'AEST', target: 'Berlin', tier: 1 }, ['format-mixing'], 'Australian TZ abbreviation + European city'),
  edge('UTC to Tokyo', { source: 'UTC', target: 'Tokyo', tier: 1 }, ['format-mixing'], 'UTC as source'),
  edge('midnight GMT to New York', { source: 'GMT', target: 'New York', time: { type: 'absolute', hour: 0, minute: 0 }, tier: 1 }, ['format-mixing'], 'Named time + TZ abbreviation + multi-word city'),
  edge('9am pacific to eastern', { source: 'pacific', target: 'eastern', time: { type: 'absolute', hour: 9, minute: 0 }, tier: 2 }, ['format-mixing'], 'Informal timezone names without "time"'),
  edge('3pm London GMT to Tokyo JST', { target: null, tier: 3 }, ['format-mixing'], 'Redundant TZ info — confusing format'),
  edge('BST to CEST', { source: 'BST', target: 'CEST', tier: 1 }, ['format-mixing'], 'Summer time abbreviations'),
  edge('ET to CT', { source: 'ET', target: 'CT', tier: 1 }, ['format-mixing'], 'Short US timezone abbreviations'),
  edge('3pm US Eastern to Japan', { source: 'US Eastern', target: 'Japan', time: { type: 'absolute', hour: 15, minute: 0 }, tier: 2 }, ['format-mixing'], 'Verbose timezone name + country name'),

  // =============================================
  // Multi-word cities (15 cases)
  // =============================================
  edge('New York to London', { source: 'New York', target: 'London', tier: 1 }, ['multi-word-city'], 'Two-word city as source'),
  edge('London to New York', { source: 'London', target: 'New York', tier: 1 }, ['multi-word-city'], 'Two-word city as target'),
  edge('Ho Chi Minh City to Bangkok', { source: 'Ho Chi Minh City', target: 'Bangkok', tier: 1 }, ['multi-word-city'], 'Four-word city as source'),
  edge('Salt Lake City to Denver', { source: 'Salt Lake City', target: 'Denver', tier: 1 }, ['multi-word-city'], 'Three-word city as source'),
  edge('3pm New York to Los Angeles', { source: 'New York', target: 'Los Angeles', time: { type: 'absolute', hour: 15, minute: 0 }, tier: 1 }, ['multi-word-city'], 'Time + two multi-word cities'),
  edge('Buenos Aires to São Paulo', { source: 'Buenos Aires', target: 'São Paulo', tier: 1 }, ['multi-word-city'], 'Diacritical marks in city name'),
  edge('Kuala Lumpur', { target: 'Kuala Lumpur', tier: 1 }, ['multi-word-city'], 'Two-word city alone'),
  edge('Rio de Janeiro to Mexico City', { source: 'Rio de Janeiro', target: 'Mexico City', tier: 1 }, ['multi-word-city'], 'Three-word city to two-word city'),
  edge('San Francisco to New York', { source: 'San Francisco', target: 'New York', tier: 1 }, ['multi-word-city'], 'Two multi-word US cities'),
  edge('Tel Aviv to Istanbul', { source: 'Tel Aviv', target: 'Istanbul', tier: 1 }, ['multi-word-city'], 'Two-word Middle Eastern city'),
  edge('3pm Hong Kong to Los Angeles', { source: 'Hong Kong', target: 'Los Angeles', time: { type: 'absolute', hour: 15, minute: 0 }, tier: 1 }, ['multi-word-city'], 'Time + two-word city + two-word city'),
  edge('Addis Ababa', { target: 'Addis Ababa', tier: 1 }, ['multi-word-city'], 'Two-word African city'),
  edge('Dar es Salaam to Nairobi', { source: 'Dar es Salaam', target: 'Nairobi', tier: 1 }, ['multi-word-city'], 'Three-word city with lowercase preposition'),
  edge('Phnom Penh to Ho Chi Minh City', { source: 'Phnom Penh', target: 'Ho Chi Minh City', tier: 1 }, ['multi-word-city'], 'Two multi-word Asian cities'),
  edge('noon San José to Guatemala City', { source: 'San José', target: 'Guatemala City', time: { type: 'absolute', hour: 12, minute: 0 }, tier: 1 }, ['multi-word-city'], 'Named time + diacritical city + multi-word city'),

  // =============================================
  // Short inputs (12 cases)
  // =============================================
  edge('LA', { target: 'LA', tier: 1 }, ['short-input'], 'Common abbreviation for Los Angeles'),
  edge('SF', { target: 'SF', tier: 1 }, ['short-input'], 'Common abbreviation for San Francisco'),
  edge('UK', { target: 'UK', tier: 1 }, ['short-input'], 'Country abbreviation'),
  edge('NZ', { target: 'NZ', tier: 1 }, ['short-input'], 'Country abbreviation for New Zealand'),
  edge('DC', { target: 'DC', tier: 1 }, ['short-input'], 'Abbreviation for Washington DC'),
  edge('HK', { target: 'HK', tier: 1 }, ['short-input'], 'Abbreviation for Hong Kong'),
  edge('SG', { target: 'SG', tier: 1 }, ['short-input'], 'Abbreviation for Singapore'),
  edge('LA to NY', { source: 'LA', target: 'NY', tier: 1 }, ['short-input'], 'Two abbreviations with connector'),
  edge('3pm LA to SF', { source: 'LA', target: 'SF', time: { type: 'absolute', hour: 15, minute: 0 }, tier: 1 }, ['short-input'], 'Time + two abbreviations'),
  edge('JP', { target: 'JP', tier: 2 }, ['short-input'], 'JP — not a common abbreviation, could be Japan'),
  edge('AZ', { target: 'AZ', tier: 2 }, ['short-input'], 'AZ — Arizona or Azerbaijan?'),
  edge('KL', { target: 'KL', tier: 2 }, ['short-input'], 'KL — Kuala Lumpur abbreviation, less common'),
]
