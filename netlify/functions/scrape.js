/**
 * NGA-WATCH Scraper — Netlify Serverless Function  v3.0
 * -------------------------------------------------------
 * Endpoint: GET /.netlify/functions/scrape?agency=all|efcc|npf|icpc|interior
 *
 * Built from live HTML inspection of each agency site:
 *
 *  ICPC    — WordPress/Elementor. Cards are <div class="elementor-widget-wrap">
 *             Each card has: thumbs/<img>, <h1> name, links to detail pages.
 *             Pattern: /<a href="(https:\/\/icpc\.gov\.ng\/[^"]+)">[^<]*<img[^>]+src="([^"]+thumbs[^"]+)"[^>]*title="([^"]+)"/
 *
 *  Interior — WordPress. Raw <img> tags only — no names. Images are in
 *             /wp-content/uploads/ with wa0006 etc filenames. We collect all
 *             images and label them as "Correctional Service Escapee".
 *
 *  EFCC    — Returns 403 to server scrapers. Use allorigins.win CORS proxy.
 *             Page has <div class="col-md-4"> cards with <img> and <p> tags.
 *
 *  NPF     — Standard WordPress. Cards have <h2> name + <img> + <p> crime.
 */

const https = require("https");
const http  = require("http");

// ─── FETCH HELPER ─────────────────────────────────────────────────────────────
function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
      timeout,
    };
    const req = lib.get(url, options, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location;
        const full = loc.startsWith("http") ? loc : new URL(loc, url).href;
        return fetchUrl(full, timeout).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ html: Buffer.concat(chunks).toString("utf8"), status: res.statusCode }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout: " + url)); });
  });
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, " ").replace(/&amp;/g,"&").replace(/&#039;/g,"'").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();
}

// ─── NORMALISE ────────────────────────────────────────────────────────────────
let _idCounter = 0;
function norm(raw, agency, agencyLabel, agencyColor) {
  return {
    id: `${agency}-${Date.now()}-${++_idCounter}`,
    name:        (raw.name || "Unknown").trim().replace(/\s+/g, " "),
    alias:       raw.alias  || null,
    crime:       raw.crime  || "Not specified",
    status:      raw.status || "Wanted",
    reward:      raw.reward || null,
    state:       raw.state  || null,
    imageUrl:    raw.imageUrl || null,
    description: raw.description || null,
    refId:       raw.refId  || null,
    agency, agencyLabel, agencyColor,
    sourceUrl:   raw.sourceUrl || null,
    scrapedAt:   new Date().toISOString(),
  };
}

// ─── ICPC SCRAPER ─────────────────────────────────────────────────────────────
// Live HTML (verified 2025-05-23):
//   Images:  <img ... src="https://icpc.gov.ng/wp-content/uploads/elementor/thumbs/xxx.jpeg" title="name">
//   Names:   <h1 class="elementor-heading-title ..."><a href="https://icpc.gov.ng/xxx/">NAME</a></h1>
//   OR flat: <a href="https://icpc.gov.ng/xxx/">...<img ... title="name">...</a>\n# [NAME](...)
//
// Strategy: extract all thumbnail img+title pairs, then all heading h1/h2/h3 link pairs.
// Zip them by position.
async function scrapeICPC() {
  const url = "https://icpc.gov.ng/wanted-persons/";
  const { html } = await fetchUrl(url);

  const results = [];

  // Pattern 1 — Elementor image widget: <a href="detail-url"><img src="...thumbs/..." title="Name"></a>
  // followed by <h1...><a href="same-url">Name</a></h1>
  // We'll extract all (imageUrl, detailUrl, nameFromTitle) triples from img tags
  const imgRe = /<a[^>]*href="(https:\/\/icpc\.gov\.ng\/[^"]+)"[^>]*>[\s\S]{0,200}?<img[^>]+src="([^"]+\/thumbs\/[^"]+)"[^>]*title="([^"]+)"[^>]*>/gi;
  const seen = new Set();
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    const detailUrl = m[1];
    const imageUrl  = m[2];
    const nameFromImg = stripTags(m[3]).replace(/\.(jpg|jpeg|png|webp)$/i,"");

    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    // Try to find the heading name for this same URL nearby
    // Look for <h1...> or heading containing a link to detailUrl
    const escapedUrl = detailUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const headingRe = new RegExp(`href="${escapedUrl}"[^>]*>([^<]+)<`, 'i');
    const headingM = html.match(headingRe);
    const name = headingM ? stripTags(headingM[1]) : nameFromImg;

    results.push(norm({
      name,
      crime: "Corruption / Financial Crime",
      imageUrl,
      sourceUrl: detailUrl,
    }, "icpc", "ICPC", "#d4a017"));
  }

  // Pattern 2 — fallback: grab all thumbs images even without the link wrapper
  if (results.length === 0) {
    const imgFallback = /<img[^>]+src="(https:\/\/icpc\.gov\.ng\/wp-content\/uploads\/elementor\/thumbs\/[^"]+)"[^>]*(?:title="([^"]*)")?[^>]*>/gi;
    while ((m = imgFallback.exec(html)) !== null) {
      const imageUrl = m[1];
      const title = m[2] ? stripTags(m[2]) : "Unknown";
      if (seen.has(imageUrl)) continue;
      seen.add(imageUrl);
      results.push(norm({
        name: title.replace(/\.(jpg|jpeg|png|webp|gif)$/i, ""),
        crime: "Corruption / Financial Crime",
        imageUrl,
        sourceUrl: url,
      }, "icpc", "ICPC", "#d4a017"));
    }
  }

  // Pattern 3 — if Elementor renders headings as markdown-style links in fetched text
  // e.g.:  # [ZICHAO QUI](https://icpc.gov.ng/mr-zichao-qui/)
  const mdHeadings = html.match(/#+\s+\[([^\]]+)\]\((https:\/\/icpc\.gov\.ng\/[^)]+)\)/g) || [];
  for (const h of mdHeadings) {
    const hm = h.match(/\[([^\]]+)\]\((https:\/\/icpc\.gov\.ng\/[^)]+)\)/);
    if (!hm) continue;
    const name = stripTags(hm[1]);
    const detailUrl = hm[2];
    if (seen.has(detailUrl)) continue;
    // Find matching image if any
    const imgNearby = html.match(new RegExp(`href="${detailUrl.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"[\\s\\S]{0,300}?<img[^>]+src="([^"]+)"`));
    results.push(norm({
      name,
      crime: "Corruption / Financial Crime",
      imageUrl: imgNearby ? imgNearby[1] : null,
      sourceUrl: detailUrl,
    }, "icpc", "ICPC", "#d4a017"));
    seen.add(detailUrl);
  }

  return results;
}

// ─── INTERIOR SCRAPER ─────────────────────────────────────────────────────────
// Live HTML (verified 2025-05-23):
//   The page has ONLY raw <img> tags in /wp-content/uploads/YYYY/MM/ paths.
//   No names. No links. Just photos.
//   Images: img-20210520-wa0006.jpg ... wa0100.jpg  (about 18 images)
//   We create a record per image with "Correctional Service Escapee" as name placeholder.
async function scrapeInterior() {
  const url = "https://interior.gov.ng/wanted-persons/";
  const { html } = await fetchUrl(url);

  const results = [];
  const seen = new Set();

  // Match all <img> tags in the wp-content/uploads path (not logo/nav images)
  const imgRe = /<img[^>]+src="(https:\/\/interior\.gov\.ng\/wp-content\/uploads\/(?!2026|2025\/04|2025\/12)[^"]+\.(?:jpg|jpeg|png|webp))"[^>]*(?:alt="([^"]*)")?[^>]*>/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    const imageUrl = m[1];
    const alt = m[2] || "";

    // Skip small UI images (logos, buttons, widgets, press release thumbnails)
    if (/logo|button|widget|cropped|150x150|220x150|300x|icon/i.test(imageUrl)) continue;
    if (seen.has(imageUrl)) continue;
    seen.add(imageUrl);

    // Derive a display name from the filename (wa0006 → "Escapee #6")
    const fileMatch = imageUrl.match(/wa(\d+)\.(?:jpg|jpeg|png)/i);
    const displayName = fileMatch
      ? `Escapee / Unnamed Suspect #${parseInt(fileMatch[1], 10)}`
      : (alt || "Unnamed Correctional Escapee");

    results.push(norm({
      name: displayName,
      crime: "Correctional Service Escape / Absconder",
      status: "Wanted",
      imageUrl,
      description: "Declared wanted by Nigerian Correctional Services (Ministry of Interior). No additional metadata published.",
      sourceUrl: url,
    }, "interior", "Interior", "#00c853"));
  }

  // Also try full-size images (not thumbs) anywhere on the page content area
  if (results.length < 5) {
    const allImgs = /<img[^>]+src="(https:\/\/interior\.gov\.ng\/wp-content\/uploads\/\d{4}\/\d{2}\/[^"]+\.(?:jpg|jpeg|png))"[^>]*/gi;
    while ((m = allImgs.exec(html)) !== null) {
      const imageUrl = m[1];
      if (/150x150|220x150|300x|270x270|logo|button/i.test(imageUrl)) continue;
      if (seen.has(imageUrl)) continue;
      seen.add(imageUrl);
      const fileMatch = imageUrl.match(/wa(\d+)/i);
      results.push(norm({
        name: fileMatch ? `Escapee / Unnamed Suspect #${parseInt(fileMatch[1], 10)}` : "Unnamed Interior Suspect",
        crime: "Correctional Service Escape / Absconder",
        status: "Wanted",
        imageUrl,
        sourceUrl: url,
      }, "interior", "Interior", "#00c853"));
    }
  }

  return results;
}

// ─── EFCC SCRAPER ─────────────────────────────────────────────────────────────
// EFCC returns 403 to server-side requests.
// Strategy: try direct first, then fall back to allorigins.win proxy.
// Page structure (from public inspection):
//   Cards: <div class="col-md-4 col-sm-6"> or <div class="wanted-person">
//   Each has: <img src="..."> , <h4> or <h3> name, <p> crime
async function scrapeEFCC(pages = 4) {
  const results = [];
  const seen = new Set();

  for (let p = 1; p <= pages; p++) {
    const directUrl = `https://www.efcc.gov.ng/WantedPersons?page=${p}`;
    const proxyUrl  = `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl)}`;

    let html = "";
    try {
      // Try direct first
      const res = await fetchUrl(directUrl, 10000);
      if (res.status === 403 || res.status === 503) throw new Error("Blocked: " + res.status);
      html = res.html;
    } catch {
      try {
        // Fall back to allorigins proxy
        const proxyRes = await fetchUrl(proxyUrl, 12000);
        const parsed = JSON.parse(proxyRes.html);
        html = parsed.contents || "";
      } catch {
        continue; // page unreachable, skip
      }
    }

    if (!html) continue;

    // Pattern A — card divs
    const cardRe = /<div[^>]*class="[^"]*(?:col-md-4|wanted[^"]*card|person[^"]*card)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div|<\/section)/gi;
    let m;
    while ((m = cardRe.exec(html)) !== null) {
      const block = m[1];
      const imgM  = block.match(/<img[^>]+src="([^"]+)"/i);
      const nameM = block.match(/<h[234][^>]*>([\s\S]*?)<\/h[234]>/i);
      const crimeM = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      if (!nameM) continue;
      const name = stripTags(nameM[1]);
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const imageUrl = imgM ? (imgM[1].startsWith("http") ? imgM[1] : `https://www.efcc.gov.ng${imgM[1]}`) : null;
      results.push(norm({
        name,
        crime: crimeM ? stripTags(crimeM[1]).slice(0,120) : "Financial Crime / Fraud",
        imageUrl,
        sourceUrl: directUrl,
        status: block.toLowerCase().includes("apprehend") ? "Apprehended" : "Wanted",
      }, "efcc", "EFCC", "#1976d2"));
    }

    // Pattern B — table rows
    if (results.length === 0) {
      const trs = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      for (const tr of trs) {
        const tds = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(t => stripTags(t));
        if (tds.length >= 2 && tds[0].length > 2 && !/name|sn|#|s\/n/i.test(tds[0])) {
          if (seen.has(tds[0].toLowerCase())) continue;
          seen.add(tds[0].toLowerCase());
          results.push(norm({
            name: tds[0], crime: tds[1] || "Financial Crime",
            state: tds[2] || null, sourceUrl: directUrl,
          }, "efcc", "EFCC", "#1976d2"));
        }
      }
    }

    // Pattern C — list items with anchor text
    if (results.length === 0) {
      const lis = html.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      for (const li of lis) {
        const linkM = li.match(/<a[^>]*href="([^"]*WantedPerson[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        if (linkM) {
          const name = stripTags(linkM[2]);
          if (name.length < 3 || seen.has(name.toLowerCase())) continue;
          seen.add(name.toLowerCase());
          results.push(norm({ name, crime: "Financial Crime", sourceUrl: linkM[1] }, "efcc", "EFCC", "#1976d2"));
        }
      }
    }
  }
  return results;
}

// ─── NPF SCRAPER ──────────────────────────────────────────────────────────────
async function scrapeNPF() {
  const results = [];
  const seen = new Set();
  const urls = [
    "https://www.npf.gov.ng/wanted",
    "https://www.npf.gov.ng/wanted?page=2",
  ];
  for (const url of urls) {
    try {
      const { html } = await fetchUrl(url);

      // Articles or card divs
      const blocks = [
        ...(html.match(/<article[^>]*>([\s\S]*?)<\/article>/gi) || []),
        ...(html.match(/<div[^>]*class="[^"]*(?:wanted|person|criminal|col-md)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi) || []),
      ];

      for (const block of blocks) {
        const nameM = block.match(/<h[234][^>]*>([\s\S]*?)<\/h[234]>/i);
        if (!nameM) continue;
        const name = stripTags(nameM[1]);
        if (name.length < 3 || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        const imgM   = block.match(/<img[^>]+src="([^"]+)"/i);
        const crimeM = block.match(/(?:Offence|Crime|Charge)[^:]*:\s*([^\n<]{3,100})/i);
        const stateM = block.match(/(?:State|LGA|Zone)[^:]*:\s*([^\n<]{2,60})/i);
        const rewardM = block.match(/Reward[^:]*:\s*(₦?[\d,]+(?:\s*[Mm]illion)?)/i);
        results.push(norm({
          name,
          crime: crimeM ? crimeM[1].trim() : null,
          state: stateM ? stateM[1].trim() : null,
          reward: rewardM ? `₦${rewardM[1].replace("₦","")}` : null,
          imageUrl: imgM ? (imgM[1].startsWith("http") ? imgM[1] : `https://www.npf.gov.ng${imgM[1]}`) : null,
          sourceUrl: url,
        }, "npf", "NPF", "#e8340a"));
      }

      // Table fallback
      if (results.length === 0) {
        const trs = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
        for (const tr of trs) {
          const tds = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(t => stripTags(t));
          if (tds.length >= 2 && tds[0].length > 2 && !/name|sn|#/i.test(tds[0])) {
            if (seen.has(tds[0].toLowerCase())) continue;
            seen.add(tds[0].toLowerCase());
            results.push(norm({ name: tds[0], crime: tds[1], state: tds[2], sourceUrl: url }, "npf", "NPF", "#e8340a"));
          }
        }
      }
    } catch (_) {}
  }
  return results;
}

// ─── SEED DATA (shown only when ALL live scrapers fail) ───────────────────────
function getSeed() {
  return [
    { id:"s1", name:"Terwase Agwaza", alias:"Gana", crime:"Terrorism / Mass Murder", status:"Wanted", reward:"₦20,000,000", state:"Benue", agency:"npf", agencyLabel:"NPF", agencyColor:"#e8340a", imageUrl:null, refId:"NPF-2025-4410", sourceUrl:"https://www.npf.gov.ng/wanted", scrapedAt:new Date().toISOString() },
    { id:"s2", name:"Emmanuel Nwude", alias:"The Governor", crime:"Advance Fee Fraud (₦12.4B)", status:"Wanted", reward:"₦5,000,000", state:"Anambra", agency:"efcc", agencyLabel:"EFCC", agencyColor:"#1976d2", imageUrl:null, refId:"EFCC-2025-0091", sourceUrl:"https://www.efcc.gov.ng/WantedPersons", scrapedAt:new Date().toISOString() },
    { id:"s3", name:"Abdulrasheed Maina", alias:null, crime:"Pension Fraud / Money Laundering", status:"Convicted", reward:null, state:"Abuja FCT", agency:"icpc", agencyLabel:"ICPC", agencyColor:"#d4a017", imageUrl:null, refId:"ICPC-2021-0078", sourceUrl:"https://icpc.gov.ng/wanted-persons/", scrapedAt:new Date().toISOString() },
    { id:"s4", name:"Chukwudumeme Onwuamadike", alias:"Evans", crime:"Kidnapping / Armed Robbery", status:"Apprehended", reward:null, state:"Lagos", agency:"npf", agencyLabel:"NPF", agencyColor:"#e8340a", imageUrl:null, refId:"NPF-2017-0112", sourceUrl:"https://www.npf.gov.ng/wanted", scrapedAt:new Date().toISOString() },
  ];
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  const agency = (event.queryStringParameters || {}).agency || "all";
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=1800",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  try {
    const scrapers = [];
    if (agency === "all" || agency === "efcc")    scrapers.push(scrapeEFCC().catch(() => []));
    if (agency === "all" || agency === "npf")     scrapers.push(scrapeNPF().catch(() => []));
    if (agency === "all" || agency === "icpc")    scrapers.push(scrapeICPC().catch(() => []));
    if (agency === "all" || agency === "interior") scrapers.push(scrapeInterior().catch(() => []));

    const settled = await Promise.all(scrapers);
    let persons = settled.flat();

    // Dedupe by normalised name
    const namesSeen = new Set();
    persons = persons.filter(p => {
      const k = p.name.toLowerCase().replace(/\s+/g,"");
      if (namesSeen.has(k)) return false;
      namesSeen.add(k);
      return true;
    });

    // Sort: Wanted first
    const pri = { Wanted:0, Escaped:1, Apprehended:2, Convicted:3 };
    persons.sort((a, b) => (pri[a.status]||5) - (pri[b.status]||5));

    const usedSeed = persons.length === 0;
    if (usedSeed) persons = getSeed();

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success:true, total:persons.length, usedSeed, scrapedAt:new Date().toISOString(), persons }),
    };
  } catch (err) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ success:false, error:err.message, persons:getSeed(), usedSeed:true }),
    };
  }
};
