# haulvisor - Claude Guidelines

## CRITICAL SAFETY RULE

**haulvisor is a data analysis platform only.** It receives normalized order data from external modules and displays it. It does NOT:
- Scrape, crawl, or directly access any third-party website
- Submit forms or trigger actions on external systems
- Store credentials for external services

## No PII in Repository

Never include personally identifying information in committed code or files. This includes:
- Real usernames, passwords, or credentials (use .env files, which are gitignored)
- Real names, phone numbers, email addresses
- JWT tokens or session data
- Company names or identifiable company information (companies are referenced by UUID only)

## No Company Names

This is a public repository. Never include company names, company-specific URLs, or any information that identifies which companies use this platform. Companies are identified by UUID only.

## Shared Core Package

Shared TypeScript types, constants, and utility functions live in the standalone [`haulvisor-core`](https://github.com/mwbhtx/haulvisor-core) repo and are consumed as `@mwbhtx/haulvisor-core`. Both frontend and backend import from this package — do NOT duplicate type definitions, constants, or cost-model logic locally.

After editing haulvisor-core, push to `main` — CI auto-publishes a new version to GitHub Packages. Then run `npm update @mwbhtx/haulvisor-core` in consuming repos to pull the latest. Do NOT use symlinks or `file:` references.

## Mobile Text Size Standards

The user base includes older users with vision difficulties. **Always use these minimum text sizes on mobile** — never use `text-xs` for primary content on mobile views:

| Element | Minimum class | Size |
|---------|--------------|------|
| Body text, labels, values | `text-base` | 16px |
| Secondary info (dates, metadata) | `text-sm` | 14px |
| Section headings | `text-sm` uppercase | 14px |
| Card titles / route names | `text-base` or `text-lg` | 16–18px |
| Metric values ($/day, profit) | `text-lg` or `text-xl` | 18–20px |
| Icons (tappable) | `h-5 w-5` minimum | 20px |
| Tappable buttons | `h-9 w-9` minimum | 36px |
| Badges / chips | `text-xs` | 12px (okay for non-essential labels) |

`text-xs` (12px) is only acceptable for non-essential decorative labels (badges, tracking-wider labels). Everything a user needs to read or tap must meet the minimums above.

**Country labels:** Never show country name (always USA). Use `city, state` format only. The shared helper `shortLabel()` in route-helpers or inline `.split(",").slice(0, 2)` handles this.

## Architecture

This project uses a feature-based module structure (`core/`, `features/`, `platform/`). See README.md for the full directory layout and dependency rules. Page files in `app/` are thin shells (~10 lines) that delegate to platform-specific views.
