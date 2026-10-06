# Remindi Software 

**AMC Management Software for Indian Service Contractors.**

Remindi is a B2B SaaS platform that helps service contractors in India manage their Annual Maintenance Contracts — from quotations and invoices to client tracking and payment records. Built for electricians, HVAC technicians, plumbers, and other field service professionals who want to move away from manual paperwork and run their contracts digitally.

> Live at [remindi.online](https://remindi.online)

---

## The Problem

Managing AMCs manually is painful — scattered Excel sheets, handwritten quotations, missed renewal dates, and clients who never received a proper invoice. Remindi fixes that.

---

## Features

- **Quotation Generation** — Create professional PDF quotations with your company branding, GSTIN/PAN details, itemized line items, and GST breakdowns
- **Invoice Generation** — Convert quotations to invoices in one click; includes payment details (bank transfer + UPI), amount in words, and optional order numbers
- **Client Management** — Maintain a clean database of your AMC clients with contract details
- **Company Profile** — Set up your business once (name, address, GSTIN, PAN, logo) and it auto-populates across all documents
- **PDF Thumbnails** — Optional branded header thumbnail on all PDF exports
- **GST-Compliant Documents** — CGST/SGST/IGST breakdown, tax totals, and compliant invoice formatting out of the box

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js + React |
| Styling | Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| PDF Generation | Custom PDF renderer |
| Deployment | Vercel |

---

## Database

Remindi uses Supabase with the following key tables:

| Table | Purpose |
|---|---|
| `company_profile` | Business name, address, GSTIN, PAN, logo, and payment details |
| `clients` | AMC client records |
| `contracts` | AMC contract details linked to clients |
| `quotations` | Quotation documents with line items and totals |
| `invoices` | Invoice documents with line items and totals |

---

## About

Remindi is built and maintained by **Prakash Jadhav (Prince)**, founder.  
A product of **Cosmos** — a software company building practical tools for Businesses.

---

## License

Private and proprietary. All rights reserved © Cosmos.
