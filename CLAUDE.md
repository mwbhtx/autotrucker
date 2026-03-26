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

## Shared Types

Shared TypeScript interfaces and enums are published as `@mwbhtx/haulvisor-types` on GitHub Packages. The frontend imports from this package — do NOT duplicate type definitions locally.
