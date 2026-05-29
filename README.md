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

### Available endpoints

- `GET /api/v1/health` returns the current API health status.
- `GET /api/v1/data` lists every supported local JSON collection.
- `GET /api/v1/data/:collection` reads a JSON collection.
- `PUT /api/v1/data/:collection` replaces an entire JSON collection.
- `POST /api/v1/data/:collection` creates an item in an array collection or merges settings into `settings.json`.
- `PATCH /api/v1/data/:collection/:id` updates an array item by `id` or merges updates into `settings.json`.
- `DELETE /api/v1/data/:collection/:id` deletes an array item by `id` or a key from `settings.json`.
- `GET|PUT|POST|PATCH|DELETE /api/v1/admin/data...` mirrors the same JSON database endpoints for admin panel usage.

Supported collections are `products`, `orders`, `gallery`, `categories`, `students`, `notifications`, and `settings`. These endpoints let the admin panel manage site content with local JSON files instead of MongoDB.

Payment gateway integrations and external API calls are intentionally not included in this foundation.
