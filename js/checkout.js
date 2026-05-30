(function () {
  "use strict";

  const PRODUCTS_JSON = "data/products.json";
  const WHATSAPP_NUMBER = "917693849472";
  const UPI_ID = "8643090832@jio";
  const STORE_PHONE = "+91 86430 90832";

  let currentProduct = null;
  let selectedPayment = "upi";
  let screenshotDataUrl = null;

  function getParam(key) {
    return new URLSearchParams(window.location.search).get(key) || "";
  }

  function normalize(val) {
    return String(val || "").trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function formatPrice(price) {
    if (!price && price !== 0) return "Price on request";
    if (typeof price === "number" && price > 0) return "₹" + price.toLocaleString("en-IN");
    return String(price);
  }

  function generateOrderId() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
    return "RD-" + ts + rand;
  }

  function getProductType(product) {
    const cat = normalize(product.category || "");
    const type = normalize(product.productType || product.type || "");
    if (cat.includes("custom") || type.includes("custom")) return "custom";
    if (cat.includes("saree") || type.includes("saree")) return "saree";
    if (cat.includes("boutique") || type.includes("boutique")) return "boutique";
    return "readymade";
  }

  function buildDynamicFields(product) {
    const container = document.getElementById("dynamicFields");
    if (!container) return;
    container.innerHTML = "";

    const pType = getProductType(product);
    const sizes = product.sizes || [];
    const colors = product.colors || [];

    if (pType === "custom") {
      container.innerHTML = `
        <div class="co-field-group">
          <p class="co-field-group-label">📏 Measurements (inches)</p>
          <div class="co-field-row">
            <div class="co-field"><label for="measChest">Chest</label><input type="number" id="measChest" placeholder='e.g. 36" '></div>
            <div class="co-field"><label for="measWaist">Waist</label><input type="number" id="measWaist" placeholder='e.g. 30" '></div>
          </div>
          <div class="co-field-row">
            <div class="co-field"><label for="measHips">Hips</label><input type="number" id="measHips" placeholder='e.g. 38" '></div>
            <div class="co-field"><label for="measLength">Length</label><input type="number" id="measLength" placeholder='e.g. 44" '></div>
          </div>
        </div>
        <div class="co-field">
          <label for="fabricDesc">Fabric / Design Description *</label>
          <textarea id="fabricDesc" rows="2" placeholder="Kapde ka rang, design, koi reference…"></textarea>
        </div>`;
    } else if (pType === "saree") {
      container.innerHTML = `
        ${colors.length ? buildChipField("coColor", "Color", colors) : '<div class="co-field"><label for="coColorText">Color</label><input type="text" id="coColorText" placeholder="Preferred color"></div>'}
        <div class="co-field">
          <label for="blouseSize">Blouse Size / Measurements</label>
          <input type="text" id="blouseSize" placeholder='e.g. 36" bust ya Custom measurements'>
        </div>`;
    } else {
      container.innerHTML = `
        ${sizes.length ? buildChipField("coSize", "Size", sizes) : '<div class="co-field"><label for="coSizeText">Size</label><input type="text" id="coSizeText" placeholder="e.g. S, M, L, XL ya measurements"></div>'}
        ${colors.length ? buildChipField("coColor", "Color", colors) : '<div class="co-field"><label for="coColorText">Color</label><input type="text" id="coColorText" placeholder="Preferred color"></div>'}`;
    }

    container.querySelectorAll(".co-chip-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const group = btn.closest(".co-chip-group");
        group.querySelectorAll(".co-chip-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });
  }

  function buildChipField(id, label, items) {
    const chips = items.map(item =>
      `<button type="button" class="co-chip-btn" data-value="${item}">${item}</button>`
    ).join("");
    return `<div class="co-field">
      <label>${label}</label>
      <div class="co-chip-group" id="${id}">${chips}</div>
    </div>`;
  }

  function getSelectedChip(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return "";
    const sel = group.querySelector(".co-chip-btn.selected");
    return sel ? sel.dataset.value : "";
  }

  function getFieldVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function collectOrderData() {
    const product = currentProduct;
    const pType = getProductType(product);

    const size = getSelectedChip("coSize") || getFieldVal("coSizeText") ||
                 (pType === "saree" ? getFieldVal("blouseSize") : "") ||
                 (pType === "custom" ? buildMeasurements() : "");
    const color = getSelectedChip("coColor") || getFieldVal("coColorText") || "";

    return {
      orderId: generateOrderId(),
      date: new Date().toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }),
      product: {
        id: product.id,
        name: product.title || product.name,
        category: product.category,
        price: formatPrice(product.price),
        image: product.image || (product.images && product.images[0]) || "",
        url: window.location.origin + window.location.pathname.replace("checkout.html", "product-details.html") + "?id=" + (product.id || "")
      },
      qty: getFieldVal("coQty") || "1",
      size: size || "As discussed",
      color: color || "As discussed",
      fabricDesc: getFieldVal("fabricDesc") || "",
      customer: {
        name: getFieldVal("custName"),
        phone: getFieldVal("custPhone"),
        address: [getFieldVal("custAddress"), getFieldVal("custCity"), getFieldVal("custPin")].filter(Boolean).join(", ")
      },
      payment: selectedPayment === "upi" ? "UPI" : "Cash on Delivery",
      hasScreenshot: !!screenshotDataUrl,
      notes: getFieldVal("coNotes")
    };
  }

  function buildMeasurements() {
    const parts = [];
    const chest = getFieldVal("measChest");
    const waist = getFieldVal("measWaist");
    const hips = getFieldVal("measHips");
    const length = getFieldVal("measLength");
    if (chest) parts.push(`Chest: ${chest}"`);
    if (waist) parts.push(`Waist: ${waist}"`);
    if (hips) parts.push(`Hips: ${hips}"`);
    if (length) parts.push(`Length: ${length}"`);
    return parts.join(", ") || "";
  }

  function buildWhatsappMessage(order) {
    const screenshot = order.hasScreenshot ? "Uploaded ✅" : "Not uploaded ❌";
    return `🛍️ *NEW ORDER — RD Advance Boutique*

*Order ID:* ${order.orderId}
*Date:* ${order.date}

━━━━━━━━━━━━━━━━━━
*🧾 PRODUCT DETAILS*
━━━━━━━━━━━━━━━━━━
Product: ${order.product.name}
Category: ${order.product.category}
Price: ${order.product.price}
Quantity: ${order.qty}
Size: ${order.size}
Color: ${order.color}${order.fabricDesc ? "\nFabric/Design: " + order.fabricDesc : ""}
Product URL: ${order.product.url}

━━━━━━━━━━━━━━━━━━
*👤 CUSTOMER DETAILS*
━━━━━━━━━━━━━━━━━━
Name: ${order.customer.name}
Phone: ${order.customer.phone}
Address: ${order.customer.address}

━━━━━━━━━━━━━━━━━━
*💳 PAYMENT*
━━━━━━━━━━━━━━━━━━
Method: ${order.payment}
Screenshot: ${screenshot}
${order.notes ? "\nNotes: " + order.notes : ""}

Please confirm and process this order. 🙏`;
  }

  function buildSummaryHTML(order) {
    return `
      <div class="co-sum-row"><span>Order ID</span><strong>${order.orderId}</strong></div>
      <div class="co-sum-row"><span>Product</span><strong>${order.product.name}</strong></div>
      <div class="co-sum-row"><span>Category</span><strong>${order.product.category}</strong></div>
      <div class="co-sum-row"><span>Price</span><strong>${order.product.price}</strong></div>
      <div class="co-sum-row"><span>Quantity</span><strong>${order.qty}</strong></div>
      <div class="co-sum-row"><span>Size</span><strong>${order.size}</strong></div>
      <div class="co-sum-row"><span>Color</span><strong>${order.color}</strong></div>
      ${order.fabricDesc ? `<div class="co-sum-row"><span>Fabric/Design</span><strong>${order.fabricDesc}</strong></div>` : ""}
      <div class="co-sum-divider"></div>
      <div class="co-sum-row"><span>Customer</span><strong>${order.customer.name}</strong></div>
      <div class="co-sum-row"><span>Phone</span><strong>${order.customer.phone}</strong></div>
      <div class="co-sum-row"><span>Address</span><strong>${order.customer.address}</strong></div>
      <div class="co-sum-divider"></div>
      <div class="co-sum-row"><span>Payment</span><strong>${order.payment}</strong></div>
      <div class="co-sum-row"><span>Screenshot</span><strong>${order.hasScreenshot ? "Uploaded ✅" : "Not uploaded"}</strong></div>
      ${order.notes ? `<div class="co-sum-row"><span>Notes</span><strong>${order.notes}</strong></div>` : ""}
    `;
  }

  function storeOrder(order) {
    try {
      const stored = JSON.parse(localStorage.getItem("rdOrders") || "[]");
      stored.unshift(order);
      localStorage.setItem("rdOrders", JSON.stringify(stored.slice(0, 100)));
    } catch (e) {}
  }

  function showSuccess(order) {
    document.getElementById("coSteps").querySelectorAll(".co-step").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".co-step")[2]?.classList.add("active");

    document.getElementById("coForm").hidden = true;
    document.getElementById("coSuccess").hidden = false;
    document.getElementById("successOrderId").textContent = order.orderId;
    document.getElementById("coSummaryCard").innerHTML = buildSummaryHTML(order);

    const waBtn = document.getElementById("coWhatsappBtn");
    const msg = buildWhatsappMessage(order);
    waBtn.dataset.msg = msg;
    waBtn.addEventListener("click", () => {
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waBtn.dataset.msg)}`;
      window.open(url, "_blank", "noopener");
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateForm() {
    const required = ["custName", "custPhone", "custAddress", "custCity", "custPin"];
    for (const id of required) {
      const el = document.getElementById(id);
      if (!el || !el.value.trim()) {
        el?.focus();
        el?.closest(".co-field")?.classList.add("co-field--error");
        return false;
      }
      el.closest(".co-field")?.classList.remove("co-field--error");
    }
    if (getFieldVal("custPhone").length < 10) {
      document.getElementById("custPhone")?.focus();
      document.getElementById("custPhone")?.closest(".co-field")?.classList.add("co-field--error");
      return false;
    }
    return true;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) {
      const firstError = document.querySelector(".co-field--error input, .co-field--error textarea");
      firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const btn = document.getElementById("coSubmitBtn");
    btn.disabled = true;
    btn.textContent = "Processing…";

    setTimeout(() => {
      const order = collectOrderData();
      storeOrder(order);
      showSuccess(order);
    }, 600);
  }

  function setupPaymentTabs() {
    document.querySelectorAll(".co-pay-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".co-pay-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        selectedPayment = tab.dataset.method;
        document.getElementById("panelUpi").hidden = selectedPayment !== "upi";
        document.getElementById("panelCod").hidden = selectedPayment !== "cod";
      });
    });
  }

  function setupFileUpload() {
    const input = document.getElementById("payScreenshot");
    const uploadUi = document.getElementById("uploadUi");
    const preview = document.getElementById("uploadPreview");
    const box = document.getElementById("uploadBox");

    if (!input) return;

    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        screenshotDataUrl = ev.target.result;
        preview.src = screenshotDataUrl;
        preview.hidden = false;
        uploadUi.hidden = true;
        box.classList.add("co-upload-box--done");
      };
      reader.readAsDataURL(file);
    });

    box.addEventListener("click", (e) => {
      if (e.target !== input) input.click();
    });

    box.addEventListener("dragover", (e) => { e.preventDefault(); box.classList.add("co-upload-box--drag"); });
    box.addEventListener("dragleave", () => box.classList.remove("co-upload-box--drag"));
    box.addEventListener("drop", (e) => {
      e.preventDefault();
      box.classList.remove("co-upload-box--drag");
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("change"));
      }
    });
  }

  function setupCopyBtns() {
    document.querySelectorAll(".co-copy-btn[data-copy]").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = btn.dataset.copy;
          ta.style.position = "fixed"; ta.style.left = "-9999px";
          document.body.appendChild(ta); ta.select();
          document.execCommand("copy"); ta.remove();
        }
        const orig = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = orig; }, 1800);
      });
    });
  }

  function updateStepIndicator(step) {
    document.querySelectorAll(".co-step").forEach((s, i) => {
      s.classList.toggle("active", i + 1 <= step);
    });
  }

  function setupScrollSteps() {
    const sections = ["sectionDetails", "sectionPayment"];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = sections.indexOf(entry.target.id);
          if (idx >= 0) updateStepIndicator(idx + 1);
        }
      });
    }, { threshold: 0.3 });
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  async function loadProduct() {
    const id = getParam("id");
    try {
      const res = await fetch(PRODUCTS_JSON, { cache: "no-store" });
      const products = await res.json();
      const found = (Array.isArray(products) ? products : []).find(p =>
        normalize(p.id || p.slug || p.title || p.name) === normalize(id)
      ) || products[0];
      currentProduct = found;

      if (found) {
        const img = found.image || (found.images && found.images[0]) || "assets/logo.png";
        document.getElementById("coProductImg").src = img;
        document.getElementById("coProductImg").alt = found.title || found.name;
        document.getElementById("coProductCat").textContent = found.category || "Boutique";
        document.getElementById("coProductName").textContent = found.title || found.name;
        document.getElementById("coProductPrice").textContent = formatPrice(found.price);
        document.title = `Checkout — ${found.title || found.name} | RD Advance Boutique`;
        buildDynamicFields(found);
      }
    } catch (err) {
      console.error("Could not load product:", err);
    }
  }

  function init() {
    if (!document.querySelector(".checkout-page")) return;

    loadProduct();
    setupPaymentTabs();
    setupFileUpload();
    setupCopyBtns();
    setupScrollSteps();

    document.getElementById("coForm")?.addEventListener("submit", handleSubmit);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
