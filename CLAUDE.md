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

After editing haulvisor-core locally, rebuild it (`cd ../haulvisor-core && npm run build`). Changes are picked up immediately through the symlink — just restart your dev server if types changed.

## Architecture

This project uses a feature-based module structure (`core/`, `features/`, `platform/`). See README.md for the full directory layout and dependency rules. Page files in `app/` are thin shells (~10 lines) that delegate to platform-specific views.
