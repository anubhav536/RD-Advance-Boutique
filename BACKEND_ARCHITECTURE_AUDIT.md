# RD Advance Boutique — Backend Architecture Audit Report
**Date:** June 4, 2026  
**Audit Type:** Read-Only Codebase Analysis (No Changes Made)  
**Project:** RD Advance Boutique — Luxury Tailoring Studio, Damoh, MP  
**Stack:** HTML/CSS/Vanilla JS · Express.js · Flat JSON files · Node.js 20

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Architecture Overview](#2-project-architecture-overview)
3. [Server Infrastructure Analysis](#3-server-infrastructure-analysis)
4. [Data Layer — Flat File Storage](#4-data-layer--flat-file-storage)
5. [API Endpoints Inventory](#5-api-endpoints-inventory)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Checkout & Order Flow](#7-checkout--order-flow)
8. [Payment System](#8-payment-system)
9. [Admin Panel Architecture](#9-admin-panel-architecture)
10. [Google Apps Script Integration](#10-google-apps-script-integration)
11. [Configuration & Secrets Management](#11-configuration--secrets-management)
12. [Security Vulnerability Assessment](#12-security-vulnerability-assessment)
13. [Data Integrity & Schema Analysis](#13-data-integrity--schema-analysis)
14. [Client-Side Feature Inventory](#14-client-side-feature-inventory)
15. [File Upload System](#15-file-upload-system)
16. [Performance & Scalability Assessment](#16-performance--scalability-assessment)
17. [Prioritized Recommendations](#17-prioritized-recommendations)

---

## 1. Executive Summary

RD Advance Boutique is a **static boutique website** currently operating without a real backend. The Express.js server functions exclusively as a static file server with a single file-upload endpoint. There are **no REST API routes**, **no database**, and **no server-side session management**. All business-critical operations — including order placement, admin authentication, and UPI payment verification — happen entirely on the client side in the browser.

### Overall Health Score

| Domain | Score | Status |
|---|---|---|
| Server Architecture | 3/10 | Minimal — static only |
| Data Persistence | 2/10 | localStorage + empty JSON files |
| Authentication | 1/10 | Client-side PIN, no sessions |
| Payment Handling | 2/10 | Manual WhatsApp-based |
| Security | 2/10 | Multiple critical exposures |
| Admin Capabilities | 5/10 | Functional read, no server writes |
| Code Quality | 7/10 | Well-structured JS modules |

### Critical Findings (Action Required)

- `data/config.json` is **publicly readable** and contains UPI ID (`8643090832@jio`), account holder name (`Anunay Shrivastava`), phone number, and manager PIN — all accessible by any visitor from the browser.
- The admin panel login is **purely client-side** — anyone who reads `manage.js` can bypass authentication.
- The `/upload` endpoint accepts image files from **any unauthenticated user**, writing directly to the `assets/` folder.
- **Orders are never saved to any server** — `data/orders.json` is permanently empty `[]`.
- The Google Apps Script integration is **built but not connected** — `config.json` still contains the placeholder `"PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE"`.

---

## 2. Project Architecture Overview

### Folder Structure

```
rd-advance-boutique/
│
├── server.js                  ← Express static server + /upload only
├── package.json               ← express@5.2.1 + multer@2.1.1 dependencies
│
├── data/                      ← All application data as flat JSON files
│   ├── config.json            ← App config + UPI details + manager PIN (PUBLIC)
│   ├── settings.json          ← Site name, logo, SEO, social links, contact
│   ├── products.json          ← 9 products, 1064 lines
│   ├── categories.json        ← 33 categories
│   ├── gallery.json           ← Gallery items with metadata
│   ├── orders.json            ← Always empty []
│   ├── users.json             ← 1 admin user with password hash (PUBLIC)
│   ├── notifications.json     ← 5 site notifications
│   ├── assets.json            ← Asset manifest
│   ├── contact.json           ← Contact enquiries (if any)
│   └── students.json          ← Course student records
│
├── js/                        ← All client-side JavaScript modules
│   ├── checkout.js            ← Full checkout flow (WhatsApp order builder)
│   ├── manage.js              ← Admin panel (1151 lines, client-side only)
│   ├── script.js              ← Main shop/homepage logic
│   ├── site-settings.js       ← Applies settings.json to all pages
│   ├── recommendations.js     ← Smart product recommendations (client-side)
│   ├── wishlist.js            ← Wishlist (localStorage)
│   ├── i18n.js                ← EN/HI language toggle (localStorage)
│   ├── notifications.js       ← Site notification banner
│   ├── compare.js             ← Product comparison
│   └── outfit-builder.js      ← Visual outfit builder
│
├── css/                       ← Stylesheets
├── assets/                    ← ~120 product/gallery images
├── apps-script/
│   └── Code.gs                ← Google Apps Script (built, NOT deployed)
│
└── *.html                     ← 14 HTML pages (all static)
```

### Deployment Model

The site runs on Node.js via `npm run start` → `node server.js`. It is structured as a **GitHub Pages-compatible static site** (per `package.json` description and `package.json` keywords: `"github-pages"`). The Express server adds only image-upload capability on top of static serving and is not needed for read-only browsing.

### HTML Pages (14 total)

| Page | Purpose |
|---|---|
| `index.html` | Homepage |
| `shop.html` | Product catalogue |
| `product-details.html` | Single product detail |
| `checkout.html` | Order flow (WhatsApp) |
| `wishlist.html` | Saved items |
| `compare.html` | Side-by-side product comparison |
| `gallery.html` | Design inspiration gallery |
| `gallery-details.html` | Individual gallery item |
| `learn.html` | Tailoring courses |
| `contact.html` | Contact form |
| `custom.html` | Custom order request |
| `custom-stitching.html` | Stitching service details |
| `outfit-builder.html` | Interactive outfit planner |
| `manage.html` | Admin panel |

---

## 3. Server Infrastructure Analysis

### server.js (47 lines total)

```
Technology:   Express.js v5.2.1
Port:         5000 (hardcoded, binds 0.0.0.0)
Routes:       2 total
  - express.static(".")   ← serves entire project root
  - POST /upload          ← multer image upload
Middleware:   NONE (no auth, no rate-limit, no CORS, no body-parser for API)
Database:     NONE
Sessions:     NONE
Error handler: generic 500 JSON response
```

### What the server does NOT do

The following capabilities are commonly expected of a boutique e-commerce backend but are completely absent:

- No `/api/orders` — orders are never sent to the server
- No `/api/products` — products are read directly from static JSON files in the browser
- No `/api/auth` — no login/logout/session management on the server
- No `/api/payment/verify` — UPI verification is manual (human checks WhatsApp)
- No database connection (SQLite, PostgreSQL, MongoDB, etc.)
- No email sending
- No SMS/OTP sending
- No inventory updates
- No CORS headers
- No request rate limiting
- No security headers (HSTS, CSP, X-Frame-Options, etc.)

### Static File Exposure Risk

Because `express.static(".")` serves the **entire project root**, the following sensitive files are directly accessible from any browser:

```
https://[domain]/data/config.json    ← UPI ID, phone, PIN
https://[domain]/data/users.json     ← Admin email + password hash
https://[domain]/data/orders.json    ← Order history (currently empty)
https://[domain]/data/students.json  ← Student records
https://[domain]/.env.example        ← Environment variable hints
https://[domain]/apps-script/Code.gs ← Full admin source code
```

---

## 4. Data Layer — Flat File Storage

### Storage Architecture

The entire application uses **9 flat JSON files** as its database. There is no database engine, no query language, and no transactional safety. All reads happen via `fetch("data/file.json")` from the browser.

### File-by-File Analysis

#### `data/config.json` — CRITICAL EXPOSURE
```json
{
  "appsScriptUrl": "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE",  ← NOT connected
  "storeName": "RD Advance Boutique",
  "ownerPhone": "917693849472",
  "upiId": "8643090832@jio",          ← PUBLICLY READABLE
  "upiName": "Anunay Shrivastava",    ← PUBLICLY READABLE
  "upiPhone": "+91 86430 90832",      ← PUBLICLY READABLE
  "managerPin": "1234"                ← PUBLICLY READABLE (default PIN unchanged)
}
```
**Risk:** Any visitor who opens browser DevTools → Network tab can read this file in full.

#### `data/users.json` — SENSITIVE EXPOSURE
```json
[{
  "username": "rdadvanceboutique@gmail.com",
  "passwordHash": "$rdab-bcrypt$322000$...",   ← custom hash format, publicly readable
  "role": "owner",
  "securityQuestion": "What is the registered admin email address?"
}]
```
**Risk:** The password hash is publicly readable. The custom `$rdab-bcrypt$` hash format is non-standard and not verified by any server-side logic.

#### `data/orders.json` — Always Empty
```json
[]
```
**Reality:** Orders placed through checkout are NEVER written here. This file has no write mechanism. It exists as a placeholder only.

#### `data/products.json` — 9 Products, 1064 Lines
- Each product has ~30 fields
- Schema inconsistencies identified (see Section 13)
- Readable client-side; editable only by downloading/replacing via manage.html ZIP export

#### `data/categories.json` — 33 Categories
- Standard `{id, name, description, status, slug}` schema
- No relationship enforcement with products (category names can drift)

#### `data/notifications.json` — 5 Notifications
- Admin-facing and public notifications mixed in same file
- No server-side targeting; all 5 load on every page that uses `notifications.js`

#### `data/students.json` — Student Records
- Not inspected in detail; contains course student data
- Publicly accessible like all other data files

---

## 5. API Endpoints Inventory

### Complete Endpoint Map

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| `GET` | `/*` (static) | None | Serve all HTML/CSS/JS/JSON/images | Serves entire root |
| `POST` | `/upload` | **None** | Upload image(s) to `assets/` | No auth, 20MB limit |

**Total API routes: 1**  
**Authenticated routes: 0**

### The `/upload` Endpoint Detail

```javascript
app.post('/upload', upload.array('files', 50), (req, res) => {
  // Accepts up to 50 files, 20MB each
  // Saves to assets/ with sanitized filename
  // Returns: { success: true, paths: ["assets/filename.jpg", ...] }
  // Auth check: NONE
  // Rate limit: NONE
});
```

**Attack surface:** Any person on the internet can `POST /upload` with an image and write files to the server's `assets/` directory. There is no token, no session check, no IP rate limit, and no CAPTCHA.

### Missing API Routes (Gap Analysis)

The following endpoints are expected for a functioning boutique e-commerce site but do not exist:

```
POST /api/orders            ← Order creation
GET  /api/orders            ← Order list for admin
PUT  /api/orders/:id/status ← Update order status
POST /api/auth/login        ← Admin login
POST /api/auth/logout       ← Admin logout
GET  /api/products          ← Product list
POST /api/products          ← Create product
PUT  /api/products/:id      ← Update product
DELETE /api/products/:id    ← Delete product
POST /api/contact           ← Contact form
POST /api/payment/verify    ← UPI verification
```

---

## 6. Authentication & Authorization

### Current Authentication Architecture

**There is no server-side authentication.** The admin panel at `manage.html` uses a purely client-side PIN check:

```javascript
// js/manage.js lines 90-101
async function handleLogin(e) {
  const pin = el("mgPin").value.trim();
  if (pin === String(S.config.managerPin || "1234")) {   // reads from data/config.json
    el("mgLoginScreen").hidden = true;
    el("mgApp").hidden = false;                          // just toggles CSS visibility
  }
}
```

**What this means:**
- The "login" only hides/shows HTML elements in the DOM — no actual session is created
- Any user can open DevTools console and type: `document.getElementById('mgLoginScreen').hidden = true` to bypass the login screen entirely
- The PIN (`1234`) is stored in `data/config.json` which is publicly readable

### users.json — Unused Credentials

`data/users.json` stores 1 admin user with a custom bcrypt-style hash. However:
- This file is never read by `server.js`
- No endpoint checks these credentials
- The hash format `$rdab-bcrypt$322000$...` is a custom implementation — not standard Node.js `bcrypt`
- These credentials are likely remnants of a planned but unimplemented login system

### Authorization Gap

Because there is no server-side auth:
- Every JSON data file is readable by anyone
- The `/upload` endpoint accepts files from anyone
- Anyone can reverse-engineer admin operations by reading the JavaScript source

---

## 7. Checkout & Order Flow

### Complete Order Journey

```
CUSTOMER JOURNEY:
─────────────────────────────────────────────────────────────────
1. Customer visits shop.html → clicks product → product-details.html
2. Clicks "Buy Now" → checkout.html?id=PRODUCT_ID
3. checkout.js fetches data/products.json (client-side, no API)
4. checkout.js fetches data/config.json (gets UPI ID, owner phone)
5. Customer fills form: size, color, qty, address, name, phone
6. Customer selects payment: UPI or COD
   - UPI: enters UTR number + uploads payment screenshot (base64 in memory)
   - COD: no payment action needed
7. Customer sees Review screen (Step 4)
8. Customer clicks "Confirm Order"
   → Order stored in browser localStorage ("rdOrders", max 200 entries)
   → WhatsApp message built with all order details
   → Browser opens: https://wa.me/917693849472?text=ENCODED_MESSAGE
9. Customer manually sends the WhatsApp message to shop owner
10. Order confirmation: shop owner replies on WhatsApp manually
─────────────────────────────────────────────────────────────────
SERVER INVOLVEMENT: ZERO
DATABASE WRITES: ZERO
BACKEND PERSISTENCE: ZERO (localStorage only)
```

### Order ID Generation

```javascript
function makeOrderId() {
  return "RD" + Date.now().toString(36).toUpperCase() +
         Math.random().toString(36).substr(2, 3).toUpperCase();
}
// Example: RD1ABCDE4XY
```

This ID is generated client-side and is never validated or deduplicated server-side.

### Order Data Object (Fields Collected)

```
orderId, createdAt, productId, productName, productUrl, productImage,
productCategory, productPrice, quantity, selectedOptions (dynamic),
customerName, phone, address, city, state, pincode,
paymentMethod, utrNumber, amountPaid, notes
```

### Product Type Detection Logic

The checkout dynamically renders different form fields based on product type. Detection priority:

```
1. productType === "readymade" → readymade schema
2. category field → match saree/blouse/kurti/kids/accessories/custom/boutique
3. productType field → same keyword matching
4. type field → same keyword matching
5. Default: readymade schema
```

**Issue:** The first product in products.json has `productType: "readymade"` but `category: "Sarees"`. Because `productType` is checked first, this product shows the generic readymade form instead of the saree-specific form (with Fall/Pico option). This is a known schema inconsistency (see Section 13).

### localStorage Order Retention

Orders saved client-side:
- Key: `rdOrders`
- Max: 200 entries (oldest discarded)
- Scope: Device/browser only
- Cleared by: clearing browser data, incognito mode

**Critical implication:** If a customer places an order on a different device or clears their browser, no record exists anywhere. The shop owner's only record is the WhatsApp message they received.

---

## 8. Payment System

### Current Payment Architecture

| Method | Flow | Verification | Automated? |
|---|---|---|---|
| UPI | Customer pays → enters UTR + uploads screenshot → sends WhatsApp | Manual (owner checks bank app) | No |
| Cash on Delivery | No pre-payment | At delivery | No |

### UPI Payment Flow Detail

```
1. checkout.html displays static UPI QR image (assets/upi-qr.jpg)
2. Displays UPI ID: 8643090832@jio (from data/config.json)
3. Displays UPI phone: +91 86430 90832 (from data/config.json)
4. Customer pays externally in UPI app
5. Customer manually enters UTR (transaction reference number)
6. Customer uploads payment screenshot (loaded into browser memory as base64)
7. Screenshot is DISPLAYED in WhatsApp message instruction but NOT automatically attached
   (WhatsApp Web API does not support file attachments; customer must attach it manually)
8. Order message includes: UTR, amount paid, instruction to attach screenshot
9. Owner must manually verify UTR in their bank/UPI app
```

### What the Apps Script WOULD do (if connected)

The `apps-script/Code.gs` file contains a `saveScreenshotToDrive()` function that:
- Takes the base64 screenshot data
- Decodes it and saves to Google Drive
- Returns a shareable Drive URL stored in the Google Sheet

However, since the Apps Script URL is not configured, this never runs.

### Payment Risks

1. No automated UPI payment verification
2. UTR numbers are self-reported by customers (no API validation)
3. Screenshot is not automatically saved — it is sent via WhatsApp only if the customer manually attaches it
4. No refund mechanism or payment reversal capability
5. If WhatsApp is unavailable, orders cannot be placed

---

## 9. Admin Panel Architecture

### manage.html + js/manage.js

The admin panel is a 1151-line single-page application embedded in `manage.html`, entirely client-side.

### Admin Panel Sections

| Section | What It Shows | Write Capability |
|---|---|---|
| Dashboard | Product count, order count, recent orders | Read only |
| Orders | Orders from `localStorage.rdOrders` on THIS device | View, filter by status |
| Products | All 9 products from `data/products.json` | Edit → Download JSON |
| Categories | 33 categories from `data/categories.json` | Edit → Download JSON |
| Gallery | Gallery items from `data/gallery.json` | Edit → Download JSON |
| Notifications | 5 notifications from `data/notifications.json` | Edit → Download JSON |
| Website Settings | From `data/settings.json` | Edit → Download JSON |
| Theme & SEO | Colors, meta tags from `data/settings.json` | Edit → Download JSON |
| Settings/Config | UPI, phone, PIN from `data/config.json` | Edit → Download JSON |

### How "Saving" Works

The admin panel cannot write to the server. Instead, after editing any data:
1. Admin clicks "Save Changes" — updates in-memory JavaScript state only
2. Admin clicks "Generate Code" or "Download ZIP" — browser downloads a ZIP file containing updated JSON files
3. Admin must manually upload/replace the JSON files in the project to make changes live

```javascript
// js/manage.js — the "save" mechanism
showCodeModal([{ name: "data/config.json", data: { ...S.config, managerPin: fv(f, "managerPin") } }]);
// Opens a modal showing the updated JSON so admin can copy-paste it
```

### Orders in Admin Panel

```javascript
function loadLocalOrders() {
  const raw = JSON.parse(localStorage.getItem("rdOrders") || "[]");
  // ... normalizes fields ...
}
```

**Critical limitation:** The admin panel only shows orders placed on the **same browser/device** where `manage.html` is opened. Orders placed by customers on their phones are NOT visible in the admin panel unless the Google Apps Script integration is connected.

### Apps Script Integration in manage.js

The manage panel has code paths to fetch orders from the Apps Script URL:

```javascript
// Only runs if config.appsScriptUrl is set and not the placeholder
if (S.config.appsScriptUrl && !S.config.appsScriptUrl.includes("PASTE_")) {
  // fetches from Apps Script
}
```

Since `appsScriptUrl` is `"PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE"`, this path never executes.

---

## 10. Google Apps Script Integration

### Status: BUILT BUT NOT CONNECTED

`apps-script/Code.gs` is a **complete, production-ready** Google Apps Script integration that was written but never deployed. It represents the intended backend for the application.

### What It Does (When Connected)

The Apps Script exposes a Web App with 5 actions:

| Action | Method | Purpose |
|---|---|---|
| `ping` | GET | Health check |
| `submitOrder` | POST | Write order row to Google Sheet + send email |
| `updateStatus` | POST | Change order status in Sheet (PIN-protected) |
| `verifyPin` | POST | Validate manager PIN |
| `getOrders` | GET | Fetch filtered orders from Sheet |

### Google Sheet Schema (19 columns)

```
Order ID | Created Date | Status | Product ID | Product Name | Product URL |
Quantity | Selected Options | Customer Name | Mobile Number | Address |
City | State | Pincode | Payment Method | UTR Number | Amount Paid |
Screenshot URL | Notes
```

### Email Notifications

When an order is submitted, the script sends a formatted email to `CONFIG.OWNER_EMAIL` containing the full order details, payment info, and a link to `manage.html`.

### Screenshot Handling

UPI payment screenshots are:
1. Received as base64 data URI
2. Decoded and saved as a file to Google Drive (configurable folder)
3. A shareable Drive URL is stored in the Sheet's "Screenshot URL" column

### Configuration Requirements (Not Yet Set)

```javascript
const CONFIG = {
  SHEET_ID       : "YOUR_GOOGLE_SHEET_ID",          ← Must be filled
  SHEET_NAME     : "Orders",
  OWNER_EMAIL    : "your@email.com",                ← Must be filled
  DRIVE_FOLDER_ID: "",                              ← Optional
  STORE_NAME     : "RD Advance Boutique",
  MANAGER_PIN    : "1234",                          ← Should be changed
  SITE_URL       : "https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME",
};
```

**To activate the integration:**
1. Copy `apps-script/Code.gs` into a Google Apps Script project
2. Deploy as Web App with "Anyone" access
3. Paste the Web App URL into `data/config.json` → `appsScriptUrl`
4. Fill in `SHEET_ID` and `OWNER_EMAIL` inside the script

---

## 11. Configuration & Secrets Management

### .env.example (hints at intended configuration)

```
NODE_ENV=development
PORT=5000
API_PREFIX=/api/v1
CLIENT_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
ADMIN_SHORTCUT_PATH=/rd-secret-admin
```

**Observation:** These environment variables are referenced in `.env.example` but are **never read by `server.js`**. The server hardcodes `PORT = 5000` and has no rate limiting, no CORS, and no admin path logic. These env variables are placeholders for a planned server that does not yet exist.

### What Is Currently Exposed Publicly

| File | Sensitive Data | Exposure Level |
|---|---|---|
| `data/config.json` | UPI ID, account holder name, phone, manager PIN | CRITICAL — readable by anyone |
| `data/users.json` | Admin email, password hash | HIGH — readable by anyone |
| `apps-script/Code.gs` | Manager PIN value `"1234"`, full admin logic | HIGH — readable by anyone |
| `data/students.json` | Student personal data (names, contacts) | HIGH — readable by anyone |
| `data/contact.json` | Customer enquiry submissions | HIGH — readable by anyone |
| `.env.example` | Environment variable names/defaults | LOW — informational only |

### Secret Rotation Needed

The following values should be treated as compromised and changed:
- Manager PIN: `1234` (default, never changed, in 3 places)
- UPI details: these are financial identifiers and should not be in a publicly served JSON file

---

## 12. Security Vulnerability Assessment

### CRITICAL

**C1 — Sensitive Financial Data in Public JSON**
- `data/config.json` contains `upiId`, `upiName`, `upiPhone` readable by any browser request
- Impact: Customer could theoretically create fake payment requests using the UPI ID
- Vector: Direct URL access `https://[domain]/data/config.json`

**C2 — Unauthenticated File Upload Endpoint**
- `POST /upload` accepts any image from any source, writes to `assets/`
- No authentication, no rate limit, no CAPTCHA, no file origin validation
- Impact: Disk exhaustion, potential content injection, abuse vector
- Vector: `curl -X POST https://[domain]/upload -F "files=@payload.jpg"`

**C3 — Admin Authentication is Client-Side Only**
- PIN comparison happens in browser JavaScript, not on server
- Anyone can open browser console and toggle HTML visibility to access admin panel
- Impact: Full access to admin data editing capabilities

### HIGH

**H1 — Admin Password Hash Publicly Accessible**
- `data/users.json` served over HTTP with no access restriction
- Custom `$rdab-bcrypt$` format may be weaker than standard bcrypt
- Impact: Offline hash cracking attempt possible

**H2 — Zero Order Persistence**
- No server-side order storage means orders can be completely lost
- Customer disputes have no authoritative record
- WhatsApp message is the only order receipt for both parties
- Impact: Business/legal risk, no audit trail

**H3 — Manager PIN in 3 Public Locations**
- `data/config.json` (served publicly)
- `apps-script/Code.gs` (served publicly from project root)
- `js/manage.js` fallback: `S.config.managerPin || "1234"` (source code readable)

**H4 — Student/Customer PII in Public JSON Files**
- `data/students.json` and `data/contact.json` are publicly served
- Contains customer names, phone numbers, enquiry messages
- Impact: Privacy violation, potential data protection liability

### MEDIUM

**M1 — No CORS Headers**
- `POST /upload` can be cross-origin POST'd from any website
- No `Access-Control-Allow-Origin` restriction

**M2 — No Security Headers**
- Missing: `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`
- Pages can be embedded in iframes by third parties

**M3 — No Rate Limiting**
- `/upload` endpoint can be spammed indefinitely
- Static file serving has no request throttling
- `.env.example` hints at `RATE_LIMIT_MAX=100` but this is never implemented

**M4 — WhatsApp-Only Order Channel**
- Single point of failure: if WhatsApp is blocked/unavailable, orders cannot be placed
- No fallback order channel

### LOW

**L1 — express.static Serves Entire Root**
- No directory filtering means `/.git` contents (if not gitignored) could be served
- `node_modules/` contents are served (though generally harmless)

**L2 — Order IDs Generated Client-Side**
- `Date.now().toString(36) + random` has theoretical collision risk
- No server-side deduplication check

**L3 — localStorage Order Cap of 200**
- Older orders are silently discarded from localStorage
- High-volume periods could cause order record loss on the customer's device

---

## 13. Data Integrity & Schema Analysis

### products.json Schema Issues

Each product has both `stockQuantity` and `stock` as separate, independent fields with different values:

```json
{
  "stockQuantity": 0,   ← Used by the checkout/shop display
  "stock": 8,           ← Appears unused or legacy
}
```

**Impact:** If any inventory check looks at `stock`, it sees 8. If it looks at `stockQuantity`, it sees 0. There is no code that keeps these in sync.

### Duplicate/Redundant Type Fields

Each product has three overlapping type identifiers:
```json
{
  "category": "Sarees",       ← Used for display and type detection
  "productType": "readymade", ← Used for checkout schema selection
  "type": "readymade"         ← Redundant, same as productType
}
```

The checkout `detectType()` function checks `productType` before `category`, meaning a Saree product with `productType: "readymade"` will use the generic readymade checkout form instead of the saree-specific one. The memory note from earlier sessions confirms `category` is actually the most reliable field.

### Non-Unique Product IDs

The first product has `"id": "sarees"` — the same as the category identifier. Product IDs should be globally unique within products.json and ideally UUIDs or URL-slugs that cannot conflict with category slugs.

### Product Link Field (Legacy)

```json
"link": "https://wa.me/917693849472?text=I%20am%20interested%20in%20Designer%20Blouse"
```

This field pre-dates the checkout system and creates duplicate order pathways (direct WhatsApp link vs. the full checkout flow). It could confuse customers or bypass the payment collection step.

### Schema Field Inventory (Per Product)

| Field | Purpose | Issue |
|---|---|---|
| `id` | Product identifier | Non-unique in some cases |
| `title` | Display name | Some products also have `name` field |
| `name` | Alternate name | Redundant with `title` |
| `category` | Category classification | Most reliable type indicator |
| `productType` | Checkout schema selector | Conflicts with `category` |
| `type` | Duplicate of `productType` | Redundant |
| `price` | Selling price | Correctly used |
| `discountPrice` | Sale price | Always `0`, unused |
| `image` | Primary image | Redundant with `images[0]` |
| `images` | Image gallery array | Correct |
| `stockQuantity` | Current stock | Conflicts with `stock` |
| `stock` | Alternate stock field | Conflicts with `stockQuantity` |
| `featured` | Homepage feature flag | Used in script.js |
| `status` | `"active"` / `"inactive"` | Used for filtering |
| `affiliateUrl` | Affiliate link | Always empty string |
| `link` | Legacy WhatsApp direct link | Bypasses checkout flow |

---

## 14. Client-Side Feature Inventory

All features below are entirely client-side (no server component).

### Wishlist System (`js/wishlist.js`)
- Storage: `localStorage.rdWishlist` (JSON array of product IDs)
- Features: Add/remove, badge counter on nav, share URL, related products, clear all
- Limitation: Device-specific, lost on browser clear, not synced across devices

### Multi-Language Support (`js/i18n.js`)
- Languages: English (EN) and Hindi (HI)
- Storage: `localStorage.rdLanguage`
- Coverage: Nav links, hero text, buttons on key pages
- Limitation: Not all product content is translated (product descriptions remain in English)

### Smart Recommendations (`js/recommendations.js`, 367 lines)
- Strategies: Similar (same category), Matching (complete the look), Occasion-based, Recently Viewed
- Data sources: `data/products.json` + `data/gallery.json` (client fetched)
- Storage: `localStorage.rd_recently_viewed_items`, `localStorage.rd_recommendation_clicks`
- Limitation: Entirely device-local; no cross-device or behavioral analytics

### Product Comparison (`js/compare.js`)
- Allows side-by-side comparison of multiple products
- Storage: Session/localStorage

### Outfit Builder (`js/outfit-builder.js`)
- Visual outfit planning tool
- Data from products.json

### Site Settings Loader (`js/site-settings.js`, 190 lines)
- Fetches `data/settings.json` on every page load
- Applies: site name, logo, SEO meta tags, social links, contact info, theme colors, footer text
- Runs on all 14 pages via `<script src="js/site-settings.js">`

### Notifications (`js/notifications.js`)
- Loads from `data/notifications.json`
- Displays dismissible banners based on `scope` field
- No server-side push; purely poll-on-load

---

## 15. File Upload System

### `/upload` Endpoint

```javascript
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'assets/'),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');    // sanitizes filename
    const name = base || ('img_' + Date.now());
    cb(null, name + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },  // 20MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Sirf images allowed hain'));
  },
});

// Accepts up to 50 files per request
app.post('/upload', upload.array('files', 50), (req, res) => { ... });
```

### Usage in manage.js

The upload endpoint is called when an admin uploads a product image through the admin panel. The returned `assets/` paths are used as image URLs in products.json.

### Security Concerns

- No authentication check before accepting files
- MIME type check only (trusts `file.mimetype`, which can be spoofed via HTTP header)
- No virus/malware scanning
- Filename sanitization is good but the destination `assets/` folder is also served publicly
- A flood of requests could exhaust disk space or server memory
- Maximum 50 files × 20MB = potentially 1GB per single request

---

## 16. Performance & Scalability Assessment

### Current Performance Characteristics

| Metric | Status | Notes |
|---|---|---|
| Static file serving | Good | Express static is efficient |
| No-cache headers | None set | `data/` JSON files fetched fresh on every page load |
| Image optimization | None | Raw JPEGs from phone camera (~2-5MB each), ~120 images |
| CDN | None | All assets served from single Node process |
| API response time | N/A — no API | All data loaded from static JSON |
| Database queries | N/A | No database |
| Concurrent users | Unknown ceiling | Single Node.js process, no clustering |

### Page Load Issues

Every page that uses `site-settings.js` makes a `fetch("data/settings.json")` request on load. With no cache headers, this hits the server fresh every time, for every user, on every page navigation.

Similarly, `script.js` and `products.js` both fetch `data/products.json` on every load of shop/home pages.

### Scalability

Because the site is effectively static HTML + JSON, it can theoretically serve unlimited concurrent readers with no backend bottleneck. The only scalability concern is the `/upload` endpoint, which is the sole stateful operation.

For the business scale of a single boutique studio in Damoh, the current architecture is sufficient for read traffic but lacks the resilience needed for reliable order management.

---

## 17. Prioritized Recommendations

### Priority 1 — Immediate (Security-Critical)

**1.1 — Protect data/config.json from public access**

Move sensitive fields (UPI ID, manager PIN, phone) out of the publicly-served JSON. Options:
- Store them as server-side environment variables read by `server.js`
- Serve them via a protected API endpoint that requires authentication
- At minimum: serve UPI display info separately from the PIN

**1.2 — Secure the /upload endpoint**

Add a secret token requirement:
```javascript
if (req.headers['x-upload-token'] !== process.env.UPLOAD_TOKEN) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**1.3 — Change the manager PIN immediately**

The default `1234` PIN is in the source code, documentation, and config file. Change it to something strong and ensure it is not stored in any publicly readable file.

**1.4 — Exclude sensitive files from express.static**

```javascript
// Deny access to data/users.json and data/config.json
app.get('/data/users.json',  (req, res) => res.status(403).end());
app.get('/data/config.json', (req, res) => res.status(403).end());
```

### Priority 2 — High (Business-Critical)

**2.1 — Connect the Google Apps Script integration**

The `apps-script/Code.gs` file is complete and production-ready. Connecting it requires:
1. Create a Google Sheet
2. Deploy `Code.gs` as a Web App
3. Set `appsScriptUrl` in `data/config.json`
4. Configure `SHEET_ID` and `OWNER_EMAIL` inside the script

This single action will enable: order persistence, email notifications, admin order management, and payment screenshot storage to Google Drive.

**2.2 — Fix the checkout.js type detection**

Per the memory note, `category` is the most reliable field. The `detectType()` function should check `category` before `productType`:
```javascript
return match(product.category)        // check category FIRST
    || match(product.productType)
    || match(product.type)
    || "readymade";
```

**2.3 — Move sensitive settings to environment variables**

```javascript
// server.js should read:
const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN;
const MANAGER_PIN  = process.env.MANAGER_PIN;
// Never serve these from a public JSON file
```

### Priority 3 — Medium (Quality & Reliability)

**3.1 — Add cache-control headers for static JSON**

```javascript
app.use('/data', express.static('data', { maxAge: '5m' }));
```

This reduces redundant fetches of products.json and settings.json on every page load.

**3.2 — Fix products.json schema inconsistencies**

- Deduplicate `productType` and `type` fields (keep only `productType`)
- Rename `stockQuantity` → `stock` (or vice versa) and remove the duplicate
- Ensure all product `id` values are unique slug-style identifiers
- Remove legacy `link` field (superseded by checkout flow)
- Remove `name` field (superseded by `title`)

**3.3 — Add basic security headers**

```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
```

**3.4 — Add rate limiting to the upload endpoint**

Install `express-rate-limit` and apply it to `POST /upload`:
```javascript
const rateLimit = require('express-rate-limit');
const uploadLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
app.post('/upload', uploadLimit, upload.array('files', 50), handler);
```

### Priority 4 — Low (Future Improvements)

**4.1 — Implement server-side admin authentication**

Replace the client-side PIN check with a proper server session:
- `POST /api/auth/login` → validates PIN against env variable → sets `httpOnly` session cookie
- All `/api/admin/*` routes protected by session middleware
- `POST /api/auth/logout` → destroys session

**4.2 — Introduce a real database**

For long-term reliability, replace flat JSON files with a database. For this project scale, **SQLite** (via `better-sqlite3`) is recommended:
- Zero infrastructure cost (single file)
- ACID transactions (no order data loss)
- Full SQL query capability
- Trivially added to the existing Express server

**4.3 — Image optimization pipeline**

Product images are raw phone camera JPEGs (potentially 2-5MB each). Implementing `sharp` for resize-on-upload would reduce page load times significantly:
```javascript
// On upload: resize to max 1200×1200, convert to WebP, quality 80
```

**4.4 — Add a sitemap.xml**

`settings.json` has `"sitemapEnabled": true` but no sitemap file or generator exists. A static `sitemap.xml` would fulfil this and improve Google indexing.

---

## Appendix A — File Size Reference

| File | Lines | Notes |
|---|---|---|
| `js/manage.js` | 1151 | Largest JS file; full admin panel |
| `data/products.json` | 1064 | 9 products × ~100 lines each |
| `data/gallery.json` | 408 | Gallery item metadata |
| `js/checkout.js` | 745 | Full checkout flow |
| `js/recommendations.js` | 367 | Smart recommendations engine |
| `data/categories.json` | 247 | 33 categories |
| `js/site-settings.js` | 190 | Settings applier for all pages |
| `apps-script/Code.gs` | 295 | Full GAS backend (not connected) |
| `server.js` | 47 | Entire backend server |

## Appendix B — Technology Versions

| Package | Version | Role |
|---|---|---|
| express | ^5.2.1 | Static file server + upload route |
| multer | ^2.1.1 | Multipart file upload handling |
| serve | ^14.2.3 | devDependency, alternative static server |
| Node.js | 20.x | Runtime |

## Appendix C — localStorage Keys Used

| Key | Set By | Contains |
|---|---|---|
| `rdOrders` | checkout.js | Orders placed (max 200) |
| `rdWishlist` | wishlist.js | Saved product IDs |
| `rdLanguage` | i18n.js | `"en"` or `"hi"` |
| `rd_recently_viewed_items` | recommendations.js | Recently viewed product IDs |
| `rd_recommendation_clicks` | recommendations.js | Click tracking for recommendations |

---

*Report generated: June 4, 2026*  
*Scope: Read-only codebase inspection — no changes were made to any file.*  
*Auditor: Replit Agent (Automated Analysis)*
