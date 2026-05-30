# RD Advance Boutique — Static GitHub Pages Website

RD Advance Boutique is now a **fully static GitHub Pages compatible website**. There is no Express server, no API route dependency, no authentication, no server-side storage, and no browser-to-JSON write operation.

All customer actions are completed through **WhatsApp Business** with prefilled messages.

## What changed

- Public pages load content from static JSON files in `data/`.
- Product ordering opens WhatsApp with product name, category, price, and current product URL.
- Gallery design enquiries open WhatsApp with design name and current design URL.
- Custom stitching and contact forms generate WhatsApp messages instead of submitting to a backend.
- Course enquiry buttons open WhatsApp with the course name.
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
  "title": "Designer Blouse",
  "category": "Blouse",
  "productType": "boutique",
  "price": 2499,
  "discountPrice": 1999,
  "stock": 1,
  "image": "assets/design1.jpg",
  "alt": "Designer blouse by RD Advance Boutique",
  "description": "Premium custom blouse with elegant finishing.",
  "tags": ["blouse", "custom", "women"]
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
  "alt": "Bridal boutique design",
  "layout": "tall",
  "description": "Luxury bridal stitching inspiration."
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
- Design Link

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
