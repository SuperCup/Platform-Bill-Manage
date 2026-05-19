# Platform-Bill-Manage (Frontend Only Prototype)

This repository contains a **frontend-only** interactive prototype for three systems:

- **In-Store Marketing** (WeChat / Alipay / Douyin)
- **Instant Retail** (Meituan / Taobao / JD Daojia / Dmall)
- **PMS** (Project Management System)

## Run

No build tools are required.

- **Option A (simplest)**: open `web/index.html` directly in your browser.
- **Option B (recommended)**: serve the `web/` folder via a local static server (any server works).

```bash
cd web && python -m http.server 8080
# http://localhost:8080/
```

## Deploy (public access)

| Platform | Config | Docs |
|----------|--------|------|
| **Netlify** | `netlify.toml` (publish `web/`) | [docs/deploy.md](docs/deploy.md) |
| **GitHub Pages** | `.github/workflows/deploy-pages.yml` | Enable **Pages → GitHub Actions** in repo settings |

After deploy:

- GitHub Pages: `https://supercup.github.io/Platform-Bill-Manage/`
- Netlify: your `*.netlify.app` URL (or custom domain)

## Pages

- `#/arch` — system communication architecture diagram (SVG)
- `#/marketing` — activities / bill aggregation / monthly cost
- `#/retail` — import status / cost allocation / allocation records
- `#/pms` — projects / cost monitoring / settlement & invoicing

## Notes

- Data is **mocked**; actions show toasts/modals only.
- The UI style follows a modern admin layout similar to the provided screenshots.

