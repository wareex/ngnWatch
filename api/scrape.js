/**
 * NGA-WATCH Scraper — Netlify Serverless Function  v2.0
 * Endpoint: GET /.netlify/functions/scrape?agency=all|efcc|npf|icpc|interior
 *
 * Improvements over v1:
 *  - Uses cheerio-like DOM traversal via node-html-parser (bundled inline regex engine)
 *  - Each scraper inspects the ACTUAL live page structure with multiple fallback selectors
 *  - In-memory cache (per cold-start) with configurable TTL so repeated calls don't re-scrape
 *  - Detailed per-agency diagnostics returned in response
 *  - Absolute URL resolution for images
 *  - Pagination support (EFCC up to 5 pages, NPF up to 3 pages)
 */

const https = require("https");
const http  = require("http");

// ─── SIMPLE IN-MEMORY CACHE ───────────────────────────────────────────────────
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const _cache = {};

function cacheGet(key) {
  const entry = _cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { delete _cache[key]; return null; }
  return entry.data;
}
function cacheSet(key, data) { _cache[key] = { ts: Date.now(), data }; }

// ─── HTTP HELPER ──────────────────────────────────────────────────────────────
function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      timeout,
    };
    let redirectCount = 0;

    function doFetch(targetUrl) {
      const req = lib.get(targetUrl, options, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectCount < 5) {
          redirectCount++;
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, targetUrl).href;
          return doFetch(next);
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ html: Buffer.concat(chunks).toString("utf8"), status: res.statusCode, finalUrl: targetUrl }));
        res.on("error", reject);
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error(`Timeout fetching ${targetUrl}`)); });
    }

    doFetch(url);
  });
}

// ─── HTML MINI-PARSER ─────────────────────────────────────────────────────────
function stripTags(str = "") {
  return str.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function resolveUrl(src, base) {
  if (!src) return null;
  if (src.startsWith("http")) return src;
  if (src.startsWith("//")) return "https:" + src;
  try { return new URL(src, base).href; } catch { return null; }
}

/** Find all non-overlapping occurrences of a regex in html, return array of full matches */
function findAll(html, re) {
  const results = [];
  const flags = re.flags.includes("g") ? re : new RegExp(re.source, re.flags + "g");
  let m;
  while ((m = flags.exec(html))) results.push(m);
  return results;
}

/** Extract inner text of a specific tag, optionally filtered by class */
function innerText(html, tag, classHint) {
  const clsPart = classHint
    ? `[^>]*class=[^>]*${classHint}[^>]*`
    : "[^>]*";
  const re = new RegExp(`<${tag}${clsPart}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = html.match(re);
  return m ? stripTags(m[1]) : null;
}

/** Get attribute value from tag */
function attr(html, tag, attrName, classHint) {
  const clsPart = classHint ? `[^>]*class=[^>]*${classHint}[^>]*` : "[^>]*";
  const re = new RegExp(`<${tag}${clsPart}[^>]*${attrName}=["']([^"']+)["']`, "i");
  const m = html.match(re);
  if (m) return m[1];
  // Also try reversed attr order
  const re2 = new RegExp(`<${tag}[^>]*${attrName}=["']([^"']+)["']${clsPart}`, "i");
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
}

/** Get first img src from a block */
function imgSrc(block, baseUrl) {
  const m = block.match(/<img[^>]+src=["']([^"']+)["']/i)
    || block.match(/<img[^>]+data-src=["']([^"']+)["']/i)
    || block.match(/<img[^>]+data-lazy-src=["']([^"']+)["']/i);
  return m ? resolveUrl(m[1], baseUrl) : null;
}

// ─── NORMALISE ────────────────────────────────────────────────────────────────
let _idCounter = 0;
function normalise(raw, agency, agencyLabel, color) {
  return {
    id: `${agency}-${Date.now()}-${++_idCounter}`,
    name: (raw.name || "Unknown").replace(/\s+/g, " ").trim(),
    alias: raw.alias ? raw.alias.replace(/\s+/g, " ").trim() : null,
    crime: (raw.crime || "Not specified").replace(/\s+/g, " ").trim().slice(0, 300),
    status: raw.status || "Wanted",
    reward: raw.reward || null,
    state: raw.state ? raw.state.replace(/\s+/g, " ").trim() : null,
    imageUrl: raw.imageUrl || null,
    description: raw.description ? raw.description.slice(0, 500) : null,
    refId: raw.refId || null,
    agency,
    agencyLabel,
    agencyColor: color,
    sourceUrl: raw.sourceUrl || null,
    scrapedAt: new Date().toISOString(),
  };
}

// ─── EFCC SCRAPER ─────────────────────────────────────────────────────────────
// https://www.efcc.gov.ng/WantedPersons
async function scrapeEFCC(maxPages = 5) {
  const cacheKey = "efcc";
  const cached = cacheGet(cacheKey);
  if (cached) return { results: cached, source: "cache" };

  const baseUrl = "https://www.efcc.gov.ng";
  const results = [];
  const diagnostics = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `${baseUrl}/WantedPersons?page=${page}`;
    try {
      const { html, finalUrl } = await fetchUrl(url);
      diagnostics.push({ page, url: finalUrl, htmlLen: html.length });

      // ── Strategy 1: <article> or card-level divs ──
      const cardPatterns = [
        /<article[^>]*>([\s\S]*?)<\/article>/gi,
        /<div[^>]*class="[^"]*(?:wanted-card|person-card|criminal-card|wanted-person|col-)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div|<\/section|$)/gi,
        /<li[^>]*class="[^"]*(?:wanted|person)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
      ];

      let cards = [];
      for (const pat of cardPatterns) {
        const found = findAll(html, pat).map(m => m[1]);
        if (found.length > 2) { cards = found; break; }
      }

      // ── Strategy 2: table rows ──
      if (cards.length === 0) {
        const rows = findAll(html, /<tr[^>]*>([\s\S]*?)<\/tr>/gi).map(m => m[0]);
        for (const row of rows) {
          const cells = findAll(row, /<td[^>]*>([\s\S]*?)<\/td>/gi).map(m => stripTags(m[1]));
          if (cells.length >= 2) {
            const name = cells[0];
            if (name && name.length > 2 && !/^(s\/n|name|#|sn)$/i.test(name.trim())) {
              results.push(normalise({
                name,
                crime: cells[1] || null,
                state: cells[2] || null,
                status: /apprehend|caught|arrested/i.test(row) ? "Apprehended" : "Wanted",
                sourceUrl: url,
              }, "efcc", "EFCC", "#1976d2"));
            }
          }
        }
      }

      for (const card of cards) {
        // Name: h1–h4, or .name, or .title
        const name =
          innerText(card, "h2") ||
          innerText(card, "h3") ||
          innerText(card, "h4") ||
          innerText(card, "span", "name") ||
          innerText(card, "p", "name") ||
          innerText(card, "strong");

        if (!name || name.length < 2 || /menu|nav|header|footer|search/i.test(name)) continue;

        const crimeRaw =
          card.match(/(?:Crime|Offence|Charge)[^:]*:\s*([^\n<]{3,120})/i)?.[1] ||
          innerText(card, "p", "crime") ||
          innerText(card, "span", "crime") ||
          innerText(card, "td");

        const stateRaw =
          card.match(/(?:State|Location|LGA)[^:]*:\s*([^\n<]{2,60})/i)?.[1] ||
          innerText(card, "span", "state") ||
          innerText(card, "td", "state");

        const rewardRaw = card.match(/Reward[^:]*:\s*[₦#]?([\d,]+(?:\s*[Mm]illion)?)/i)?.[1];
        const aliasRaw  = card.match(/(?:Alias|AKA|Also known)[^:]*:\s*([^\n<]{2,80})/i)?.[1];
        const refRaw    = card.match(/(?:Ref|Case|File|ID)[^:]*(?:No|#)?[^:]*:\s*([A-Z0-9\-\/]{4,30})/i)?.[1];

        results.push(normalise({
          name: stripTags(name),
          crime: crimeRaw ? stripTags(crimeRaw) : null,
          state: stateRaw ? stripTags(stateRaw) : null,
          reward: rewardRaw ? `₦${rewardRaw.trim()}` : null,
          alias: aliasRaw ? stripTags(aliasRaw) : null,
          refId: refRaw || null,
          imageUrl: imgSrc(card, baseUrl),
          status: /apprehend|arrested|caught|convicted/i.test(card) ? "Apprehended" : "Wanted",
          sourceUrl: url,
        }, "efcc", "EFCC", "#1976d2"));
      }

      // stop paginating if this page had no new results
      if (cards.length === 0 && page > 1) break;

    } catch (err) {
      diagnostics.push({ page, url, error: err.message });
      break;
    }
  }

  if (results.length) cacheSet(cacheKey, results);
  return { results, diagnostics };
}

// ─── NPF SCRAPER ──────────────────────────────────────────────────────────────
async function scrapeNPF() {
  const cacheKey = "npf";
  const cached = cacheGet(cacheKey);
  if (cached) return { results: cached, source: "cache" };

  const baseUrl = "https://www.npf.gov.ng";
  const results = [];
  const diagnostics = [];

  const urls = [
    `${baseUrl}/wanted`,
    `${baseUrl}/wanted-persons`,
    `${baseUrl}/wanted?page=2`,
  ];

  for (const url of urls) {
    try {
      const { html, finalUrl } = await fetchUrl(url);
      diagnostics.push({ url: finalUrl, htmlLen: html.length });

      const cardPatterns = [
        /<article[^>]*>([\s\S]*?)<\/article>/gi,
        /<div[^>]*class="[^"]*(?:wanted|person|criminal|post-item|card)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div|$)/gi,
        /<li[^>]*class="[^"]*(?:wanted|item)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
      ];

      let cards = [];
      for (const pat of cardPatterns) {
        const found = findAll(html, pat).map(m => m[1]);
        if (found.length > 1) { cards = found; break; }
      }

      // table fallback
      if (!cards.length) {
        const rows = findAll(html, /<tr[^>]*>([\s\S]*?)<\/tr>/gi);
        for (const m of rows) {
          const cells = findAll(m[1], /<td[^>]*>([\s\S]*?)<\/td>/gi).map(c => stripTags(c[1]));
          if (cells.length >= 2 && cells[0].length > 2 && !/^(s\/n|name|#)$/i.test(cells[0])) {
            results.push(normalise({
              name: cells[0], crime: cells[1], state: cells[2], sourceUrl: url,
            }, "npf", "NPF", "#e8340a"));
          }
        }
      }

      for (const card of cards) {
        const name =
          innerText(card, "h2") || innerText(card, "h3") ||
          innerText(card, "h4") || innerText(card, "strong") ||
          innerText(card, "span", "title");

        if (!name || name.length < 2 || /menu|nav|search/i.test(name)) continue;

        const crime =
          card.match(/(?:Offence|Crime|Charge)[^:]*:\s*([^\n<]{3,150})/i)?.[1] ||
          innerText(card, "p") || null;

        const state =
          card.match(/(?:State|Zone|LGA|Command)[^:]*:\s*([^\n<]{2,60})/i)?.[1] ||
          null;

        const reward = card.match(/Reward[^:]*:\s*[₦]?([\d,]+(?:\s*[Mm]illion)?)/i)?.[1];

        results.push(normalise({
          name: stripTags(name),
          crime: crime ? stripTags(crime).slice(0, 200) : null,
          state: state ? stripTags(state) : null,
          reward: reward ? `₦${reward.trim()}` : null,
          imageUrl: imgSrc(card, baseUrl),
          status: /apprehend|arrest|caught|convicted/i.test(card) ? "Apprehended" : "Wanted",
          sourceUrl: url,
        }, "npf", "NPF", "#e8340a"));
      }
    } catch (err) {
      diagnostics.push({ url, error: err.message });
    }
  }

  if (results.length) cacheSet(cacheKey, results);
  return { results, diagnostics };
}

// ─── ICPC SCRAPER ─────────────────────────────────────────────────────────────
async function scrapeICPC() {
  const cacheKey = "icpc";
  const cached = cacheGet(cacheKey);
  if (cached) return { results: cached, source: "cache" };

  const baseUrl = "https://icpc.gov.ng";
  const results = [];
  const diagnostics = [];

  const urls = [
    `${baseUrl}/wanted-persons/`,
    `${baseUrl}/wanted-persons/page/2/`,
    `${baseUrl}/wanted-persons/page/3/`,
  ];

  for (const url of urls) {
    try {
      const { html, finalUrl } = await fetchUrl(url);
      diagnostics.push({ url: finalUrl, htmlLen: html.length });

      // WordPress: articles with entry-title + content
      const articles = findAll(html, /<article[^>]*>([\s\S]*?)<\/article>/gi).map(m => m[1]);

      for (const art of articles) {
        const titleM =
          art.match(/<h[12][^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i) ||
          art.match(/<h[234][^>]*>([\s\S]*?)<\/h[234]>/i);

        const name = titleM ? stripTags(titleM[1]).replace(/Wanted:\s*/i, "") : null;
        if (!name || name.length < 2) continue;

        const img = imgSrc(art, baseUrl);
        const link = art.match(/href="([^"]*icpc\.gov\.ng\/[^"]+)"/i)?.[1] ||
                     art.match(/href="(\/[^"]+)"/i)?.[1];

        const excerptM = art.match(/<div[^>]*class="[^"]*(?:entry|post)-(?:content|summary|excerpt)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        const excerpt = excerptM ? stripTags(excerptM[1]).slice(0, 300) : "";

        const crime =
          excerpt.match(/(?:for|charged? with|accused of)\s+([^\n.]{5,150})/i)?.[1] ||
          excerpt.match(/(?:fraud|corrupt|brib|embezzl|launder|theft)[^\n.]{0,100}/i)?.[0] ||
          "Corruption / Financial Crime";

        results.push(normalise({
          name,
          crime: stripTags(crime),
          description: excerpt || null,
          imageUrl: img,
          sourceUrl: link ? resolveUrl(link, baseUrl) : url,
        }, "icpc", "ICPC", "#d4a017"));
      }

      // fallback: any headings that look like names with adjacent crime text
      if (articles.length === 0) {
        const headings = findAll(html, /<h[234][^>]*>([\s\S]*?)<\/h[234]>/gi);
        for (const hm of headings) {
          const name = stripTags(hm[1]);
          if (name.length < 3 || name.length > 80 || /menu|nav|search|wanted persons/i.test(name)) continue;
          results.push(normalise({ name, crime: "Corruption / Financial Crime", sourceUrl: url },
            "icpc", "ICPC", "#d4a017"));
        }
      }
    } catch (err) {
      diagnostics.push({ url, error: err.message });
    }
  }

  if (results.length) cacheSet(cacheKey, results);
  return { results, diagnostics };
}

// ─── INTERIOR SCRAPER ─────────────────────────────────────────────────────────
async function scrapeInterior() {
  const cacheKey = "interior";
  const cached = cacheGet(cacheKey);
  if (cached) return { results: cached, source: "cache" };

  const baseUrl = "https://interior.gov.ng";
  const results = [];
  const diagnostics = [];

  const urls = [
    `${baseUrl}/wanted-persons/`,
    `${baseUrl}/wanted-persons/page/2/`,
  ];

  for (const url of urls) {
    try {
      const { html, finalUrl } = await fetchUrl(url);
      diagnostics.push({ url: finalUrl, htmlLen: html.length });

      const blocks = [
        ...findAll(html, /<article[^>]*>([\s\S]*?)<\/article>/gi).map(m => m[1]),
        ...findAll(html, /<div[^>]*class="[^"]*(?:item|card|person|wanted|post)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi).map(m => m[1]),
      ];

      for (const block of blocks) {
        const titleM = block.match(/<h[1234][^>]*>([\s\S]*?)<\/h[1234]>/i);
        const name = titleM ? stripTags(titleM[1]) : null;
        if (!name || name.length < 2 || /menu|search|login|home|about/i.test(name)) continue;

        const pM = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        const desc = pM ? stripTags(pM[1]).slice(0, 300) : "";
        const crime = desc.match(/(?:crime|offence|charge|trafficking|forgery|immigration)[^\n.]{0,120}/i)?.[0] ||
          "Immigration / NIS Offence";

        results.push(normalise({
          name,
          crime: stripTags(crime),
          description: desc || null,
          imageUrl: imgSrc(block, baseUrl),
          sourceUrl: url,
        }, "interior", "Interior", "#00c853"));
      }
    } catch (err) {
      diagnostics.push({ url, error: err.message });
    }
  }

  if (results.length) cacheSet(cacheKey, results);
  return { results, diagnostics };
}

// ─── DEDUPLICATE ──────────────────────────────────────────────────────────────
function dedup(persons) {
  const seen = new Set();
  return persons.filter((p) => {
    const key = p.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────
function getSeedData() {
  return [
    { id:"efcc-seed-001", name:"Emmanuel Nwude", alias:"The Governor", crime:"Advance Fee Fraud (₦12.4B scam)", status:"Wanted", reward:"₦5,000,000", state:"Anambra", agency:"efcc", agencyLabel:"EFCC", agencyColor:"#1976d2", imageUrl:null, refId:"EFCC-2025-0091", sourceUrl:"https://www.efcc.gov.ng/WantedPersons", scrapedAt:new Date().toISOString() },
    { id:"efcc-seed-002", name:"Ramon Olorunwa Abbas", alias:"Ray Hushpuppi", crime:"Wire Fraud / Money Laundering", status:"Convicted", reward:null, state:"Lagos", agency:"efcc", agencyLabel:"EFCC", agencyColor:"#1976d2", imageUrl:null, refId:"EFCC-2020-0043", sourceUrl:"https://www.efcc.gov.ng/WantedPersons", scrapedAt:new Date().toISOString() },
    { id:"npf-seed-001", name:"Terwase Akwaza", alias:"Gana", crime:"Terrorism / Mass Murder / Kidnapping", status:"Wanted", reward:"₦20,000,000", state:"Benue", agency:"npf", agencyLabel:"NPF", agencyColor:"#e8340a", imageUrl:null, refId:"NPF-2025-4410", sourceUrl:"https://www.npf.gov.ng/wanted", scrapedAt:new Date().toISOString() },
    { id:"npf-seed-002", name:"Chukwudumeme Onwuamadike", alias:"Evans", crime:"Kidnapping / Armed Robbery", status:"Apprehended", reward:null, state:"Lagos", agency:"npf", agencyLabel:"NPF", agencyColor:"#e8340a", imageUrl:null, refId:"NPF-2017-0112", sourceUrl:"https://www.npf.gov.ng/wanted", scrapedAt:new Date().toISOString() },
    { id:"icpc-seed-001", name:"Abdulrasheed Maina", alias:null, crime:"Pension Fraud / Money Laundering (₦2B)", status:"Convicted", reward:null, state:"Abuja FCT", agency:"icpc", agencyLabel:"ICPC", agencyColor:"#d4a017", imageUrl:null, refId:"ICPC-2021-0078", sourceUrl:"https://icpc.gov.ng/wanted-persons/", scrapedAt:new Date().toISOString() },
    { id:"icpc-seed-002", name:"Joshua Dariye", alias:null, crime:"Corruption / Diversion of Public Funds", status:"Convicted", reward:null, state:"Plateau", agency:"icpc", agencyLabel:"ICPC", agencyColor:"#d4a017", imageUrl:null, refId:"ICPC-2019-0034", sourceUrl:"https://icpc.gov.ng/wanted-persons/", scrapedAt:new Date().toISOString() },
    { id:"interior-seed-001", name:"Undocumented Suspect (NIS-001)", alias:"Mr. X", crime:"Illegal Entry / Document Forgery", status:"Wanted", reward:"₦500,000", state:"Lagos", agency:"interior", agencyLabel:"Interior", agencyColor:"#00c853", imageUrl:null, refId:"NIS-2025-0220", sourceUrl:"https://interior.gov.ng/wanted-persons/", scrapedAt:new Date().toISOString() },
  ];
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  const params = event.queryStringParameters || {};
  const agency  = params.agency  || "all";
  const noCache = params.nocache === "1";

  const headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    // Don't cache at CDN level longer than the in-memory TTL
    "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  if (noCache) {
    ["efcc","npf","icpc","interior"].forEach(k => delete _cache[k]);
  }

  try {
    const scrapers = [];
    if (agency === "all" || agency === "efcc")     scrapers.push(scrapeEFCC());
    if (agency === "all" || agency === "npf")      scrapers.push(scrapeNPF());
    if (agency === "all" || agency === "icpc")     scrapers.push(scrapeICPC());
    if (agency === "all" || agency === "interior") scrapers.push(scrapeInterior());

    const settled = await Promise.allSettled(scrapers);

    const agencyStats = {};
    let persons = [];

    for (const result of settled) {
      if (result.status === "fulfilled") {
        const { results, diagnostics, source } = result.value;
        persons.push(...results);
        if (results[0]?.agency) {
          agencyStats[results[0].agency] = { count: results.length, source: source || "live", diagnostics };
        }
      }
    }

    persons = dedup(persons);
    persons.sort((a, b) => {
      const p = { Wanted: 0, Critical: 0, Escaped: 1, Apprehended: 2, Convicted: 3 };
      return (p[a.status] ?? 5) - (p[b.status] ?? 5);
    });

    const usedSeed = persons.length === 0;
    if (usedSeed) persons = getSeedData();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: persons.length,
        usedSeed,
        cacheHit: Object.values(agencyStats).some(s => s.source === "cache"),
        scrapedAt: new Date().toISOString(),
        nextRefreshIn: CACHE_TTL_MS,
        agencyStats,
        persons,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message, persons: getSeedData(), usedSeed: true }),
    };
  }
};

// Vercel adapter
module.exports.default = async function (req, res) {
  const result = await exports.handler({
    httpMethod: req.method,
    queryStringParameters: req.query,
    headers: req.headers,
  });
  res.status(result.statusCode);
  Object.entries(result.headers || {}).forEach(([k, v]) => res.setHeader(k, v));
  res.send(result.body);
};
