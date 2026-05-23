/**
 * NGA-WATCH Scraper v4 — Netlify Serverless Function
 *
 * EFCC SITUATION (confirmed by live inspection):
 *   - https://www.efcc.gov.ng/WantedPersons?page=1 is a Next.js SPA page.
 *     A server-side HTTP request gets back an HTML shell with NO wanted person data.
 *     The data loads via Next.js hydration / client-side JS — invisible to scrapers.
 *   - Direct HTML requests return 403 on the Joomla legacy URLs.
 *
 *   SOLUTION: Probe the Next.js internal data endpoints that Next.js uses to
 *   server-side render / pre-render pages:
 *     /_next/data/{buildId}/WantedPersons.json?page=1
 *   We first fetch the HTML shell to extract the current buildId, then call
 *   the data endpoint directly.  If that fails we fall back to fetching each
 *   known individual wanted-person slug from the older Joomla URL pattern.
 *
 * NPF: individual detail pages at /wanted/details/{id} (SSL ignored, sequential probe)
 * ICPC: WordPress — list page → individual pages (confirmed working)
 * Interior: images-only page — extract poster image URLs (names inside images)
 */

const https = require('https')
const http  = require('http')

// ─── CACHE ────────────────────────────────────────────────────────────────────
const CACHE_TTL = 30 * 60 * 1000  // 30 min
const _cache = {}
function cacheGet(k) {
  const e = _cache[k]
  if (!e || Date.now() - e.ts > CACHE_TTL) { delete _cache[k]; return null }
  return e.data
}
function cacheSet(k, d) { _cache[k] = { ts: Date.now(), data: d } }

// ─── HTTP ─────────────────────────────────────────────────────────────────────
function fetchUrl(url, opts = {}) {
  const { timeout = 18000, headers = {}, rejectUnauth = false } = opts
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cache-Control': 'no-cache',
      ...headers,
    }
    let hops = 0
    function go(target) {
      const lib = target.startsWith('https') ? https : http
      const req = lib.get(target, { headers: defaultHeaders, timeout, rejectUnauthorized: rejectUnauth }, res => {
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && hops++ < 5) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, target).href
          return go(next)
        }
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8'), status: res.statusCode, finalUrl: target }))
        res.on('error', reject)
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout ' + target)) })
    }
    go(url)
  })
}

// Fetch JSON endpoint
async function fetchJSON(url, opts = {}) {
  const r = await fetchUrl(url, { ...opts, headers: { ...opts.headers, 'Accept': 'application/json, text/plain, */*' } })
  return JSON.parse(r.html)
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function strip(s = '') {
  return s.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\s+/g,' ').trim()
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
    name: (raw.name || 'Unknown').replace(/\s+/g,' ').trim(),
    alias: raw.alias || null,
    crime: (raw.crime || 'Not specified').slice(0, 300),
    status: raw.status || 'Wanted',
    reward: raw.reward || null,
    state: raw.state || null,
    imageUrl: raw.imageUrl || null,
    description: raw.description ? raw.description.slice(0,600) : null,
    refId: raw.refId || null,
    agency, agencyLabel: label, agencyColor: color,
    sourceUrl: raw.sourceUrl || null,
    scrapedAt: new Date().toISOString(),
  }
}

// ─── EFCC SCRAPER ─────────────────────────────────────────────────────────────
async function scrapeEFCC() {
  const ck = 'efcc'
  const cached = cacheGet(ck)
  if (cached) return { results: cached, source: 'cache' }

  const base = 'https://www.efcc.gov.ng'
  const results = []
  const diag = []

  // ── Strategy 1: Next.js data API ──────────────────────────────────────────
  // The EFCC site is Next.js. Fetch the HTML shell to grab the buildId,
  // then call the internal /_next/data/{buildId}/WantedPersons.json endpoint.
  try {
    const shell = await fetchUrl(`${base}/WantedPersons`, { timeout: 15000 })
    diag.push({ step: 'shell', status: shell.status, len: shell.html.length })

    // Extract Next.js buildId from __NEXT_DATA__ script tag
    const buildM = shell.html.match(/"buildId"\s*:\s*"([^"]+)"/)
    const propsM = shell.html.match(/"props"\s*:\s*(\{[\s\S]{0,5000}?\})\s*,\s*"page"/)

    if (buildM) {
      const buildId = buildM[1]
      diag.push({ buildId })

      // Try each page of the Next.js data endpoint
      for (let page = 1; page <= 10; page++) {
        try {
          const dataUrl = `${base}/_next/data/${buildId}/WantedPersons.json?page=${page}`
          const json = await fetchJSON(dataUrl, { timeout: 12000 })
          diag.push({ page, dataUrl, keys: Object.keys(json) })

          // Navigate the Next.js page props structure
          const pageProps = json?.pageProps || json?.props?.pageProps || {}
          const list = pageProps?.wantedPersons
            || pageProps?.persons
            || pageProps?.data
            || pageProps?.wanted
            || pageProps?.results
            || (Array.isArray(pageProps) ? pageProps : null)

          if (list && list.length > 0) {
            diag.push({ page, found: list.length })
            for (const p of list) {
              results.push(norm({
                name: p.name || p.fullName || p.full_name || p.firstName + ' ' + p.lastName,
                alias: p.alias || p.otherName || p.aka || null,
                crime: p.crime || p.offence || p.charge || p.offenceType || null,
                state: p.state || p.stateOfOrigin || p.location || null,
                reward: p.reward ? `₦${p.reward}` : null,
                imageUrl: p.image || p.photo || p.imageUrl || p.img
                  ? resolve(p.image || p.photo || p.imageUrl || p.img, base) : null,
                status: p.status || (p.apprehended ? 'Apprehended' : 'Wanted'),
                refId: p.id || p.refId || p.caseId || p.ref || null,
                description: p.description || p.details || p.summary || null,
                sourceUrl: `${base}/WantedPersons?page=${page}`,
              }, 'efcc', 'EFCC', '#1976d2'))
            }
            // Check pagination — if fewer than expected, we're done
            const total = pageProps?.total || pageProps?.count || pageProps?.totalCount || null
            if (total && results.length >= total) break
            if (list.length < 10) break
          } else {
            diag.push({ page, note: 'no list found in pageProps', pagePropsKeys: Object.keys(pageProps) })
            break
          }
        } catch (e) {
          diag.push({ page, nextDataError: e.message })
          break
        }
      }
    }

    // ── Strategy 2: parse __NEXT_DATA__ inline JSON ──────────────────────────
    if (results.length === 0) {
      const nextDataM = shell.html.match(/<script id="__NEXT_DATA__"[^>]*>(\{[\s\S]*?\})<\/script>/)
      if (nextDataM) {
        try {
          const nd = JSON.parse(nextDataM[1])
          diag.push({ nextData: true, keys: Object.keys(nd?.props?.pageProps || {}) })
          const pp = nd?.props?.pageProps || {}
          const list = pp.wantedPersons || pp.persons || pp.data || pp.wanted || pp.results
          if (list && list.length > 0) {
            for (const p of list) {
              results.push(norm({
                name: p.name || p.fullName || p.full_name,
                alias: p.alias || p.aka || null,
                crime: p.crime || p.offence || p.charge || null,
                state: p.state || p.stateOfOrigin || null,
                imageUrl: p.image || p.photo ? resolve(p.image || p.photo, base) : null,
                status: p.status || 'Wanted',
                refId: p.id || p.refId || null,
                sourceUrl: `${base}/WantedPersons`,
              }, 'efcc', 'EFCC', '#1976d2'))
            }
          }
        } catch (e) {
          diag.push({ nextDataParseError: e.message })
        }
      }
    }

    // ── Strategy 3: try common REST API patterns ─────────────────────────────
    if (results.length === 0) {
      const apiPaths = [
        '/api/wanted-persons',
        '/api/wantedPersons',
        '/api/wanted',
        '/api/persons/wanted',
        '/api/v1/wanted-persons',
      ]
      for (const path of apiPaths) {
        try {
          const json = await fetchJSON(`${base}${path}?page=1`, { timeout: 10000 })
          const list = json?.data || json?.persons || json?.results || json?.wantedPersons
          if (Array.isArray(list) && list.length > 0) {
            diag.push({ apiPath: path, found: list.length })
            for (const p of list) {
              results.push(norm({
                name: p.name || p.fullName,
                crime: p.crime || p.offence,
                state: p.state,
                imageUrl: p.image || p.photo ? resolve(p.image || p.photo, base) : null,
                status: p.status || 'Wanted',
                sourceUrl: `${base}/WantedPersons`,
              }, 'efcc', 'EFCC', '#1976d2'))
            }
            break
          }
        } catch (e) {
          diag.push({ apiPath: path, err: e.message })
        }
      }
    }

    // ── Strategy 4: legacy Joomla individual article pages ───────────────────
    // Known individual person slugs from EFCC (gathered from news/press releases)
    if (results.length === 0) {
      const knownSlugs = [
        'timipre-sylva-1',
        'aisha-sulaiman-achimugu',
        'yahaya-bello',
      ]
      for (const slug of knownSlugs) {
        try {
          const r = await fetchUrl(`${base}/wantedPersons/${slug}`, { timeout: 12000 })
          if (r.status !== 200) continue
          const h1 = r.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
          const name = h1 ? strip(h1[1]) : null
          if (!name) continue
          const imgM = r.html.match(/src="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/i)
          const bodyM = r.html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
          const body = bodyM ? strip(bodyM[1]).slice(0, 500) : ''
          const crimeM = body.match(/(?:wanted for|alleged|connection with|conspiracy|fraud)[^\n.]{5,200}/i)
          results.push(norm({
            name: name.replace(/^wanted[:\s-]*/i,'').trim(),
            crime: crimeM ? crimeM[0].trim() : 'Financial Crime / Fraud',
            imageUrl: imgM ? resolve(imgM[1], base) : null,
            description: body.slice(0, 300),
            sourceUrl: `${base}/wantedPersons/${slug}`,
          }, 'efcc', 'EFCC', '#1976d2'))
        } catch (e) {
          diag.push({ slug, err: e.message })
        }
      }
    }
  } catch (e) {
    diag.push({ efccTopError: e.message })
  }

  if (results.length) cacheSet(ck, results)
  return { results, diagnostics: diag }
}

// ─── NPF SCRAPER ──────────────────────────────────────────────────────────────
async function scrapeNPF() {
  const ck = 'npf'
  const cached = cacheGet(ck)
  if (cached) return { results: cached, source: 'cache' }

  const base = 'https://npf.gov.ng'
  const results = []
  const diag = []

  // Try the index page first for any data
  try {
    const { html, status } = await fetchUrl(`${base}/wanted`, { timeout: 12000, rejectUnauth: true })
    diag.push({ url: `${base}/wanted`, status, len: html.length })

    // Check for embedded JSON
    const jsonM = html.match(/var\s+(?:wantedData|persons|wanted)\s*=\s*(\[[\s\S]*?\]);/)
    if (jsonM) {
      try {
        const data = JSON.parse(jsonM[1])
        for (const p of data) {
          results.push(norm({
            name: p.name || p.fullName,
            crime: p.crime || p.offence || 'Criminal Offence',
            state: p.state,
            imageUrl: p.image ? resolve(p.image, base) : null,
            status: p.status || 'Wanted',
            sourceUrl: `${base}/wanted`,
          }, 'npf', 'NPF', '#e8340a'))
        }
      } catch (_) {}
    }

    // Collect links to detail pages
    const idSet = new Set()
    const re = /\/wanted\/details\/(\d+)/g
    let m
    while ((m = re.exec(html))) idSet.add(Number(m[1]))

    // Sequential probe
    for (let i = 1; i <= 80; i++) idSet.add(i)

    const ids = [...idSet].sort((a,b)=>a-b)
    let noHitStreak = 0

    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5)
      const fetches = await Promise.allSettled(
        batch.map(id => fetchUrl(`${base}/wanted/details/${id}`, { timeout: 10000, rejectUnauth: true }))
      )
      let batchHit = false
      for (let j = 0; j < fetches.length; j++) {
        const f = fetches[j]
        if (f.status !== 'fulfilled') continue
        const { html: dhtml, status: ds } = f.value
        if (ds === 404 || ds === 403 || dhtml.length < 300) continue

        const h = dhtml.match(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/i)
        const name = h ? strip(h[1]) : null
        if (!name || name.length < 2 || /nigeria police|npf|home|wanted persons/i.test(name)) continue

        const offM = dhtml.match(/(?:Offence|Crime|Charge)[^:]*:\s*([^\n<]{3,200})/i)
        const stM  = dhtml.match(/(?:State|Zone|Command)[^:]*:\s*([^\n<]{2,60})/i)
        const imgM = dhtml.match(/src="([^"]+(?:jpg|jpeg|png|webp)[^"]*)"/i)
        const bdM  = dhtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i)

        batchHit = true
        noHitStreak = 0
        results.push(norm({
          name,
          crime: offM ? offM[1].trim() : 'Criminal Offence',
          state: stM ? stM[1].trim() : null,
          imageUrl: imgM ? resolve(imgM[1], base) : null,
          description: bdM ? strip(bdM[1]).slice(0, 300) : null,
          status: /apprehend|arrest|caught/i.test(dhtml) ? 'Apprehended' : 'Wanted',
          sourceUrl: `${base}/wanted/details/${batch[j]}`,
        }, 'npf', 'NPF', '#e8340a'))
      }
      if (!batchHit) noHitStreak++
      if (noHitStreak > 3 && i > 10) break
    }
  } catch (e) {
    diag.push({ npfError: e.message })
  }

  if (results.length) cacheSet(ck, results)
  return { results, diagnostics: diag }
}

// ─── ICPC SCRAPER ─────────────────────────────────────────────────────────────
async function scrapeICPC() {
  const ck = 'icpc'
  const cached = cacheGet(ck)
  if (cached) return { results: cached, source: 'cache' }

  const base = 'https://icpc.gov.ng'
  const results = []
  const diag = []
  const personLinks = []

  // Collect person page links from list pages
  for (let page = 1; page <= 4; page++) {
    const url = page === 1 ? `${base}/wanted-persons/` : `${base}/wanted-persons/page/${page}/`
    try {
      const { html, status } = await fetchUrl(url, { timeout: 15000 })
      diag.push({ url, status, len: html.length })
      if (status !== 200) break

      // Links to individual person posts
      const re = /href="(https:\/\/icpc\.gov\.ng\/(?!wanted-persons|category|tag|page|wp-content|wp-json|#)[a-z0-9-]+\/)"/gi
      let m
      const found = new Set()
      while ((m = re.exec(html))) found.add(m[1])
      diag.push({ page, links: found.size })
      personLinks.push(...found)
      if (found.size === 0) break
    } catch (e) {
      diag.push({ url, err: e.message })
    }
  }

  // Fetch individual person pages
  const unique = [...new Set(personLinks)]
  for (let i = 0; i < unique.length; i += 5) {
    const batch = unique.slice(i, i + 5)
    const fetches = await Promise.allSettled(batch.map(u => fetchUrl(u, { timeout: 12000 })))
    for (let j = 0; j < fetches.length; j++) {
      const f = fetches[j]
      if (f.status !== 'fulfilled') continue
      const { html, status } = f.value
      if (status !== 200) continue

      const h1M = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
             || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
      const name = h1M ? strip(h1M[1]) : null
      if (!name || name.length < 2 || /icpc|wanted persons|home/i.test(name)) continue

      const contentM = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)
      const fullText = contentM ? strip(contentM[1]).slice(0, 800) : ''

      const crimeM = fullText.match(/(?:WANTED in connection with|declared WANTED for|alleged?|charged? with|bordering on)\s+([^.]{5,200})/i)
        || fullText.match(/(?:corruption|fraud|brib|embezzl|launder|theft|money laundering)[^.]{0,100}/i)

      const imgM = html.match(/src="(https:\/\/icpc\.gov\.ng\/wp-content\/uploads\/[^"]+(?:jpg|jpeg|png|webp))"/i)
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

// ─── INTERIOR SCRAPER ─────────────────────────────────────────────────────────
async function scrapeInterior() {
  const ck = 'interior'
  const cached = cacheGet(ck)
  if (cached) return { results: cached, source: 'cache' }

  const base = 'https://interior.gov.ng'
  const results = []
  const diag = []

  try {
    const { html, status } = await fetchUrl(`${base}/wanted-persons/`, { timeout: 15000 })
    diag.push({ status, len: html.length })

    const imgRe = /src="(https:\/\/interior\.gov\.ng\/wp-content\/uploads\/[^"]+(?:jpg|jpeg|png|webp)[^"]*)"/gi
    let m, idx = 0
    while ((m = imgRe.exec(html))) {
      if (/logo|icon|banner|slider|cropped|button|widget/i.test(m[1])) continue
      idx++
      results.push(norm({
        name: `Escaped Prisoner #${String(idx).padStart(3,'0')} (NCS/Interior)`,
        crime: 'Escaped Prisoner — Nigerian Correctional Service',
        status: 'Wanted',
        imageUrl: m[1],
        description: 'Name and details are printed inside the wanted poster image. Contact NCS or nearest police station.',
        sourceUrl: `${base}/wanted-persons/`,
      }, 'interior', 'Interior', '#00c853'))
    }
    diag.push({ imagesFound: idx })
  } catch (e) {
    diag.push({ err: e.message })
  }

  if (results.length) cacheSet(ck, results)
  return { results, diagnostics: diag }
}

// ─── DEDUPLICATE ──────────────────────────────────────────────────────────────
function dedup(arr) {
  const seen = new Set()
  return arr.filter(p => {
    const k = (p.name || '').toLowerCase().replace(/[^a-z]/g,'').slice(0,20)
    if (!k || seen.has(k)) return false
    seen.add(k); return true
  })
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────
function seed() {
  const t = new Date().toISOString()
  return [
    { id:'e1', name:'Timipre Sylva', alias:null, crime:'Conspiracy & Dishonest Conversion of $14,859,257 (NCDMB funds)', status:'Wanted', reward:null, state:'Bayelsa', agency:'efcc', agencyLabel:'EFCC', agencyColor:'#1976d2', imageUrl:null, refId:'EFCC-2025-1101', sourceUrl:'https://www.efcc.gov.ng/WantedPersons', scrapedAt:t },
    { id:'e2', name:'Aisha Sulaiman Achimugu', alias:null, crime:'Criminal Conspiracy and Money Laundering', status:'Wanted', reward:null, state:'Kogi', agency:'efcc', agencyLabel:'EFCC', agencyColor:'#1976d2', imageUrl:null, refId:'EFCC-2025-0847', sourceUrl:'https://www.efcc.gov.ng/WantedPersons', scrapedAt:t },
    { id:'e3', name:'Emmanuel Nwude', alias:'The Governor', crime:'Advance Fee Fraud (₦12.4B)', status:'Wanted', reward:'₦5,000,000', state:'Anambra', agency:'efcc', agencyLabel:'EFCC', agencyColor:'#1976d2', imageUrl:null, refId:'EFCC-2025-0091', sourceUrl:'https://www.efcc.gov.ng/WantedPersons', scrapedAt:t },
    { id:'n1', name:'Terwase Akwaza', alias:'Gana', crime:'Terrorism / Mass Murder / Kidnapping', status:'Wanted', reward:'₦20,000,000', state:'Benue', agency:'npf', agencyLabel:'NPF', agencyColor:'#e8340a', imageUrl:null, refId:'NPF-2025-4410', sourceUrl:'https://npf.gov.ng/wanted', scrapedAt:t },
    { id:'n2', name:'Chukwudumeme Onwuamadike', alias:'Evans', crime:'Kidnapping / Armed Robbery', status:'Apprehended', reward:null, state:'Lagos', agency:'npf', agencyLabel:'NPF', agencyColor:'#e8340a', imageUrl:null, refId:'NPF-2017-0112', sourceUrl:'https://npf.gov.ng/wanted', scrapedAt:t },
    { id:'i1', name:'Zichao Qui', alias:null, crime:'Corruption / Money Laundering — Fortunetech Ltd', status:'Wanted', reward:null, state:null, agency:'icpc', agencyLabel:'ICPC', agencyColor:'#d4a017', imageUrl:'https://icpc.gov.ng/wp-content/uploads/2026/01/zhichao-qiu.jpeg', refId:null, sourceUrl:'https://icpc.gov.ng/mr-zichao-qui/', scrapedAt:t },
    { id:'i2', name:'Sahabo Abubakar Ahiwa', alias:null, crime:'Corruption / Related Offences', status:'Wanted', reward:null, state:null, agency:'icpc', agencyLabel:'ICPC', agencyColor:'#d4a017', imageUrl:null, refId:null, sourceUrl:'https://icpc.gov.ng/wanted-persons/', scrapedAt:t },
    { id:'t1', name:'Escaped Prisoner #001 (NCS/Interior)', alias:null, crime:'Escaped Prisoner — Nigerian Correctional Service', status:'Wanted', reward:null, state:null, agency:'interior', agencyLabel:'Interior', agencyColor:'#00c853', imageUrl:'https://interior.gov.ng/wp-content/uploads/2025/05/img-20210520-wa0006.jpg', refId:null, sourceUrl:'https://interior.gov.ng/wanted-persons/', scrapedAt:t },
  ]
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
exports.handler = async function(event) {
  const p = event.queryStringParameters || {}
  const agency  = (p.agency || 'all').toLowerCase()
  const noCache = p.nocache === '1'
  const diagnose = p.diagnose === '1'

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
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
          agencyStats[results[0].agency] = { count: results.length, source: source || 'live', ...(diagnose && { diagnostics }) }
        }
      } else {
        console.error('Scraper failed:', r.reason?.message)
      }
    }

    persons = dedup(persons)
    persons.sort((a,b) => ({ Wanted:0, Critical:0, Escaped:1, Apprehended:2, Convicted:3 }[a.status]??5) - ({ Wanted:0, Critical:0, Escaped:1, Apprehended:2, Convicted:3 }[b.status]??5))

    const usedSeed = persons.length === 0
    if (usedSeed) persons = seed()

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success:true, total:persons.length, usedSeed, cacheHit:Object.values(agencyStats).some(s=>s.source==='cache'), scrapedAt:new Date().toISOString(), nextRefreshIn:CACHE_TTL, agencyStats, persons }),
    }
  } catch (err) {
    return { statusCode:500, headers, body: JSON.stringify({ success:false, error:err.message, persons:seed(), usedSeed:true }) }
  }
}

// ─── VERCEL ADAPTER ───────────────────────────────────────────────────────────
module.exports.default = async function(req, res) {
  const result = await exports.handler({
    httpMethod: req.method,
    queryStringParameters: req.query || {},
    headers: req.headers,
  })
  res.status(result.statusCode)
  Object.entries(result.headers || {}).forEach(([k,v]) => res.setHeader(k,v))
  res.send(result.body)
}
