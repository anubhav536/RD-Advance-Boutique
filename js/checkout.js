(function () {
  "use strict";

  /* ─────────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────────── */
  const PRODUCTS_JSON  = "data/products.json";
  const WA_NUMBER      = "917693849472";
  const UPI_ID         = "8643090832@jio";

  /* ─────────────────────────────────────────────
     PRODUCT-TYPE SCHEMAS
     Each schema = array of field descriptors.
     Field descriptor shape:
       { id, type, label, source?, staticOptions?, placeholder?, required?, optional? }

     type values:
       chips-or-text  → chips from product data OR free text
       chips          → chips from staticOptions only
       select         → <select> dropdown
       radio          → inline radio buttons
       quantity       → 1–10 number stepper
       measurements   → 5-box measurement grid
       text           → single-line input
       textarea       → multi-line input
       file           → image file upload
  ───────────────────────────────────────────── */
  const PRODUCT_SCHEMAS = {

    saree: [
      { id: "color",    type: "chips-or-text", label: "Color",               source: "colors",  required: true  },
      { id: "qty",      type: "quantity",       label: "Quantity",                               required: true  },
      { id: "fallPico", type: "radio",          label: "Fall / Pico Required",
        staticOptions: ["Yes – zaroor chahiye", "No – nahi chahiye"],                            required: true  },
    ],

    blouse: [
      { id: "blouseSize",  type: "chips-or-text", label: "Blouse Size",    source: "sizes",      required: true  },
      { id: "sleeveType",  type: "select",         label: "Sleeve Type",
        staticOptions: ["Full Sleeve", "Half Sleeve", "Sleeveless", "Cap Sleeve", "Bell Sleeve", "Puff Sleeve"],
        required: true  },
      { id: "neckDesign",  type: "select",         label: "Neck Design",
        staticOptions: ["Round Neck", "V-Neck", "Square Neck", "Boat Neck", "Sweetheart Neck", "Halter Neck", "Deep Neck", "Custom Design"],
        required: true  },
      { id: "color",       type: "chips-or-text", label: "Color",          source: "colors",     required: false },
      { id: "qty",         type: "quantity",       label: "Quantity",                             required: true  },
    ],

    kurti: [
      { id: "size",            type: "chips-or-text", label: "Size",             source: "sizes",   required: true  },
      { id: "color",           type: "chips-or-text", label: "Color",            source: "colors",  required: false },
      { id: "lengthPref",      type: "radio",          label: "Length Preference",
        staticOptions: ["Short (up to 36\")", "Midi (36\"–42\")", "Long (42\"+)"],               required: true  },
      { id: "qty",             type: "quantity",       label: "Quantity",                          required: true  },
    ],

    kids: [
      { id: "ageGroup", type: "chips", label: "Age Group",
        staticOptions: ["0–2 yrs", "2–4 yrs", "4–6 yrs", "6–8 yrs", "8–10 yrs", "10–12 yrs"],  required: true  },
      { id: "size",     type: "chips-or-text", label: "Size",   source: "sizes",                  required: false },
      { id: "color",    type: "chips-or-text", label: "Color",  source: "colors",                 required: false },
      { id: "qty",      type: "quantity",       label: "Quantity",                                required: true  },
    ],

    accessories: [
      { id: "qty",   type: "quantity",        label: "Quantity",                              required: true  },
      { id: "color", type: "chips-or-text",  label: "Color (if applicable)", source: "colors", optional: true },
    ],

    custom: [
      { id: "measurements", type: "measurements", label: "Body Measurements (inches)", required: false },
      { id: "fabricDetails",type: "textarea",      label: "Fabric / Kapde ki Details",
        placeholder: "Kapde ka rang, type, quality, kahan se lena hai…",                      required: false },
      { id: "designNotes",  type: "textarea",      label: "Design Notes",
        placeholder: "Design kaisa chahiye, koi reference design, embroidery, print…",        required: false },
      { id: "refImage",     type: "file",           label: "Reference Image (optional)",      optional: true  },
      { id: "qty",          type: "quantity",       label: "Quantity",                        required: true  },
    ],

    boutique: [
      { id: "size",  type: "chips-or-text", label: "Size",  source: "sizes",  required: false },
      { id: "color", type: "chips-or-text", label: "Color", source: "colors", required: false },
      { id: "qty",   type: "quantity",       label: "Quantity",                required: true  },
    ],

    readymade: [
      { id: "size",  type: "chips-or-text", label: "Size",  source: "sizes",  required: false },
      { id: "color", type: "chips-or-text", label: "Color", source: "colors", required: false },
      { id: "qty",   type: "quantity",       label: "Quantity",                required: true  },
    ],
  };

  /* ─────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────── */
  let currentProduct   = null;
  let selectedPayment  = "upi";
  let screenshotData   = null;
  let refImageData     = null;
  let pendingOrder     = null;
  let activeSchema     = [];

  /* ─────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────── */
  function getParam(k) {
    return new URLSearchParams(window.location.search).get(k) || "";
  }

  function norm(v) {
    return String(v || "").trim().toLowerCase()
      .replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function fmtPrice(p) {
    if (!p && p !== 0) return "Price on request";
    if (typeof p === "number" && p > 0) return "₹" + p.toLocaleString("en-IN");
    return String(p);
  }

  function makeOrderId() {
    return "RD-" + Date.now().toString(36).toUpperCase() +
           Math.random().toString(36).substr(2, 3).toUpperCase();
  }

  function el(id) { return document.getElementById(id); }

  /* ─────────────────────────────────────────────
     PRODUCT TYPE DETECTION
  ───────────────────────────────────────────── */
  function detectType(product) {
    function match(s) {
      if (!s) return null;
      const v = norm(s);
      if (v.includes("saree") || v.includes("sari"))         return "saree";
      if (v.includes("blouse"))                               return "blouse";
      if (v.includes("kurti") || v.includes("kurta"))        return "kurti";
      if (v.includes("kid")   || v.includes("children"))     return "kids";
      if (v.includes("access"))                               return "accessories";
      if (v.includes("custom") || v.includes("stitch"))      return "custom";
      if (v.includes("boutique"))                             return "boutique";
      return null;
    }
    // category is most reliable — check it first
    return match(product.category)
        || match(product.productType)
        || match(product.type)
        || "readymade";
  }

  /* ─────────────────────────────────────────────
     SCHEMA RESOLUTION
     Merges default schema with product.options.customFields
  ───────────────────────────────────────────── */
  function resolveSchema(product) {
    const type   = detectType(product);
    const base   = (PRODUCT_SCHEMAS[type] || PRODUCT_SCHEMAS.readymade).slice();
    const opts   = product.options || {};

    // If product.options.customFields provided, append them
    if (Array.isArray(opts.customFields)) {
      opts.customFields.forEach(cf => {
        if (!base.find(f => f.id === cf.id)) base.push(cf);
      });
    }

    // If product.options.size === false, remove size fields
    if (opts.size === false)  return base.filter(f => !["size","blouseSize"].includes(f.id));
    if (opts.color === false) return base.filter(f => f.id !== "color");
    if (opts.measurements === false) return base.filter(f => f.id !== "measurements");

    return base;
  }

  /* ─────────────────────────────────────────────
     FIELD RENDERERS
  ───────────────────────────────────────────── */
  function renderChips(items, id) {
    return `<div class="co-chip-group" id="${id}-chips">${
      items.map(v => `<button type="button" class="co-chip-btn" data-value="${v}">${v}</button>`).join("")
    }</div>`;
  }

  function renderField(field, product) {
    const opts   = product.options || {};
    const req    = field.required && !field.optional ? " *" : "";
    const reqAttr= field.required ? "required" : "";

    let inner = "";

    switch (field.type) {

      case "chips-or-text": {
        const sourceKey = field.source || field.id + "s";
        const items     = (opts[sourceKey] || product[sourceKey] || []).filter(Boolean);
        if (items.length) {
          inner = renderChips(items, field.id);
        } else {
          inner = `<input type="text" id="${field.id}" class="co-dyn-input"
                    placeholder="${field.placeholder || field.label + " likhein…"}" ${reqAttr}>`;
        }
        break;
      }

      case "chips": {
        const items = field.staticOptions || [];
        inner = renderChips(items, field.id);
        break;
      }

      case "select": {
        const items   = field.staticOptions || [];
        const options = items.map(o => `<option value="${o}">${o}</option>`).join("");
        inner = `<select id="${field.id}" class="co-dyn-input" ${reqAttr}>
                   <option value="">— Select ${field.label} —</option>
                   ${options}
                 </select>`;
        break;
      }

      case "radio": {
        const items = field.staticOptions || [];
        inner = `<div class="co-radio-group" id="${field.id}-radios">${
          items.map((o, i) =>
            `<label class="co-radio-label">
               <input type="radio" name="${field.id}" value="${o}" ${reqAttr} ${i === 0 ? "" : ""}>
               <span>${o}</span>
             </label>`
          ).join("")
        }</div>`;
        break;
      }

      case "quantity": {
        inner = `<div class="co-qty-stepper">
                   <button type="button" class="co-qty-btn co-qty-minus" aria-label="Decrease">−</button>
                   <input type="number" id="${field.id}" class="co-qty-input" value="1" min="1" max="20" readonly>
                   <button type="button" class="co-qty-btn co-qty-plus"  aria-label="Increase">+</button>
                 </div>`;
        break;
      }

      case "measurements": {
        inner = `<div class="co-meas-grid">
                   ${[["measChest","Chest"],["measWaist","Waist"],["measHips","Hips"],
                      ["measLength","Length"],["measShoulder","Shoulder"]].map(([mid, mlabel]) =>
                     `<div class="co-meas-box">
                        <label for="${mid}">${mlabel}</label>
                        <input type="number" id="${mid}" placeholder='e.g. 36"' min="10" max="100">
                      </div>`
                   ).join("")}
                 </div>`;
        break;
      }

      case "textarea": {
        inner = `<textarea id="${field.id}" class="co-dyn-input" rows="2"
                  placeholder="${field.placeholder || field.label + "…"}" ${reqAttr}></textarea>`;
        break;
      }

      case "file": {
        inner = `<div class="co-upload-box co-upload-box--sm" id="${field.id}-uploadBox">
                   <input type="file" id="${field.id}" accept="image/*" class="co-file-input">
                   <div class="co-upload-ui" id="${field.id}-uploadUi">
                     <span class="co-upload-icon">🖼️</span>
                     <span>Image select karein</span>
                     <small>JPG, PNG, WebP</small>
                   </div>
                   <img id="${field.id}-preview" class="co-upload-preview" src="" alt="Reference" hidden>
                 </div>`;
        break;
      }

      case "text":
      default: {
        inner = `<input type="text" id="${field.id}" class="co-dyn-input"
                  placeholder="${field.placeholder || field.label + " likhein…"}" ${reqAttr}>`;
        break;
      }
    }

    return `<div class="co-field co-dyn-field" data-field-id="${field.id}" data-field-type="${field.type}">
              <label>${field.label}${req}</label>
              ${inner}
            </div>`;
  }

  /* ─────────────────────────────────────────────
     BUILD DYNAMIC FORM
  ───────────────────────────────────────────── */
  function buildDynamicForm(product) {
    const schema    = resolveSchema(product);
    activeSchema    = schema;
    const container = el("productOptionsContainer");
    if (!container) return;

    const typeName  = detectType(product);
    const titleMap  = { saree:"Saree Options", blouse:"Blouse Options", kurti:"Kurti Options",
                        kids:"Kids Wear Options", accessories:"Accessories", custom:"Custom Stitching Details",
                        boutique:"Boutique Options", readymade:"Product Options" };
    const titleEl = el("optionsTitle");
    if (titleEl) titleEl.textContent = titleMap[typeName] || "Product Options";

    container.innerHTML = schema.map(f => renderField(f, product)).join("");

    // Bind chip buttons
    container.querySelectorAll(".co-chip-group").forEach(group => {
      group.querySelectorAll(".co-chip-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          group.querySelectorAll(".co-chip-btn").forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
          btn.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      });
    });

    // Bind quantity steppers
    container.querySelectorAll(".co-qty-stepper").forEach(stepper => {
      const input = stepper.querySelector(".co-qty-input");
      stepper.querySelector(".co-qty-plus").addEventListener("click", () => {
        input.value = Math.min(20, parseInt(input.value) + 1);
      });
      stepper.querySelector(".co-qty-minus").addEventListener("click", () => {
        input.value = Math.max(1, parseInt(input.value) - 1);
      });
    });

    // Bind reference image upload
    schema.filter(f => f.type === "file").forEach(f => {
      const input = el(f.id);
      if (!input) return;
      input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          refImageData = ev.target.result;
          const prev = el(f.id + "-preview");
          const ui   = el(f.id + "-uploadUi");
          if (prev) { prev.src = refImageData; prev.hidden = false; }
          if (ui)   ui.hidden = true;
          el(f.id + "-uploadBox")?.classList.add("co-upload-box--done");
        };
        reader.readAsDataURL(file);
      });
      const box = el(f.id + "-uploadBox");
      box?.addEventListener("click", e => { if (e.target !== input) input.click(); });
    });
  }

  /* ─────────────────────────────────────────────
     COLLECT DYNAMIC FIELD VALUES
  ───────────────────────────────────────────── */
  function collectFieldValue(field) {
    switch (field.type) {
      case "chips-or-text": {
        const chips = document.querySelector(`#${field.id}-chips .co-chip-btn.selected`);
        if (chips) return chips.dataset.value;
        return (el(field.id) || {}).value?.trim() || "";
      }
      case "chips": {
        const sel = document.querySelector(`#${field.id}-chips .co-chip-btn.selected`);
        return sel ? sel.dataset.value : "";
      }
      case "select":
      case "text":
      case "textarea":
        return (el(field.id) || {}).value?.trim() || "";
      case "radio": {
        const checked = document.querySelector(`input[name="${field.id}"]:checked`);
        return checked ? checked.value : "";
      }
      case "quantity":
        return (el(field.id) || {}).value || "1";
      case "measurements": {
        const parts = [
          ["measChest","Chest"],["measWaist","Waist"],["measHips","Hips"],
          ["measLength","Length"],["measShoulder","Shoulder"]
        ].map(([mid, lbl]) => {
          const v = (el(mid) || {}).value;
          return v ? `${lbl}: ${v}"` : "";
        }).filter(Boolean);
        return parts.length ? parts.join(", ") : "";
      }
      case "file":
        return refImageData ? "Uploaded" : "";
      default:
        return "";
    }
  }

  function collectAllOptions() {
    const result = {};
    activeSchema.forEach(field => {
      const val = collectFieldValue(field);
      if (val) result[field.label] = val;
    });
    return result;
  }

  /* ─────────────────────────────────────────────
     VALIDATION
  ───────────────────────────────────────────── */
  function validate() {
    let valid = true;
    const errors = [];

    // Validate dynamic required fields
    activeSchema.filter(f => f.required && !f.optional).forEach(field => {
      const val = collectFieldValue(field);
      if (!val) {
        errors.push(field.label);
        const fieldEl = document.querySelector(`[data-field-id="${field.id}"]`);
        fieldEl?.classList.add("co-field--error");
        valid = false;
      } else {
        document.querySelector(`[data-field-id="${field.id}"]`)?.classList.remove("co-field--error");
      }
    });

    // Validate customer fields
    const custFields = [
      { id: "custName",    label: "Full Name" },
      { id: "custPhone",   label: "Phone Number" },
      { id: "custAddress", label: "Address" },
      { id: "custCity",    label: "City" },
      { id: "custPin",     label: "Pincode" },
    ];
    custFields.forEach(({ id, label }) => {
      const input = el(id);
      if (!input || !input.value.trim()) {
        input?.closest(".co-field")?.classList.add("co-field--error");
        errors.push(label);
        valid = false;
      } else {
        input.closest(".co-field")?.classList.remove("co-field--error");
      }
    });

    if (el("custPhone") && el("custPhone").value.trim().length < 10) {
      el("custPhone")?.closest(".co-field")?.classList.add("co-field--error");
      errors.push("Valid Phone Number");
      valid = false;
    }

    if (!valid) {
      const firstErr = document.querySelector(".co-field--error input, .co-field--error textarea, .co-field--error select");
      firstErr?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return valid;
  }

  /* ─────────────────────────────────────────────
     ORDER OBJECT BUILDER
  ───────────────────────────────────────────── */
  function buildOrder() {
    const product = currentProduct;
    const title   = product.title || product.name || "Boutique Product";
    const options = collectAllOptions();

    return {
      orderId  : makeOrderId(),
      date     : new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      product  : {
        id       : product.id || "",
        name     : title,
        category : product.category || "Boutique",
        price    : fmtPrice(product.price),
        image    : product.image || (product.images && product.images[0]) || "assets/logo.png",
        url      : window.location.origin +
                   window.location.pathname.replace("checkout.html", "product-details.html") +
                   "?id=" + (product.id || ""),
      },
      options,
      customer : {
        name    : (el("custName") || {}).value?.trim() || "",
        phone   : (el("custPhone") || {}).value?.trim() || "",
        address : [
          (el("custAddress") || {}).value?.trim(),
          (el("custCity") || {}).value?.trim(),
          (el("custPin") || {}).value?.trim(),
        ].filter(Boolean).join(", "),
      },
      payment      : selectedPayment === "upi" ? "UPI Payment" : "Cash on Delivery",
      hasScreenshot: !!screenshotData,
      notes        : (el("coNotes") || {}).value?.trim() || "",
    };
  }

  /* ─────────────────────────────────────────────
     ORDER REVIEW SCREEN
  ───────────────────────────────────────────── */
  function showReview(order) {
    el("coForm").hidden   = true;
    el("coReview").hidden = false;
    setStep(4);

    // Product card in review
    el("reviewProductCard").innerHTML = `
      <img src="${order.product.image}" alt="${order.product.name}" class="co-rev-img">
      <div class="co-rev-info">
        <span class="co-product-cat">${order.product.category}</span>
        <strong class="co-rev-name">${order.product.name}</strong>
        <span class="co-product-price">${order.product.price}</span>
      </div>`;

    // Details table
    const rows = [];

    // Options
    Object.entries(order.options).forEach(([label, val]) => {
      rows.push(`<div class="co-sum-row"><span>${label}</span><strong>${val}</strong></div>`);
    });

    rows.push(`<div class="co-sum-divider"></div>`);

    // Customer
    rows.push(`<div class="co-sum-row"><span>Name</span><strong>${order.customer.name}</strong></div>`);
    rows.push(`<div class="co-sum-row"><span>Phone</span><strong>${order.customer.phone}</strong></div>`);
    rows.push(`<div class="co-sum-row"><span>Address</span><strong>${order.customer.address}</strong></div>`);

    rows.push(`<div class="co-sum-divider"></div>`);

    // Payment
    rows.push(`<div class="co-sum-row"><span>Payment</span><strong>${order.payment}</strong></div>`);
    if (order.payment === "UPI Payment") {
      rows.push(`<div class="co-sum-row"><span>Screenshot</span><strong>${order.hasScreenshot ? "Uploaded ✅" : "Not uploaded ⚠️"}</strong></div>`);
    }
    if (order.notes) {
      rows.push(`<div class="co-sum-row"><span>Notes</span><strong>${order.notes}</strong></div>`);
    }

    // Product link
    rows.push(`<div class="co-sum-divider"></div>`);
    rows.push(`<div class="co-sum-row"><span>Product URL</span><strong><a href="${order.product.url}" target="_blank" style="color:var(--gold);word-break:break-all;">View Product</a></strong></div>`);

    el("coReviewDetails").innerHTML = rows.join("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ─────────────────────────────────────────────
     SUCCESS SCREEN
  ───────────────────────────────────────────── */
  function showSuccess(order) {
    el("coReview").hidden  = true;
    el("coSuccess").hidden = false;
    setStep(5);

    el("successOrderId").textContent = order.orderId;

    // Compact summary
    const rows = [
      `<div class="co-sum-row"><span>Order ID</span><strong>${order.orderId}</strong></div>`,
      `<div class="co-sum-row"><span>Product</span><strong>${order.product.name}</strong></div>`,
      `<div class="co-sum-row"><span>Price</span><strong>${order.product.price}</strong></div>`,
    ];
    Object.entries(order.options).forEach(([l, v]) => {
      rows.push(`<div class="co-sum-row"><span>${l}</span><strong>${v}</strong></div>`);
    });
    rows.push(`<div class="co-sum-divider"></div>`);
    rows.push(`<div class="co-sum-row"><span>Customer</span><strong>${order.customer.name}</strong></div>`);
    rows.push(`<div class="co-sum-row"><span>Phone</span><strong>${order.customer.phone}</strong></div>`);
    rows.push(`<div class="co-sum-row"><span>Address</span><strong>${order.customer.address}</strong></div>`);
    rows.push(`<div class="co-sum-divider"></div>`);
    rows.push(`<div class="co-sum-row"><span>Payment</span><strong>${order.payment}</strong></div>`);
    rows.push(`<div class="co-sum-row"><span>Screenshot</span><strong>${order.hasScreenshot ? "Uploaded ✅" : "—"}</strong></div>`);

    el("coSuccessSummary").innerHTML = rows.join("");

    // WhatsApp button
    const waBtn = el("coWhatsappBtn");
    waBtn.onclick = () => {
      const url = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(buildWAMessage(order));
      window.open(url, "_blank", "noopener");
    };

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ─────────────────────────────────────────────
     WHATSAPP MESSAGE
  ───────────────────────────────────────────── */
  function buildWAMessage(order) {
    const optLines = Object.entries(order.options)
      .map(([l, v]) => `${l}: ${v}`).join("\n");

    const screenshot = order.hasScreenshot ? "Uploaded ✅" : "Not uploaded ❌";

    return `🛍️ *NEW ORDER — RD Advance Boutique*

*Order ID:* ${order.orderId}
*Date:* ${order.date}

━━━━━━━━━━━━━━━━━━━
*🧾 PRODUCT DETAILS*
━━━━━━━━━━━━━━━━━━━
Product: ${order.product.name}
Category: ${order.product.category}
Price: ${order.product.price}
Product URL: ${order.product.url}

━━━━━━━━━━━━━━━━━━━
*✅ SELECTED OPTIONS*
━━━━━━━━━━━━━━━━━━━
${optLines || "—"}

━━━━━━━━━━━━━━━━━━━
*👤 CUSTOMER DETAILS*
━━━━━━━━━━━━━━━━━━━
Name: ${order.customer.name}
Mobile: ${order.customer.phone}
Address: ${order.customer.address}

━━━━━━━━━━━━━━━━━━━
*💳 PAYMENT*
━━━━━━━━━━━━━━━━━━━
Method: ${order.payment}
Screenshot: ${screenshot}${order.notes ? "\n\nNotes: " + order.notes : ""}

Please confirm and process this order. 🙏`;
  }

  /* ─────────────────────────────────────────────
     STEP INDICATOR
  ───────────────────────────────────────────── */
  function setStep(active) {
    document.querySelectorAll(".co-step").forEach((s, i) => {
      s.classList.toggle("active", i + 1 <= active);
    });
  }

  /* ─────────────────────────────────────────────
     STORE ORDER
  ───────────────────────────────────────────── */
  function storeOrder(order) {
    try {
      const stored = JSON.parse(localStorage.getItem("rdOrders") || "[]");
      stored.unshift({ ...order, screenshotUploaded: order.hasScreenshot });
      localStorage.setItem("rdOrders", JSON.stringify(stored.slice(0, 100)));
    } catch (_) {}
  }

  /* ─────────────────────────────────────────────
     EVENT HANDLERS
  ───────────────────────────────────────────── */
  function handleFormSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    pendingOrder = buildOrder();
    showReview(pendingOrder);
  }

  function handleConfirm() {
    if (!pendingOrder) return;
    const btn = el("coConfirmBtn");
    btn.disabled    = true;
    btn.textContent = "Confirming…";
    setTimeout(() => {
      storeOrder(pendingOrder);
      showSuccess(pendingOrder);
    }, 500);
  }

  function handleEdit() {
    el("coReview").hidden = false;
    el("coReview").hidden = true;
    el("coForm").hidden   = false;
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ─────────────────────────────────────────────
     PAYMENT TABS
  ───────────────────────────────────────────── */
  function setupPaymentTabs() {
    document.querySelectorAll(".co-pay-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".co-pay-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        selectedPayment = tab.dataset.method;
        el("panelUpi").hidden = selectedPayment !== "upi";
        el("panelCod").hidden = selectedPayment !== "cod";
      });
    });
  }

  /* ─────────────────────────────────────────────
     SCREENSHOT UPLOAD
  ───────────────────────────────────────────── */
  function setupScreenshotUpload() {
    const input = el("payScreenshot");
    const box   = el("uploadBox");
    if (!input) return;

    function loadFile(file) {
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = ev => {
        screenshotData = ev.target.result;
        el("uploadPreview").src    = screenshotData;
        el("uploadPreview").hidden = false;
        el("uploadUi").hidden      = true;
        box.classList.add("co-upload-box--done");
      };
      reader.readAsDataURL(file);
    }

    input.addEventListener("change", () => loadFile(input.files[0]));
    box.addEventListener("click",    e => { if (e.target !== input) input.click(); });
    box.addEventListener("dragover",  e => { e.preventDefault(); box.classList.add("co-upload-box--drag"); });
    box.addEventListener("dragleave", ()=> box.classList.remove("co-upload-box--drag"));
    box.addEventListener("drop",      e => {
      e.preventDefault();
      box.classList.remove("co-upload-box--drag");
      loadFile(e.dataTransfer.files[0]);
    });
  }

  /* ─────────────────────────────────────────────
     COPY BUTTONS
  ───────────────────────────────────────────── */
  function setupCopyBtns() {
    document.querySelectorAll(".co-copy-btn[data-copy]").forEach(btn => {
      btn.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(btn.dataset.copy); }
        catch {
          const ta = document.createElement("textarea");
          ta.value = btn.dataset.copy;
          Object.assign(ta.style, { position:"fixed", left:"-9999px" });
          document.body.appendChild(ta); ta.select();
          document.execCommand("copy"); ta.remove();
        }
        const orig = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = orig; }, 1800);
      });
    });
  }

  /* ─────────────────────────────────────────────
     LOAD PRODUCT
  ───────────────────────────────────────────── */
  async function loadProduct() {
    const id = getParam("id");
    try {
      const res      = await fetch(PRODUCTS_JSON, { cache: "no-store" });
      const products = await res.json();
      const found    = (Array.isArray(products) ? products : []).find(p =>
        norm(p.id || p.slug || p.title || p.name) === norm(id)
      ) || products[0];

      if (!found) {
        el("productOptionsContainer").innerHTML = "<p>Product not found. <a href='shop.html'>Shop par wapas jaayein.</a></p>";
        return;
      }

      currentProduct = found;
      const img = found.image || (found.images && found.images[0]) || "assets/logo.png";

      el("coProductImg").src       = img;
      el("coProductImg").alt       = found.title || found.name;
      el("coProductCat").textContent  = found.category || "Boutique";
      el("coProductName").textContent = found.title || found.name;
      el("coProductPrice").textContent= fmtPrice(found.price);
      document.title = "Checkout — " + (found.title || found.name) + " | RD Advance Boutique";

      buildDynamicForm(found);

    } catch (err) {
      console.error("Product load error:", err);
      el("productOptionsContainer").innerHTML = "<p>Product load nahi hua. Reload karein.</p>";
    }
  }

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  function init() {
    if (!document.querySelector(".checkout-page")) return;

    loadProduct();
    setupPaymentTabs();
    setupScreenshotUpload();
    setupCopyBtns();

    el("coForm")?.addEventListener("submit", handleFormSubmit);
    el("coConfirmBtn")?.addEventListener("click", handleConfirm);
    el("coEditBtn")?.addEventListener("click", handleEdit);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
