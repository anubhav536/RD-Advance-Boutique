# RD Advance Boutique Project Audit Report

**Audit date:** 2026-05-29  
**Scope requested:** every HTML page, JavaScript file, JSON file, and configuration file in the repository.  
**Audit method:** static review of all root HTML pages, root/client JavaScript files, JSON data/configuration files, Express routes/controllers/models/middleware/configuration, link/script/form/button extraction, JSON parsing, `npm run lint`, and live local smoke checks against the Node server.

## 1. Executive Summary

The project is a hybrid static frontend plus Express/JSON-file backend. The backend API is materially more complete than the HTML admin screens that are supposed to consume it. Public product/gallery display, custom stitching order creation, admin authentication, product CRUD screens, gallery create, notification management, website/social/SEO settings, asset upload, and the JSON database layer are the strongest working areas.

The largest gaps are in the admin UI pages for categories, courses, admissions/students/enquiries, contact/support, and parts of order management. Many of those pages render hard-coded sample rows and attach buttons that only show success alerts instead of calling the API. Several admin forms also have inline placeholder handlers with comments such as `FUTURE: Save ... to database`; a few are rescued by external scripts loaded later, but the pattern is inconsistent and creates duplicate submit handlers.

Top risks:

1. **Admin category CRUD is not connected.** Category add/edit/delete pages only alert success and do not persist to `data/categories.json`.
2. **Course/admin student pages are mostly disconnected from the implemented `/api/v1/tailoring-courses/...` API.** Existing pages contain hard-coded cards/rows and alert-only buttons.
3. **Contact appointment form does not save data.** `contact.html` has a public appointment form but no submit handler or `action` endpoint.
4. **Many admin contact/support pages are static.** Contact messages and support tickets do not load or update backend contact data.
5. **`data/students.json` is an object while the generic JSON database config marks `students` as an array.** Dedicated course models expect an object store, but generic admin data writes may reject or mishandle the collection.
6. **Some referenced placeholder image paths do not exist.** Several admin gallery/category/product examples reference `assets/gallery/...`, `assets/categories/...`, and `assets/products/sample.jpg`, none of which exist.
7. **Duplicate root-level image files appear unused.** The application consistently references `assets/...`; root duplicates such as `design1.jpg`, `logo.png`, and `hero-bg.jpg` are not directly used by pages/styles/data.

## 2. Inventory Reviewed

### HTML pages reviewed

37 root HTML pages were reviewed:

- Public: `index.html`, `shop.html`, `gallery.html`, `learn.html`, `contact.html`, `custom.html`.
- Authentication: `admin-login.html`.
- Admin dashboard/navigation: `admin-dashboard.html`, `admin-products.html`, `admin-gallery.html`, `admin.orders.html`, `admin-course.html`, `admin-categories.html`, `admin-contact.html`, `admin-settings.html`, `admin-notifications.html`.
- Product admin: `add-product.html`, `edit-product.html`, `all-products.html`, `product-details.html`.
- Gallery admin: `add-gallery.html`, `edit-gallery.html`, `all-gallery.html`.
- Category admin: `add-category.html`, `edit-category.html`, `all-categories.html`.
- Order admin: `pending-orders.html`, `completed-orders.html`, `custom-stitching.html`.
- Course admin: `course-enquiries.html`, `students.html`, `admissions.html`.
- Contact/support admin: `contact-messages.html`, `customer-support.html`.
- Settings admin: `website-settings.html`, `social-links.html`, `seo-settings.html`.

### JavaScript/configuration reviewed

- Client/root JS: `products.js`, `js/script.js`, `js/admin-auth.js`, `js/admin-products.js`, `js/admin-notifications.js`, `js/admin-website-settings.js`, `js/admin-social-settings.js`, `js/admin-seo-settings.js`, `js/site-settings.js`, `js/notifications.js`.
- Backend JS: all `src/config`, `src/controllers`, `src/middleware`, `src/models`, `src/routes`, `src/services`, `src/utils`, and `src/server.js`/`src/app.js` files.
- JSON/config: `package.json`, `config/admin-auth.json`, and all JSON files in `data/`.

## 3. Features Fully Working

These features are implemented end-to-end or have a complete backend and connected frontend path based on the reviewed code and smoke checks.

### 3.1 Backend foundation and API routing

- Express app boots successfully and serves `/api/v1/health` with HTTP 200.
- API routes are mounted for health, products, gallery, orders, tailoring courses, contact, public data, assets, admin assets, admin auth, and admin JSON data.
- Static files are served after API routes.
- Admin pages listed in the protected-page set redirect unauthenticated visitors to `admin-login.html`.
- The project lint/syntax check passes.

### 3.2 Admin authentication

- `admin-login.html` posts credentials to `/api/v1/admin/auth/login`, handles JSON errors, and redirects to the requested admin page on success.
- Admin session/profile/logout/credential-update routes exist.
- `js/admin-auth.js` protects client-side admin pages by checking `/api/v1/admin/auth/session` and injecting a logout button into `.admin-profile`.
- `admin-settings.html` includes a credentials form that loads `/profile` and sends `PUT /credentials`.

### 3.3 Public product listing and filtering

- `shop.html` loads public scripts and includes category filter buttons.
- `products.js` loads `data/products.json`, renders product cards, supports category filters/search, and links to WhatsApp/product links.
- The backend `/api/v1/products` endpoint returns product data.

### 3.4 Public gallery listing and lightbox

- `gallery.html` loads `products.js`, which loads `data/gallery.json`, renders gallery cards, and builds fullscreen preview anchors/lightboxes.
- The backend `/api/v1/gallery` endpoint returns gallery data.

### 3.5 Public notifications

- `index.html`, `shop.html`, `learn.html`, and `product-details.html` include `js/notifications.js` in relevant places.
- Notifications load from `data/notifications.json`, filter by page scope/status/date, render inline announcements, and support dismissible popup notices.

### 3.6 Website settings application on public pages

- Public pages load `js/site-settings.js`.
- The script reads `/api/v1/data/settings` with fallback to `data/settings.json`, then applies SEO metadata, logo, contact details, WhatsApp links, social links, and banner/hero content.

### 3.7 Custom stitching booking form

- `custom.html` contains a detailed custom stitching form and a tracking form.
- `js/script.js` intercepts custom stitching submit, reads form fields/files, posts a custom-stitching order to `/api/v1/orders`, shows the returned order number, and renders tracking details.
- Tracking uses `/api/v1/orders/custom-stitching?search=...`.
- **Caveat:** tracking endpoint is admin-protected on the backend, so public tracking will fail unless the customer is logged in as admin. See partial/missing sections.

### 3.8 Product admin CRUD screens

- `js/admin-products.js` connects product admin pages to `/api/v1/products` and `/api/v1/admin/assets/products`.
- Working paths include listing all products, product creation, edit form population/update, delete from list/edit/detail contexts, product details rendering, and local image upload through asset API.
- **Caveat:** `add-product.html` and `edit-product.html` also contain inline placeholder submit handlers, but the external admin-products handler registers in the capture phase and calls `stopImmediatePropagation()`, so the connected handler should run first.

### 3.9 Gallery creation

- `add-gallery.html` uploads selected gallery files to `/api/v1/admin/assets/gallery`, then posts each uploaded asset as a gallery record to `/api/v1/gallery`.
- Gallery API CRUD exists in backend routes/models.
- **Caveat:** edit/list/delete gallery admin pages are not connected. See partially implemented/missing sections.

### 3.10 Notification management

- `admin-notifications.html` loads `js/admin-notifications.js`.
- The script reads/writes `/api/v1/admin/data/notifications`, falls back to `data/notifications.json` for preview, supports create/update/delete, table rendering, editing, reset, and image-path capture.

### 3.11 Website/social/SEO settings admin

- `website-settings.html` uses `js/admin-website-settings.js` to load/save `settings` through `/api/v1/admin/data/settings` and upload logo/hero/favicon assets.
- `social-links.html` uses `js/admin-social-settings.js` to update `settings.socialLinks` and `settings.contact.whatsappUrl`.
- `seo-settings.html` uses `js/admin-seo-settings.js` to update `settings.seo`.

### 3.12 Asset management backend

- Asset routes support listing, type-specific listing, upload, replace, and delete.
- Local asset middleware validates uploads and writes into `assets/<type>/`.
- Asset metadata is stored in `data/assets.json`.

### 3.13 JSON validation and syntax

- All JSON files parsed successfully during audit.
- `npm run lint` passed syntax checks for `src/**/*.js`.

## 4. Features Partially Implemented

### 4.1 Order management

Implemented:

- Backend order routes exist for create/list/detail/update/delete, summaries, pending/completed/cancelled/custom-stitching/ready-made filters, status changes, payment submission, payment approval, and payment rejection.
- `custom.html` can submit orders to `/api/v1/orders`.
- `custom-stitching.html` loads `/api/v1/orders/custom-stitching` and updates status through `/api/v1/orders/:id/status`.
- `pending-orders.html` has a substantial inline script that fetches pending orders, renders payment details, and calls payment approve/reject APIs.

Partial gaps:

- `admin.orders.html` is static and its edit/delete buttons only show alerts.
- `completed-orders.html` uses hard-coded completed order rows; invoice buttons only alert.
- `pending-orders.html` is more connected than other order pages, but it still contains sample markup and should be fully verified against non-empty order data.
- Public tracking in `custom.html` calls an admin-protected endpoint, so customers cannot track without an admin session.

### 4.2 Course management

Implemented backend:

- `/api/v1/tailoring-courses/categories`, `/enquiries`, `/admissions`, `/students`, and `/enrollments` routes exist, each with public GET and admin-protected create/update/delete.
- The model supports dashboard counts, constants, CRUD operations, normalization, and object-store writes to `data/students.json`.

Partial frontend:

- `admin-course.html`, `course-enquiries.html`, `admissions.html`, and `students.html` contain visually complete cards/tables/buttons.
- Those pages do not call `/api/v1/tailoring-courses/...`; they rely on hard-coded content and alert-only button behavior.

### 4.3 Contact and support management

Implemented backend:

- `/api/v1/contact` supports public submission creation.
- `/api/v1/contact/submissions` and `/api/v1/contact/tickets` support admin list/read/update/delete/status/replies.

Partial frontend:

- `admin-contact.html`, `contact-messages.html`, and `customer-support.html` render admin UI but do not fetch or persist contact/support data.
- The public `contact.html` appointment form has no submit handler or action, so it is not connected to the implemented contact backend.

### 4.4 Gallery admin

Implemented:

- Public gallery rendering works.
- `add-gallery.html` is connected to asset upload and gallery create API.
- Backend gallery CRUD is complete.

Partial gaps:

- `all-gallery.html` delete buttons only remove/alert visually and do not call `DELETE /api/v1/gallery/:id`.
- `edit-gallery.html` update/delete handlers only alert success and do not call `PUT/PATCH/DELETE /api/v1/gallery/:id`.
- Admin gallery table/cards still reference non-existent `assets/gallery/design*.jpg` example paths.

### 4.5 Category management

Implemented data/API foundation:

- `data/categories.json` exists.
- Generic admin JSON data routes can read/write `categories` as an array through `/api/v1/admin/data/categories`.

Partial/missing UI:

- `add-category.html`, `edit-category.html`, and `all-categories.html` do not call the admin data API.
- Form submissions and delete buttons only alert success and contain future-save comments.
- Example category images reference missing `assets/categories/category*.jpg` paths.

### 4.6 Public home/learn pages

Implemented:

- Pages are navigable, styled, and use settings/notifications.
- Static course/design content displays.

Partial:

- `learn.html` does not connect to course API for live categories/enquiries/admissions.
- Course CTAs route primarily to WhatsApp/contact rather than saving course enquiries in the backend.

## 5. Missing Features

### 5.1 Missing public-ready order tracking endpoint

`custom.html` tracking calls `/api/v1/orders/custom-stitching?search=...`, but backend route `GET /api/v1/orders/custom-stitching` requires admin authentication. A public customer-safe tracking endpoint is missing.

### 5.2 Missing contact form persistence on `contact.html`

The appointment request form on `contact.html` has fields and a submit button, but no JavaScript submit handler and no HTML `action`. It should post to `/api/v1/contact` or another appropriate endpoint.

### 5.3 Missing category API-specific frontend integration

No category page calls `/api/v1/admin/data/categories`. Category create/edit/delete is not persisted from UI.

### 5.4 Missing connected course frontend/admin integration

Admin course pages do not consume the implemented `/api/v1/tailoring-courses/...` API. Public course enquiry/admission flows are also not wired to save data.

### 5.5 Missing connected contact/support admin integration

Contact/support admin pages do not consume `/api/v1/contact/submissions` or `/api/v1/contact/tickets`.

### 5.6 Missing completed order invoice generation

`completed-orders.html` has invoice buttons but no invoice API, PDF generation, print handling, or persistent invoice metadata.

### 5.7 Missing ready-made order checkout flow

Product cards generally link to WhatsApp/product URLs. There is no public ready-made product checkout form wired to `/api/v1/orders` for normal product purchases.

### 5.8 Missing upload persistence in notification image field

`js/admin-notifications.js` records selected image as `assets/<filename>` but does not upload it through the asset API. Unless the file already exists in `assets/`, saved notification images can be broken.

### 5.9 Missing sitemap/robots generation

SEO settings save `sitemapEnabled` and robots/canonical values into settings, but there is no actual sitemap or robots.txt generation route/file update.

## 6. Disconnected Pages

“Disconnected” means either no incoming internal link, no outgoing navigation, or no meaningful data/API connection despite presenting a management screen.

### 6.1 Navigation-disconnected

- `admin-login.html` has no ordinary incoming link and no outgoing page links. This appears intentional because the README describes a hidden admin shortcut and the server redirects protected admin pages to login.

### 6.2 Data-disconnected admin pages

These pages are linked in the admin navigation but are disconnected from persistence/API data:

- `admin-categories.html` — navigation hub only; links to disconnected category pages.
- `add-category.html` — form does not save.
- `edit-category.html` — edit/delete actions do not save.
- `all-categories.html` — delete actions do not save.
- `admin-course.html` — approve buttons only alert.
- `course-enquiries.html` — action/approve buttons only alert.
- `admissions.html` — approve/message/view actions only alert.
- `students.html` — message/view actions only alert.
- `admin-contact.html` — quick action buttons only alert/no backend load.
- `contact-messages.html` — action buttons only alert/no backend load.
- `customer-support.html` — resolve buttons only alert/no backend update.
- `completed-orders.html` — invoice buttons only alert/no invoice generation.
- `admin.orders.html` — edit/delete buttons only alert/no backend update/delete.
- `all-gallery.html` — delete buttons only alert/no backend delete.
- `edit-gallery.html` — edit/delete form/buttons only alert/no backend update/delete.

### 6.3 Data-connected pages

These pages have confirmed data/API connections:

- `index.html` — notifications/settings.
- `shop.html` — products/settings/notifications.
- `gallery.html` — gallery/settings.
- `custom.html` — order create; tracking attempted but blocked by admin route.
- `admin-login.html` — auth login.
- `admin-settings.html` — auth profile/credentials.
- `admin-notifications.html` — notifications admin data.
- `website-settings.html` — settings and assets.
- `social-links.html` — settings.
- `seo-settings.html` — settings.
- `add-product.html`, `edit-product.html`, `all-products.html`, `product-details.html` — product API via `js/admin-products.js`.
- `add-gallery.html` — asset upload and gallery create.
- `custom-stitching.html` — admin custom order list/status update.
- `pending-orders.html` — admin pending orders/payment approve/reject.

## 7. Forms That Do Not Save Data

### 7.1 Public forms

| Page | Form | Current behavior | Expected persistence |
| --- | --- | --- | --- |
| `contact.html` | Appointment request/contact form | No submit handler or action; browser will not save data. | Should POST to `/api/v1/contact` or `/api/v1/contact/submissions`. |
| `custom.html` tracking form | Tracking lookup | Calls admin-protected `/api/v1/orders/custom-stitching`; likely fails for public users. | Should use a public customer-safe tracking endpoint. |

### 7.2 Admin forms

| Page | Form | Current behavior | Expected persistence |
| --- | --- | --- | --- |
| `add-category.html` | `#categoryForm` | Alerts “Category Created Successfully”; future-save comment only. | Create item in `/api/v1/admin/data/categories`. |
| `edit-category.html` | `#editCategoryForm` | Alerts “Category Updated Successfully”; future-update comment only. | Update `/api/v1/admin/data/categories/:id`. |
| `add-product.html` | `#addProductForm` | Has inline fake submit handler, but external `js/admin-products.js` should intercept first and save. | Remove duplicate placeholder handler; keep API POST. |
| `edit-product.html` | `#editProductForm` | Has inline fake submit handler, but external `js/admin-products.js` should intercept first and save. | Remove duplicate placeholder handler; keep API PUT. |
| `edit-gallery.html` | `#editGalleryForm` | Alerts success only. | Update `/api/v1/gallery/:id`. |
| `admin-settings.html` | `#adminCredentialsForm` | Saves to `config/admin-auth.json` through `/api/v1/admin/auth/credentials`. | Working. |
| `admin-notifications.html` | `#notificationForm` | Saves notification JSON records. | Working, except image upload is path-only. |
| `website-settings.html` | `#websiteSettingsForm` | Saves settings and uploads assets. | Working. |
| `social-links.html` | `#socialLinksForm` | Saves settings. | Working. |
| `seo-settings.html` | `#seoSettingsForm` | Saves settings. | Working. |

## 8. Admin Functions Not Connected

### Products

- Mostly connected through `js/admin-products.js`.
- Cleanup needed: duplicate inline placeholder submit handlers remain in `add-product.html` and `edit-product.html`.

### Categories

- Create category: not connected.
- Edit category: not connected.
- Delete category: not connected.
- Category list/search: static markup only.

### Gallery

- Add gallery: connected.
- Edit gallery: not connected.
- Delete gallery: not connected.
- Gallery list/search: static markup only.

### Orders

- Pending order payment approve/reject: connected in `pending-orders.html`.
- Custom stitching status update: connected in `custom-stitching.html`.
- General order dashboard edit/delete: not connected in `admin.orders.html`.
- Completed order invoice: not connected.

### Courses

- Course enquiry approve/action: not connected.
- Admission approve/action: not connected.
- Student actions: not connected.
- Course dashboard buttons: not connected.

### Contact/support

- Contact message list/actions: not connected.
- Customer support ticket resolve/action: not connected.
- Contact dashboard quick action buttons: not connected.

### Settings

- Website settings: connected.
- Social links: connected.
- SEO settings: connected.
- Admin credentials: connected.

## 9. Buttons With No Functionality or Alert-Only Functionality

### Alert-only or visual-only buttons

- `add-category.html`: submit button only alerts and does not save.
- `edit-category.html`: delete buttons and save button only alert.
- `all-categories.html`: delete buttons only alert/remove UI.
- `edit-gallery.html`: delete buttons and save button only alert.
- `all-gallery.html`: delete buttons only alert/remove UI.
- `admin.orders.html`: edit and delete buttons only alert.
- `completed-orders.html`: invoice buttons only alert.
- `admin-course.html`: approve buttons only alert.
- `course-enquiries.html`: action and approve buttons only alert.
- `admissions.html`: approve/message/view buttons only alert.
- `students.html`: message/view buttons only alert.
- `contact-messages.html`: message action buttons only alert.
- `customer-support.html`: resolve buttons only alert.
- `admin-contact.html`: quick action buttons have no durable data effect.

### Buttons intentionally functional

- Public nav toggle injected by `js/script.js`.
- Shop category filters in `products.js`/`js/script.js`.
- Notification popup close button in `js/notifications.js`.
- Admin logout button injected by `js/admin-auth.js`.
- Product admin edit/delete/list/detail buttons through `js/admin-products.js`.
- Pending order modal close/approve/reject buttons in `pending-orders.html`.
- Custom stitching status `<select>` controls in `custom-stitching.html`.
- Settings/admin/auth form submit buttons on connected settings pages.

## 10. Unused or Probably Unused Files

### 10.1 Root-level duplicate media files

The app consistently references assets through `assets/...` or CSS-relative `../assets/...`. The following root-level media files appear to be duplicates and are not directly referenced by HTML/CSS/JSON/JS paths as root files:

- `course.jpg`
- `coursedesign1.jpg`
- `coursedesign2.jpg`
- `coursedesign3.jpg`
- `design1.jpg`
- `design2.jpg`
- `design3.jpg`
- `design5.jpg`
- `design6.png`
- `hero-bg.jpg`
- `logo.png`

The corresponding `assets/...` files are used. Do not delete duplicates without confirming deployment/static hosting assumptions, but they are candidates for cleanup.

### 10.2 Possibly unused data/config paths

- `data/assets.json` is used by the asset backend, even if some existing metadata entries may not be visible in current pages.
- `data/students.json` is used by `TailoringCourseModel`, but its object shape conflicts with the generic JSON database collection config that marks `students` as an array.

### 10.3 Broken referenced placeholder assets

These paths are referenced by admin sample markup but files are absent:

- `assets/categories/category1.jpg`
- `assets/categories/category2.jpg`
- `assets/categories/category3.jpg`
- `assets/categories/category4.jpg`
- `assets/gallery/design1.jpg`
- `assets/gallery/design2.jpg`
- `assets/gallery/design3.jpg`
- `assets/products/sample.jpg`

These are not “unused”; they are missing references and should either be created, replaced with existing `assets/design*.jpg`, or removed from static sample markup.

## 11. JSON and Configuration Findings

### 11.1 Valid JSON files

All audited JSON/config files parse successfully:

- `config/admin-auth.json`
- `data/assets.json`
- `data/categories.json`
- `data/contact.json`
- `data/gallery.json`
- `data/notifications.json`
- `data/orders.json`
- `data/products.json`
- `data/settings.json`
- `data/students.json`
- `package.json`

### 11.2 Schema inconsistencies

- `src/utils/jsonDatabase.js` declares `students` as an array collection.
- `data/students.json` is an object containing course categories, enquiries, admissions, students, enrollments, etc.
- `TailoringCourseModel` correctly treats `students` as an object store, but generic `/api/v1/admin/data/students` writes can conflict with the declared generic collection type.

### 11.3 Empty data collections

- `data/orders.json` is currently an empty array. Order pages with hard-coded sample rows are not reflecting saved backend data.

## 12. Endpoint Smoke-Check Results

Local server smoke checks run on `http://127.0.0.1:5000`:

| Endpoint/page | Result | Notes |
| --- | ---: | --- |
| `/api/v1/health` | 200 | API health works. |
| `/api/v1/products` | 200 | Product data returned. |
| `/api/v1/gallery` | 200 | Gallery data returned. |
| `/api/v1/products/categories` | 200 | Product category summary returned. |
| `/api/v1/orders/payment-methods` | 200 | Manual UPI payment methods returned. |
| `/api/v1/tailoring-courses` | 404 | No route for collection root; actual routes are `/categories`, `/enquiries`, `/admissions`, `/students`, `/enrollments`, `/dashboard`, `/constants`. |
| `/api/v1/contact/submissions` | 401 | Expected without admin session. |
| `/api/v1/data/students` | 200 | Object-shaped course data returned publicly. |
| `/api/v1/data/settings` | 200 | Settings returned. |
| `/admin-dashboard.html` | 302 | Expected redirect to login without session. |
| `/index.html` | 200 | Static public page served. |
| `/shop.html` | 200 | Static public page served. |
| `/custom.html` | 200 | Static public page served. |
| `/contact.html` | 200 | Static public page served. |

## 13. Prioritized Remediation Plan

### Priority 1: Data integrity and user-facing saves

1. Connect `contact.html` to `POST /api/v1/contact`.
2. Add a public customer-safe order tracking endpoint and update `custom.html` tracking to use it.
3. Fix the `students` collection type mismatch in the generic JSON database config or prevent generic writes for the object-shaped course store.
4. Replace alert-only category CRUD with `/api/v1/admin/data/categories` calls.

### Priority 2: Admin operational screens

1. Connect course pages to `/api/v1/tailoring-courses/...`.
2. Connect contact/support admin pages to `/api/v1/contact/...`.
3. Connect gallery edit/delete pages to `/api/v1/gallery/:id`.
4. Connect general order dashboard actions and completed-order invoice actions.

### Priority 3: Cleanup and consistency

1. Remove duplicate inline placeholder handlers from product pages now handled by `js/admin-products.js`.
2. Replace missing placeholder asset references with existing assets or create the missing directories/files.
3. Decide whether root-level duplicate media files are needed for deployment; remove if not.
4. Add frontend regression tests or Playwright smoke tests for forms/buttons/routes.

## 14. Final Status by Requested Category

1. **Fully working:** backend API foundation, static serving, admin auth, product read/admin CRUD, public product/gallery rendering, gallery create, custom order creation, notification admin/display, settings/social/SEO admin, asset upload backend, JSON parsing, syntax lint.
2. **Partially implemented:** order management, course management, contact/support, gallery admin, category data foundation, public course pages.
3. **Missing:** public order tracking endpoint, contact form save, connected course admin UI, connected contact/support admin UI, category CRUD integration, completed-order invoices, ready-made checkout flow, notification image upload, sitemap/robots generation.
4. **Disconnected pages:** primarily category admin, course admin detail pages, contact/support admin pages, completed orders, general orders, gallery edit/list delete pages; `admin-login.html` is intentionally hidden/disconnected from normal nav.
5. **Forms that do not save:** `contact.html`, `add-category.html`, `edit-category.html`, `edit-gallery.html`; product add/edit contain duplicate fake handlers but should be rescued by `js/admin-products.js`.
6. **Admin functions not connected:** category CRUD, course approvals/students/enquiries, contact/support actions, gallery edit/delete, completed invoices, general order edit/delete.
7. **Buttons with no functionality:** most alert-only action buttons on category, course, contact/support, completed orders, and general orders pages.
8. **Unused files:** root duplicate media files are likely unused; missing referenced placeholder assets should be fixed separately.
