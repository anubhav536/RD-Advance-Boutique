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
  utils/                  # Shared utilities
```

### Getting started

1. Copy `.env.example` to `.env` and adjust values for your environment.
2. Install dependencies with `npm install`.
3. Start development mode with `npm run dev` or production mode with `npm start`.

### Available endpoint

- `GET /api/v1/health` returns the current API health status.

Payment gateway integrations and external API calls are intentionally not included in this foundation.
