# NGA-WATCH — Nigerian Criminal Wanted Catalogue

A deployable React + serverless application that aggregates **publicly published** wanted persons records from Nigerian federal law enforcement agencies into a unified, searchable database.

---

## 🏛️ Data Sources

| Agency | URL | Crimes Covered |
|--------|-----|----------------|
| **EFCC** | https://www.efcc.gov.ng/WantedPersons | Financial fraud, cybercrime, money laundering |
| **NPF** | https://www.npf.gov.ng/wanted | Armed robbery, kidnapping, terrorism, murder |
| **ICPC** | https://icpc.gov.ng/wanted-persons/ | Corruption, bribery, embezzlement |
| **Interior/NIS** | https://interior.gov.ng/wanted-persons/ | Immigration offences, trafficking, forgery |

> All records are sourced exclusively from **publicly accessible government websites**. This platform is an aggregator and search tool under Nigeria's Freedom of Information Act (FOI Act 2011).

---

## 🚀 Deployment (Choose one)

### Option A — Netlify (Recommended)

```bash
# 1. Clone and install
git clone <your-repo-url> nga-watch
cd nga-watch
npm install

# 2. Install Netlify CLI
npm install -g netlify-cli

# 3. Copy environment variables
cp .env.example .env
# Edit .env with your values

# 4. Run locally (functions + frontend together)
netlify dev

# 5. Deploy to production
netlify deploy --prod
```

The scraper runs as a Netlify Function at `/.netlify/functions/scrape`.

---

### Option B — Vercel

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy (follow the prompts)
vercel

# 3. Set environment variables in Vercel dashboard
# Or via CLI:
vercel env add VITE_GOOGLE_MAPS_KEY
```

The scraper runs as a Vercel Serverless Function at `/api/scrape`.

---

## 🛠️ Local Development

```bash
npm install
cp .env.example .env

# With Netlify (runs functions + dev server)
npm install -g netlify-cli
netlify dev

# Without functions (frontend only, shows seed data)
npm run dev
```

---

## 📁 Project Structure

```
nga-watch/
├── src/
│   ├── components/
│   │   ├── Header.jsx          # Sticky nav header
│   │   ├── Hero.jsx            # Stats banner + live ticker
│   │   ├── AgencyBar.jsx       # Agency filter tabs
│   │   ├── FilterSidebar.jsx   # Search/filter panel
│   │   ├── WantedCard.jsx      # Person card in grid
│   │   └── PersonModal.jsx     # Detailed profile modal
│   ├── pages/
│   │   ├── Home.jsx            # Main database view
│   │   ├── Agencies.jsx        # Agency profiles & stats
│   │   ├── Map.jsx             # Geographic view
│   │   └── SubmitTip.jsx       # Anonymous tip form
│   ├── hooks/
│   │   └── useWantedPersons.js # Data fetching hook
│   ├── utils/
│   │   └── helpers.js          # Filters, constants, formatters
│   ├── styles/
│   │   └── global.css          # Design tokens, global styles
│   ├── App.jsx
│   └── main.jsx
├── netlify/
│   └── functions/
│       └── scrape.js           # Netlify serverless scraper
├── api/
│   └── scrape.js               # Vercel serverless scraper (same code + adapter)
├── netlify.toml                # Netlify config
├── vercel.json                 # Vercel config
├── vite.config.js
└── index.html
```

---

## 🔌 Adding More Agencies

To add a new agency (e.g. DSS, NDLEA), edit `netlify/functions/scrape.js`:

```js
// 1. Add a new scraper function
async function scrapeDSS() {
  const results = []
  const { html } = await fetchUrl('https://www.dss.gov.ng/wanted')
  // Parse the HTML — each site has a different structure
  // Look for card divs, table rows, or article elements
  // Extract: name, crime, state, imageUrl, status
  return results
}

// 2. Register it in the main handler
if (agency === 'all' || agency === 'dss') scrapers.push(scrapeDSS())

// 3. Add to AGENCIES array in src/utils/helpers.js
{ id: 'dss', label: 'DSS', color: '#7c3aed', ... }
```

---

## 🗺️ Enabling Google Maps

1. Create a project in Google Cloud Console
2. Enable **Maps JavaScript API** and **Geocoding API**
3. Add your key to `.env`:
   ```
   VITE_GOOGLE_MAPS_KEY=AIza...
   ```
4. Install the library:
   ```bash
   npm install @react-google-maps/api
   ```
5. Replace the schematic in `src/pages/Map.jsx` with `<GoogleMap />`

---

## 🎯 Planned Features (Phase 2)

- [ ] AWS Rekognition face search (agency login required)
- [ ] Auth0 role-based access (public vs agency)
- [ ] Firebase Cloud Messaging push alerts
- [ ] Full-text search with PostgreSQL/Supabase
- [ ] Pagination and infinite scroll
- [ ] Responsive mobile layout
- [ ] INTERPOL red notice integration
- [ ] Case status change webhooks

---

## ⚖️ Legal Notice

- Data sourced from public government websites under FOI Act 2011
- No classified or unpublished data is accessed
- All records remain property of their originating agencies
- Misuse is an offence under the Cybercrimes Act 2015
- Whistleblower tips protected under the Whistleblower Protection Act 2011

---

## 📞 Emergency Numbers

| Service | Number |
|---------|--------|
| Emergency | **112** |
| EFCC Tip Line | **0800-883-2679** |
| Police | **199** |
| Ministry of Interior | **08100046474** |
