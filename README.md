# RD Advance Boutique — Static GitHub Pages Website

RD Advance Boutique is now a **fully static GitHub Pages compatible website**. There is no Express server, no API route dependency, no authentication, no server-side storage, and no browser-to-JSON write operation.

All customer actions are completed through **WhatsApp Business** with prefilled messages.

## What changed

- Public pages load content from static JSON files in `data/`.
- Product cards show short descriptions, link to static product detail pages, and ordering opens WhatsApp with product name, category, price, and product URL.
- Gallery cards link to static gallery detail pages; design enquiries open WhatsApp with design name and design URL.
- Product and gallery detail pages include native share buttons with copy-link fallback.
- Custom stitching and contact forms generate WhatsApp messages instead of submitting to a backend.
- Course enquiry buttons open WhatsApp with the course name and website URL.
- Former admin URLs are preserved as static content-management guide pages.
- Backend source, Express dependencies, API writes, admin login, sessions, and server storage were removed.

## Static content files

> Documentation comments are not valid inside JSON, so use this guide when editing the files below.

### `data/products.json`

Use this file to add, edit, or delete products. The shop reads this file dynamically.

Recommended product object:

```json
{
  "id": "designer-blouse-001",
  "name": "Designer Blouse",
  "category": "Blouses",
  "image": "assets/design1.jpg",
  "price": 1999,
  "oldPrice": 2499,
  "shortDescription": "Premium custom blouse with elegant finishing.",
  "longDescription": "Full boutique description shown on the product details page.",
  "sizes": ["S", "M", "L", "XL", "Custom"],
  "colors": ["Pink", "Gold", "Maroon"],
  "featured": true,
  "tags": ["blouse", "custom", "women"],
  "whatsappMessage": "Please share availability, fitting, payment, and delivery details."
}
```

- **Add:** append a new object to the array.
- **Edit:** change the fields for the matching `id`.
- **Delete:** remove the object from the array.
- If the file is empty or invalid, the shop shows a friendly fallback message and WhatsApp contact option.

### `data/gallery.json`

Use this file to manage gallery designs.

Recommended gallery object:

```json
{
  "id": "bridal-design-001",
  "title": "Bridal Design",
  "category": "Bridal",
  "image": "assets/design5.jpg",
  "shortDescription": "Luxury bridal stitching inspiration.",
  "longDescription": "Full design description shown on the gallery details page.",
  "tags": ["bridal", "boutique", "custom design"],
  "featured": true,
  "whatsappMessage": "Please share stitching details and price."
}
```

- **Add:** append a new object.
- **Edit:** update title, category, image, or layout.
- **Delete:** remove the object.
- Supported `layout` values include `default`, `tall`, and `wide`.
- If the file is empty or invalid, the gallery displays a fallback error instead of breaking the page.

### `data/categories.json`

Use this file for category labels and filters.

```json
{
  "id": "bridal",
  "name": "Bridal",
  "description": "Bridal boutique fashion and custom stitching.",
  "status": "active",
  "slug": "bridal"
}
```

### `data/settings.json`

Manage site branding, homepage banner, SEO, contact details, and social links.

Important fields:

- `siteName`
- `tagline`
- `description`
- `logo`
- `homepageBanner`
- `socialLinks.whatsapp`
- `contact.phone`
- `contact.whatsappUrl`
- `seo.metaTitle`
- `seo.metaDescription`

### `data/notifications.json`

Manage static notices and popups.

```json
{
  "id": "course-admissions-open",
  "title": "Tailoring course admissions are open",
  "scope": "course",
  "status": "active",
  "message": "Ask about batch timing, course fees, and seat availability.",
  "ctaLabel": "WhatsApp Now",
  "ctaUrl": "https://wa.me/917693849472",
  "showAsPopup": false
}
```

Useful scopes: `homepage`, `product`, `course`, `admin`, and `popup`.

## WhatsApp message flows

### Product order

Every shop product gets a **WhatsApp Order** button. The generated message contains:

- Product Name
- Category
- Price
- Product Link

### Gallery enquiry

Every gallery design gets an **Enquire on WhatsApp** button. The generated message contains:

- Design Name
- Design URL

### Custom stitching

The custom stitching form generates a WhatsApp message with:

- Name
- Mobile
- Measurements
- Design preferences
- Fabric preference

### Course enquiry

Course buttons generate a WhatsApp message with:

- Course Name
- Website URL

### Contact form

The contact form generates a WhatsApp message with customer name, mobile, service/occasion, notes, and page link.

## GitHub Pages deployment guide

1. Commit the website files to the repository.
2. Push the branch to GitHub.
3. Open the repository on GitHub.
4. Go to **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the branch and the repository root folder (`/`).
7. Save.
8. Wait for GitHub Pages to publish the site.
9. Open the Pages URL and verify:
   - `index.html`
   - `shop.html`
   - `gallery.html`
   - `product-details.html?id=designer-blouse`
   - `gallery-details.html?id=design1`
   - `custom.html`
   - `learn.html`
   - `contact.html`

## Local checks

Run JavaScript syntax checks:

```bash
npm run check
```

You can also preview locally with any static file server, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.
