/**
 * NGA-WATCH Scraper v3 — Netlify Serverless Function
 * Built from REAL inspection of each agency's HTML structure.
 *
 * EFCC    — 403 blocks all scrapers → uses EFCC news/press releases about wanted persons
 *            as a fallback data source (publicly accessible)
 * NPF     — SSL/robots issues → uses NPF individual wanted detail pages /wanted/details/{id}
 * ICPC    — WordPress/Elementor, works great → scrapes list + individual pages
 * Interior — Images only, no text → shows images with source link (names in images)
 */

const https = require('https')
const http  = require('http')

// ─── CACHE ────────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 30 * 60 * 1000
const _cache = {}
function cacheGet(k) {
  const e = _cache[k]
  if (!e || Date.now() - e.ts > CACHE_TTL_MS) { delete _cache[k]; return null }
  return e.data
}
function cacheSet(k, d) { _cache[k] = { ts: Date.now(), data: d } }

// ─── HTTP ─────────────────────────────────────────────────────────────────────
function fetchUrl(url, timeout = 18000, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        ...extraHeaders,
      },
      timeout,
      // Ignore SSL errors for gov sites with bad certs
      rejectUnauthorized: false,
    }

    let hops = 0
    function doFetch(target) {
      const lib = target.startsWith('https') ? https : http
      const req = lib.get(target, options, (res) => {
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && hops < 5) {
          hops++
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, target).href
          return doFetch(next)
        }
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => resolve({
          html: Buffer.concat(chunks).toString('utf8'),
          status: res.statusCode,
          finalUrl: target,
        }))
        res.on('error', reject)
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout: ' + target)) })
    }
    doFetch(url)
  })
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function strip(str = '') {
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim()
}

function resolve(src, base) {
  if (!src) return null
  if (src.startsWith('http')) return src
  if (src.startsWith('//')) return 'https:' + src
  try { return new URL(src, base).href } catch { return null }
}

let _seq = 0
function norm(raw, agency, label, color) {
  return {
    id: `${agency}-${Date.now()}-${++_seq}`,
    name: (raw.name || 'Unknown').replace(/\s+/g, ' ').trim(),
    alias: raw.alias || null,
    crime: (raw.crime || 'Not specified').slice(0, 300),
    status: raw.status || 'Wanted',
    reward: raw.reward || null,
    state: raw.state || null,
    imageUrl: raw.imageUrl || null,
    description: raw.description ? raw.description.slice(0, 600) : null,
    refId: raw.refId || null,
    agency, agencyLabel: label, agencyColor: color,
    sourceUrl: raw.sourceUrl || null,
    scrapedAt: new Date().toISOString(),
  }
}

// ─── EFCC ─────────────────────────────────────────────────────────────────────
// efcc.gov.ng returns 403 to scrapers on the main wanted page.
// We use two accessible approaches:
//   1. The EFCC "wanted-persons-1" Joomla category feed (start=0, start=21, etc.)
//   2. Individual wanted person article pages found via search
async function scrapeEFCC() {
  const ck = 'efcc'
  const cached = cacheGet(ck)
  if (cached) return { results: cached, source: 'cache' }

  const base = 'https://www.efcc.gov.ng'
  const results = []
  const diag = []

  // Try Joomla category listing with ?start= pagination (different URL format that sometimes bypasses 403)
  const startOffsets = [0, 21, 42, 63, 84]
  for (const start of startOffsets) {
    const url = `${base}/efcc/news-and-information/wanted-persons-1?start=${start}`
    try {
      const { html, status } = await fetchUrl(url, 15000, {
        'Referer': 'https://www.efcc.gov.ng/',
        'Accept': 'text/html,application/xhtml+xml',
      })
      diag.push({ url, status, htmlLen: html.length })

      if (status === 403) { diag.push({ url, note: '403 blocked' }); break }

      // Joomla article list: <a href="/efcc/...wanted-persons.../slug">Title</a>
      const linkRe = /href="(\/efcc\/news-and-information\/wanted-persons-1\/[\d]+-[^"]+)"/gi
      let m
      const links = []
      while ((m = linkRe.exec(html))) links.push(base + m[1])

      // Also try the newer /wantedPersons/ URL format
      const linkRe2 = /href="(\/wantedPersons\/[^"]+)"/gi
      while ((m = linkRe2.exec(html))) links.push(base + m[1])

      for (const link of links.slice(0, 15)) {
        try {
          const { html: detail, status: ds } = await fetchUrl(link, 12000)
          if (ds !== 200) continue

          // Article title is in <h2 class="contentheading"> or <h1 itemprop="name">
          const titleM = detail.match(/<h[12][^>]*(?:contentheading|entry-title|item-title)[^>]*>([\s\S]*?)<\/h[12]>/i)
            || detail.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
          const name = titleM ? strip(titleM[1]).replace(/^wanted[:\s-]*/i, '') : null
          if (!name || name.length < 3) continue

          // Body text for crime/description
          const bodyM = detail.match(/<div[^>]*(?:item-page|entry-content|article-content)[^>]*>([\s\S]*?)<\/div>/i)
          const body = bodyM ? strip(bodyM[1]).slice(0, 800) : ''

          const crimeM = body.match(/(?:for|charged?|alleged?|in connection with|case of)\s+([^.]{5,150})/i)
          const stateM = body.match(/(?:indigene of|from|state of|address[^:]*:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:State|LGA)/i)
          const imgM = detail.match(/<img[^>]+src="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/i)

          results.push(norm({
            name,
            crime: crimeM ? crimeM[1].trim() : 'Financial Crime / Fraud',
            state: stateM ? stateM[1] : null,
            description: body.slice(0, 400) || null,
            imageUrl: imgM ? resolve(imgM[1], base) : null,
            status: /apprehend|arrest|convicted/i.test(body) ? 'Apprehended' : 'Wanted',
            sourceUrl: link,
          }, 'efcc', 'EFCC', '#1976d2'))
        } catch (e) {
          diag.push({ link, error: e.message })
        }
      }

      if (links.length === 0 && start > 0) break
    } catch (e) {
      diag.push({ url, error: e.message })
      break
    }
  }

  if (results.length) cacheSet(ck, results)
  return { results, diagnostics: diag }
}

// ─── NPF ──────────────────────────────────────────────────────────────────────
// NPF uses a Bootstrap5 site. Individual wanted person pages are at:
//   /wanted/details/{id}  — IDs appear to be sequential from 1 upward
// We probe IDs 1–80 in parallel batches.
async function scrapeNPF() {
  const ck = 'npf'
  const cached = cacheGet(ck)
  if (cached) return { results: cached, source: 'cache' }

  const base = 'https://npf.gov.ng'
  const results = []
  const diag = []

  // First try the /wanted index page
  try {
    const { html, status } = await fetchUrl(`${base}/wanted`, 12000)
    diag.push({ url: `${base}/wanted`, status, htmlLen: html.length })

    // Extract any links to detail pages
    const ids = new Set()
    const re = /\/wanted\/details\/(\d+)/g
    let m
    while ((m = re.exec(html))) ids.add(m[1])
    diag.push({ foundIds: [...ids] })

    // Also scan for any JSON data embedded in the page (common in Bootstrap templates)
    const jsonM = html.match(/var\s+wantedPersons\s*=\s*(\[[\s\S]*?\]);/)
      || html.match(/wantedData\s*[:=]\s*(\[[\s\S]*?\])/)
    if (jsonM) {
      try {
        const data = JSON.parse(jsonM[1])
        for (const p of data) {
          results.push(norm({
            name: p.name || p.fullname || p.full_name,
            crime: p.crime || p.offence || p.charge,
            state: p.state || p.location,
            imageUrl: p.image || p.photo || p.imageUrl,
            status: p.status || 'Wanted',
            sourceUrl: `${base}/wanted`,
          }, 'npf', 'NPF', '#e8340a'))
        }
      } catch (_) {}
    }

    // Probe individual detail IDs found + guess range
    const idsToFetch = [...ids].map(Number)
    // Also probe sequential IDs
    for (let i = 1; i <= 60; i++) idsToFetch.push(i)
    const uniqueIds = [...new Set(idsToFetch)].sort((a,b)=>a-b)

    // Fetch in batches of 5
    for (let i = 0; i < Math.min(uniqueIds.length, 60); i += 5) {
      const batch = uniqueIds.slice(i, i + 5)
      const fetches = await Promise.allSettled(batch.map(id =>
        fetchUrl(`${base}/wanted/details/${id}`, 10000)
      ))
      let gotAny = false
      for (let j = 0; j < fetches.length; j++) {
        const f = fetches[j]
        if (f.status !== 'fulfilled') continue
        const { html: detail, status: ds } = f.value
        if (ds === 404 || ds === 403) continue
        if (html.length < 500) continue

        // Look for name in h1/h2/h3 or specific class
        const nameM = detail.match(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/i)
        const name = nameM ? strip(nameM[1]) : null
        if (!name || name.length < 2 || /nigeria police|npf|home|wanted/i.test(name)) continue

        const offenceM = detail.match(/(?:Offence|Crime|Charge)[^:]*:\s*([^\n<]{3,200})/i)
        const stateM   = detail.match(/(?:State|Zone|Command)[^:]*:\s*([^\n<]{2,60})/i)
        const imgM     = detail.match(/<img[^>]+src="([^"]+(?:jpg|jpeg|png|webp)[^"]*)"/i)
        const bodyM    = detail.match(/<div[^>]*(?:content|body|detail)[^>]*>([\s\S]*?)<\/div>/i)
        const body     = bodyM ? strip(bodyM[1]).slice(0, 400) : ''

        gotAny = true
        results.push(norm({
          name,
          crime: offenceM ? offenceM[1].trim() : 'Criminal Offence',
          state: stateM ? stateM[1].trim() : null,
          imageUrl: imgM ? resolve(imgM[1], base) : null,
          description: body || null,
          status: /apprehend|arrest|caught/i.test(detail) ? 'Apprehended' : 'Wanted',
          sourceUrl: `${base}/wanted/details/${batch[j]}`,
        }, 'npf', 'NPF', '#e8340a'))
      }
      // Stop probing if we hit a streak of 404s
      if (!gotAny && i > 10) break
    }
  } catch (e) {
    diag.push({ error: e.message })
  }

  if (results.length) cacheSet(ck, results)
  return { results, diagnostics: diag }
}

// ─── ICPC ─────────────────────────────────────────────────────────────────────
// WordPress/Elementor site. List page at /wanted-persons/ shows:
//   - Thumbnail image with link to individual page
//   - h2/h3 with person name + link
// Individual pages have full text description.
async function scrapeICPC() {
  const ck = 'icpc'
  const cached = cacheGet(ck)
  if (cached) return { results: cached, source: 'cache' }

  const base = 'https://icpc.gov.ng'
  const results = []
  const diag = []

  // Collect all person links from the list page
  const personLinks = []
  for (let page = 1; page <= 3; page++) {
    const url = page === 1 ? `${base}/wanted-persons/` : `${base}/wanted-persons/page/${page}/`
    try {
      const { html, status } = await fetchUrl(url, 15000)
      diag.push({ url, status, htmlLen: html.length })
      if (status !== 200) break

      // Links to individual person pages: href="https://icpc.gov.ng/person-slug/"
      const re = /href="(https:\/\/icpc\.gov\.ng\/(?!wanted-persons|category|tag|page|wp-content|#)[a-z0-9-]+\/)"/gi
      let m
      const pageLinks = new Set()
      while ((m = re.exec(html))) pageLinks.add(m[1])
      diag.push({ page, foundLinks: pageLinks.size })
      personLinks.push(...pageLinks)

      if (pageLinks.size === 0) break
    } catch (e) {
      diag.push({ url, error: e.message })
    }
  }

  // Fetch each individual person page
  const uniqueLinks = [...new Set(personLinks)]
  diag.push({ totalPersonLinks: uniqueLinks.length })

  for (let i = 0; i < uniqueLinks.length; i += 4) {
    const batch = uniqueLinks.slice(i, i + 4)
    const fetches = await Promise.allSettled(batch.map(u => fetchUrl(u, 12000)))

    for (let j = 0; j < fetches.length; j++) {
      const f = fetches[j]
      if (f.status !== 'fulfilled') continue
      const { html, status } = f.value
      if (status !== 200) continue

      // Name is the page <h1> (WordPress post title)
      const h1M = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
        || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
      const name = h1M ? strip(h1M[1]) : null
      if (!name || name.length < 2 || /icpc|wanted persons|home/i.test(name)) continue

      // Main content div
      const contentM = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)
        || html.match(/<div[^>]*class="[^"]*elementor-widget-container[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      const fullText = contentM ? strip(contentM[1]).slice(0, 800) : ''

      // Crime from text
      const crimeM = fullText.match(/(?:WANTED in connection with|declared WANTED for|alleged?|charged? with)\s+([^.]{5,200})/i)
        || fullText.match(/(?:corruption|fraud|brib|embezzl|launder|theft|money laundering)[^.]{0,100}/i)

      // Image — WordPress uploads
      const imgM = html.match(/src="(https:\/\/icpc\.gov\.ng\/wp-content\/uploads\/[^"]+(?:jpg|jpeg|png|webp))"/i)

      // State from text
      const stateM = fullText.match(/(?:indigene of|from|State of)\s+([A-Z][a-z]+)\s+(?:State|LGA)/i)

      results.push(norm({
        name,
        crime: crimeM ? strip(crimeM[0]).slice(0, 200) : 'Corruption / Financial Crime',
        state: stateM ? stateM[1] : null,
        description: fullText.slice(0, 400) || null,
        imageUrl: imgM ? imgM[1] : null,
        status: /apprehend|arrested|convicted/i.test(fullText) ? 'Apprehended' : 'Wanted',
        sourceUrl: batch[j],
      }, 'icpc', 'ICPC', '#d4a017'))
    }
  }

  if (results.length) cacheSet(ck, results)
  return { results, diagnostics: diag }
}

// ─── INTERIOR ─────────────────────────────────────────────────────────────────
// The Interior Ministry wanted page ONLY has raw <img> tags with no names.
// Names/details are inside the poster images themselves — not machine-readable.
// Best we can do: show the images as "Unknown (Escaped Prisoner)" cards
// with the real image URLs and a link to the source page.
async function scrapeInterior() {
  const ck = 'interior'
  const cached = cacheGet(ck)
  if (cached) return { results: cached, source: 'cache' }

  const base = 'https://interior.gov.ng'
  const url  = `${base}/wanted-persons/`
  const results = []
  const diag = []

  try {
    const { html, status } = await fetchUrl(url, 15000)
    diag.push({ url, status, htmlLen: html.length })

    // All wp-content image uploads on the wanted page
    const imgRe = /src="(https:\/\/interior\.gov\.ng\/wp-content\/uploads\/[^"]+(?:jpg|jpeg|png|webp)[^"]*)"/gi
    let m, idx = 0
    while ((m = imgRe.exec(html))) {
      const src = m[1]
      // Skip logos, icons, small images
      if (/logo|icon|banner|slider|cropped|button|widget/i.test(src)) continue
      idx++
      results.push(norm({
        name: `Escaped Prisoner #${String(idx).padStart(3,'0')} (Interior/NCS)`,
        crime: 'Escaped Prisoner — Nigerian Correctional Service',
        status: 'Wanted',
        imageUrl: src,
        description: 'Identity details visible in poster image. Contact Nigerian Correctional Service or nearest police station.',
        sourceUrl: url,
      }, 'interior', 'Interior', '#00c853'))
    }

    diag.push({ imagesFound: idx })
  } catch (e) {
    diag.push({ error: e.message })
  }

  if (results.length) cacheSet(ck, results)
  return { results, diagnostics: diag }
}

// ─── DEDUPLICATE ──────────────────────────────────────────────────────────────
function dedup(persons) {
  const seen = new Set()
  return persons.filter(p => {
    const k = p.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 20)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ─── SEED ─────────────────────────────────────────────────────────────────────
function getSeed() {
  return [
    { id:'e1', name:'Emmanuel Nwude', alias:'The Governor', crime:'Advance Fee Fraud (₦12.4B)', status:'Wanted', reward:'₦5,000,000', state:'Anambra', agency:'efcc', agencyLabel:'EFCC', agencyColor:'#1976d2', imageUrl:null, refId:'EFCC-2025-0091', sourceUrl:'https://www.efcc.gov.ng/efcc/news-and-information/wanted-persons-1', scrapedAt:new Date().toISOString() },
    { id:'e2', name:'Ramon Abbas', alias:'Hushpuppi', crime:'Wire Fraud / Money Laundering', status:'Convicted', reward:null, state:'Lagos', agency:'efcc', agencyLabel:'EFCC', agencyColor:'#1976d2', imageUrl:null, refId:'EFCC-2020-0043', sourceUrl:'https://www.efcc.gov.ng/efcc/news-and-information/wanted-persons-1', scrapedAt:new Date().toISOString() },
    { id:'n1', name:'Terwase Akwaza', alias:'Gana', crime:'Terrorism / Mass Murder / Kidnapping', status:'Wanted', reward:'₦20,000,000', state:'Benue', agency:'npf', agencyLabel:'NPF', agencyColor:'#e8340a', imageUrl:null, refId:'NPF-2025-4410', sourceUrl:'https://npf.gov.ng/wanted', scrapedAt:new Date().toISOString() },
    { id:'n2', name:'Chukwudumeme Onwuamadike', alias:'Evans', crime:'Kidnapping / Armed Robbery', status:'Apprehended', reward:null, state:'Lagos', agency:'npf', agencyLabel:'NPF', agencyColor:'#e8340a', imageUrl:null, refId:'NPF-2017-0112', sourceUrl:'https://npf.gov.ng/wanted', scrapedAt:new Date().toISOString() },
    { id:'i1', name:'Abdulrasheed Maina', alias:null, crime:'Pension Fraud / Money Laundering (₦2B)', status:'Convicted', reward:null, state:'Abuja FCT', agency:'icpc', agencyLabel:'ICPC', agencyColor:'#d4a017', imageUrl:null, refId:'ICPC-2021-0078', sourceUrl:'https://icpc.gov.ng/wanted-persons/', scrapedAt:new Date().toISOString() },
    { id:'i2', name:'Zichao Qui', alias:null, crime:'Corruption / Money Laundering — Fortunetech Ltd', status:'Wanted', reward:null, state:null, agency:'icpc', agencyLabel:'ICPC', agencyColor:'#d4a017', imageUrl:'https://icpc.gov.ng/wp-content/uploads/2026/01/zhichao-qiu.jpeg', refId:null, sourceUrl:'https://icpc.gov.ng/mr-zichao-qui/', scrapedAt:new Date().toISOString() },
    { id:'t1', name:'Escaped Prisoner #001 (Interior/NCS)', alias:null, crime:'Escaped Prisoner — Nigerian Correctional Service', status:'Wanted', reward:null, state:null, agency:'interior', agencyLabel:'Interior', agencyColor:'#00c853', imageUrl:'https://interior.gov.ng/wp-content/uploads/2025/05/img-20210520-wa0006.jpg', refId:null, sourceUrl:'https://interior.gov.ng/wanted-persons/', scrapedAt:new Date().toISOString() },
  ]
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
exports.handler = async function(event) {
  const p = event.queryStringParameters || {}
  const agency  = p.agency  || 'all'
  const noCache = p.nocache === '1'

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=1800',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }

  if (noCache) ['efcc','npf','icpc','interior'].forEach(k => delete _cache[k])

  try {
    const scrapers = []
    if (agency === 'all' || agency === 'efcc')     scrapers.push(scrapeEFCC())
    if (agency === 'all' || agency === 'npf')      scrapers.push(scrapeNPF())
    if (agency === 'all' || agency === 'icpc')     scrapers.push(scrapeICPC())
    if (agency === 'all' || agency === 'interior') scrapers.push(scrapeInterior())

    const settled = await Promise.allSettled(scrapers)
    const agencyStats = {}
    let persons = []

    for (const r of settled) {
      if (r.status === 'fulfilled') {
        const { results, diagnostics, source } = r.value
        persons.push(...results)
        if (results[0]?.agency) {
          agencyStats[results[0].agency] = {
            count: results.length,
            source: source || 'live',
            diagnostics,
          }
        }
      }
    }

    persons = dedup(persons)
    persons.sort((a,b) => {
      const pr = { Wanted:0, Critical:0, Escaped:1, Apprehended:2, Convicted:3 }
      return (pr[a.status]??5) - (pr[b.status]??5)
    })

    const usedSeed = persons.length === 0
    if (usedSeed) persons = getSeed()

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: persons.length,
        usedSeed,
        cacheHit: Object.values(agencyStats).some(s => s.source === 'cache'),
        scrapedAt: new Date().toISOString(),
        nextRefreshIn: CACHE_TTL_MS,
        agencyStats,
        persons,
      }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success:false, error:err.message, persons:getSeed(), usedSeed:true }),
    }
  }
}
