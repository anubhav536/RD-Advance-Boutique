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


### Product management endpoints

Products are stored in `data/products.json` and exposed through dedicated backend routes:

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

Orders are stored in `data/orders.json` and exposed through dedicated backend routes with no payment integration yet:

- `GET /api/v1/orders` lists orders with optional `search`, `status`, `type`/`orderType`, `customerPhone`, `customerEmail`, `productId`, `createdFrom`, and `createdTo` filters.
- `POST /api/v1/orders` creates an order for either a ready-made product order or a custom stitching order. Customer name and phone are required.
- `GET /api/v1/orders/:id` returns one order.
- `PUT|PATCH /api/v1/orders/:id` edits order details, customer details, items, measurements, stitching details, due date, notes, and totals.
- `PATCH /api/v1/orders/:id/status` updates an order status with `pending`, `completed`, or `cancelled`.
- `PATCH /api/v1/orders/:id/complete` marks an order completed.
- `PATCH /api/v1/orders/:id/cancel` marks an order cancelled.
- `DELETE /api/v1/orders/:id` deletes an order.
- `GET /api/v1/orders/summary` returns status and order-type counts.
- `GET /api/v1/orders/pending` returns pending orders.
- `GET /api/v1/orders/completed` returns completed orders.
- `GET /api/v1/orders/cancelled` returns cancelled orders.
- `GET /api/v1/orders/custom-stitching` returns custom stitching orders.
- `GET /api/v1/orders/ready-made` returns ready-made product orders.

Valid order statuses are `pending`, `completed`, and `cancelled`. Valid order types are `custom-stitching` and `ready-made`.

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

Gallery images are stored in `data/gallery.json` and exposed through dedicated backend routes:

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
- `PUT /api/v1/data/:collection` replaces an entire JSON collection.
- `POST /api/v1/data/:collection` creates an item in an array collection or merges settings into `settings.json`.
- `PATCH /api/v1/data/:collection/:id` updates an array item by `id` or merges updates into `settings.json`.
- `DELETE /api/v1/data/:collection/:id` deletes an array item by `id` or a key from `settings.json`.
- `GET|PUT|POST|PATCH|DELETE /api/v1/admin/data...` mirrors the same JSON database endpoints for admin panel usage.

Supported collections are `products`, `orders`, `gallery`, `categories`, `students`, `notifications`, `contact`, and `settings`. These endpoints let the admin panel manage site content with local JSON files instead of MongoDB.

Payment gateway integrations and external API calls are intentionally not included in this foundation.
