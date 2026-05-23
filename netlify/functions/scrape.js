/**
 * NGA-WATCH Scraper — Netlify Serverless Function
 * Endpoint: GET /.netlify/functions/scrape?agency=all|efcc|npf|icpc|interior
 *
 * Also works as Vercel API route at /api/scrape.js (same code, see /api/scrape.js)
 *
 * Each agency scraper handles that site's specific HTML structure.
 * Falls back to cached/mock data when the live site is unreachable.
 */

const https = require("https");
const http = require("http");

// ─── TINY HTML PARSER (no npm cheerio to keep bundle small) ───────────────────
function extractAttr(html, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["'][^>]*>`, "gi");
  const matches = [];
  let m;
  while ((m = re.exec(html))) matches.push(m[1]);
  return matches;
}

function extractText(html, tag, cls) {
  const clsPart = cls ? `[^>]*class=["'][^"']*${cls}[^"']*["']` : "";
  const re = new RegExp(`<${tag}${clsPart}[^>]*>([\\s\\S]*?)<\/${tag}>`, "gi");
  const matches = [];
  let m;
  while ((m = re.exec(html))) matches.push(stripTags(m[1]).trim());
  return matches;
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function fetchUrl(url, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; NGAWatch/1.0; +https://ngawatch.gov.ng)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
        },
        timeout,
      },
      (res) => {
        // Follow redirects up to 3 times
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          return fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ html: data, status: res.statusCode }));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

// ─── NORMALISE A PERSON RECORD ─────────────────────────────────────────────────
function normalise(raw, agency, agencyLabel, color) {
  return {
    id: `${agency}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: (raw.name || "Unknown").replace(/\s+/g, " ").trim(),
    alias: raw.alias || null,
    crime: raw.crime || "Not specified",
    status: raw.status || "Wanted",
    reward: raw.reward || null,
    state: raw.state || null,
    imageUrl: raw.imageUrl || null,
    description: raw.description || null,
    refId: raw.refId || null,
    agency,
    agencyLabel,
    agencyColor: color,
    sourceUrl: raw.sourceUrl || null,
    scrapedAt: new Date().toISOString(),
  };
}

// ─── EFCC SCRAPER ─────────────────────────────────────────────────────────────
// https://www.efcc.gov.ng/WantedPersons?page=N
// The EFCC site renders a card grid. Each card has:
//   .wanted-person-card with img, h3 (name), p.crime, p.status
async function scrapeEFCC(pages = 3) {
  const results = [];
  for (let p = 1; p <= pages; p++) {
    try {
      const url = `https://www.efcc.gov.ng/WantedPersons?page=${p}`;
      const { html } = await fetchUrl(url);

      // Extract card blocks between card wrapper divs
      const cardRe = /<div[^>]*class=["'][^"']*wanted[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?=<div|$)/gi;
      let m;
      while ((m = cardRe.exec(html))) {
        const block = m[1];
        const nameMatch = block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
        const crimeMatch = block.match(/(?:Crime|Offence)[^:]*:\s*([^\n<]+)/i) ||
          block.match(/<p[^>]*class=["'][^"']*crime[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
        const imgMatch = block.match(/<img[^>]*src=["']([^"']+)["']/i);
        const rewardMatch = block.match(/Reward[^:]*:\s*₦?([\d,]+)/i);
        const stateMatch = block.match(/(?:State|Location)[^:]*:\s*([^\n<]+)/i);

        if (nameMatch) {
          results.push(
            normalise(
              {
                name: stripTags(nameMatch[1]),
                crime: crimeMatch ? stripTags(crimeMatch[1]) : null,
                imageUrl: imgMatch
                  ? imgMatch[1].startsWith("http")
                    ? imgMatch[1]
                    : `https://www.efcc.gov.ng${imgMatch[1]}`
                  : null,
                reward: rewardMatch ? `₦${rewardMatch[1]}` : null,
                state: stateMatch ? stripTags(stateMatch[1]) : null,
                status: block.toLowerCase().includes("apprehend") ? "Apprehended" : "Wanted",
                sourceUrl: url,
              },
              "efcc",
              "EFCC",
              "#1976d2"
            )
          );
        }
      }

      // No cards found yet — try alternate pattern (table rows or list items)
      if (results.length === 0) {
        const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
        for (const row of rows) {
          const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
          if (cells.length >= 2) {
            const name = stripTags(cells[0]);
            const crime = stripTags(cells[1] || "");
            const state = stripTags(cells[2] || "");
            if (name && name.length > 3 && !/name|s\/n|#/i.test(name)) {
              results.push(
                normalise(
                  { name, crime, state, sourceUrl: url },
                  "efcc",
                  "EFCC",
                  "#1976d2"
                )
              );
            }
          }
        }
      }
    } catch (_) {
      // page failed, continue
    }
  }
  return results;
}

// ─── NPF SCRAPER ──────────────────────────────────────────────────────────────
// https://www.npf.gov.ng/wanted
// NPF uses a CMS that renders a list with divs: name, offence, state, photo
async function scrapeNPF() {
  const results = [];
  const urls = [
    "https://www.npf.gov.ng/wanted",
    "https://www.npf.gov.ng/wanted?page=1",
    "https://www.npf.gov.ng/wanted?page=2",
  ];
  for (const url of urls) {
    try {
      const { html } = await fetchUrl(url);

      // Pattern A: card/article based
      const articles = html.match(/<article[^>]*>([\s\S]*?)<\/article>/gi) ||
        html.match(/<div[^>]*class=["'][^"']*(?:wanted|person|criminal)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi) || [];

      for (const art of articles) {
        const name = extractText(art, "h[234]", "")[0] ||
          extractText(art, "strong", "")[0];
        const crime = art.match(/(?:Offence|Crime|Charge)[^:]*:\s*([^\n<]+)/i);
        const state = art.match(/(?:State|LGA|Zone)[^:]*:\s*([^\n<]+)/i);
        const img = art.match(/<img[^>]*src=["']([^"']+)["']/i);
        const reward = art.match(/Reward[^:]*:\s*₦?([\d,]+(?:\s*[Mm]illion)?)/i);

        if (name) {
          results.push(
            normalise(
              {
                name,
                crime: crime ? crime[1].trim() : null,
                state: state ? state[1].trim() : null,
                imageUrl: img
                  ? img[1].startsWith("http") ? img[1] : `https://www.npf.gov.ng${img[1]}`
                  : null,
                reward: reward ? `₦${reward[1]}` : null,
                sourceUrl: url,
              },
              "npf",
              "NPF",
              "#e8340a"
            )
          );
        }
      }

      // Pattern B: plain table
      if (results.length === 0) {
        const trs = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
        for (const tr of trs) {
          const tds = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map((t) =>
            stripTags(t)
          );
          if (tds.length >= 2 && tds[0].length > 2 && !/name|sn|#/i.test(tds[0])) {
            results.push(
              normalise(
                { name: tds[0], crime: tds[1], state: tds[2], sourceUrl: url },
                "npf",
                "NPF",
                "#e8340a"
              )
            );
          }
        }
      }
    } catch (_) {}
  }
  return results;
}

// ─── ICPC SCRAPER ─────────────────────────────────────────────────────────────
// https://icpc.gov.ng/wanted-persons/
// ICPC WordPress site typically renders posts with featured images
async function scrapeICPC() {
  const results = [];
  const urls = [
    "https://icpc.gov.ng/wanted-persons/",
    "https://icpc.gov.ng/wanted-persons/page/2/",
  ];
  for (const url of urls) {
    try {
      const { html } = await fetchUrl(url);

      // WordPress post entries
      const posts = html.match(/<article[^>]*>([\s\S]*?)<\/article>/gi) || [];
      for (const post of posts) {
        const title = post.match(/<h[12][^>]*class=["'][^"']*(?:entry|post)-title[^"']*["'][^>]*>([\s\S]*?)<\/h[12]>/i) ||
          post.match(/<h[234][^>]*>([\s\S]*?)<\/h[234]>/i);
        const img = post.match(/src=["']([^"']*(?:jpg|jpeg|png|webp)[^"']*)["']/i);
        const excerpt = post.match(/<div[^>]*class=["'][^"']*(?:entry|post)-(?:content|summary|excerpt)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
        const link = post.match(/<a[^>]*href=["']([^"']*icpc\.gov\.ng[^"']*)["']/i);

        // Parse crime from title or excerpt
        const fullText = title ? stripTags(title[1]) : "";
        const excerptText = excerpt ? stripTags(excerpt[1]).slice(0, 200) : "";
        const crimeMatch = excerptText.match(/(?:for|charge[d]? with|accused of)[^.]*?(?:fraud|corrupt|brib|embezzl|launder|theft|steal)[^.]*/i);

        if (fullText && fullText.length > 2) {
          results.push(
            normalise(
              {
                name: fullText.replace(/wanted:?\s*/i, "").trim(),
                crime: crimeMatch ? crimeMatch[0].trim() : "Corruption / Financial Crime",
                description: excerptText || null,
                imageUrl: img
                  ? img[1].startsWith("http") ? img[1] : `https://icpc.gov.ng${img[1]}`
                  : null,
                sourceUrl: link ? link[1] : url,
              },
              "icpc",
              "ICPC",
              "#d4a017"
            )
          );
        }
      }
    } catch (_) {}
  }
  return results;
}

// ─── INTERIOR (NIS) SCRAPER ───────────────────────────────────────────────────
// https://interior.gov.ng/wanted-persons/
// Ministry of Interior — typically a gallery or card layout
async function scrapeInterior() {
  const results = [];
  const url = "https://interior.gov.ng/wanted-persons/";
  try {
    const { html } = await fetchUrl(url);

    const posts = html.match(/<article[^>]*>([\s\S]*?)<\/article>/gi) ||
      html.match(/<div[^>]*class=["'][^"']*(?:item|card|person|wanted)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi) || [];

    for (const post of posts) {
      const title = post.match(/<h[1234][^>]*>([\s\S]*?)<\/h[1234]>/i);
      const img = post.match(/<img[^>]*src=["']([^"']+)["']/i);
      const desc = post.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const name = title ? stripTags(title[1]) : null;

      if (name && name.length > 2 && !/menu|search|login/i.test(name)) {
        const descText = desc ? stripTags(desc[1]).slice(0, 250) : "";
        results.push(
          normalise(
            {
              name,
              crime: descText.match(/(?:crime|offence|charge)[^\n.]*/i)?.[0] || "Immigration Offence",
              description: descText,
              imageUrl: img
                ? img[1].startsWith("http") ? img[1] : `https://interior.gov.ng${img[1]}`
                : null,
              sourceUrl: url,
            },
            "interior",
            "Interior",
            "#00c853"
          )
        );
      }
    }
  } catch (_) {}
  return results;
}

// ─── FALLBACK SEED DATA (shown when live scrape yields nothing) ────────────────
// Modelled on actual EFCC/NPF published data patterns
function getSeedData() {
  return [
    {
      id: "efcc-seed-001", name: "Emmanuel Nwude", alias: "The Governor",
      crime: "Advance Fee Fraud (₦12.4B scam)", status: "Wanted",
      reward: "₦5,000,000", state: "Anambra", agency: "efcc", agencyLabel: "EFCC",
      agencyColor: "#1976d2", imageUrl: null, refId: "EFCC-2025-0091",
      sourceUrl: "https://www.efcc.gov.ng/WantedPersons", scrapedAt: new Date().toISOString(),
    },
    {
      id: "efcc-seed-002", name: "Hushpuppi (Ramon Olorunwa Abbas)", alias: "Ray Hushpuppi",
      crime: "Wire Fraud / Money Laundering", status: "Convicted / Extradited",
      reward: null, state: "Lagos", agency: "efcc", agencyLabel: "EFCC",
      agencyColor: "#1976d2", imageUrl: null, refId: "EFCC-2020-0043",
      sourceUrl: "https://www.efcc.gov.ng/WantedPersons", scrapedAt: new Date().toISOString(),
    },
    {
      id: "npf-seed-001", name: "Terwase Akwaza", alias: "Gana",
      crime: "Terrorism / Mass Murder / Kidnapping", status: "Wanted",
      reward: "₦20,000,000", state: "Benue", agency: "npf", agencyLabel: "NPF",
      agencyColor: "#e8340a", imageUrl: null, refId: "NPF-2025-4410",
      sourceUrl: "https://www.npf.gov.ng/wanted", scrapedAt: new Date().toISOString(),
    },
    {
      id: "npf-seed-002", name: "Chukwudumeme Onwuamadike", alias: "Evans",
      crime: "Kidnapping / Armed Robbery", status: "Apprehended",
      reward: null, state: "Lagos", agency: "npf", agencyLabel: "NPF",
      agencyColor: "#e8340a", imageUrl: null, refId: "NPF-2017-0112",
      sourceUrl: "https://www.npf.gov.ng/wanted", scrapedAt: new Date().toISOString(),
    },
    {
      id: "icpc-seed-001", name: "Abdulrasheed Maina", alias: null,
      crime: "Pension Fraud / Money Laundering (₦2B)", status: "Convicted",
      reward: null, state: "Abuja FCT", agency: "icpc", agencyLabel: "ICPC",
      agencyColor: "#d4a017", imageUrl: null, refId: "ICPC-2021-0078",
      sourceUrl: "https://icpc.gov.ng/wanted-persons/", scrapedAt: new Date().toISOString(),
    },
    {
      id: "icpc-seed-002", name: "Joshua Dariye", alias: null,
      crime: "Corruption / Diversion of Public Funds", status: "Convicted",
      reward: null, state: "Plateau", agency: "icpc", agencyLabel: "ICPC",
      agencyColor: "#d4a017", imageUrl: null, refId: "ICPC-2019-0034",
      sourceUrl: "https://icpc.gov.ng/wanted-persons/", scrapedAt: new Date().toISOString(),
    },
    {
      id: "interior-seed-001", name: "John Doe (Undocumented)", alias: "Mr. X",
      crime: "Illegal Entry / Document Forgery", status: "Wanted",
      reward: "₦500,000", state: "Lagos", agency: "interior", agencyLabel: "Interior",
      agencyColor: "#00c853", imageUrl: null, refId: "NIS-2025-0220",
      sourceUrl: "https://interior.gov.ng/wanted-persons/", scrapedAt: new Date().toISOString(),
    },
  ];
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  const agency = event.queryStringParameters?.agency || "all";

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600", // cache for 1 hour
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    let scrapers = [];
    if (agency === "all" || agency === "efcc") scrapers.push(scrapeEFCC());
    if (agency === "all" || agency === "npf") scrapers.push(scrapeNPF());
    if (agency === "all" || agency === "icpc") scrapers.push(scrapeICPC());
    if (agency === "all" || agency === "interior") scrapers.push(scrapeInterior());

    const results = await Promise.allSettled(scrapers);
    let persons = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    // Deduplicate by normalised name
    const seen = new Set();
    persons = persons.filter((p) => {
      const key = p.name.toLowerCase().replace(/\s+/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort: Wanted first, then Apprehended/Convicted
    persons.sort((a, b) => {
      const priority = { Wanted: 0, Escaped: 1, Apprehended: 2, Convicted: 3 };
      return (priority[a.status] ?? 5) - (priority[b.status] ?? 5);
    });

    // If live scrape got nothing, return seed data with a flag
    const usedSeed = persons.length === 0;
    if (usedSeed) persons = getSeedData();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: persons.length,
        usedSeed,
        scrapedAt: new Date().toISOString(),
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
