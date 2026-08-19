# FloresEarthquake
Situation report for Earthquake in Flores

## Site structure
As of Situation Report 14, the SitRep is a multi-page static site (previously a
single long-scrolling page, preserved as a redirect at `sitrep.html`):

| Page | Content |
|---|---|
| `index.html` | Overview — headline-figure infographic, executive summary, first-24-hours priorities, timeline |
| `hazards.html` | Live BMKG feed, aftershock sequence, liquefaction, observed tsunami |
| `impact.html` | Affected-regency map, confirmed impacts/gaps, emergency status |
| `response.html` | BNPB coordination directive, Basarnas SAR, priority areas |
| `health.html` | Health facilities, disease surveillance, vulnerable groups, animal health |
| `economy.html` | Economic and service-disruption impacts |
| `reports.html` | Official report archive, sources and methodology |

`sitrep.js` loads `data/impact.json` on every page (shared masthead) and
loads the other JSON files / the live BMKG feed only on the page(s) that use
them (see the `data-page` attribute on each `<body>`), to keep page loads
lighter on constrained connections.
