/**
 * Downloads all city skyline SVG icons from the city-icons repo.
 * https://github.com/anto1/city-icons
 *
 * Usage:
 *   npx tsx scripts/download-icons.ts          # skip existing
 *   npx tsx scripts/download-icons.ts --force   # re-download all
 */

import { writeFile, mkdir, access } from 'node:fs/promises'
import { join } from 'node:path'

const BASE_URL =
  'https://raw.githubusercontent.com/anto1/city-icons/main/public/icons'
const OUT_DIR = join(import.meta.dirname, '..', 'public', 'icons')
const CONCURRENCY = 10

const SLUGS = [
  'ad-andorra',
  'ae-abu-dhabi',
  'ae-dubai',
  'ag-saint-john',
  'al-tirana',
  'am-yerevan',
  'ar-buenos-aires',
  'ar-cordoba',
  'ar-ushuaia',
  'at-graz',
  'at-hallstatt',
  'at-vienna',
  'au-canberra',
  'au-hobart',
  'au-melbourne',
  'au-perth',
  'au-sydney',
  'az-baku',
  'ba-mostar',
  'ba-sarajevo',
  'bd-dhaka',
  'be-bruges',
  'be-brussels',
  'bf-ouagadougou',
  'bg-sofia',
  'bh-manama',
  'bn-seria',
  'bo-la-paz',
  'br-brasilia',
  'br-rio-de-janeiro',
  'br-sao-paolo',
  'br-sao-paulo',
  'bs-nassau',
  'bt-thimphu',
  'by-minsk',
  'bz-san-ignacio',
  'ca-ottawa',
  'ca-toronto',
  'ca-vancouver',
  'ch-bern',
  'cl-santiago',
  'cl-valparaiso',
  'cn-beijing',
  'cn-chengdu',
  'cn-jingzhou',
  'cn-leshan',
  'cn-shanghai',
  'co-bogota',
  'co-cartagena',
  'co-medellin',
  'cr-alajuela',
  'cu-havana',
  'cw-willemstadt',
  'cy-limassol',
  'cy-nicosia',
  'cy-paphos',
  'cz-prague',
  'de-aachen',
  'de-berlin',
  'de-bielefeld',
  'de-bremen',
  'de-cologne',
  'de-erfurt',
  'de-frankfurt',
  'de-freiburg',
  'de-giessen',
  'de-hamburg',
  'de-karlsruhe',
  'de-leipzig',
  'de-munich',
  'de-nuremberg',
  'de-siegen',
  'de-stuttgart',
  'dk-copenhagen',
  'ec-quito',
  'ee-tallinn',
  'eg-cairo',
  'es-barcelona',
  'es-cordoba',
  'es-coruna',
  'es-gijon',
  'es-granada',
  'es-madrid',
  'es-malaga',
  'es-santiago-de-compostela',
  'es-valencia',
  'es-vigo',
  'et-lalibela',
  'fi-helsinki',
  'fi-kuopio',
  'fj-suva',
  'fr-lyon',
  'fr-montpellier',
  'fr-paris',
  'fr-rennes',
  'gb-edinburgh',
  'gb-leeds',
  'gb-london',
  'gb-manchester',
  'gd-st-george',
  'ge-batumi',
  'ge-tbilisi',
  'gh-accra',
  'gr-athens',
  'gt-antigua',
  'gy-georgetown',
  'hn-tegucigalpa',
  'hr-zagreb',
  'ht-port-au-prince',
  'hu-budapest',
  'hu-debrecen',
  'hu-szeged',
  'id-denpasar',
  'ie-dublin',
  'il-haifa',
  'il-jerusalem',
  'il-tel-aviv',
  'in-agra',
  'in-delhi',
  'iq-samarra',
  'ir-isfahan',
  'ir-mashhad',
  'ir-tehran',
  'is-akureyri',
  'is-reykjavik',
  'it-bologna',
  'it-ferrara',
  'it-forte-dei-marmi',
  'it-milan',
  'it-palermo',
  'it-rome',
  'it-sorrento',
  'it-taranto',
  'it-trieste',
  'it-venice',
  'jo-amman',
  'jp-kyoto',
  'jp-nara',
  'jp-shirakawa-go',
  'jp-tokyo',
  'ke-nairobi',
  'kg-bishkek',
  'kh-sihanoukville',
  'ki-tarawa',
  'kp-pyongyang',
  'kr-seoul',
  'kw-kuwait',
  'kz-alma-aty',
  'kz-astana',
  'kz-kostanay',
  'kz-schuchinsk',
  'kz-uralsk',
  'la-luang-prabang',
  'lb-beirut',
  'lc-soufriere',
  'li-vaduz',
  'ls-maseru',
  'lt-vilnius',
  'lu-luxembourg',
  'lv-riga',
  'ly-benghazi',
  'ma-casablanca',
  'ma-fez',
  'ma-marrakesh',
  'mc-monaco',
  'md-chisinau',
  'me-budva',
  'me-herceg-novi',
  'me-podgorica',
  'mg-antananarivo',
  'mk-skopje',
  'mm-bagan',
  'mn-ulaanbaatar',
  'mt-valletta',
  'mu-port-louis',
  'mx-guadalajara',
  'mx-tijuana',
  'my-kuala-lumpur',
  'my-kuching',
  'mz-maputo',
  'na-windhoek',
  'nc-noumea',
  'ng-lagos',
  'ni-granada',
  'nl-amsterdam',
  'nl-de-meije',
  'nl-maastricht',
  'nl-rotterdam',
  'nl-woerden',
  'no-oslo',
  'np-kathmandu',
  'nz-wellington',
  'om-muscat',
  'pa-panama',
  'pe-cusco',
  'pe-lima',
  'ph-cebu',
  'ph-manila',
  'pk-islamabad',
  'pk-karachi',
  'pl-gdansk',
  'pl-poznan',
  'pl-swiebodzin',
  'pl-warsaw',
  'pl-wroclaw',
  'pr-san-juan',
  'ps-jerusalem',
  'pt-amadora',
  'pt-barcelos',
  'pt-braga',
  'pt-chaves',
  'pt-guimaraes',
  'pt-leiria',
  'pt-lisbon',
  'pt-matosinhos',
  'pt-nazare',
  'pt-porto',
  'pt-viana-do-castelo',
  'pt-vila-real',
  'qa-doha',
  'ro-bucharest',
  'rs-belgrade',
  'rs-subotica',
  'ru-moscow',
  'ru-murmansk',
  'ru-tula',
  'ru-yakutsk',
  'rw-kigali',
  'sa-riyadh',
  'sb-honiara',
  'se-stockholm',
  'sg-sentosa',
  'si-ljubljana',
  'sk-bratislava',
  'sm-san-marino',
  'sn-dakar',
  'sv-san-salvador',
  'th-pattaya',
  'tj-dushanbe',
  'tl-dili',
  'tm-ashgabat',
  'tn-tunis',
  'to-nukualofa',
  'tr-ankara',
  'tr-istanbul',
  'tr-izmir',
  'tv-funafuti',
  'tw-taipei',
  'tz-zanzibar',
  'ua-kyiv',
  'ua-odessa',
  'uk-liverpool',
  'us-albuquerque',
  'us-atlanta',
  'us-austin',
  'us-boston',
  'us-chicago',
  'us-cincinnati',
  'us-columbus',
  'us-denver',
  'us-hartford',
  'us-irvine',
  'us-los-angeles',
  'us-miami',
  'us-new-orleans',
  'us-new-york',
  'us-peoria',
  'us-philadelphia',
  'us-phoenix',
  'us-pittsburgh',
  'us-sacramento',
  'us-san-diego',
  'us-san-francisco',
  'us-seattle',
  'us-st-louis',
  'us-washington',
  'uy-montevideo',
  'uz-nukus',
  'uz-tashkent',
  'va-vatican',
  've-caracas',
  'vn-hanoi',
  'vn-vung-tau',
  'vu-port-vila',
  'ws-apia',
  'xk-pristina',
  'za-cape-town',
] as const

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function download(slug: string, force: boolean): Promise<string> {
  const outPath = join(OUT_DIR, `${slug}.svg`)
  if (!force && (await fileExists(outPath))) {
    return `skip ${slug}`
  }

  const url = `${BASE_URL}/${slug}.svg`
  const res = await fetch(url)
  if (!res.ok) {
    return `FAIL ${slug} (${res.status})`
  }

  const svg = await res.text()
  await writeFile(outPath, svg)
  return `ok   ${slug}`
}

async function main() {
  const force = process.argv.includes('--force')
  await mkdir(OUT_DIR, { recursive: true })

  console.log(
    `Downloading ${SLUGS.length} icons (force=${force}, concurrency=${CONCURRENCY})`,
  )

  let done = 0
  const results: string[] = []

  // Process in batches
  for (let i = 0; i < SLUGS.length; i += CONCURRENCY) {
    const batch = SLUGS.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map((slug) => download(slug, force)),
    )
    results.push(...batchResults)
    done += batch.length
    process.stdout.write(`\r  ${done}/${SLUGS.length}`)
  }

  console.log('\n')

  const failed = results.filter((r) => r.startsWith('FAIL'))
  const skipped = results.filter((r) => r.startsWith('skip'))
  const downloaded = results.filter((r) => r.startsWith('ok'))

  console.log(
    `Done: ${downloaded.length} downloaded, ${skipped.length} skipped, ${failed.length} failed`,
  )

  if (failed.length > 0) {
    console.log('\nFailed:')
    for (const f of failed) console.log(`  ${f}`)
    process.exit(1)
  }
}

main()
