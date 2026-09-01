# KISAN MITRA (किसान मित्र)

**Farmer Price Intelligence & Market Linkage Platform**  
*सही दाम, सीधे किसान — Fair Prices, Directly to Farmers*

![Version](https://img.shields.io/badge/Version-1.0.0-FF9933?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-138808?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20PWA%20%7C%20Android-000080?style=flat-square)

---

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Roles & Permissions](#roles--permissions)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Database](#database)
- [Frontend Architecture](#frontend-architecture)
- [Security](#security)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**Kisan Mitra** is a digital platform connecting farmers, buyers, government officers, FPOs (Farmer Producer Organizations), and logistics providers on a single marketplace for transparent agricultural trade, real-time price intelligence, scheme access, and supply chain management.

### Problem Statement

Indian farmers face severe information asymmetry — they lack access to real-time mandi prices, government schemes, and direct buyer linkages. Middlemen exploit this gap, forcing farmers to sell below MSP. Buyers struggle to find quality produce without traveling to multiple mandis. Officers have no centralized dashboard to monitor agricultural activity across their district. Logistics providers lack a structured channel to offer transport services to farmers.

### Solution

Kisan Mitra is a unified platform bridging these gaps with **6 integrated chains**:

| Chain | Area | Description |
|-------|------|-------------|
| **1** | Farmer Registration & KYC | Document upload, multi-level verification (FPO → Officer), audit trail |
| **2** | Listing Management | Create listings with 3 mandatory crop photos (overview/closeup/quality detail), receipt upload, FPO→Officer approval workflow |
| **3** | Scheme Applications | Browse eligible schemes, fill 4-section forms, upload supporting documents (Aadhaar, PAN, caste, income, etc.), FPO/Officer review |
| **4** | Mandi Price Intelligence | Real-time mandi prices with MSP comparison, 7-day trends, crop calculator |
| **5** | Buyer Marketplace & Logistics | Browse/place bids on active listings; logistics booking with real-time tracking pings, live shipment status progression, payment recording |
| **6** | Storage & Cold Chain | FPO-managed storage facilities, farmer storage requests with capacity tracking, logistics-managed storage deliveries |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                 Capacitor PWA (Android)               │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Vanilla  │  │  Chart.js │  │  Service Worker   │  │
│  │ JS SPA   │  │  Charts   │  │  (offline cache)  │  │
│  └────┬─────┘  └──────────┘  └───────────────────┘  │
│       │           Hash Router + Dynamic Imports       │
│       │  Hindi/English Bilingual UI (i18n)           │
└───────┼──────────────────────────────────────────────┘
        │ HTTP / REST
┌───────┼──────────────────────────────────────────────┐
│  ┌────┴─────┐  Express.js API Server (Node.js)      │
│  │ auth     │  JWT + OTP Auth (Twilio)              │
│  │ farmer   │  Listing CRUD, Photo Upload, Schemes  │
│  │ buyer    │  Browse, Bid, Order Tracking          │
│  │ officer  │  Dashboard, KYC, Reports, History     │
│  │ fpo      │  Members, Verification, Storage       │
│  │ logistics│  Shipments, Tracking, Payments        │
│  └──────────┘                                       │
│         │                                           │
│  ┌──────┴───────┐  ┌──────────┐  ┌──────────────┐  │
│  │  PostgreSQL   │  │  Redis   │  │  S3/MinIO    │  │
│  │  (Persistent) │  │(RateLmt) │  │ (File Store) │  │
│  └──────────────┘  └──────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## Features

### Chain 1 — Farmer Registration & KYC Verification Pipeline
- Farmer profile creation with land details, crop history, ID documents
- **FPO-level verification** — FPO reviews member documents, approves/rejects with reason
- **Officer-level verification** — Officer confirms or overrides, can also update land/crop details
- Full **audit trail** (`verification_audit` table) — every status change tracked with reviewer, reason, timestamp
- Visual timeline showing KYC journey (Pending → FPO_Reviewed → Verified/Rejected)

### Chain 2 — Listing Management with Media
- Farmers create listings (crop, quantity, price, grade) **without requiring photos upfront** — photos uploaded per-slot after creation
- **3 mandatory slots**: `overview`, `closeup`, `quality_detail` with minimum resolution requirements
- Receipt upload per listing (PDF/image, 5 MB max)
- **Submit-for-review** endpoint validates all 3 photos exist before marking listing complete
- **Two-tier verification**: FPO reviews → marks `FPO_Reviewed`, Officer reviews → publishes as `Active`
- Rejection at any stage requires a 10+ character reason

### Chain 3 — Scheme Applications
- Eligible schemes displayed per role with `applied` status overlay
- 4-section application form (personal info, documents, declarations)
- 11 document types supported (Aadhaar, PAN, voter ID, driving licence, passport, electricity bill, ration card, caste/EWS/disability/minority certificates)
- Documents uploaded to S3 with MIME type tracking
- FPO reviews member applications → Officer does final approval/rejection
- Duplicate application prevention with clear error messaging

### Chain 4 — Mandi Price Intelligence
- Real-time commodity prices from APMC mandis across India
- MSP comparison per commodity
- 7-day price trend charts (Chart.js)
- Crop cost-profit calculator (seed + fertilizer + labour + irrigation + other → break-even price)
- Filter by commodity, state, mandi

### Chain 5 — Buyer Marketplace & Logistics
- **Buyers**: Browse active listings, place/withdraw bids, view order history
- **Logistics providers**: Full profile (company, GST, license, service area, fleet size)
- View available orders (accepted bids ready for transport)
- **Shipment management**: Create shipments (bid-linked), status progression (`Booked → Picked_Up → In_Transit → Delivered`)
- **Real-time tracking**: Push GPS pings per shipment, view tracking history
- **Payment recording**: Log payments per shipment with method + transaction reference

### Chain 6 — Storage & Cold Chain
- FPOs create/manage storage facilities (capacity, rate, accepted crops)
- Farmers browse facilities (filter by district, crop), submit storage requests
- FPOs verify incoming requests — capacity deducts atomically with **row-count guard** preventing silent overbooking (returns HTTP 409)
- Officer oversight: view all facilities/requests, flag problematic facilities
- **Dual-purpose logistics**: Shipments support both `buyer_delivery` and `storage_delivery` modes

### Trade History (Officer & FPO Dashboards)
- 3-slide horizontally-swipeable carousel view
- **Slide 1**: Farmer ↔ Buyer trade history (accepted bids)
- **Slide 2**: Farmer ↔ Logistics shipment history (buyer deliveries)
- **Slide 3**: Farmer ↔ Storage delivery history (storage deliveries)
- Officer sees all records per district; FPO sees only members' records
- Paginated, filterable by date range, crop, district (officer only)
- Lazy-loaded per slide — only fetches visible data
- Read-only reporting view (no approve/reject actions)

---

## Roles & Permissions

| Role | Color | Primary Actions |
|------|-------|-----------------|
| **Farmer** (किसान) | Green `#1B5E20` | Profile, listings, photo upload, scheme applications, storage requests, price viewer |
| **Buyer** (खरीदार) | Blue `#0D47A1` | Browse market, place/withdraw bids, track orders |
| **Officer** (अधिकारी) | Purple `#4A148C` | Dashboard, farmer KYC, listing verification, scheme review, reports, storage oversight, trade history |
| **FPO** (एफपीओ) | Orange `#E65100` | Member management, KYC verification, listing approval, storage facilities, scheme review, trade history |
| **Logistics** (लॉजिस्टिक्स) | Teal `#00695C` | Profile, orders, shipments, GPS tracking, payments |

Each role has a distinct color theme (gradient header, nav indicators) injected at login via CSS custom properties.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Vanilla JS** (ES6 modules) | Modular page system with dynamic `import()` |
| **CSS3** | `base.css` (variables/reset) + `components.css` + `layout.css` + 15 per-page stylesheets |
| **Chart.js** | Price trend charts and mandi comparison |
| **PWA** | Service worker + `manifest.json` for offline capabilities |
| **Capacitor** | Android native wrapper with WebView |

### Backend
| Library | Purpose |
|---------|---------|
| **Express.js** | REST API framework |
| **PostgreSQL** (via `pg`) | Primary database with connection pooling |
| **Redis** (via `redis`) | Rate limiting state and session cache |
| **JWT** (`jsonwebtoken`) | Access + refresh token authentication |
| **Joi** | Request validation with conditional schemas |
| **bcrypt** | OTP hash comparison |
| **Twilio** | SMS delivery for OTP |
| **AWS S3 SDK** | File uploads (photos, receipts, scheme documents) |
| **Sharp** | Image dimension validation and metadata extraction |
| **Multer** | Multipart file upload middleware |
| **Socket.IO** | Real-time notifications |
| **Helmet** | Security headers |
| **express-rate-limit** | API + OTP rate limiting |

---

## Project Structure

```
farmer/
├── www/                              # (Legacy static site)
│
├── backend/                          # Express API server
│   ├── src/
│   │   ├── app.js                    # Express entry, route mounts, Socket.IO
│   │   ├── db.js                     # PostgreSQL Pool
│   │   ├── controllers/              # Route handlers per role
│   │   │   ├── auth.controller.js
│   │   │   ├── farmer.controller.js  # Listings, photos, schemes, storage reqs
│   │   │   ├── buyer.controller.js   # Market, bids
│   │   │   ├── officer.controller.js # Dashboard, KYC, listings, schemes, history
│   │   │   ├── fpo.controller.js     # Members, verification, storage, history
│   │   │   ├── logistics.controller.js  # Shipments, tracking, payments
│   │   │   └── storage.controller.js # Facilities, requests, oversight
│   │   ├── services/
│   │   │   ├── otp.service.js        # OTP generation, hashing, verify, lockout
│   │   │   ├── price.service.js      # Mandi price queries
│   │   │   ├── scheme.service.js     # Scheme CRUD + eligibility
│   │   │   ├── notification.service.js   # Bulk notification push
│   │   │   ├── upload.service.js     # S3 upload, signed URLs, dimension validation
│   │   │   └── history.service.js    # Trade/logistics/storage history queries
│   │   ├── routes/                   # Express routers per role
│   │   │   ├── auth.routes.js
│   │   │   ├── farmer.routes.js
│   │   │   ├── buyer.routes.js
│   │   │   ├── officer.routes.js
│   │   │   ├── fpo.routes.js
│   │   │   └── logistics.routes.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js     # JWT verification
│   │   │   ├── role.middleware.js     # Role-based access
│   │   │   ├── rateLimit.middleware.js    # API + OTP rate limiters
│   │   │   └── upload.middleware.js   # Multer config + error handler
│   │   └── utils/
│   │       ├── jwt.utils.js          # Token generation & verification
│   │       ├── validators.js         # Joi schemas (50+ schemas)
│   │       └── response.utils.js     # success(), error(), paginated()
│   ├── migrations/                   # 8 SQL migration files
│   ├── seeds/                        # Sample seed data
│   ├── tests/
│   │   └── run-all-tests.js          # 70+ automated API tests
│   ├── mock-server.js                # In-memory mock API (no DB needed)
│   ├── TEST_REPORT.md
│   └── .env.example
│
├── android/
│   └── app/src/main/assets/public/   # Frontend (served by mock-server or Android WebView)
│       ├── index.html                # SPA entry
│       ├── manifest.json             # PWA manifest
│       ├── sw.js                     # Service worker
│       ├── css/
│       │   ├── base.css              # Variables, reset, typography, Hindi fonts
│       │   ├── components.css        # Cards, buttons, modals, tables, badges
│       │   ├── layout.css            # Header, sidebar, bottom nav, grid
│       │   └── pages/                # 15 per-page CSS files
│       └── js/
│           ├── app.js                # Router, role system, nav renderer
│           └── pages/
│               ├── login.js          # Login (role tabs, send OTP, verify)
│               ├── home.js           # Shared home
│               ├── prices.js         # Mandi prices + Chart.js trends
│               ├── sell.js           # Create listing / photo upload
│               ├── schemes.js        # Scheme list + apply flow
│               ├── calculator.js     # Crop cost-profit calculator
│               ├── storage.js        # Browse facilities / request storage
│               ├── profile.js        # User profile
│               ├── buyer/            # 5 buyer page modules
│               ├── farmer/           # 6 farmer page modules
│               ├── officer/          # 8 officer page modules (incl. history)
│               ├── fpo/              # 8 FPO page modules (incl. history)
│               ├── logistics/        # 5 logistics page modules
│               └── shared/           # Shared/fallback pages
│
├── docker-compose.yml                # PostgreSQL 16 + Redis 7 + API
├── capacitor.config.ts               # Capacitor Android config
└── package.json                      # Root project (Capacitor)
```

---

## Quick Start

### Frontend Only (Mock Data — No Backend Needed)

```bash
npx http-server android/app/src/main/assets/public -p 3000 -c-1 --cors
```

Open **http://localhost:3000** — login as any role using the mock login form (no SMS needed).

### Backend API (Requires PostgreSQL + Redis)

```bash
cd backend
cp .env.example .env         # Edit with your DB credentials
npm run migrate              # Apply 8 migration files
npm run seed                 # Insert sample data
npm start                    # API on port 3000
```

### Using the Mock Backend (No DB Needed)

```bash
cd backend
node mock-server.js          # In-memory API on port 3000
```

Login with OTP bypass `1234` using test mobiles:
- **Farmer**: `9999999999` / **Buyer**: `9999999998` / **Officer**: `9999999997`
- **FPO**: `9999999996` / **Logistics**: `7777777777`

Then run tests:
```bash
node tests/run-all-tests.js
```

### Docker

```bash
docker-compose up            # Spins up PostgreSQL 16, Redis 7, API, migrations, seed
```

---

## API Reference

### Authentication
| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/api/auth/send-otp` | No | 5/hour/mobile | Send OTP to mobile |
| POST | `/api/auth/verify-otp` | No | 10/15min/IP + per-mobile lockout | Verify OTP, get JWT |
| POST | `/api/auth/refresh` | No | — | Refresh access token |
| POST | `/api/auth/logout` | Yes | — | Logout |

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prices` | Mandi prices (filter by `commodity`, `state`, `mandi_name`) |
| GET | `/api/crops` | Crop list + MSP rates |
| GET | `/api/mandis` | Mandi list by state |
| GET | `/health` | Health check |

### Farmer
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/farmer/profile` | Get profile + farmer_profiles |
| PUT | `/api/farmer/profile` | Update profile (name, district, land, crops) |
| GET | `/api/farmer/listings` | My listings (with photos) |
| POST | `/api/farmer/listings` | Create listing (no photo_keys required) |
| PUT | `/api/farmer/listings/:id` | Update listing |
| DELETE | `/api/farmer/listings/:id` | Delete listing |
| POST | `/api/farmer/listings/:id/submit-for-review` | Validate 3 photos → submit for verification |
| POST | `/api/farmer/listings/:listingId/photos/:slot` | Upload photo per slot (`overview`/`closeup`/`quality_detail`) |
| POST | `/api/farmer/listings/:listingId/receipt` | Upload receipt (PDF/image) |
| GET | `/api/farmer/schemes` | Eligible schemes with application status |
| POST | `/api/farmer/schemes/:id/apply` | Full 4-section application with document uploads |
| GET | `/api/farmer/scheme-applications` | My applications with documents |
| GET | `/api/farmer/prices` | Latest mandi prices |
| GET | `/api/farmer/verification-status` | KYC status + audit timeline |
| GET | `/api/farmer/storage-facilities` | Browse facilities (filter by district/crop) |
| POST | `/api/farmer/storage-requests` | Request storage |
| GET | `/api/farmer/storage-requests` | My storage requests |

### Buyer
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/buyer/profile` | Profile CRUD |
| GET | `/api/buyer/market` | Active listings (filter by crop/district/grade) |
| POST | `/api/buyer/bids` | Place bid |
| GET | `/api/buyer/bids` | My bids |
| PUT | `/api/buyer/bids/:id` | Withdraw bid |
| GET | `/api/buyer/prices` | Latest prices |

### Officer
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/officer/dashboard` | Aggregated stats (farmers, KYC, listings, schemes) |
| GET | `/api/officer/farmers` | Farmer list (filter by district/status/crop) |
| GET | `/api/officer/farmers/:id` | Farmer detail + listings |
| PUT | `/api/officer/farmers/:id/kyc` | Update KYC (with audit) |
| GET | `/api/officer/listings` | All listings (filter by status/district) |
| GET/POST | `/api/officer/schemes` | Scheme CRUD |
| PUT/DELETE | `/api/officer/schemes/:id` | Scheme update/delete |
| GET | `/api/officer/reports` | Reports (crop distribution, KYC stats, mandi summary) |
| POST | `/api/officer/notifications` | Send bulk notification |
| GET | `/api/officer/verification-queue` | Farmers pending officer KYC |
| GET | `/api/officer/verification/:farmerId/history` | Audit trail for a farmer |
| PUT | `/api/officer/verification/:farmerId` | Verify/override KYC |
| GET | `/api/officer/listings/verification-queue` | Listings pending officer review |
| PUT | `/api/officer/listings/verification/:id` | Approve/reject listing |
| GET | `/api/officer/scheme-applications` | Applications pending review |
| POST | `/api/officer/scheme-applications/:id/review` | Review application |
| GET | `/api/officer/storage-facilities` | All facilities |
| GET | `/api/officer/storage-requests` | All requests |
| PUT | `/api/officer/storage-facilities/:id/flag` | Flag facility |
| **GET** | **`/api/officer/history/trades`** | **Slide 1: buyer trades** |
| **GET** | **`/api/officer/history/logistics`** | **Slide 2: logistics shipments** |
| **GET** | **`/api/officer/history/storage`** | **Slide 3: storage deliveries** |

### FPO
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/fpo/profile` | Profile CRUD |
| GET | `/api/fpo/members` | List member farmers |
| POST | `/api/fpo/members/:farmerId` | Add member |
| DELETE | `/api/fpo/members/:farmerId` | Remove member |
| GET/POST | `/api/fpo/listings` | Bulk listings CRUD |
| PUT | `/api/fpo/listings/:id` | Update listing |
| GET | `/api/fpo/schemes` | Eligible schemes |
| POST | `/api/fpo/schemes/:id/apply` | Apply |
| GET | `/api/fpo/prices` | Prices |
| GET | `/api/fpo/verification-queue` | Members pending FPO KYC |
| GET | `/api/fpo/verification/:farmerId/history` | Member audit trail |
| PUT | `/api/fpo/verification/:farmerId` | Verify member KYC |
| GET | `/api/fpo/listings/verification-queue` | Listings pending FPO review |
| PUT | `/api/fpo/listings/verification/:id` | Approve/reject listing |
| GET | `/api/fpo/scheme-applications` | Member applications pending review |
| POST | `/api/fpo/scheme-applications/:id/review` | Review application |
| GET/POST | `/api/fpo/storage-facilities` | Facility CRUD |
| PUT/DELETE | `/api/fpo/storage-facilities/:id` | Update/delete facility |
| GET | `/api/fpo/storage-requests` | Incoming storage requests |
| PUT | `/api/fpo/storage-requests/:id/verify` | Verify request (capacity guard → 409) |
| **GET** | **`/api/fpo/history/trades`** | **Slide 1: member buyer trades** |
| **GET** | **`/api/fpo/history/logistics`** | **Slide 2: member logistics** |
| **GET** | **`/api/fpo/history/storage`** | **Slide 3: member storage** |

### Logistics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/logistics/profile` | Profile (company, GST, license, service area, fleet) |
| GET | `/api/logistics/orders` | Available orders (accepted bids) |
| POST | `/api/logistics/shipments` | Create shipment (`buyer_delivery` or `storage_delivery`) |
| GET | `/api/logistics/shipments` | My shipments (filter by status) |
| PUT | `/api/logistics/shipments/:id/status` | Update status (Booked→Picked_Up→In_Transit→Delivered) |
| POST | `/api/logistics/shipments/:id/tracking` | Push GPS ping |
| GET | `/api/logistics/shipments/:id/tracking` | Get tracking history |
| GET | `/api/logistics/payments` | My payments |
| POST | `/api/logistics/payments/:id/mark-paid` | Record payment |

---

## Database

### Migration History (8 files)

| # | File | Key Changes |
|---|------|-------------|
| 001 | `001_init.sql` | Core schema: `users`, `farmer_profiles`, `buyer_profiles`, `officer_profiles`, `fpo_profiles`, `fpo_members`, `listings`, `bids`, `schemes`, `scheme_applications`, `otp_sessions`, `mandi_prices`, `notifications` |
| 002 | `002_verification_pipeline.sql` | Expanded `kyc_status` CHECK enum, `verification_audit` table with audit trail |
| 003 | `003_listings_verification.sql` | Updated `listings` status CHECK, `listing_verification_audit` table |
| 004 | `004_listing_media.sql` | `listing_photos` table (UNIQUE listing_id+slot), receipt columns, partial Active index |
| 005 | `005_scheme_applications_full.sql` | Extended scheme/scheme_application columns, `scheme_application_documents` table |
| 006 | `006_storage.sql` | `storage_facilities`, `storage_requests` with capacity tracking |
| 007 | `007_logistics.sql` | Added `logistics` role, `logistics_profiles`, `shipments`, `shipment_tracking_pings`, `shipment_payments` |
| 008 | `008_shipment_purpose.sql` | Dual-purpose shipments: `purpose` CHECK, `storage_request_id`, `farmer_id`, constraint, backfill, indexes |

### Key Table Relationships

```
users (role: farmer|buyer|officer|fpo|logistics)
├── farmer_profiles           (1:1)
├── buyer_profiles            (1:1)
├── officer_profiles          (1:1)
├── fpo_profiles              (1:1)
├── logistics_profiles        (1:1)
├── fpo_members               (1:N — FPO → farmers)
├── listings                  (1:N — farmer → listings)
│   ├── listing_photos        (1:N)
│   └── listing_verification_audit (1:N)
├── bids                      (N:1 buyer + N:1 listing)
├── scheme_applications       (1:N)
│   └── scheme_application_documents (1:N)
├── storage_requests          (1:N)
│   └── storage_facilities    (N:1)
├── shipments                 (1:N — logistics → shipments)
│   ├── shipment_tracking_pings (1:N)
│   └── shipment_payments     (1:N)
├── verification_audit        (1:N)
└── otp_sessions              (1:1 per mobile)
```

---

## Frontend Architecture

### Routing System

The frontend uses a **hash-based router** with lazy-loaded ES6 modules:

```
window.location.hash = 'farmers'
  → router() detects hash change
  → resolvePagePath('officer', 'farmers') → './pages/officer/farmers.js'
  → dynamic import() → module.render('farmers-content')
```

### Role Configuration

Each role is defined in `ROLE_CONFIG` with:
- **Theme**: `color`, `colorDark`, `colorLight`, `gradient` — injected as CSS custom properties
- **Nav items**: `{ page, icon, label, labelHi }` — rendered in sidebar + bottom nav
- **Bottom nav**: Subset of nav items visible on mobile

### Page Structure

Each page module exports a `render(containerId)` function. Pages are role-specific (`officer/farmers.js`) or shared (`prices.js`). The router auto-redirects to the role's default page on invalid hash.

### Bilingual UI

All labels have English + Hindi (`labelHi`) pairs. CSS supports Devanagari typography via Noto Sans Devanagari. The login page has a language toggle (`en`/`hi`).

---

## Security

### Authentication
- **OTP-based login** with bcrypt-hashed OTPs stored in PostgreSQL
- **JWT access tokens** (15 min expiry) + **refresh tokens** (7 day expiry)
- All protected routes require `Authorization: Bearer <token>` header

### Rate Limiting
| Limiter | Window | Max | Applied To |
|---------|--------|-----|------------|
| `otpLimiter` | 1 hour | 5 | `POST /send-otp` (keyed by mobile + IP) |
| `otpVerifyLimiter` | 15 min | 10 | `POST /verify-otp` (keyed by IP) |
| Per-mobile lockout | 15 min | 5 consecutive wrong OTPs | `verifyOtp` in service layer |
| `apiLimiter` | 1 min | 100 | All API routes |

### File Upload Security
- **MIME type whitelist**: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- **Max file size**: 5 MB (enforced by Multer + service validation)
- **Photo dimension requirements**: overview ≥1024×768, closeup ≥2048×1536, quality_detail ≥2560×1920
- **Signed URLs**: S3 keys never exposed directly — `hydrateFileUrls()` replaces keys with 15-minute pre-signed URLs in all API responses

### Data Integrity
- **Storage capacity**: `available_capacity_quintal >= $1` guard in UPDATE + `rowCount` check returns HTTP 409 on overbooking
- **Shipment purpose**: CHECK constraint ensures exactly one of `bid_id`/`storage_request_id`
- **Verification audit**: All KYC and listing status changes logged immutably
- **OTP sessions**: Expired after 10 min, max 3 attempts per session

### Headers
- Helmet.js security headers (CSP, X-Frame-Options, HSTS, etc.)
- CORS restricted to configured origin

---

## Testing

### Automated Test Suite

```bash
cd backend
node mock-server.js              # Start mock API (in another terminal)
node tests/run-all-tests.js      # Run 70+ tests
```

The test suite (`tests/run-all-tests.js`) covers:

| Category | Tests | What's Verified |
|----------|-------|-----------------|
| Auth | 10 | Send/verify OTP for all 5 roles, wrong OTP, rate limiting, per-mobile lockout |
| Farmer | 15 | Profile, listing CRUD (no photo_keys), photo upload, submit-for-review guard, scheme application, storage request |
| Buyer | 6 | Profile, market browse, bid CRUD |
| Officer | 12 | Dashboard, farmers, KYC, listings, schemes, verification queue, history |
| FPO | 10 | Profile, members, storage facility CRUD, verification queue, scheme review, history |
| Logistics | 6 | Profile, orders, shipments, tracking, payments |
| Storage | 6 | Facility CRUD, request/verify, overbooking guard (409) |
| Rate Limiting | 3 | verify-otp 429, per-mobile lockout, illegal status transitions |
| Edge Cases | 4 | Unauthorized access, wrong role, duplicate application, expired tokens |

### Test Report

See `backend/TEST_REPORT.md` for detailed results.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `NODE_ENV` | `development` | Environment mode |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | — | Redis connection string |
| `JWT_SECRET` | — | JWT signing secret (min 32 chars) |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token TTL |
| `TWILIO_ACCOUNT_SID` | — | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | — | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | — | SMS sender number |
| `OTP_BYPASS` | `1234` | Dev-mode bypass OTP |
| `S3_ACCESS_KEY` | `minioadmin` | S3/MinIO access key |
| `S3_SECRET_KEY` | `minioadmin` | S3/MinIO secret key |
| `S3_BUCKET` | `kisan-mitra-dev` | S3 bucket name |
| `S3_REGION` | `ap-south-1` | S3 region |
| `S3_ENDPOINT` | — | Custom S3 endpoint (MinIO) |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- ES6+ JavaScript (Node.js 16+)
- Single quotes, semicolons, 4-space indentation
- JSDoc comments for public APIs (controllers, services)
- Joi validation schemas for all request bodies/query params
- SQL in backtick template literals with parameterized queries

---

## License

MIT — see [LICENSE](LICENSE).

---

*Built for the Ministry of Agriculture & Farmers Welfare, Government of India.*
*Kisan Mitra — Sahi Daam, Seedha Kisan.*
