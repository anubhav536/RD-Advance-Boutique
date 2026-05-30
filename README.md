# RD-Advance-Boutique

## Backend foundation

This repository includes a Node.js and Express backend scaffold using an MVC-oriented structure that is ready for future feature growth.

### Structure

```text
src/
  app.js                  # Express application setup
  server.js               # HTTP server and process lifecycle handling
  config/                 # Environment and application configuration
  controllers/            # Request handlers
  middleware/             # Error, security, and request middleware
  models/                 # Domain/data models
  routes/                 # Versioned API route definitions
  utils/                  # Shared utilities, including local JSON database helpers
data/
  products.json           # Product catalogue records
  orders.json             # Customer order records
  gallery.json            # Gallery image records
  categories.json         # Product/category records
  students.json           # Course student/admission records
  notifications.json      # Admin notification records
  contact.json            # Contact submissions and support tickets
  settings.json           # Website and business settings
```

### Getting started

1. Copy `.env.example` to `.env` and adjust values for your environment.
2. Install dependencies with `npm install`.
3. Start development mode with `npm run dev` or production mode with `npm start`.


### Admin authentication

Admin authentication uses only local credentials from `data/users.json` plus session settings from `config/admin-auth.json`; no Firebase, external identity provider, or third-party identity API is used. Signup and password changes store hashed passwords, login verifies the stored hash with `bcrypt.compare()`, and successful logins receive an HTTP-only same-site admin session cookie.

Default local development admin email is `rdadvanceboutique@gmail.com`. The admin password is stored only as a hash; do not publish the plaintext password in documentation. Legacy PBKDF2 hashes are still recognized so old admins can login once and be upgraded to the new hash format automatically.

Use the secret admin shortcut URL configured by `ADMIN_SHORTCUT_PATH` (default: `/rd-secret-admin`) to open admin access without adding an admin link to the public site navigation. The server shortcut and public-site logo long-press now send unauthenticated visitors to `admin-signup.html`; already-authenticated admins are sent to `admin-dashboard.html`.

Change both the password hash, `sessionSecret`, and `ADMIN_SHORTCUT_PATH` before deploying. You can generate replacement values locally with Node.js `crypto.pbkdf2Sync` and `crypto.randomBytes`.

Admin password reset is available from the `Forgot password?` link on `admin-login.html`. Email reset links have been removed; the page now loads the admin user's security question and allows a new password only after the security answer is verified. Existing legacy users without a saved security answer can use the registered admin email as the initial answer, then update credentials from the admin settings page.

Admin auth endpoints:

- `POST /api/v1/admin/auth/login` creates an admin session from the configured local credentials.
- `POST /api/v1/admin/auth/password-reset/question` returns the stored security question for a valid admin email.
- `POST /api/v1/admin/auth/password-reset/complete` changes the admin password after the security answer is verified.
- `GET /api/v1/admin/auth/session` verifies the current admin session.
- `POST /api/v1/admin/auth/logout` destroys the current admin session.

Protected admin HTML pages redirect unauthenticated users to `admin-login.html`. Admin-only JSON database writes are available under `/api/v1/admin/data...`; public `/api/v1/data...` is read-only.

### Product management endpoints

Products are stored in `data/products.json` and exposed through dedicated backend routes. Product reads are public; create, update, stock update, and delete operations require an admin session:

- `GET /api/v1/products` lists products with optional `search`, `category`, `type`, `status`, `featured`, and `inStock` filters.
- `POST /api/v1/products` adds a product with title, category, price, type, stock quantity, images, details, features, tags, featured status, and affiliate/product links.
- `GET /api/v1/products/:id` returns complete product details.
- `PUT|PATCH /api/v1/products/:id` edits product information.
- `PATCH /api/v1/products/:id/stock` updates only `stockQuantity`/`stock`.
- `DELETE /api/v1/products/:id` deletes a product.
- `GET /api/v1/products/categories` returns product categories with product counts.
- `GET /api/v1/products/featured` returns featured products.
- `GET /api/v1/products/ready-made` returns ready-made products.
- `GET /api/v1/products/boutique` returns boutique products.
- `GET /api/v1/products/affiliate` returns affiliate products.

Valid product types are `ready-made`, `boutique`, and `affiliate`. Valid product statuses are `active`, `draft`, `inactive`, and `out-of-stock`.


### Order management endpoints

Orders are stored in `data/orders.json` and exposed through dedicated backend routes. Public customers can create orders and submit manual payment details; admin order lists, detail reads, status changes, payment approvals/rejections, edits, and deletes require an admin session:

- `GET /api/v1/orders` lists orders with optional `search`, `status`, `type`/`orderType`, `customerPhone`, `customerEmail`, `productId`, `createdFrom`, and `createdTo` filters.
- `POST /api/v1/orders` creates an order for either a ready-made product order or a custom stitching order. Customer name and phone are required.
- `GET /api/v1/orders/:id` returns one order.
- `GET /api/v1/orders/payment-methods` returns the currently enabled payment methods and required submission fields.
- `PATCH /api/v1/orders/:id/payment` submits manual UPI payment details for admin verification.
- `PATCH /api/v1/orders/:id/payment/approve` approves a submitted manual payment and moves the order to `in-progress`.
- `PATCH /api/v1/orders/:id/payment/reject` rejects submitted manual payment details with an optional reason.
- `PUT|PATCH /api/v1/orders/:id` edits order details, customer details, items, measurements, stitching details, due date, notes, and totals.
- `PATCH /api/v1/orders/:id/status` updates an order status with `pending`, `in-progress`, `completed`, or `cancelled`.
- `PATCH /api/v1/orders/:id/complete` marks an order completed.
- `PATCH /api/v1/orders/:id/cancel` marks an order cancelled.
- `DELETE /api/v1/orders/:id` deletes an order.
- `GET /api/v1/orders/summary` returns status and order-type counts.
- `GET /api/v1/orders/pending` returns pending orders.
- `GET /api/v1/orders/completed` returns completed orders.
- `GET /api/v1/orders/cancelled` returns cancelled orders.
- `GET /api/v1/orders/custom-stitching` returns custom stitching orders.
- `GET /api/v1/orders/ready-made` returns ready-made product orders.

Valid order statuses are `pending`, `in-progress`, `completed`, and `cancelled`. Valid order types are `custom-stitching` and `ready-made`. Valid payment statuses are `not-submitted`, `pending-verification`, `approved`, and `rejected`.

### Payment architecture

Payment handling is intentionally modular but does not integrate any external gateway yet. `src/services/payment/PaymentService.js` resolves the payment method for an order, delegates method-specific behavior to a gateway adapter, and persists the resulting payment state through `OrderModel`. The only registered adapter is `manual-upi`, which captures a customer-provided UPI transaction ID and screenshot for admin verification.

Future payment gateways can be added by creating a gateway adapter with `getMetadata`, `submit`, `approve`, and `reject` behaviors under `src/services/payment/gateways/`, then registering the adapter in `src/services/payment/gateways/index.js`. No Razorpay SDK, credentials, checkout flow, or webhook handling is included at this stage.

### Contact management endpoints

Contact submissions and customer support tickets are stored together in `data/contact.json`:

- `GET /api/v1/contact` returns contact submissions and support tickets, with optional shared `search`, `phone`, `email`, `createdFrom`, and `createdTo` filters.
- `POST /api/v1/contact` creates a contact form submission. Customer name, phone, and message are required.
- `GET /api/v1/contact/dashboard` returns contact submission and support ticket status counts.
- `GET /api/v1/contact/constants` returns allowed submission statuses, ticket statuses, ticket priorities, and support types.
- `GET /api/v1/contact/submissions` lists contact form submissions with optional `search`, `status`, `phone`, `email`, `createdFrom`, and `createdTo` filters.
- `POST /api/v1/contact/submissions` creates a contact form submission with customer details, service/occasion, subject, message, source, metadata, and optional replies.
- `GET /api/v1/contact/submissions/:id` returns one contact form submission.
- `PUT|PATCH /api/v1/contact/submissions/:id` edits a contact form submission.
- `PATCH /api/v1/contact/submissions/:id/status` updates the submission inquiry status.
- `POST /api/v1/contact/submissions/:id/replies` adds an admin reply and marks the inquiry as replied by default.
- `DELETE /api/v1/contact/submissions/:id` deletes a contact form submission.
- `GET /api/v1/contact/tickets` lists customer support tickets with optional `search`, `status`, `priority`, `supportType`, `phone`, `email`, `createdFrom`, and `createdTo` filters.
- `POST /api/v1/contact/tickets` creates a support ticket with customer details, support type, priority, subject, message, optional order reference, source, metadata, and optional replies.
- `GET /api/v1/contact/tickets/:id` returns one support ticket by internal id or ticket number.
- `PUT|PATCH /api/v1/contact/tickets/:id` edits a support ticket.
- `PATCH /api/v1/contact/tickets/:id/status` updates ticket inquiry status.
- `POST /api/v1/contact/tickets/:id/replies` adds an admin reply and moves public replies to `waiting-customer` by default.
- `DELETE /api/v1/contact/tickets/:id` deletes a support ticket.

Valid contact submission statuses are `new`, `read`, `replied`, and `closed`. Valid support ticket statuses are `open`, `in-progress`, `waiting-customer`, `resolved`, and `closed`.

### Gallery management endpoints

Gallery images are stored in `data/gallery.json` and exposed through dedicated backend routes. Gallery reads are public; create, update, and delete operations require an admin session:

- `GET /api/v1/gallery` lists gallery images with optional `search`, `category`, `layout`, and `featured` filters.
- `POST /api/v1/gallery` adds a gallery image with title, category, image URL/path, alt text, layout, featured status, tags, description, and sort order.
- `GET /api/v1/gallery/:id` returns one gallery image.
- `PUT|PATCH /api/v1/gallery/:id` edits gallery image information.
- `DELETE /api/v1/gallery/:id` deletes a gallery image.
- `GET /api/v1/gallery/categories` returns gallery categories with image and featured counts.
- `GET /api/v1/gallery/featured` returns featured gallery images.

Valid gallery layouts are `default`, `wide`, and `tall`. Gallery categories are derived from `data/gallery.json`, so no separate gallery category file is required.

### Available endpoints

- `GET /api/v1/health` returns the current API health status.
- `GET /api/v1/data` lists every supported local JSON collection.
- `GET /api/v1/data/:collection` reads a JSON collection.
- `GET|PUT|POST|PATCH|DELETE /api/v1/admin/data...` provides authenticated JSON database management for the admin panel.

Supported collections are `products`, `orders`, `gallery`, `categories`, `students`, `notifications`, `contact`, and `settings`. These endpoints let the admin panel manage site content with local JSON files instead of MongoDB.

External payment gateway SDKs, credentials, webhooks, and checkout API calls are intentionally not included in this foundation.
