---
name: Checkout product type detection priority
description: Category field must be checked before productType/type to correctly detect product schemas.
---

In products.json, a product may have `productType: "boutique"` (a fallback value) but `category: "Sarees"` (the real type). The detection function must prioritize `category` over `productType`/`type`.

**The rule:** Always check `category → productType → type` in that order when detecting schema type.

**Why:** Vendors tend to set accurate `category` but may use generic values like "boutique" for `productType`.

**How to apply:**
```javascript
function detectType(product) {
  function match(s) { /* maps keywords to type */ }
  return match(product.category) || match(product.productType) || match(product.type) || "readymade";
}
```
