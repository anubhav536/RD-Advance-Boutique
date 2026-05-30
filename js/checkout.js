(function () {
  "use strict";

  /* ─────────────────────────────────────────────
     PRODUCT SCHEMAS  (schema per product type)
  ───────────────────────────────────────────── */
  const PRODUCT_SCHEMAS = {
    saree: [
      { id: "color",    type: "chips-or-text", label: "Color",               source: "colors",  required: true  },
      { id: "qty",      type: "quantity",       label: "Quantity",                               required: true  },
      { id: "fallPico", type: "radio",          label: "Fall / Pico Required",
        staticOptions: ["Yes – zaroor chahiye", "No – nahi chahiye"],                            required: true  },
    ],
    blouse: [
      { id: "blouseSize",  type: "chips-or-text", label: "Blouse Size",    source: "sizes",     required: true  },
      { id: "sleeveType",  type: "select",        label: "Sleeve Type",
        staticOptions: ["Full Sleeve","Half Sleeve","Sleeveless","Cap Sleeve","Bell Sleeve","Puff Sleeve"],
        required: true },
      { id: "neckDesign",  type: "select",        label: "Neck Design",
        staticOptions: ["Round Neck","V-Neck","Square Neck","Boat Neck","Sweetheart Neck","Halter Neck","Deep Neck","Custom Design"],
        required: true },
      { id: "color",       type: "chips-or-text", label: "Color",          source: "colors",    required: false },
      { id: "qty",         type: "quantity",      label: "Quantity",                             required: true  },
    ],
    kurti: [
      { id: "size",       type: "chips-or-text", label: "Size",             source: "sizes",    required: true  },
      { id: "color",      type: "chips-or-text", label: "Color",            source: "colors",   required: false },
      { id: "lengthPref", type: "radio",         label: "Length Preference",
        staticOptions: ["Short (up to 36\")", "Midi (36\"–42\")", "Long (42\"+)"],               required: true  },
      { id: "qty",        type: "quantity",      label: "Quantity",                              required: true  },
    ],
    kids: [
      { id: "ageGroup", type: "chips", label: "Age Group",
        staticOptions: ["0–2 yrs","2–4 yrs","4–6 yrs","6–8 yrs","8–10 yrs","10–12 yrs"],       required: true  },
      { id: "size",     type: "chips-or-text", label: "Size",  source: "sizes",                  required: false },
      { id: "color",    type: "chips-or-text", label: "Color", source: "colors",                 required: false },
      { id: "qty",      type: "quantity",      label: "Quantity",                                required: true  },
    ],
    accessories: [
      { id: "qty",   type: "quantity",       label: "Quantity",                              required: true  },
      { id: "color", type: "chips-or-text", label: "Color (if applicable)", source: "colors", optional: true },
    ],
    custom: [
      { id: "measurements", type: "measurements", label: "Body Measurements (inches)",      required: false },
      { id: "fabricDetails",type: "textarea",     label: "Fabric / Kapde ki Details",
        placeholder: "Kapde ka rang, type, quality…",                                        required: false },
      { id: "designNotes",  type: "textarea",     label: "Design Notes",
        placeholder: "Design kaisa chahiye, embroidery, print…",                             required: false },
      { id: "refImage",     type: "file",         label: "Reference Image (optional)",       optional: true  },
      { id: "qty",          type: "quantity",     label: "Quantity",                         required: true  },
    ],
    boutique: [
      { id: "size",  type: "chips-or-text", label: "Size",  source: "sizes",  required: false },
      { id: "color", type: "chips-or-text", label: "Color", source: "colors", required: false },
      { id: "qty",   type: "quantity",      label: "Quantity",                 required: true  },
    ],
    readymade: [
      { id: "size",  type: "chips-or-text", label: "Size",  source: "sizes",  required: false },
      { id: "color", type: "chips-or-text", label: "Color", source: "colors", required: false },
      { id: "qty",   type: "quantity",      label: "Quantity",                 required: true  },
    ],
  };

  /* ─────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────── */
  let appConfig       = {};
  let currentProduct  = null;
  let selectedPayment = "upi";
  let screenshotData  = null;
  let refImageData    = null;
  let pendingOrder    = null;
  let activeSchema    = [];

  /* ─────────────────────────────────────────────
     UTILS
  ───────────────────────────────────────────── */
  const el     = id => document.getElementById(id);
  const getParam = k => new URLSearchParams(window.location.search).get(k) || "";

  function norm(v) {
    return String(v || "").trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function fmtPrice(p) {
    if (!p && p !== 0) return "Price on request";
    if (typeof p === "number" && p > 0) return "₹" + p.toLocaleString("en-IN");
    return String(p);
  }

  function makeOrderId() {
    return "RD" + Date.now().toString(36).toUpperCase() +
           Math.random().toString(36).substr(2, 3).toUpperCase();
  }

  /* ─────────────────────────────────────────────
     PRODUCT TYPE DETECTION
  ───────────────────────────────────────────── */
  function detectType(product) {
    function match(s) {
      if (!s) return null;
      const v = norm(s);
      if (v.includes("saree") || v.includes("sari"))     return "saree";
      if (v.includes("blouse"))                           return "blouse";
      if (v.includes("kurti") || v.includes("kurta"))    return "kurti";
      if (v.includes("kid")   || v.includes("children")) return "kids";
      if (v.includes("access"))                           return "accessories";
      if (v.includes("custom") || v.includes("stitch"))  return "custom";
      if (v.includes("boutique"))                         return "boutique";
      return null;
    }
    return match(product.category)
        || match(product.productType)
        || match(product.type)
        || "readymade";
  }

  /* ─────────────────────────────────────────────
     SCHEMA RESOLUTION
  ───────────────────────────────────────────── */
  function resolveSchema(product) {
    const type = detectType(product);
    const base = (PRODUCT_SCHEMAS[type] || PRODUCT_SCHEMAS.readymade).slice();
    const opts = product.options || {};

    if (Array.isArray(opts.customFields)) {
      opts.customFields.forEach(cf => {
        if (!base.find(f => f.id === cf.id)) base.push(cf);
      });
    }
    if (opts.size         === false) return base.filter(f => !["size","blouseSize"].includes(f.id));
    if (opts.color        === false) return base.filter(f => f.id !== "color");
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
    const opts  = product.options || {};
    const req   = (field.required && !field.optional) ? " *" : "";
    const reqA  = field.required ? "required" : "";
    let inner   = "";

    switch (field.type) {
      case "chips-or-text": {
        const src   = field.source || field.id + "s";
        const items = (opts[src] || product[src] || []).filter(Boolean);
        inner = items.length
          ? renderChips(items, field.id)
          : `<input type="text" id="${field.id}" class="co-dyn-input"
              placeholder="${field.placeholder || field.label + " likhein…"}" ${reqA}>`;
        break;
      }
      case "chips":
        inner = renderChips(field.staticOptions || [], field.id);
        break;

      case "select": {
        const opts2 = (field.staticOptions || [])
          .map(o => `<option value="${o}">${o}</option>`).join("");
        inner = `<select id="${field.id}" class="co-dyn-input" ${reqA}>
                   <option value="">— ${field.label} Select Karein —</option>${opts2}
                 </select>`;
        break;
      }
      case "radio":
        inner = `<div class="co-radio-group" id="${field.id}-radios">${
          (field.staticOptions || []).map(o =>
            `<label class="co-radio-label">
               <input type="radio" name="${field.id}" value="${o}" ${reqA}>
               <span>${o}</span>
             </label>`).join("")
        }</div>`;
        break;

      case "quantity":
        inner = `<div class="co-qty-stepper">
                   <button type="button" class="co-qty-btn co-qty-minus" aria-label="Decrease">−</button>
                   <input type="number" id="${field.id}" class="co-qty-input" value="1" min="1" max="20" readonly>
                   <button type="button" class="co-qty-btn co-qty-plus"  aria-label="Increase">+</button>
                 </div>`;
        break;

      case "measurements":
        inner = `<div class="co-meas-grid">${
          [["measChest","Chest"],["measWaist","Waist"],["measHips","Hips"],
           ["measLength","Length"],["measShoulder","Shoulder"]].map(([mid, mlbl]) =>
            `<div class="co-meas-box">
               <label for="${mid}">${mlbl}</label>
               <input type="number" id="${mid}" placeholder='36"' min="10" max="100">
             </div>`).join("")
        }</div>`;
        break;

      case "textarea":
        inner = `<textarea id="${field.id}" class="co-dyn-input" rows="2"
                  placeholder="${field.placeholder || field.label + "…"}" ${reqA}></textarea>`;
        break;

      case "file":
        inner = `<div class="co-upload-box co-upload-box--sm" id="${field.id}-uploadBox">
                   <input type="file" id="${field.id}" accept="image/*" class="co-file-input">
                   <div class="co-upload-ui" id="${field.id}-uploadUi">
                     <span class="co-upload-icon">🖼️</span>
                     <span>Image select karein</span><small>JPG, PNG, WebP</small>
                   </div>
                   <img id="${field.id}-preview" class="co-upload-preview" src="" alt="" hidden>
                 </div>`;
        break;

      default:
        inner = `<input type="text" id="${field.id}" class="co-dyn-input"
                  placeholder="${field.placeholder || field.label + "…"}" ${reqA}>`;
    }

    return `<div class="co-field co-dyn-field" data-field-id="${field.id}" data-field-type="${field.type}">
              <label>${field.label}${req}</label>${inner}
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

    const titleMap = {
      saree:"Saree Options", blouse:"Blouse Options", kurti:"Kurti Options",
      kids:"Kids Wear Options", accessories:"Accessories", custom:"Custom Stitching Details",
      boutique:"Boutique Options", readymade:"Product Options",
    };
    const titleEl = el("optionsTitle");
    if (titleEl) titleEl.textContent = titleMap[detectType(product)] || "Product Options";

    container.innerHTML = schema.map(f => renderField(f, product)).join("");

    // Chips
    container.querySelectorAll(".co-chip-group").forEach(group => {
      group.querySelectorAll(".co-chip-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          group.querySelectorAll(".co-chip-btn").forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
        });
      });
    });

    // Qty steppers
    container.querySelectorAll(".co-qty-stepper").forEach(stepper => {
      const input = stepper.querySelector(".co-qty-input");
      stepper.querySelector(".co-qty-plus").addEventListener("click",  () => { input.value = Math.min(20, +input.value + 1); });
      stepper.querySelector(".co-qty-minus").addEventListener("click", () => { input.value = Math.max(1,  +input.value - 1); });
    });

    // File fields (reference image)
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
      el(f.id + "-uploadBox")?.addEventListener("click", e => { if (e.target !== input) input.click(); });
    });
  }

  /* ─────────────────────────────────────────────
     COLLECT FIELD VALUES
  ───────────────────────────────────────────── */
  function collectFieldValue(field) {
    switch (field.type) {
      case "chips-or-text": {
        const chip = document.querySelector(`#${field.id}-chips .co-chip-btn.selected`);
        return chip ? chip.dataset.value : ((el(field.id) || {}).value?.trim() || "");
      }
      case "chips": {
        const chip = document.querySelector(`#${field.id}-chips .co-chip-btn.selected`);
        return chip ? chip.dataset.value : "";
      }
      case "radio": {
        const chk = document.querySelector(`input[name="${field.id}"]:checked`);
        return chk ? chk.value : "";
      }
      case "quantity":
        return (el(field.id) || {}).value || "1";
      case "measurements": {
        const parts = [
          ["measChest","Chest"],["measWaist","Waist"],["measHips","Hips"],
          ["measLength","Length"],["measShoulder","Shoulder"],
        ].map(([mid, lbl]) => { const v = (el(mid) || {}).value; return v ? `${lbl}: ${v}"` : ""; }).filter(Boolean);
        return parts.join(", ");
      }
      case "file":
        return refImageData ? "Uploaded" : "";
      default:
        return (el(field.id) || {}).value?.trim() || "";
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

    // Dynamic required fields
    activeSchema.filter(f => f.required && !f.optional).forEach(field => {
      const val = collectFieldValue(field);
      const wrap = document.querySelector(`[data-field-id="${field.id}"]`);
      if (!val) { wrap?.classList.add("co-field--error");    valid = false; }
      else        wrap?.classList.remove("co-field--error");
    });

    // Customer fields
    [
      { id: "custName",    min: 2  },
      { id: "custPhone",   min: 10 },
      { id: "custAddress", min: 5  },
      { id: "custCity",    min: 2  },
      { id: "custState",   min: 2  },
      { id: "custPin",     min: 6  },
    ].forEach(({ id, min }) => {
      const inp = el(id);
      if (!inp) return;
      const ok = inp.value.trim().length >= min;
      inp.closest(".co-field")?.classList.toggle("co-field--error", !ok);
      if (!ok) valid = false;
    });

    // UPI-specific
    if (selectedPayment === "upi") {
      const utr = el("utrNumber");
      const amt = el("amountPaid");
      if (utr && utr.value.trim().length < 6) { utr.closest(".co-field")?.classList.add("co-field--error"); valid = false; }
      if (amt && !amt.value)                   { amt.closest(".co-field")?.classList.add("co-field--error"); valid = false; }
    }

    if (!valid) {
      const first = document.querySelector(".co-field--error input, .co-field--error textarea, .co-field--error select");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return valid;
  }

  /* ─────────────────────────────────────────────
     BUILD ORDER OBJECT
  ───────────────────────────────────────────── */
  function buildOrder() {
    const product = currentProduct;
    const options = collectAllOptions();
    const productUrl = window.location.origin +
      window.location.pathname.replace("checkout.html", "product-details.html") +
      "?id=" + (product.id || "");

    return {
      orderId        : makeOrderId(),
      createdAt      : new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      productId      : product.id || "",
      productName    : product.title || product.name || "Boutique Product",
      productUrl,
      productImage   : product.image || (product.images && product.images[0]) || "assets/logo.png",
      productCategory: product.category || "Boutique",
      productPrice   : fmtPrice(product.price),
      quantity       : collectFieldValue({ id: "qty", type: "quantity" }) || 1,
      selectedOptions: options,
      customerName   : el("custName")?.value.trim()    || "",
      phone          : el("custPhone")?.value.trim()   || "",
      address        : el("custAddress")?.value.trim() || "",
      city           : el("custCity")?.value.trim()    || "",
      state          : el("custState")?.value.trim()   || "",
      pincode        : el("custPin")?.value.trim()     || "",
      paymentMethod  : selectedPayment === "upi" ? "UPI" : "Cash on Delivery",
      utrNumber      : el("utrNumber")?.value.trim()   || "",
      amountPaid     : el("amountPaid")?.value          || "",
      screenshotBase64: screenshotData || "",
      notes          : el("coNotes")?.value.trim()     || "",
    };
  }

  /* ─────────────────────────────────────────────
     REVIEW SCREEN
  ───────────────────────────────────────────── */
  function showReview(order) {
    el("coForm").hidden   = true;
    el("coReview").hidden = false;
    setStep(4);

    el("reviewProductCard").innerHTML = `
      <img src="${order.productImage}" alt="${order.productName}" class="co-rev-img">
      <div class="co-rev-info">
        <span class="co-product-cat">${order.productCategory}</span>
        <strong class="co-rev-name">${order.productName}</strong>
        <span class="co-product-price">${order.productPrice}</span>
      </div>`;

    const rows = [];
    Object.entries(order.selectedOptions).forEach(([l, v]) =>
      rows.push(`<div class="co-sum-row"><span>${l}</span><strong>${v}</strong></div>`)
    );
    rows.push(`<div class="co-sum-divider"></div>`);
    rows.push(`<div class="co-sum-row"><span>Name</span><strong>${order.customerName}</strong></div>`);
    rows.push(`<div class="co-sum-row"><span>Phone</span><strong>${order.phone}</strong></div>`);
    rows.push(`<div class="co-sum-row"><span>Address</span><strong>${[order.address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}</strong></div>`);
    rows.push(`<div class="co-sum-divider"></div>`);
    rows.push(`<div class="co-sum-row"><span>Payment</span><strong>${order.paymentMethod}</strong></div>`);
    if (order.paymentMethod === "UPI") {
      rows.push(`<div class="co-sum-row"><span>UTR</span><strong>${order.utrNumber || "—"}</strong></div>`);
      rows.push(`<div class="co-sum-row"><span>Amount</span><strong>₹${order.amountPaid || "—"}</strong></div>`);
      rows.push(`<div class="co-sum-row"><span>Screenshot</span><strong>${screenshotData ? "Uploaded ✅" : "Not uploaded ⚠️"}</strong></div>`);
    }
    if (order.notes) rows.push(`<div class="co-sum-row"><span>Notes</span><strong>${order.notes}</strong></div>`);

    el("coReviewDetails").innerHTML = rows.join("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ─────────────────────────────────────────────
     SUBMIT TO APPS SCRIPT
  ───────────────────────────────────────────── */
  async function submitOrder(order) {
    const scriptUrl = appConfig.appsScriptUrl || "";
    if (!scriptUrl || scriptUrl.includes("PASTE_YOUR")) {
      // Offline mode — save to localStorage only
      storeLocally(order);
      return { ok: true, offline: true, status: order.paymentMethod === "UPI" ? "Pending Verification" : "Confirmed – COD" };
    }

    const payload = { action: "submitOrder", ...order };
    const res = await fetch(scriptUrl, {
      method       : "POST",
      body         : JSON.stringify(payload),
      headers      : { "Content-Type": "application/json" },
      redirect     : "follow",
    });
    if (!res.ok) throw new Error("Server error " + res.status);
    return await res.json();
  }

  /* ─────────────────────────────────────────────
     SUCCESS SCREEN
  ───────────────────────────────────────────── */
  function showSuccess(order, serverStatus) {
    el("coReview").hidden  = true;
    el("coSuccess").hidden = false;
    setStep(5);

    el("successOrderId").textContent = order.orderId;

    const status = serverStatus || (order.paymentMethod === "UPI" ? "Pending Verification" : "Confirmed – COD");
    const statusConf = {
      "Pending Verification": { cls: "badge--warn",  text: "⏳ Pending Verification — UTR check baaki hai" },
      "Confirmed – COD"     : { cls: "badge--green", text: "✅ Order Confirmed — COD" },
    };
    const sc = statusConf[status] || { cls: "badge--blue", text: status };
    el("successStatusBadge").innerHTML  = `<span class="co-badge ${sc.cls}">${sc.text}</span>`;

    el("successMsg").textContent = status === "Pending Verification"
      ? "Aapka order mila! Hum UTR verify karke aapko confirm karenge. WhatsApp par bhi message kar sakte hain."
      : "Aapka order confirm ho gaya! Delivery ke samay payment karein. Hum aapko call karenge.";

    const rows = [
      `<div class="co-sum-row"><span>Order ID</span><strong>${order.orderId}</strong></div>`,
      `<div class="co-sum-row"><span>Product</span><strong>${order.productName}</strong></div>`,
      `<div class="co-sum-row"><span>Price</span><strong>${order.productPrice}</strong></div>`,
    ];
    Object.entries(order.selectedOptions).forEach(([l, v]) =>
      rows.push(`<div class="co-sum-row"><span>${l}</span><strong>${v}</strong></div>`)
    );
    rows.push(`<div class="co-sum-divider"></div>`);
    rows.push(`<div class="co-sum-row"><span>Name</span><strong>${order.customerName}</strong></div>`);
    rows.push(`<div class="co-sum-row"><span>Phone</span><strong>${order.phone}</strong></div>`);
    rows.push(`<div class="co-sum-row"><span>Address</span><strong>${[order.address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}</strong></div>`);
    rows.push(`<div class="co-sum-divider"></div>`);
    rows.push(`<div class="co-sum-row"><span>Payment</span><strong>${order.paymentMethod}</strong></div>`);
    if (order.paymentMethod === "UPI") {
      rows.push(`<div class="co-sum-row"><span>UTR</span><strong>${order.utrNumber}</strong></div>`);
      rows.push(`<div class="co-sum-row"><span>Amount Paid</span><strong>₹${order.amountPaid}</strong></div>`);
    }
    el("coSuccessSummary").innerHTML = rows.join("");

    el("coWhatsappBtn").onclick = () => {
      const url = "https://wa.me/" + (appConfig.ownerPhone || "917693849472") +
                  "?text=" + encodeURIComponent(buildWAMessage(order, status));
      window.open(url, "_blank", "noopener");
    };

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ─────────────────────────────────────────────
     WHATSAPP MESSAGE
  ───────────────────────────────────────────── */
  function buildWAMessage(order, status) {
    const optLines = Object.entries(order.selectedOptions)
      .map(([k, v]) => `• ${k}: ${v}`).join("\n");

    return `🛍️ *NEW ORDER — RD Advance Boutique*

*Order ID:* ${order.orderId}
*Date:* ${order.createdAt}
*Status:* ${status}

━━━━━━━━━━━━━━━━━
*PRODUCT*
━━━━━━━━━━━━━━━━━
${order.productName}
Price: ${order.productPrice}
URL: ${order.productUrl}

━━━━━━━━━━━━━━━━━
*SELECTED OPTIONS*
━━━━━━━━━━━━━━━━━
${optLines || "—"}

━━━━━━━━━━━━━━━━━
*CUSTOMER DETAILS*
━━━━━━━━━━━━━━━━━
Name: ${order.customerName}
Mobile: ${order.phone}
Address: ${order.address}, ${order.city}, ${order.state} - ${order.pincode}

━━━━━━━━━━━━━━━━━
*PAYMENT*
━━━━━━━━━━━━━━━━━
Method: ${order.paymentMethod}${order.utrNumber ? "\nUTR: " + order.utrNumber : ""}${order.amountPaid ? "\nAmount: ₹" + order.amountPaid : ""}${screenshotData ? "\nScreenshot: Uploaded ✅" : ""}${order.notes ? "\n\nNotes: " + order.notes : ""}

Please confirm this order. 🙏`;
  }

  /* ─────────────────────────────────────────────
     LOCAL STORAGE (fallback)
  ───────────────────────────────────────────── */
  function storeLocally(order) {
    try {
      const stored = JSON.parse(localStorage.getItem("rdOrders") || "[]");
      stored.unshift({ ...order, screenshotBase64: undefined });
      localStorage.setItem("rdOrders", JSON.stringify(stored.slice(0, 200)));
    } catch (_) {}
  }

  /* ─────────────────────────────────────────────
     STEP INDICATOR
  ───────────────────────────────────────────── */
  function setStep(n) {
    document.querySelectorAll(".co-step").forEach((s, i) =>
      s.classList.toggle("active", i + 1 <= n)
    );
  }

  /* ─────────────────────────────────────────────
     ERROR BANNER
  ───────────────────────────────────────────── */
  function showError(msg) {
    const banner = el("coErrorBanner");
    const msgEl  = el("coErrorMsg");
    if (!banner || !msgEl) { alert(msg); return; }
    msgEl.textContent = msg;
    banner.hidden = false;
    banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ─────────────────────────────────────────────
     EVENT HANDLERS
  ───────────────────────────────────────────── */
  async function handleConfirm() {
    if (!pendingOrder) return;
    const btn = el("coConfirmBtn");
    btn.disabled    = true;
    btn.textContent = "Submitting…";

    try {
      const result = await submitOrder(pendingOrder);
      if (result.ok || result.offline) {
        storeLocally(pendingOrder);
        showSuccess(pendingOrder, result.status);
      } else {
        throw new Error(result.error || "Order submit failed");
      }
    } catch (err) {
      btn.disabled    = false;
      btn.textContent = "✅ Order Confirm Karein";
      showError("Order submit karne mein problem aayi. Screenshot le kar WhatsApp par bhejein, ya dubara try karein. (" + err.message + ")");
    }
  }

  function handleEdit() {
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
      if (file.size > 5 * 1024 * 1024) { showError("Screenshot 5 MB se bada hai. Chhoti image choose karein."); return; }
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
    box.addEventListener("click",    e  => { if (e.target !== input) input.click(); });
    box.addEventListener("dragover",  e  => { e.preventDefault(); box.classList.add("co-upload-box--drag"); });
    box.addEventListener("dragleave", ()  => box.classList.remove("co-upload-box--drag"));
    box.addEventListener("drop",      e  => {
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
          const t = document.createElement("textarea");
          Object.assign(t.style, { position: "fixed", left: "-9999px" });
          t.value = btn.dataset.copy;
          document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
        }
        const orig = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = orig; }, 1800);
      });
    });
  }

  /* ─────────────────────────────────────────────
     LOAD CONFIG + PRODUCT
  ───────────────────────────────────────────── */
  async function loadConfig() {
    try {
      const res = await fetch("data/config.json", { cache: "no-store" });
      appConfig = await res.json();
      // Update UPI display from config
      if (appConfig.upiId) {
        const upiEl = el("cfgUpiId");
        if (upiEl) { upiEl.textContent = appConfig.upiId; upiEl.closest(".co-upi-row")?.querySelector(".co-copy-btn")?.setAttribute("data-copy", appConfig.upiId); }
      }
      if (appConfig.upiPhone) {
        const upiPhEl = el("cfgUpiPhone");
        if (upiPhEl) upiPhEl.textContent = appConfig.upiPhone;
      }
      if (appConfig.upiName) {
        const upiNmEl = el("cfgUpiName");
        if (upiNmEl) upiNmEl.textContent = appConfig.upiName;
      }
    } catch (_) { appConfig = {}; }
  }

  async function loadProduct() {
    const id = getParam("id");
    try {
      const res      = await fetch("data/products.json", { cache: "no-store" });
      const products = await res.json();
      const found    = (Array.isArray(products) ? products : []).find(p =>
        norm(p.id || p.slug || p.title || p.name) === norm(id)
      ) || products[0];

      if (!found) {
        el("productOptionsContainer").innerHTML = "<p>Product nahi mila. <a href='shop.html'>Shop par jaayein.</a></p>";
        return;
      }

      currentProduct = found;
      const img = found.image || (found.images && found.images[0]) || "assets/logo.png";

      el("coProductImg").src          = img;
      el("coProductImg").alt          = found.title || found.name;
      el("coProductCat").textContent  = found.category || "Boutique";
      el("coProductName").textContent = found.title || found.name;
      el("coProductPrice").textContent= fmtPrice(found.price);
      document.title = "Checkout — " + (found.title || found.name);

      buildDynamicForm(found);
    } catch (err) {
      console.error(err);
      el("productOptionsContainer").innerHTML = "<p>Product load nahi hua. Reload karein.</p>";
    }
  }

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  async function init() {
    if (!document.querySelector(".checkout-page")) return;

    await Promise.all([loadConfig(), loadProduct()]);
    setupPaymentTabs();
    setupScreenshotUpload();
    setupCopyBtns();

    el("coForm")?.addEventListener("submit", e => {
      e.preventDefault();
      if (!validate()) return;
      pendingOrder = buildOrder();
      showReview(pendingOrder);
    });

    el("coConfirmBtn")?.addEventListener("click", handleConfirm);
    el("coEditBtn")?.addEventListener("click", handleEdit);

    el("coErrorClose")?.addEventListener("click", () => {
      el("coErrorBanner").hidden = true;
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
