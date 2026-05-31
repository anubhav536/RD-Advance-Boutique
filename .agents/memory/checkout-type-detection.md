---
name: Checkout product type detection priority
description: readymade productType/type must be checked FIRST before category to avoid wrong schema for ready-made products.
---

Ready-made products must always use the simple `readymade` schema (size, color, qty only) — no customization fields like Fall/Pico, measurements, etc.

**The rule:** Check if `productType` or `type` equals `"readymade"` FIRST, before any category matching. Only fall through to category-based detection for non-readymade products.

**Why:** A product can have `category: "Sarees"` but `productType: "readymade"` — without the early readymade check, the saree schema (which includes Fall/Pico) is applied incorrectly. Ready-made products are sold as-is like normal e-commerce, no stitching customization needed.

**How to apply:**
```javascript
function detectType(product) {
  const pt = norm(product.productType || "");
  const tp = norm(product.type || "");
  if (pt === "readymade" || tp === "readymade") return "readymade";

  function match(s) { /* maps keywords to type */ }
  return match(product.category) || match(product.productType) || match(product.type) || "readymade";
}
```
