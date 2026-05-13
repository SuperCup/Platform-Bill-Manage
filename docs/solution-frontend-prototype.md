# Frontend Prototype Solution (No Canvas UI)

## Goal

Implement the requested 3-system **frontend interaction** design **inside the repo**, without using Cursor Canvas UI.

## Deliverables

### 1) System communication architecture diagram

- Implemented as an **SVG diagram** on the `#/arch` route.
- Shows:
  - In-Store Platforms → In-Store Marketing (API sync)
  - Instant Retail Platforms → Instant Retail (crawler)
  - Both business systems ↔ PMS (cost aggregation and shared project pool)
  - PMS → outputs (settlement / inventory monitoring / finance cost rollup)

### 2) Necessary functional pages per system

#### In-Store Marketing (`#/marketing`)
- **Activities**: list + filters + “New Activity” modal + project link entry point
- **Bill Aggregation**: batch/manual aggregation actions + no-overlap rule callout + list view
- **Monthly Cost**: summary stats + rollup table

Key rules represented:
- Aggregation by activity, **no overlap**
- Auto-run on 1st day of each month, manual trigger supported
- Project-change reference validation is shown as a rule callout + modal copy

#### Instant Retail (`#/retail`)
- **Bill Import**: crawl status cards and cost records (Month + Customer + Entity)
- **Cost Allocation**: allocation target selector + project allocation table + detail auto-split table (editable remainder)
- **Allocation Records**: list of historical allocations (adjust action)

Key rules represented:
- No activity id on bills → operate at **Month + Customer + Secondary Entity**
- Operator allocation (monthly) with **auto-split** and **editable** detail items
- Allocation can be adjusted and then aggregated

#### PMS (`#/pms`)
- **Projects**: quote/cost/remaining inventory, highlighted inventory risk
- **Cost Monitoring**: inventory warning list
- **Settlement & Invoicing**: settlement records with status and actions

Key rules represented:
- Remaining inventory = quote - aggregated cost
- Warning list for low remaining inventory

## Implementation

Location: `web/`

### Folder split (per system)

- `web/index.html` — layout shell (top bar + sidebar + main content)
- `web/main.js` — app entry (router + global actions)
- `web/styles.css` — admin-style theme similar to screenshot (white surfaces + blue accent)

Per-system pages:
- `web/arch/page.js`
- `web/marketing/page.js`
- `web/retail/page.js`
- `web/pms/page.js`

Shared modules:
- `web/shared/data.js` — mock data
- `web/shared/ui.js` — UI rendering helpers (tables/tabs/callouts/modals/toasts)
- `web/shared/router.js` — hash router helpers
- `web/shared/format.js` — formatting helpers
- `web/shared/dom.js` — DOM helpers

## How to run

- Open `web/index.html` in a browser, or
- Serve the `web/` folder via any static server.

