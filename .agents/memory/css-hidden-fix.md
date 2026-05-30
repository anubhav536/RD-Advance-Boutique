---
name: CSS hidden attribute override fix
description: When CSS sets display:flex/grid on an element, it overrides the HTML hidden attribute causing elements to show unexpectedly.
---

When a CSS class sets `display: flex` or `display: grid`, it overrides the browser's default `display: none` that the HTML `hidden` attribute implies.

**The rule:** Any CSS file that styles elements which are toggled via the `hidden` attribute must include this at the very top:

```css
[hidden] { display: none !important; }
```

**Why:** The HTML `hidden` attribute has user-agent stylesheet specificity. Any author stylesheet `display` rule beats it without `!important`.

**How to apply:** Add `[hidden] { display: none !important; }` as the first rule in any CSS file where elements use both flex/grid layout AND are hidden/shown via JS with `.hidden = true/false`.
