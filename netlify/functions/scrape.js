/**
 * NGA-WATCH — Netlify Serverless Scraper  v4.0
 * ─────────────────────────────────────────────
 * Built from live HTML/markdown inspection of each agency (May 2025):
 *
 * ICPC:    WordPress/Elementor. web_fetch returns markdown where every person
 *          appears as two consecutive lines:
 *            [![img-title](IMAGE_URL)](DETAIL_URL)
 *            # [FULL NAME](DETAIL_URL)
 *          29 persons confirmed on single page.
 *
 * EFCC:    Joomla CMS. Real URL = /efcc/news-and-information/wanted-persons-1
 *          Paginated ?start=0, ?start=18, ?start=36 … (18 per page, ~60+ total).
 *          Site returns 403 to Node fetch; must use allorigins.win proxy.
 *          Each item: <div class="items-row"> with <img> and <a> title.
 *
 * Interior: WordPress. Raw <img> tags only, no names. ~18 images.
 *
 * NPF:     Standard WordPress. Articles with <h2>/<h3> names + <img>.
 */

const https = require('https')
const http  = require('http')

// ─── HTTP FETCH ───────────────────────────────────────────────────────────────
function fetchUrl(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      timeout: timeoutMs,
    }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href
        return fetchUrl(next, timeoutMs).then(resolve).catch(reject)
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8'), status: res.statusCode }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout: ' + url)) })
  })
}

// Fetch via allorigins.win proxy (bypasses 403 on EFCC)
async function fetchViaProxy(url, timeoutMs = 18000) {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&timestamp=${Date.now()}`
  const res = await fetchUrl(proxyUrl, timeoutMs)
  const json = JSON.parse(res.html)
  if (!json.contents) throw new Error('Proxy returned empty contents for ' + url)
  return { html: json.contents, status: 200 }
}

function strip(str) {
  return (str || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
    .replace(/\s+/g, ' ').trim()
}

let uid = 0
function record(raw, agency, agencyLabel, agencyColor) {
  return {
    id:          `${agency}-${Date.now()}-${++uid}`,
    name:        (raw.name || 'Unknown').replace(/\s+/g, ' ').trim(),
    alias:       raw.alias  || null,
    crime:       raw.crime  || 'Not specified',
    status:      raw.status || 'Wanted',
    reward:      raw.reward || null,
    state:       raw.state  || null,
    imageUrl:    raw.imageUrl || null,
    description: raw.description || null,
    refId:       raw.refId  || null,
    agency, agencyLabel, agencyColor,
    sourceUrl:   raw.sourceUrl || null,
    scrapedAt:   new Date().toISOString(),
  }
}

// ─── ICPC ─────────────────────────────────────────────────────────────────────
// The page renders as markdown-like text where each person is two lines:
//   [![img-alt](https://icpc.gov.ng/wp-content/.../thumbs/xxx.jpeg "title")](https://icpc.gov.ng/slug/)
//   # [FULL NAME](https://icpc.gov.ng/slug/)
//
// We parse both raw HTML img+link pairs AND the rendered markdown fallback.
async function scrapeICPC() {
  const url = 'https://icpc.gov.ng/wanted-persons/'
  const { html } = await fetchUrl(url)
  const results = []
  const seen = new Set()

  // Strategy A: parse raw HTML for the elementor image+link pattern
  // Pattern: <a href="https://icpc.gov.ng/SLUG/"><img ... src="URL" title="NAME" ...></a>
  // Followed nearby by: <h1 ...><a href="https://icpc.gov.ng/SLUG/">NAME</a></h1>
  //
  // Step 1: collect all (detailUrl -> imageUrl) from img-inside-link blocks
  const imgLinkRe = /<a\s+href="(https:\/\/icpc\.gov\.ng\/[^"#?]+\/)"[^>]*>\s*<img[^>]+src="(https:\/\/icpc\.gov\.ng\/wp-content\/uploads\/elementor\/thumbs\/[^"]+)"[^>]*(?:title="([^"]*)")?[^>]*>\s*<\/a>/gi
  const imgMap = new Map() // detailUrl -> {imageUrl, titleFromImg}
  let m
  while ((m = imgLinkRe.exec(html)) !== null) {
    const detailUrl = m[1]
    const imageUrl  = m[2]
    const imgTitle  = m[3] ? strip(m[3]) : ''
    if (!imgMap.has(detailUrl)) imgMap.set(detailUrl, { imageUrl, imgTitle })
  }

  // Step 2: collect all (detailUrl -> name) from heading links
  const headingRe = /<h[123][^>]*>\s*<a\s+href="(https:\/\/icpc\.gov\.ng\/[^"#?]+\/)"[^>]*>([\s\S]*?)<\/a>\s*<\/h[123]>/gi
  const nameMap = new Map()
  while ((m = headingRe.exec(html)) !== null) {
    const detailUrl = m[1]
    const name      = strip(m[2])
    if (name && name.length > 1 && !nameMap.has(detailUrl)) nameMap.set(detailUrl, name)
  }

  // Step 3: merge — prefer name from heading, fall back to img title
  const allUrls = new Set([...imgMap.keys(), ...nameMap.keys()])
  for (const detailUrl of allUrls) {
    if (seen.has(detailUrl)) continue
    seen.add(detailUrl)
    const img  = imgMap.get(detailUrl)
    const name = nameMap.get(detailUrl) || (img && img.imgTitle) || 'Unknown'
    // Skip navigation/menu links that sneak in
    if (/wanted-persons|icpc\.gov\.ng\/$|contact|about|special|download|news|gallery|faq|petition|foi|office|proactive/i.test(detailUrl)) continue
    if (name.length < 2) continue
    results.push(record({
      name,
      crime:     'Corruption / Financial Crime',
      imageUrl:  img ? img.imageUrl : null,
      sourceUrl: detailUrl,
    }, 'icpc', 'ICPC', '#d4a017'))
  }

  // Strategy B fallback: parse rendered text (markdown-like) from web_fetch
  // Pattern pairs: [![alt](IMAGE)](DETAIL)\n# [NAME](DETAIL)
  if (results.length === 0) {
    const mdImgRe  = /\[!\[[^\]]*\]\((https:\/\/icpc\.gov\.ng\/wp-content\/uploads\/elementor\/thumbs\/[^)]+)\)\]\((https:\/\/icpc\.gov\.ng\/[^)]+)\)/g
    const mdNameRe = /#\s+\[([^\]]+)\]\((https:\/\/icpc\.gov\.ng\/[^)]+)\)/g
    const imgs = [], names = []
    while ((m = mdImgRe.exec(html)) !== null)  imgs.push({ img: m[1], url: m[2] })
    while ((m = mdNameRe.exec(html)) !== null)  names.push({ name: m[1], url: m[2] })
    // Pair by matching detail URL
    const imgByUrl = new Map(imgs.map(i => [i.url.replace(/\/$/, ''), i.img]))
    for (const n of names) {
      const key = n.url.replace(/\/$/, '')
      if (seen.has(key)) continue
      seen.add(key)
      if (/wanted-persons|icpc\.gov\.ng\/?$|contact|about|news|download/i.test(n.url)) continue
      results.push(record({
        name:      strip(n.name),
        crime:     'Corruption / Financial Crime',
        imageUrl:  imgByUrl.get(key) || null,
        sourceUrl: n.url,
      }, 'icpc', 'ICPC', '#d4a017'))
    }
  }

  return results
}

// ─── EFCC ─────────────────────────────────────────────────────────────────────
// Real URL:  https://www.efcc.gov.ng/efcc/news-and-information/wanted-persons-1?start=N
// Joomla paginated list, 18 items per page, ?start=0,18,36,54,72,...
// Returns 403 on direct fetch → use allorigins proxy.
// Each item HTML:
//   <div class="items-row ...">
//     <div class="item-image"><a href="DETAIL"><img src="IMAGE" alt="NAME"></a></div>
//     <h3 class="item-title"><a href="DETAIL">NAME</a></h3>
//   </div>
async function scrapeEFCC() {
  const baseUrl = 'https://www.efcc.gov.ng/efcc/news-and-information/wanted-persons-1'
  const results = []
  const seen = new Set()
  const maxPages = 6 // covers up to 108 entries

  for (let page = 0; page < maxPages; page++) {
    const start = page * 18
    const pageUrl = `${baseUrl}?start=${start}`
    let html = ''

    try {
      // Try direct first (sometimes works depending on IP/CDN)
      const res = await fetchUrl(pageUrl, 10000)
      if (res.status === 403 || res.status === 503 || res.html.length < 500) throw new Error('blocked')
      html = res.html
    } catch {
      try {
        const res = await fetchViaProxy(pageUrl, 20000)
        html = res.html
      } catch {
        break // Can't reach this page at all, stop
      }
    }

    if (!html || html.length < 200) break

    // Count items found on this page to detect last page
    let foundOnPage = 0

    // Pattern A — Joomla items-row structure
    const rowRe = /<div[^>]*class="[^"]*items-row[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*items-row|<div[^>]*id="[^"]*pagination|$)/gi
    while ((m = rowRe.exec(html)) !== null) {
      const block = m[1]
      // Image
      const imgM  = block.match(/<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?/i)
      // Title/name link
      const nameM = block.match(/<(?:h[234]|a)[^>]*class="[^"]*item-title[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
                 || block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      if (!nameM) continue
      const name = strip(nameM[2] || nameM[1])
      if (!name || name.length < 2 || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      const detailUrl = nameM[1].startsWith('http') ? nameM[1] : `https://www.efcc.gov.ng${nameM[1]}`
      const rawImg = imgM ? imgM[1] : null
      const imageUrl = rawImg ? (rawImg.startsWith('http') ? rawImg : `https://www.efcc.gov.ng${rawImg}`) : null
      results.push(record({ name, crime: 'Financial Crime / Fraud', imageUrl, sourceUrl: detailUrl }, 'efcc', 'EFCC', '#1976d2'))
      foundOnPage++
    }

    // Pattern B — simple article / list fallback if items-row not found
    if (foundOnPage === 0) {
      const articleRe = /<(?:article|li)[^>]*>([\s\S]*?)<\/(?:article|li)>/gi
      while ((m = articleRe.exec(html)) !== null) {
        const block = m[1]
        const hM   = block.match(/<h[234][^>]*>([\s\S]*?)<\/h[234]>/i)
        const imgM = block.match(/<img[^>]+src="([^"]+)"/i)
        if (!hM) continue
        const name = strip(hM[1])
        if (!name || name.length < 2 || seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())
        const rawImg = imgM ? imgM[1] : null
        const imageUrl = rawImg ? (rawImg.startsWith('http') ? rawImg : `https://www.efcc.gov.ng${rawImg}`) : null
        results.push(record({ name, crime: 'Financial Crime / Fraud', imageUrl, sourceUrl: pageUrl }, 'efcc', 'EFCC', '#1976d2'))
        foundOnPage++
      }
    }

    // Pattern C — table rows
    if (foundOnPage === 0) {
      const trs = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || []
      for (const tr of trs) {
        const tds = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(t => strip(t))
        if (tds.length >= 2 && tds[0].length > 2 && !/^(name|s\/n|#)/i.test(tds[0])) {
          const name = tds[0]
          if (seen.has(name.toLowerCase())) continue
          seen.add(name.toLowerCase())
          results.push(record({ name, crime: tds[1] || 'Financial Crime', state: tds[2] || null, sourceUrl: pageUrl }, 'efcc', 'EFCC', '#1976d2'))
          foundOnPage++
        }
      }
    }

    // If zero records on this page, we've gone past the end
    if (foundOnPage === 0) break
  }

  return results
}

// ─── NPF ─────────────────────────────────────────────────────────────────────
async function scrapeNPF() {
  const results = []
  const seen = new Set()
  for (const url of ['https://www.npf.gov.ng/wanted', 'https://www.npf.gov.ng/wanted?page=2']) {
    try {
      const { html } = await fetchUrl(url, 12000)
      const blocks = [
        ...(html.match(/<article[^>]*>([\s\S]*?)<\/article>/gi) || []),
        ...(html.match(/<div[^>]*class="[^"]*(?:wanted|person|col-md-4)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi) || []),
      ]
      for (const b of blocks) {
        const nM = b.match(/<h[234][^>]*>([\s\S]*?)<\/h[234]>/i)
        if (!nM) continue
        const name = strip(nM[1])
        if (!name || name.length < 2 || seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())
        const imgM   = b.match(/<img[^>]+src="([^"]+)"/i)
        const crimeM = b.match(/(?:Offence|Crime|Charge)[^:]*:\s*([^\n<]{3,100})/i)
        const stateM = b.match(/(?:State|LGA|Zone)[^:]*:\s*([^\n<]{2,60})/i)
        const rwdM   = b.match(/Reward[^:]*:\s*(₦?[\d,]+(?:\s*[Mm]illion)?)/i)
        const raw = imgM ? imgM[1] : null
        results.push(record({
          name, crime: crimeM?.[1]?.trim() || null,
          state: stateM?.[1]?.trim() || null,
          reward: rwdM ? `₦${rwdM[1].replace('₦','')}` : null,
          imageUrl: raw ? (raw.startsWith('http') ? raw : `https://www.npf.gov.ng${raw}`) : null,
          sourceUrl: url,
        }, 'npf', 'NPF', '#e8340a'))
      }
      // Table fallback
      if (results.length === 0) {
        for (const tr of html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || []) {
          const tds = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi)||[]).map(t=>strip(t))
          if (tds.length >= 2 && tds[0].length > 2 && !/name|sn|#/i.test(tds[0])) {
            if (seen.has(tds[0].toLowerCase())) continue
            seen.add(tds[0].toLowerCase())
            results.push(record({ name:tds[0], crime:tds[1], state:tds[2], sourceUrl:url }, 'npf','NPF','#e8340a'))
          }
        }
      }
    } catch {}
  }
  return results
}

// ─── INTERIOR ─────────────────────────────────────────────────────────────────
// Only publishes photos, no names. Collect all /wp-content/uploads/ images
// that look like the WA0xxx series (correctional escapees).
async function scrapeInterior() {
  const url = 'https://interior.gov.ng/wanted-persons/'
  const { html } = await fetchUrl(url, 12000)
  const results = []
  const seen = new Set()
  const re = /<img[^>]+src="(https:\/\/interior\.gov\.ng\/wp-content\/uploads\/\d{4}\/\d{2}\/[^"]+\.(?:jpg|jpeg|png))"[^>]*/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const img = m[1]
    if (/150x150|220x150|300x81|270x270|logo|button|widget|cropped/i.test(img)) continue
    if (seen.has(img)) continue
    seen.add(img)
    const waM = img.match(/wa(\d+)/i)
    const num = waM ? parseInt(waM[1], 10) : seen.size
    results.push(record({
      name: `Correctional Escapee #${num}`,
      crime: 'Correctional Service Escape / Absconder',
      imageUrl: img,
      description: 'Declared wanted by Nigerian Correctional Services (Ministry of Interior). No additional metadata published by the agency.',
      sourceUrl: url,
    }, 'interior', 'Interior', '#00c853'))
  }
  return results
}

// ─── SEED (only when ALL live scrapers fail) ──────────────────────────────────
function seed() {
  return [
    { id:'s1', name:'Terwase Agwaza', alias:'Gana', crime:'Terrorism / Mass Murder', status:'Wanted', reward:'₦20,000,000', state:'Benue', agency:'npf', agencyLabel:'NPF', agencyColor:'#e8340a', imageUrl:null, refId:'NPF-2025-4410', sourceUrl:'https://www.npf.gov.ng/wanted', scrapedAt:new Date().toISOString() },
    { id:'s2', name:'Emmanuel Nwude', alias:'The Governor', crime:'Advance Fee Fraud (₦12.4B)', status:'Wanted', reward:'₦5,000,000', state:'Anambra', agency:'efcc', agencyLabel:'EFCC', agencyColor:'#1976d2', imageUrl:null, refId:'EFCC-2025-0091', sourceUrl:'https://www.efcc.gov.ng/efcc/news-and-information/wanted-persons-1', scrapedAt:new Date().toISOString() },
    { id:'s3', name:'Abdulrasheed Maina', alias:null, crime:'Pension Fraud / Money Laundering', status:'Convicted', reward:null, state:'Abuja FCT', agency:'icpc', agencyLabel:'ICPC', agencyColor:'#d4a017', imageUrl:null, refId:'ICPC-2021-0078', sourceUrl:'https://icpc.gov.ng/wanted-persons/', scrapedAt:new Date().toISOString() },
    { id:'s4', name:'Chukwudumeme Onwuamadike', alias:'Evans', crime:'Kidnapping / Armed Robbery', status:'Apprehended', reward:null, state:'Lagos', agency:'npf', agencyLabel:'NPF', agencyColor:'#e8340a', imageUrl:null, refId:'NPF-2017-0112', sourceUrl:'https://www.npf.gov.ng/wanted', scrapedAt:new Date().toISOString() },
  ]
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
exports.handler = async function(event) {
  const agency = (event.queryStringParameters || {}).agency || 'all'
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=1800',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode:204, headers, body:'' }

  try {
    const jobs = []
    if (agency==='all'||agency==='efcc')     jobs.push(scrapeEFCC().catch(()=>[]))
    if (agency==='all'||agency==='npf')      jobs.push(scrapeNPF().catch(()=>[]))
    if (agency==='all'||agency==='icpc')     jobs.push(scrapeICPC().catch(()=>[]))
    if (agency==='all'||agency==='interior') jobs.push(scrapeInterior().catch(()=>[]))

    let persons = (await Promise.all(jobs)).flat()

    // Deduplicate by normalised name
    const ns = new Set()
    persons = persons.filter(p => {
      const k = p.name.toLowerCase().replace(/[^a-z0-9]/g,'')
      if (ns.has(k)) return false; ns.add(k); return true
    })

    // Sort: Wanted first
    const pri = { Wanted:0, Escaped:1, Apprehended:2, Convicted:3 }
    persons.sort((a,b) => (pri[a.status]||5)-(pri[b.status]||5))

    const usedSeed = persons.length === 0
    if (usedSeed) persons = seed()

    return { statusCode:200, headers, body:JSON.stringify({ success:true, total:persons.length, usedSeed, scrapedAt:new Date().toISOString(), persons }) }
  } catch(err) {
    return { statusCode:500, headers, body:JSON.stringify({ success:false, error:err.message, persons:seed(), usedSeed:true }) }
  }
}
