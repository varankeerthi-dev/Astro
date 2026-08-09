# Marketing Site — SEO Audit Report

**Project:** BillFast / PerfectERP Marketing (`apps/marketing`)  
**Framework:** Astro + React + Tailwind v4  
**CMS/Backend:** Supabase (PostgreSQL) via hybrid SSR (`@astrojs/vercel`)  
**Live site:** https://perfecterp.com  
**Local test build:** http://localhost:3000  
**Audit tool:** SEOmator `@seomator/seo-audit` v3.0.1  
**Audit date:** 2026-08-09  
**Auditor:** Kilo (automated)

---

## 1. What This App Is

`apps/marketing` is the **public-facing marketing website** for the BillFast / PerfectERP product. It is an Astro application that serves:

- Homepage and core marketing pages (`/`, `/pricing`, `/client`)
- Industry-specific landing pages (`/industries/construction-erp`, `/industries/fabrication-erp`, `/industries/manufacturing-erp`, `/industries/project-management-erp`, `/industries/sme-erp-software`)
- Blog, help center, knowledge base, and release notes
- Location/geo landing pages
- Search and media endpoints
- A full admin CMS shell at `/admin` for managing pages, banners, announcements, SEO, media, blog, locations, help, releases, users, and audit logs

The project is wired to **Supabase** for content, auth, and settings. Key architectural decisions from the project docs:

- Hybrid rendering via `@astrojs/vercel`; static pages are prerendered by default, CMS/admin routes opt into on-demand SSR
- `checkOrigin: false` in `astro.config.mjs` to allow admin form POSTs; CSRF protection is handled by `httpOnly` session cookies + `SameSite=Lax`
- `@astrojs/sitemap` was removed in favor of a dynamic `src/pages/sitemap.xml.ts`
- A central `Seo.astro` component and `JsonLd.astro` component were added to emit canonical, robots, OG/Twitter, and JSON-LD tags
- `robots.txt` and `sitemap.xml` are dynamic endpoints driven by the CMS

---

## 2. How the Audit Was Performed

1. **Built the project locally** with `npm run build` from `C:\Users\admin\mep-project\apps\marketing`.
2. **Served the built output** on `http://localhost:3000` using `serve` so the audit tool could crawl actual rendered HTML.
3. **Ran SEOmator** against the local server:
   - Mode: **crawl** with `--max-pages 20`
   - Output: **LLM format**
   - CWV measurement: **skipped** (`--no-cwv`) because local previews do not produce real-user network conditions
   - Result saved to the local `.seomator` database as audit ID `2026-08-08-ghcfgd`
4. **Exported the report** with `seomator report 2026-08-08-ghcfgd --format llm` and analyzed the findings.

### Scope / Coverage

- **18 pages** discovered and audited
- **20 categories** checked
- **251 rules** evaluated per page

### Important Caveat About Local Testing

Several findings are **artifacts of local preview serving** rather than true production defects:

| Artifact | Why it appears locally | Real production expectation |
|---|---|---|
| `security-https` / `security-ssl-*` failures | Served over `http://localhost:3000` | Vercel provides HTTPS; these should pass in production |
| `performance` CWV warnings | No real-user network conditions in local preview | CWV metrics require live browser measurement on production |
| `security-hsts` warnings | HSTS only applies to HTTPS | Should be fine once HTTPS is enforced |

Because of this, the **real code-level defects** to focus on are missing meta tags, thin content, missing structured data, broken internal links, missing `robots.txt`/`sitemap.xml` in dev, and accessibility issues.

---

## 3. Parameters & Categories Checked

| # | Category | Rules | Weight |
|---|---|---|---|
| 1 | Core | 19 | 12% |
| 2 | Technical SEO | varies | — |
| 3 | Performance | varies | — |
| 4 | Links | varies | — |
| 5 | Images | varies | — |
| 6 | Security | varies | — |
| 7 | Crawlability | varies | — |
| 8 | Structured Data | varies | — |
| 9 | Accessibility | varies | — |
| 10 | Content | varies | — |
| 11 | Social | varies | — |
| 12 | E-E-A-T | varies | — |
| 13 | URL Structure | varies | — |
| 14 | Mobile | varies | — |
| 15 | Internationalization | varies | — |
| 16 | Legal Compliance | varies | — |
| 17 | JavaScript Rendering | varies | — |
| 18 | Redirects | varies | — |
| 19 | HTML Validation | varies | — |
| 20 | AI/GEO Readiness | varies | — |

---

## 4. Overall Scorecard

| Metric | Count |
|---|---|
| Overall Score | **94 / 100 (Grade A)** |
| Total Rules Evaluated | 4,518 |
| Passed | 3,378 |
| Warnings | 705 |
| Failures | 435 |

### Category Scores

| Category | Score | Passed | Warnings | Failed |
|---|---|---|---|---|
| Social | 77% | 30 | 48 | 84 |
| AI/GEO Readiness | 85% | 36 | 30 | 24 |
| Security | 86–88% | 108 | 80 | 100 |
| E-E-A-T | 86% | 143 | 109 | 0 |
| Performance | 89% | 252 | 144 | 0 |
| Structured Data | 89% | 144 | 78 | 12 |
| Technical SEO | 93–95% | 149 | 44 | 41 |
| Accessibility | 92–96% | 163 | 45 | 8 |
| Core | 94–99% | 222 | 38 | 82 |
| Links | 97–100% | 303 | 23 | 16 |
| Crawlability | 97–98% | 288 | 30 | 6 |
| Content | 88–100% | 235 | 21 | 50 |
| URL Structure | 98–100% | 245 | 7 | 0 |
| HTML Validation | 97–100% | 154 | 8 | 0 |
| Images | 100% | 252 | 0 | 0 |
| Mobile | 100% | 86 | 0 | 4 |
| Internationalization | 100% | 172 | 0 | 8 |
| Legal Compliance | 100% | 18 | 0 | 0 |
| JavaScript Rendering | 100% | 234 | 0 | 0 |
| Redirects | 100% | 144 | 0 | 0 |

---

## 5. Detailed Findings

### 5.1 Security (86–88%) — 100 errors, 80 warnings

**Root cause:** The site is being served over plain HTTP in local preview. In production on Vercel these are expected to resolve to HTTPS, but some are also genuine missing-response-header issues.

Errors:
- `security-https` — HTTP served instead of HTTPS (18 pages; local artifact)
- `security-https-redirect` — HTTP accessible without redirect to HTTPS (10 pages; local artifact)
- `security-x-frame-options` — Missing `X-Frame-Options` or CSP `frame-ancestors` (18 pages)
- `security-x-content-type-options` — Missing `X-Content-Type-Options: nosniff` (18 pages)
- `security-ssl-expiry` — No SSL in use (18 pages; local artifact)
- `security-ssl-protocol` — TLS check not applicable (18 pages; local artifact)

Warnings:
- `security-hsts` — HSTS only applies to HTTPS (18 pages; local artifact)
- `security-csp` — Missing Content-Security-Policy header (18 pages)
- `security-permissions-policy` — Missing Permissions-Policy header (18 pages)
- `security-referrer-policy` — Referrer-Policy not set (18 pages)

### 5.2 Social (77%) — 84 errors, 48 warnings

**Root cause:** The `Seo.astro` component has OG/Twitter fields, but several pages are not passing `seo` records or settings defaults, and some OG tags are not rendering on 12 pages.

Errors:
- `social-og-title` — Missing `<meta property="og:title">` (12 pages)
- `social-og-description` — Missing `<meta property="og:description">` (12 pages)
- `social-og-image` — Missing `<meta property="og:image">` (18 pages)
- `social-og-image-size` — Cannot check dimensions because no `og:image` (18 pages)
- `social-twitter-card` — Missing `<meta name="twitter:card">` (12 pages)
- `social-og-url` — Missing `<meta property="og:url">` (12 pages)

Warnings:
- `social-og-url-canonical` — Neither `og:url` nor canonical found (12 pages)
- `social-share-buttons` — No social sharing buttons detected (18 pages)
- `social-profiles` — No social media profile links found (18 pages)

### 5.3 Core SEO (94–99%) — 82 errors, 38 warnings

**Root cause:** Several pages (`/pricing`, `/industries/*`, some `/client/*` routes) are missing `<title>`, `<meta description>`, `<link rel="canonical">`, and favicon. Some canonical URLs point to HTTPS while the page itself is on HTTP.

Errors:
- `core-description-present` — No `<meta name="description">` (12 pages)
- `core-canonical-present` — No `<link rel="canonical">` (12 pages)
- `core-favicon-present` — No favicon link tag (12 pages)
- `core-canonical-http-mismatch` — Page is HTTP but canonical points to HTTPS (6 pages)
- `core-title-present` / `core-title-length` / `core-h1-present` / `core-h1-single` / `core-title-unique` — No `<title>` or `<h1>` on 8 pages

Warnings:
- `core-title-length` — Title too short: 18 characters on `/`, `/client`, `/client/industries/sme-erp-software`
- `core-description-length` — No description on 12 pages; too short on 5 industry pages (97 chars)
- `core-canonical-valid` — No canonical on 12 pages
- `core-canonical-loop` — Canonical points to a different URL on `/client/pricing` and each industry page

### 5.4 Content (88–100%) — 50 errors, 21 warnings

**Root cause:** Many pages have extremely thin or missing body text. Several industry pages and pricing page have low text-to-HTML ratio. The pricing page has keyword stuffing and high link density.

Errors:
- `content-word-count` — Extremely thin content: 1 word minimum (17 pages)
- `content-duplicate-description` — No meta description (12 pages)
- `content-text-html-ratio` — Very low ratio on `/`, `/client`, `/client/_astro`, `/client/industries`, and 8 industry/pricing pages
- `content-keyword-stuffing` — Keyword stuffing on `/client/pricing`
- `content-heading-hierarchy` — No headings on 8 pages (`/pricing`, `/industries/*`)

Warnings:
- Thin content on `/client/pricing` (115 words)
- Reading level too complex on pricing and industry pages
- Link density too high on pricing (20 links per 100 words)
- Heading hierarchy issues on pricing
- Short headings on pricing and industry pages
- Low text-to-HTML ratio warnings on pricing and all 5 industry pages
- Reading level warnings on all 5 industry pages

### 5.5 Technical SEO (93–95%) — 41 errors, 44 warnings

**Root cause:** `robots.txt` returns 404 in local dev because it only exists on the on-demand runtime; `sitemap.xml` has the same limitation. WWW/non-WWW both accessible. A `/client/_astro` URL path contains underscores.

Errors:
- `technical-robots-txt-exists` — `robots.txt` returned 404 (18 pages)
- `technical-sitemap-exists` — No `sitemap.xml` found (18 pages)
- `technical-www-redirect` — Both www and non-www accessible (4 pages)
- `technical-url-structure` — URL contains underscores: `/client/_astro`

Warnings:
- `technical-robots-txt-valid` — Cannot validate because 404 (18 pages)
- `technical-sitemap-valid` — Cannot validate because missing (18 pages)
- `technical-www-redirect` — WWW returned 404, non-www returned 404 on 8 pages

### 5.6 Structured Data (89%) — 12 errors, 78 warnings

**Root cause:** Most pages do not pass JSON-LD data. The `Seo.astro` component supports JSON-LD, but the page templates are not providing schema objects for most routes.

Errors:
- `schema-present` — No structured data on 12 pages

Warnings:
- `schema-valid` / `schema-type` / `schema-required-fields` — No JSON-LD to validate (18 pages)
- `schema-website-search` — Homepage missing `WebSite` schema
- `schema-breadcrumb` — Non-homepage pages missing `BreadcrumbList` schema (17 pages)
- Some pages have RDFa but not JSON-LD

### 5.7 Accessibility (92–96%) — 8 errors, 45 warnings

**Root cause:** Several pages disable user zoom via viewport meta tag, are missing `<main>` landmarks, skip links, and have touch target sizing and heading order issues.

Errors:
- `a11y-zoom-disabled` — Viewport prevents user zoom on 8 pages (`/pricing`, `/industries/*`, and 3 more)

Warnings:
- `a11y-landmark-regions` — Missing `<main>`, banner/header landmarks on multiple pages
- `a11y-touch-targets` — Touch target sizing issues on `/`, `/client`, `/client/_astro`, `/client/industries`, and 8 industry/pricing pages
- `a11y-heading-order` — Heading hierarchy issues on `/client/pricing`; no headings on 8 pages
- `a11y-skip-link` — No skip link on 6 pages

### 5.8 Internationalization (100% but 8 errors)

**Root cause:** Missing `lang` attribute on `<html>` element on 8 pages.

- `i18n-lang-attribute` — No `lang` attribute on 8 pages

### 5.9 Mobile (100% but 4 errors)

**Root cause:** Critical font-size issues below 12px on 4 pages.

- `mobile-font-size` — Found 1 critical font size issue below 12px on `/`, `/client`, `/client/_astro`, `/client/industries`

### 5.10 E-E-A-T (86%) — 0 errors, 109 warnings

**Root cause:** No about page, no contact page, no author bylines, no content dates, no privacy policy link, and YMYL financial content lacks disclaimers.

- `eeat-about-page` — No about page link found (18 pages)
- `eeat-author-byline` — No author byline (18 pages)
- `eeat-author-expertise` — No author present (18 pages)
- `eeat-contact-page` — No contact page or contact methods (12 pages)
- `eeat-content-dates` — No content date signals (18 pages)
- `eeat-privacy-policy` — No privacy policy link (18 pages)
- `eeat-citations` — External links exist but none to recognized authoritative sources
- `eeat-disclaimers` — YMYL financial content without appropriate disclaimers on `/client/industries/sme-erp-software`

### 5.11 Links (97–100%) — 16 errors, 23 warnings

**Root cause:** Localhost/development URLs leaked into production HTML. Broken internal links on 6 pages. Some external links are unreachable.

Errors:
- `links-localhost` — Found localhost/development URL references on `/`, `/client`, `/client/_astro`, `/client/industries`, `/client/pricing`, and industry pages
- `links-broken-internal` — 15 broken internal links out of 18 on 6 pages
- `links-external-valid` — Unreachable external links on pricing and industry pages

Warnings:
- `links-invalid` — 1 empty `href` on `/client/pricing`
- `links-internal-present` — No internal links on 8 pages
- `links-dead-end-pages` — Dead-end pages with no outgoing internal links on 8 pages

### 5.12 Crawlability (97–98%) — 6 errors, 30 warnings

**Root cause:** `robots.txt` and `sitemap.xml` missing in local dev. Canonical URLs return 404 in some cases.

Errors:
- `crawl-canonical-redirect` — Canonical URL returns HTTP 404 on 6 pages
- Warnings about missing sitemap and canonical tags

### 5.13 Performance (89%) — 0 errors, 144 warnings

**Root cause:** CWV metrics could not be measured in local preview. Missing Brotli compression, cache headers, HTTP/2 hints, and font `display=swap` parameters.

- `cwv-*` — Could not measure LCP, CLS, INP, TTFB, FCP on 18 pages (local artifact)
- `perf-brotli` — Using gzip but not Brotli (18 pages)
- `perf-cache-policy` — No caching headers (12 pages)
- `perf-http2` — No alt-svc header (18 pages)
- `perf-font-loading` — Google Fonts missing `display=swap` (6 pages)

---

## 6. Key Takeaways

1. **The app is a CMS-backed marketing site** with a Supabase-driven admin panel. The public pages are mostly Astro components that should pull SEO data from the CMS, but many pages are not receiving or rendering that data correctly.

2. **The biggest production-impacting issues** are:
   - Missing or incomplete `<title>`, `<meta description>`, and canonical tags on multiple pages
   - Missing Open Graph and Twitter Card tags
   - Extremely thin content on many pages
   - Missing JSON-LD structured data
   - Broken internal links
   - Missing `robots.txt` and `sitemap.xml` in dev (should be fixed by the dynamic endpoints already in the code)

3. **Security headers** (`X-Frame-Options`, `X-Content-Type-Options`, CSP, HSTS, Permissions-Policy, Referrer-Policy) are genuinely missing and should be added via Vercel configuration or middleware.

4. **Accessibility issues** include disabled zoom, missing landmarks, skip links, and touch target sizing.

5. **E-E-A-T signals** are weak: no about page, contact page, author bylines, content dates, or privacy policy.

6. **Several issues are local-preview artifacts** and will likely resolve when deployed to Vercel over HTTPS (security HTTPS/SSL, CWV measurement).

---

## 7. Recommended Next Steps

Priority order for remediation:

1. **Fix missing meta tags** on all public pages via `Seo.astro` and page props/CMS data
2. **Add content** to thin pages to reach minimum word counts
3. **Add JSON-LD schema** (`WebSite`, `BreadcrumbList`, `Organization`) to all pages
4. **Fix broken internal links** and remove localhost references from production HTML
5. **Add missing security headers** via Vercel `headers.json` or Astro middleware
6. **Ensure `robots.txt` and `sitemap.xml`** are served correctly in production
7. **Add OG/Twitter tags** consistently across all pages
8. **Fix accessibility issues**: zoom, landmarks, skip links, touch targets
9. **Add E-E-A-T pages**: about, contact, privacy policy
10. **Re-audit after fixes** to verify score improvement

---

*Report generated by Kilo using SEOmator `@seomator/seo-audit` v3.0.1*
