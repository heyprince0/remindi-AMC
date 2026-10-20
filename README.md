# Remindi — AMC Management Software

**Simplifying service business management for Indian service contractors.**

[![Website](https://img.shields.io/badge/Website-remindi.online-blue)](https://remindi.online)

Remindi is a B2B SaaS platform built for Indian service contractors to manage Annual Maintenance Contracts (AMCs), schedule service visits, track customers, manage technicians, and handle everyday business operations from one place.

Whether you manage AC maintenance, lift servicing, CCTV installations, RO water purifiers, fire safety equipment, or other maintenance services, Remindi helps you replace scattered spreadsheets and manual paperwork with a more organized digital workflow.

🌐 **Live website:** https://remindi.online

---

## The Problem

AMC service contractors often struggle with:

- Missed service visits and contract renewal dates.
- Customer information scattered across spreadsheets and notebooks.
- Manual quotation and invoice preparation.
- Difficulty coordinating technicians and field service work.
- Poor visibility into spare parts and inventory.
- Incomplete service records and payment tracking.

**Remindi brings these workflows together in one platform**, helping service businesses organize contracts, improve service scheduling, and manage their operations more efficiently.

---

## Features

### 📅 AMC & Contract Management
- Create and manage AMC contracts in one place.
- Track contract start dates, expiry dates, service frequency, and upcoming visits.
- Monitor active, upcoming, and overdue service schedules.
- Keep customer contracts organized for easier follow-ups.

### 🔔 Service Scheduling & Notifications
- Track upcoming service visits.
- Receive browser notifications before scheduled services are due.
- Keep service schedules organized to reduce missed visits.
- Maintain a history of completed service visits.

### 👥 Customer Management
- Maintain a centralized customer database.
- Store customer contact information and service addresses.
- Associate customers with their contracts and service history.
- Access customer information when preparing quotations and invoices.

### 🛠️ Technician & Team Management
- Manage technicians and team members.
- Assign technicians to service work.
- Organize responsibilities across your service operations.
- Support team-based business workflows.

### 🧾 Quotation Management
- Create professional quotations for customers.
- Add itemized products, services, quantities, units, and prices.
- Configure applicable taxes and discounts.
- Generate PDF quotations with your business details.
- Convert accepted quotations into invoices.

### 💰 Invoice & Payment Management
- Generate professional invoices.
- Track invoice and payment information.
- Include business details and payment instructions in documents.
- Generate PDF invoices and share them with customers through WhatsApp.
- Support GST calculations and tax breakdowns where applicable.

### 📦 Inventory Management
- Maintain an inventory of spare parts, products, and materials.
- Track stock quantities and units of measurement.
- Monitor low-stock items.
- Maintain inventory records and track stock usage during service operations.
- Support barcode-based inventory workflows.

### 📋 Work Reports & Service History
- Maintain records of completed service work.
- Record service notes and relevant work details.
- Generate PDF work reports for documentation.
- Keep service history organized for future reference.

### 🚚 Delivery Challans
- Prepare delivery challans for goods and materials.
- Maintain documentation for material movement.
- Support a more organized workflow for service-related deliveries.

### 📊 Business Dashboard
- Get an overview of contracts and service operations.
- Monitor upcoming and overdue service activities.
- Access important customer, billing, and operational information.

### 🏢 Business Profile & Document Branding
- Configure business details such as name, address, logo, GSTIN, and PAN.
- Use business information across supported business documents.
- Include payment details in quotations and invoices.

### 🔐 Multi-Tenant Business Management
- Organize business data by organization.
- Support team memberships and invitation workflows.
- Apply organization-based access controls to supported business records.

---

## Who Is Remindi For?

Remindi is designed for small and medium-sized service contractors in India, including businesses working in:

- Air conditioning (AC) maintenance
- Lift and elevator servicing
- CCTV and security systems
- RO water purifiers and water treatment
- Fire safety equipment maintenance
- Electrical maintenance
- Plumbing and other maintenance services

The platform is intended for contractors who want to manage multiple customers, contracts, service schedules, technicians, and business documents without relying entirely on manual processes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js |
| UI Library | React |
| Styling | Tailwind CSS |
| Backend & Database | Supabase |
| Database Engine | PostgreSQL |
| Authentication | Supabase Auth |
| Document Generation | Custom PDF rendering |
| Deployment | Vercel |
| Version Control | Git & GitHub |

---

## Database Overview

Remindi uses Supabase and PostgreSQL to store and manage application data.

Key tables and data groups include:

| Table | Purpose |
|---|---|
| `organizations` | Business organization records |
| `memberships` | Organization membership and access relationships |
| `invites` | Team invitation workflows |
| `company_profile` | Business identity, tax, and payment details |
| `customers` | Customer records and contact information |
| `contracts` | AMC contract details and service schedules |
| `quotations` | Quotation documents and line items |
| `invoices` | Invoice documents, line items, and totals |

Additional application modules support inventory, service history, technicians, work reports, and delivery challans.

*This is a high-level overview; it is not intended to be an exhaustive database schema.*

---

## Getting Started

Remindi is a hosted SaaS application.

1. Visit [remindi.online](https://remindi.online).
2. Create an account or sign in.
3. Configure your business profile.
4. Add your customers and AMC contracts.
5. Organize service schedules, quotations, invoices, and other business operations.

For the latest product information, pricing, and trial availability, visit the official website.

---

## Deployment & Development

The application uses Next.js and Supabase, with Vercel for deployment.

The general development workflow involves:

- Maintaining application code in GitHub.
- Configuring environment variables for the application and Supabase.
- Managing database changes through appropriate migrations.
- Testing changes before deploying updates to production through Vercel.

**Note:** Environment variables and credentials should never be committed to the repository. Use local environment files and the appropriate hosting platform's environment-variable settings.

---

## About Remindi

Remindi Software is founded and maintained by **Prakash Jadhav (Prince)**.

Remindi is a product of **Cosmos**, a software venture focused on building practical digital tools for businesses.

- **Website:** https://remindi.online
- **Product:** AMC management and service business operations software
- **Market:** Indian service contractors

---

## License

Remindi is proprietary software. All rights reserved © Cosmos.

Unauthorized copying, redistribution, or commercial use of the software is prohibited without permission from the owner.
