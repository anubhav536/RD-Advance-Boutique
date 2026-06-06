(function () {
  "use strict";

  /* ─────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────── */
  const S = {
    config: {}, settings: {}, products: [], categories: [],
    gallery: [], notifications: [], orders: [],
    activeFilter: "all", editType: null, editItem: null, editIdx: -1,
    pendingFiles: new Map(), // kept for gallery/notifications zip flow
    productSearch: "", productFilter: "all",
  };

  /* ─────────────────────────────────────────────
     UTILS
  ───────────────────────────────────────────── */
  const el  = id => document.getElementById(id);
  const esc = s  => String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const slug = s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  const lines = s => String(s || "").split("\n").map(t => t.trim()).filter(Boolean);
  const fv   = (form, n) => (form.querySelector(`[name="${n}"]`)?.value || "").trim();
  const fcb  = (form, n) => !!form.querySelector(`[name="${n}"]`)?.checked;

  async function fetchJ(url) {
    try { return await (await fetch(url, { cache: "no-store" })).json(); }
    catch { return null; }
  }

  function relTime(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr); if (isNaN(d)) return dateStr;
    const mins = Math.floor((Date.now() - d) / 60000);
    if (mins < 1)  return "just now";
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs  < 24) return hrs + "h ago";
    const days = Math.floor(hrs / 24);
    if (days < 7)  return days + "d ago";
    return d.toLocaleDateString("en-IN");
  }

  /* ─────────────────────────────────────────────
     LOAD ALL DATA
  ───────────────────────────────────────────── */
  async function loadAll() {
    const [cfg, set, pro, cat, gal, notif] = await Promise.all([
      fetchJ("data/config.json"),   fetchJ("data/settings.json"),
      fetchJ("data/products.json"), fetchJ("data/categories.json"),
      fetchJ("data/gallery.json"),  fetchJ("data/notifications.json"),
    ]);
    S.config        = cfg   || {};
    S.settings      = set   || {};
    S.products      = Array.isArray(pro)   ? pro   : [];
    S.categories    = Array.isArray(cat)   ? cat   : [];
    S.gallery       = Array.isArray(gal)   ? gal   : [];
    S.notifications = Array.isArray(notif) ? notif : [];
    S.orders        = loadLocalOrders();
  }

  function loadLocalOrders() {
    try {
      const raw = JSON.parse(localStorage.getItem("rdOrders") || "[]");
      return raw.map(o => ({
        "Order ID"        : o.orderId      || "—",
        "Created Date"    : o.createdAt    || "",
        "Status"          : o.paymentMethod === "UPI" ? "Pending Verification" : "Confirmed – COD",
        "Product Name"    : o.productName  || "",
        "Product URL"     : o.productUrl   || "",
        "Quantity"        : o.quantity     || 1,
        "Selected Options": o.selectedOptions || {},
        "Customer Name"   : o.customerName || "",
        "Mobile Number"   : o.phone        || "",
        "Address"         : o.address      || "",
        "City"            : o.city         || "",
        "State"           : o.state        || "",
        "Pincode"         : o.pincode      || "",
        "Payment Method"  : o.paymentMethod|| "",
        "UTR Number"      : o.utrNumber    || "",
        "Amount Paid"     : o.amountPaid   || "",
        "Notes"           : o.notes        || "",
        _local: true,
      }));
    } catch (_) { return []; }
  }

  /* ─────────────────────────────────────────────
     LOGIN / LOGOUT
  ───────────────────────────────────────────── */
  function handleLogin(e) {
    e.preventDefault();
    const pin = el("mgPin").value.trim();
    if (!pin) return;

    const correct = String(pin) === String(S.config.managerPin || "1234");
    if (correct) {
      sessionStorage.setItem("rdAdminPin", pin);
      el("mgLoginScreen").hidden = true;
      el("mgApp").hidden = false;
      el("mgLoginErr").hidden = true;
      showSection("dashboard");
    } else {
      el("mgLoginErr").hidden = false;
      el("mgPin").select();
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("rdAdminPin");
    el("mgApp").hidden = true;
    el("mgLoginScreen").hidden = false;
    el("mgPin").value = "";
    el("mgLoginErr").hidden = true;
  }

  /* ─────────────────────────────────────────────
     SIDEBAR NAVIGATION
  ───────────────────────────────────────────── */
  const SECTION_LABELS = {
    dashboard:"Dashboard", orders:"Orders", products:"Products",
    categories:"Categories", gallery:"Gallery", notifications:"Notifications",
    website:"Website Settings", theme:"Theme & SEO", config:"Settings",
  };

  const SECTION_RENDERERS = {
    dashboard: renderDashboard,
    orders: renderOrders,
    products: renderProducts,
    categories: renderCategories,
    gallery: renderGallery,
    notifications: renderNotifications,
    website: renderWebsite,
    theme: renderTheme,
    config: renderConfigSection,
  };

  function showSection(name) {
    document.querySelectorAll(".adm-section").forEach(s => { s.hidden = true; });
    const sec = el("section-" + name);
    if (sec) sec.hidden = false;
    document.querySelectorAll(".adm-nav-item").forEach(i =>
      i.classList.toggle("active", i.dataset.section === name)
    );
    if (el("admCurrentSection")) el("admCurrentSection").textContent = SECTION_LABELS[name] || name;
    el("admSidebar")?.classList.remove("adm-sidebar--open");
    SECTION_RENDERERS[name]?.();
  }

  /* ─────────────────────────────────────────────
     DASHBOARD
  ───────────────────────────────────────────── */
  function renderDashboard() {
    const pending = S.orders.filter(o => o["Status"] === "Pending Verification").length;
    el("dashOrders").textContent        = S.orders.length;
    el("dashPending").textContent       = pending;
    el("dashProducts").textContent      = S.products.length;
    el("dashCategories").textContent    = S.categories.length;
    el("dashGallery").textContent       = S.gallery.length;
    el("dashNotifications").textContent = S.notifications.length;
    if (pending > 0) {
      const badge = el("navOrderBadge");
      if (badge) { badge.textContent = pending; badge.hidden = false; }
    }
    document.querySelectorAll(".adm-dash-card[data-goto]").forEach(card => {
      card.addEventListener("click", () => showSection(card.dataset.goto));
    });
  }

  /* ─────────────────────────────────────────────
     ORDERS
  ───────────────────────────────────────────── */
  const STATUS_CONFIG = {
    "Pending Verification": { cls: "badge--warn",  label: "⏳ Pending Verification" },
    "Confirmed – COD"     : { cls: "badge--teal",  label: "🏠 COD" },
    "Verified"            : { cls: "badge--blue",  label: "✅ Verified" },
    "Completed"           : { cls: "badge--green", label: "📦 Completed" },
    "Cancelled"           : { cls: "badge--red",   label: "❌ Cancelled" },
    "Rejected"            : { cls: "badge--red",   label: "🚫 Rejected" },
  };
  const ALL_STATUSES = Object.keys(STATUS_CONFIG);

  /* ─────────────────────────────────────────────
     CONNECTION STATUS
  ───────────────────────────────────────────── */
  function gasUrl() { return null; }

  function getAdminPin() {
    return sessionStorage.getItem("rdAdminPin") || "";
  }

  /* Upload image: Cloudinary unsigned (preferred) or server /upload */
  async function uploadImage(file) {
    const cloudName   = S.config.cloudinaryCloudName   || "";
    const uploadPreset = S.config.cloudinaryUploadPreset || "";

    if (cloudName && uploadPreset) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", uploadPreset);
      const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST", body: fd,
      });
      const d = await r.json();
      if (d.secure_url) return d.secure_url;
      throw new Error(d.error?.message || "Cloudinary upload failed");
    }

    /* Fallback: local server */
    const fd = new FormData();
    fd.append("files", file);
    const r = await fetch("/upload", { method: "POST", body: fd });
    const d = await r.json();
    if (d.success && d.paths?.length) return d.paths[0];
    throw new Error(d.error || "Server upload failed");
  }

  function bustCatalogCaches() {
    if (window.RDApi) { window.RDApi.bustProducts(); window.RDApi.bustCategories(); }
  }

  function updateConnectionStatus() {
    const badge = el("mgConnectionBadge");
    if (!badge) return;
    badge.textContent = "📱 WhatsApp Orders";
    badge.className   = "mg-connection-badge mg-connection-badge--local";
    badge.title       = "Orders received via WhatsApp — stored on this device";
  }

  async function renderOrders() {
    el("mgLoadingState").hidden  = false;
    el("mgEmptyState").hidden    = true;
    el("mgErrorState").hidden    = true;
    el("mgOrdersList").innerHTML = "";

    updateConnectionStatus();
    S.orders = loadLocalOrders();

    el("mgLoadingState").hidden = true;
    updateOrderStats();
    renderOrderList();
  }

  function updateOrderStats() {
    el("statAll").textContent       = S.orders.length;
    el("statPending").textContent   = S.orders.filter(o => o["Status"] === "Pending Verification").length;
    el("statCod").textContent       = S.orders.filter(o => o["Status"] === "Confirmed – COD").length;
    el("statVerified").textContent  = S.orders.filter(o => o["Status"] === "Verified").length;
    el("statCompleted").textContent = S.orders.filter(o => o["Status"] === "Completed").length;
    el("statCancelled").textContent = S.orders.filter(o => o["Status"] === "Cancelled").length;
  }

  function renderOrderList() {
    el("mgLoadingState").hidden = true;
    const filtered = S.activeFilter === "all"
      ? S.orders
      : S.orders.filter(o => o["Status"] === S.activeFilter);
    el("mgEmptyState").hidden = filtered.length > 0;
    el("mgOrdersList").innerHTML = filtered.map(order => renderOrderCard(order)).join("");
    el("mgOrdersList").querySelectorAll(".mg-order-card").forEach(card => {
      card.querySelector(".mg-order-header")?.addEventListener("click", () => {
        card.classList.toggle("mg-order-card--open");
      });
    });
    el("mgOrdersList").querySelectorAll(".mg-status-select").forEach(sel => {
      sel.addEventListener("change", () => updateOrderStatus(sel.dataset.orderId, sel.value));
    });
  }

  function renderOrderCard(order) {
    const orderId  = esc(order["Order ID"] || "—");
    const date     = order["Created Date"] || "";
    const status   = order["Status"]       || "—";
    const custName = esc(order["Customer Name"]  || "—");
    const phone    = esc(order["Mobile Number"]  || "—");
    const product  = esc(order["Product Name"]   || "—");
    const qty      = order["Quantity"]           || 1;
    const payment  = esc(order["Payment Method"] || "—");
    const utr      = esc(order["UTR Number"]     || "");
    const amount   = order["Amount Paid"]        || "";
    const address  = esc([order["Address"], order["City"], order["State"], order["Pincode"]].filter(Boolean).join(", "));
    const notes    = esc(order["Notes"]          || "");
    const prodUrl  = order["Product URL"]        || "";
    const opts     = order["Selected Options"]   || {};
    const optHtml  = typeof opts === "object" && !Array.isArray(opts)
      ? Object.entries(opts).map(([k,v]) => `<div class="mg-opt-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")
      : esc(String(opts));
    const sc       = STATUS_CONFIG[status] || { cls: "badge--blue", label: status };
    const statusOpts = ALL_STATUSES.map(s =>
      `<option value="${s}" ${s === status ? "selected" : ""}>${s}</option>`).join("");
    const waMsg = `📋 *Order Update — RD Advance Boutique*\n\n*Order ID:* ${order["Order ID"]||"—"}\n*Status:* ${status}\n\n*Product:* ${order["Product Name"]||"—"} (Qty: ${qty})\n*Customer:* ${order["Customer Name"]||"—"}\n*Phone:* ${order["Mobile Number"]||"—"}\n*Address:* ${[order["Address"],order["City"],order["State"],order["Pincode"]].filter(Boolean).join(", ")}`;
    const waUrl = "https://wa.me/" + (S.config.ownerPhone || "917693849472") + "?text=" + encodeURIComponent(waMsg);

    return `
<div class="mg-order-card" data-order-id="${orderId}">
  <div class="mg-order-header">
    <div class="mg-order-header-left">
      <span class="mg-order-id">#${orderId}</span>
      <span class="co-badge ${sc.cls}">${sc.label}</span>
      ${order._local ? '<span class="mg-offline-badge">Local</span>' : ""}
    </div>
    <div class="mg-order-header-right">
      <span class="mg-order-meta">${esc(custName)} · ${esc(payment)}</span>
      <span class="mg-order-time">${relTime(date)}</span>
      <span class="mg-order-chevron">▾</span>
    </div>
  </div>
  <div class="mg-order-body">
    <div class="mg-order-grid">
      <div class="mg-order-section">
        <h4 class="mg-section-title">Product</h4>
        <div class="mg-info-row"><span>Name</span><strong>${product}</strong></div>
        <div class="mg-info-row"><span>Qty</span><strong>${qty}</strong></div>
        ${prodUrl ? `<div class="mg-info-row"><span>URL</span><a href="${esc(prodUrl)}" target="_blank" class="mg-product-link">View →</a></div>` : ""}
      </div>
      <div class="mg-order-section">
        <h4 class="mg-section-title">Options</h4>
        ${optHtml || "<p class='mg-no-opts'>—</p>"}
      </div>
      <div class="mg-order-section">
        <h4 class="mg-section-title">Customer</h4>
        <div class="mg-info-row"><span>Name</span><strong>${custName}</strong></div>
        <div class="mg-info-row"><span>Phone</span><a href="tel:${esc(phone)}" class="mg-phone-link">${phone}</a></div>
        <div class="mg-info-row"><span>Address</span><strong>${address}</strong></div>
        ${notes ? `<div class="mg-info-row"><span>Notes</span><strong>${notes}</strong></div>` : ""}
      </div>
      <div class="mg-order-section">
        <h4 class="mg-section-title">Payment</h4>
        <div class="mg-info-row"><span>Method</span><strong>${payment}</strong></div>
        ${utr    ? `<div class="mg-info-row"><span>UTR</span><strong>${utr}</strong></div>` : ""}
        ${amount ? `<div class="mg-info-row"><span>Amount</span><strong>₹${esc(String(amount))}</strong></div>` : ""}
      </div>
    </div>
    <div class="mg-order-actions">
      <div class="mg-status-change">
        <label>Update Status:</label>
        <select class="mg-status-select" data-order-id="${orderId}">${statusOpts}</select>
      </div>
      <div class="mg-action-btns">
        <a href="${waUrl}" target="_blank" class="btn mg-wa-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </a>
        <a href="tel:${esc(phone)}" class="btn btn--ghost mg-call-btn">📞 Call</a>
      </div>
    </div>
  </div>
</div>`;
  }

  function updateOrderStatus(orderId, newStatus) {
    const idx = S.orders.findIndex(o => o["Order ID"] === orderId);
    if (idx >= 0) S.orders[idx]["Status"] = newStatus;
    updateOrderStats();
    renderOrderList();
    showToast("Status updated: " + newStatus);
  }

  /* ─────────────────────────────────────────────
     IMAGE PICKER HELPERS
  ───────────────────────────────────────────── */

  function makeImgPicker(name, val, label, hint) {
    return `<div class="adm-img-picker">
      <label>${label}${hint ? ` <small>${hint}</small>` : ""}</label>
      <div class="adm-img-picker-row">
        <input type="text" name="${name}" value="${esc(val || "")}" placeholder="URL type karo ya photo choose karo →">
        <label class="adm-upload-btn adm-single-upload-btn">
          📁 Photo
          <input type="file" accept="image/*" class="adm-file-input-single" data-target="${name}" hidden>
        </label>
      </div>
      <img class="adm-img-preview" src="${esc(val || "")}" ${val ? "" : "hidden"} onerror="this.hidden=true">
    </div>`;
  }

  function makeMultiImgPicker(images) {
    const rows = (images && images.length ? images : []).map((src, i) => makeImgRow(src, i)).join("");
    return `<div class="adm-multi-img-picker" id="multiImgPicker">
      <label class="adm-bulk-upload-zone" id="bulkUploadZone">
        <input type="file" accept="image/*" multiple id="bulkFileInput" hidden>
        <div class="adm-bulk-content">
          <span class="adm-bulk-icon">🖼️</span>
          <strong>Photos Choose Karein</strong>
          <small>Click karo — ek saath kai photos upload hoti hain</small>
        </div>
      </label>
      <div class="adm-multi-img-rows" id="multiImgRows">${rows}</div>
      <button type="button" class="adm-multi-add-btn" id="btnAddImgRow">+ URL se ek aur add karein</button>
    </div>`;
  }

  function makeImgRow(src, i) {
    const idx = typeof i === "number" ? i : Date.now();
    return `<div class="adm-multi-img-row">
      <img class="adm-multi-img-thumb" src="${esc(src || "")}" ${src ? "" : "hidden"} onerror="this.hidden=true">
      <input type="text" name="images[]" value="${esc(src || "")}" placeholder="img${idx + 1} URL">
      <label class="adm-upload-btn adm-upload-btn--sm adm-row-upload-label">
        📁
        <input type="file" accept="image/*" class="adm-file-input-row" hidden>
      </label>
      <button type="button" class="adm-multi-img-del" title="Hatao">✕</button>
    </div>`;
  }

  /* Upload single file and update the target input + preview */
  async function handleFileUpload(file, targetName, container) {
    const urlInp = container.querySelector(`[name="${targetName}"]`);
    const picker = urlInp?.closest(".adm-img-picker");
    const prev   = picker?.querySelector(".adm-img-preview");

    // Show optimistic preview via objectURL immediately
    const objURL = URL.createObjectURL(file);
    if (urlInp) urlInp.value = "⏳ Uploading…";
    if (prev)   { prev.src = objURL; prev.hidden = false; }

    try {
      const url = await uploadImage(file);
      if (urlInp) urlInp.value = url;
      if (prev)   prev.src = url;
    } catch (err) {
      // Fallback: keep objectURL (works for current session preview)
      if (urlInp) urlInp.value = objURL;
      showToast("Photo local mein saved — cloud upload failed: " + err.message, "error");
    }
  }

  /* Upload a file into a multi-image row */
  async function handleRowFileUpload(file, row) {
    const urlInp = row.querySelector("input[type=text]");
    const thumb  = row.querySelector(".adm-multi-img-thumb");
    const objURL = URL.createObjectURL(file);

    if (urlInp) urlInp.value = "⏳ Uploading…";
    if (thumb)  { thumb.src = objURL; thumb.hidden = false; }

    try {
      const url = await uploadImage(file);
      if (urlInp) urlInp.value = url;
      if (thumb)  thumb.src = url;
    } catch (err) {
      if (urlInp) urlInp.value = objURL;
      showToast("Photo local mein saved — cloud upload failed: " + err.message, "error");
    }
  }

  function attachImgPickerListeners(container) {
    /* Single pickers — upload on select */
    container.querySelectorAll(".adm-single-upload-btn").forEach(label => {
      const fileInp = label.querySelector(".adm-file-input-single");
      if (!fileInp) return;
      fileInp.addEventListener("change", () => {
        const file = fileInp.files[0];
        if (!file) return;
        handleFileUpload(file, fileInp.dataset.target, container);
        fileInp.value = "";
      });
    });

    /* Single picker — live URL preview */
    container.querySelectorAll(".adm-img-picker").forEach(picker => {
      const urlInp = picker.querySelector("input[type=text]");
      const prev   = picker.querySelector(".adm-img-preview");
      if (!urlInp || !prev) return;
      urlInp.addEventListener("input", () => {
        const v = urlInp.value.trim();
        if (v && !v.startsWith("⏳")) { prev.src = v; prev.hidden = false; } else prev.hidden = true;
      });
    });

    attachMultiImgListeners(container);
  }

  function attachMultiImgListeners(container) {
    const picker   = container.querySelector("#multiImgPicker");
    const rowsWrap = container.querySelector("#multiImgRows");
    const bulkInp  = container.querySelector("#bulkFileInput");
    const addBtn   = container.querySelector("#btnAddImgRow");
    if (!picker) return;

    function bindRow(row) {
      const rowFile = row.querySelector(".adm-file-input-row");
      const urlInp  = row.querySelector("input[type=text]");
      const thumb   = row.querySelector(".adm-multi-img-thumb");
      const delBtn  = row.querySelector(".adm-multi-img-del");

      if (rowFile) {
        rowFile.addEventListener("change", () => {
          const file = rowFile.files[0];
          if (!file) return;
          handleRowFileUpload(file, row);
          rowFile.value = "";
        });
      }
      if (urlInp && thumb) urlInp.addEventListener("input", () => {
        const v = urlInp.value.trim();
        if (v && !v.startsWith("⏳")) { thumb.src = v; thumb.hidden = false; } else thumb.hidden = true;
      });
      if (delBtn) delBtn.addEventListener("click", () => row.remove());
    }

    rowsWrap?.querySelectorAll(".adm-multi-img-row").forEach(bindRow);

    /* Bulk select — multiple files */
    if (bulkInp) {
      bulkInp.addEventListener("change", async () => {
        const files = Array.from(bulkInp.files);
        if (!files.length) return;
        showToast("⏳ Uploading " + files.length + " photo(s)…");
        for (const file of files) {
          const emptyInp = Array.from(rowsWrap.querySelectorAll("input[type=text]"))
            .find(inp => !inp.value.trim());
          if (emptyInp) {
            const row = emptyInp.closest(".adm-multi-img-row");
            await handleRowFileUpload(file, row);
          } else {
            const div = document.createElement("div");
            div.className = "adm-multi-img-row";
            div.innerHTML = `
              <img class="adm-multi-img-thumb" hidden>
              <input type="text" name="images[]" value="" placeholder="…">
              <label class="adm-upload-btn adm-upload-btn--sm adm-row-upload-label">
                📁<input type="file" accept="image/*" class="adm-file-input-row" hidden>
              </label>
              <button type="button" class="adm-multi-img-del" title="Hatao">✕</button>`;
            rowsWrap.appendChild(div);
            bindRow(div);
            await handleRowFileUpload(file, div);
          }
        }
        showToast("✅ " + files.length + " photo(s) uploaded!");
        bulkInp.value = "";
      });
    }

    /* Add empty row manually */
    addBtn?.addEventListener("click", () => {
      const idx = rowsWrap.querySelectorAll(".adm-multi-img-row").length;
      const div = document.createElement("div");
      div.className = "adm-multi-img-row";
      div.innerHTML = `
        <img class="adm-multi-img-thumb" hidden>
        <input type="text" name="images[]" value="" placeholder="assets/img${idx + 1}.jpg">
        <label class="adm-upload-btn adm-upload-btn--sm adm-row-upload-label">
          📁<input type="file" accept="image/*" class="adm-file-input-row" hidden>
        </label>
        <button type="button" class="adm-multi-img-del" title="Hatao">✕</button>`;
      rowsWrap.appendChild(div);
      bindRow(div);
    });
  }

  /* ZIP download — kept for gallery/notifications only */
  function updateZipBtn() {
    const btn = el("admZipDownload");
    if (!btn) return;
    const count = S.pendingFiles.size;
    if (count > 0) {
      btn.hidden = false;
      btn.textContent = `📥 Download ${count} Photo${count > 1 ? "s" : ""} (ZIP)`;
    } else {
      btn.hidden = true;
    }
  }

  async function downloadImagesZip() {
    if (!S.pendingFiles.size) return;
    const btn = el("admZipDownload");
    if (btn) { btn.textContent = "⏳ Zip ban rahi hai…"; btn.disabled = true; }
    try {
      const zip = new JSZip();
      const folder = zip.folder("assets");
      S.pendingFiles.forEach((file, path) => {
        const filename = path.replace(/^assets\//, "");
        folder.file(filename, file);
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "boutique-assets.zip";
      a.click();
      showToast("✅ ZIP download shuru — assets/ folder mein extract karo aur GitHub par commit karo");
    } catch (err) {
      showToast("❌ ZIP error: " + err.message, "error");
    }
    if (btn) { btn.disabled = false; updateZipBtn(); }
  }

  /* ─────────────────────────────────────────────
     PRODUCTS
  ───────────────────────────────────────────── */

  function sheetsConnectedBanner() {
    return `<div class="adm-api-status adm-api-status--warn">
      📋 <strong>JSON mode:</strong> Product/category add karne ke baad <strong>"Generate JSON"</strong> button dabao aur code copy karke <code>data/products.json</code> mein paste karo, phir GitHub par commit karo.
    </div>`;
  }

  function renderProducts() {
    const list = el("admProductsList");
    if (!list) return;

    const q   = S.productSearch.toLowerCase();
    const flt = S.productFilter;

    let visible = S.products.filter(p => {
      if (flt === "active"    && p.status === "inactive")  return false;
      if (flt === "inactive"  && p.status !== "inactive")  return false;
      if (flt === "boutique"  && (p.productType || p.type || "readymade").toLowerCase() !== "boutique") return false;
      if (flt === "readymade" && (p.productType || p.type || "readymade").toLowerCase() === "boutique") return false;
      if (q) {
        const title = (p.title || p.name || "").toLowerCase();
        const tags  = (p.tags || []).join(" ").toLowerCase();
        const cats  = (Array.isArray(p.categories) ? p.categories : [p.category || ""]).join(" ").toLowerCase();
        if (!title.includes(q) && !tags.includes(q) && !cats.includes(q)) return false;
      }
      return true;
    });

    if (!S.products.length) {
      list.innerHTML = sheetsConnectedBanner() + '<div class="adm-empty">No products yet. Click "+ Add Product" to create the first one.</div>';
      return;
    }

    const tableRows = visible.map((p, i) => {
      const origIdx = S.products.indexOf(p);
      const pt = (p.productType || p.type || "readymade").toLowerCase();
      const isBoutique = pt === "boutique";
      const cats = Array.isArray(p.categories) && p.categories.length ? p.categories : (p.category ? [p.category] : []);
      const catHtml = cats.length ? cats.map(c => `<span class="adm-tag">${esc(c)}</span>`).join(" ") : "<span style='color:#aaa'>—</span>";
      const stock = p.stock > 0 ? `<span style="color:#27ae60">${p.stock}</span>` : (p.stock === 0 && p.stock !== "" && p.stock !== undefined ? `<span style="color:#e74c3c">0</span>` : "—");
      return `
      <tr>
        <td><img src="${esc(p.image || (p.images && p.images[0]) || "")}" class="adm-table-img" onerror="this.style.display='none'"></td>
        <td><strong>${esc(p.title || p.name || "—")}</strong>${p.featured ? ' <span title="Featured" style="color:#c9a45c">★</span>' : ''}</td>
        <td><span class="adm-badge ${isBoutique ? "adm-badge--boutique" : "adm-badge--readymade"}">${isBoutique ? "✂️ Boutique" : "🛍️ Ready-Made"}</span></td>
        <td class="adm-cat-tags-cell">${catHtml}</td>
        <td>${p.price ? "₹" + p.price : "—"}</td>
        <td>${stock}</td>
        <td><span class="adm-badge ${p.status !== "inactive" ? "adm-badge--green" : "adm-badge--grey"}">${p.status || "active"}</span></td>
        <td class="adm-actions">
          <button class="adm-btn-sm adm-btn-edit"  data-idx="${origIdx}">✏️</button>
          <button class="adm-btn-sm adm-btn-dup"   data-idx="${origIdx}" title="Duplicate">⧉</button>
          <button class="adm-btn-sm adm-btn-del"   data-idx="${origIdx}">🗑️</button>
        </td>
      </tr>`;
    }).join("");

    list.innerHTML = sheetsConnectedBanner() + `
    <div class="adm-list-toolbar">
      <input type="search" id="productSearchInp" class="adm-search-inp" placeholder="🔍 Search by title, tag, category…" value="${esc(S.productSearch)}">
      <select id="productFilterSel" class="adm-filter-sel">
        <option value="all"       ${S.productFilter==="all"       ? "selected":""}>All (${S.products.length})</option>
        <option value="active"    ${S.productFilter==="active"    ? "selected":""}>Active</option>
        <option value="inactive"  ${S.productFilter==="inactive"  ? "selected":""}>Inactive</option>
        <option value="readymade" ${S.productFilter==="readymade" ? "selected":""}>Ready-Made</option>
        <option value="boutique"  ${S.productFilter==="boutique"  ? "selected":""}>Boutique</option>
      </select>
      <span class="adm-result-count">${visible.length} product${visible.length !== 1 ? "s" : ""}</span>
    </div>
    ${visible.length ? `<table class="adm-table">
      <thead><tr><th>Image</th><th>Title</th><th>Type</th><th>Categories</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${tableRows}</tbody></table>` : '<div class="adm-empty">No products match your search / filter.</div>'}`;

    // Bind toolbar
    list.querySelector("#productSearchInp")?.addEventListener("input", e => {
      S.productSearch = e.target.value;
      renderProducts();
    });
    list.querySelector("#productFilterSel")?.addEventListener("change", e => {
      S.productFilter = e.target.value;
      renderProducts();
    });

    list.querySelectorAll(".adm-btn-edit").forEach(b => b.addEventListener("click", () => openProductForm(+b.dataset.idx)));
    list.querySelectorAll(".adm-btn-del").forEach(b => b.addEventListener("click", () => deleteProduct(+b.dataset.idx)));
    list.querySelectorAll(".adm-btn-dup").forEach(b => b.addEventListener("click", () => duplicateProduct(+b.dataset.idx)));
  }

  function deleteProduct(idx) {
    const p = S.products[idx];
    if (!p) return;
    if (!confirm(`"${p.title || p.name}" delete karein?`)) return;
    S.products.splice(idx, 1);
    bustCatalogCaches();
    renderProducts();
    showToast("Product deleted. \"Generate JSON\" dabao aur commit karo.");
  }

  function duplicateProduct(idx) {
    const p = S.products[idx];
    if (!p) return;
    const copy = JSON.parse(JSON.stringify(p));
    copy.id    = slug(copy.title || "product") + "-copy-" + Date.now().toString(36);
    copy.title = (copy.title || copy.name || "") + " (Copy)";
    copy.name  = copy.title;
    copy.status = "inactive";
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = new Date().toISOString();
    S.products.splice(idx + 1, 0, copy);
    renderProducts();
    showToast("Product duplicated — edit and save to publish.");
    // Open the duplicate for editing
    openProductForm(idx + 1);
  }

  function openProductForm(idx) {
    S.editType = "product"; S.editItem = idx >= 0 ? S.products[idx] : null; S.editIdx = idx;
    const item = S.editItem || {};
    const currentType = item.productType || item.type || "readymade";
    const selectedCats = Array.isArray(item.categories) && item.categories.length ? item.categories : (item.category ? [item.category] : []);
    const catCheckboxes = S.categories.map(c => `
      <label class="adm-cat-cb-label">
        <input type="checkbox" name="categories" value="${esc(c.name)}" ${selectedCats.includes(c.name) ? "checked" : ""}>
        <span>${esc(c.name)}</span>
      </label>`).join("");
    el("admModalTitle").textContent = idx >= 0 ? "Edit Product" : "Add Product";
    el("admModalBody").innerHTML = `<div class="adm-form-grid">
      <div class="adm-fg adm-fg--full"><label>Product Title *</label><input type="text" name="title" value="${esc(item.title || item.name || "")}" placeholder="e.g. Woven Handloom Cotton Saree"></div>
      <div class="adm-fg adm-fg--full">
        <label>Product Type *</label>
        <div class="adm-type-toggle">
          <label class="adm-type-opt">
            <input type="radio" name="productType" value="readymade" ${currentType !== "boutique" ? "checked" : ""}>
            <span class="adm-type-opt-inner adm-type-opt--rm">🛍️ Ready-Made<small>Tayaar kapda — size/color choose karke order</small></span>
          </label>
          <label class="adm-type-opt">
            <input type="radio" name="productType" value="boutique" ${currentType === "boutique" ? "checked" : ""}>
            <span class="adm-type-opt-inner adm-type-opt--bt">✂️ Boutique Custom<small>Custom stitching — nap, design, fabric</small></span>
          </label>
        </div>
      </div>
      <div class="adm-fg adm-fg--full">
        <label>Categories <small>(ek ya zyada select karein)</small></label>
        <div class="adm-cat-cb-grid">${catCheckboxes}</div>
      </div>
      <div class="adm-fg"><label>Price (₹)</label><input type="number" name="price" value="${item.price || ""}" min="0" placeholder="349"></div>
      <div class="adm-fg"><label>Stock Quantity</label><input type="number" name="stock" value="${item.stock !== undefined ? item.stock : ""}" min="0" placeholder="0 = out of stock"></div>
      <div class="adm-fg"><label>Status</label><select name="status"><option value="active" ${item.status !== "inactive" ? "selected" : ""}>Active</option><option value="inactive" ${item.status === "inactive" ? "selected" : ""}>Inactive</option><option value="out-of-stock" ${item.status === "out-of-stock" ? "selected" : ""}>Out of Stock</option></select></div>
      <div class="adm-fg adm-fg--check"><label><input type="checkbox" name="featured" ${item.featured ? "checked" : ""}> Featured Product</label></div>
      <div class="adm-fg adm-fg--full"><label>Short Description</label><textarea name="shortDescription" rows="2" placeholder="Brief product description...">${esc(item.shortDescription || "")}</textarea></div>
      <div class="adm-fg adm-fg--full">${makeImgPicker("image", item.image || "", "Main Image", "Cover photo jo shop mein dikhegi")}</div>
      <div class="adm-fg adm-fg--full">
        <label>Saari Images <small>(upload karo — turant Cloudinary ya server par save hoti hain)</small></label>
        ${makeMultiImgPicker(item.images || [])}
      </div>
      <div class="adm-fg adm-fg--full"><label>Available Colors <small>(one per line)</small></label><textarea name="colors" rows="3" placeholder="Black &amp; Maroon&#10;Royal Blue &amp; Green">${(item.colors || []).join("\n")}</textarea></div>
      <div class="adm-fg adm-fg--full"><label>Available Sizes <small>(one per line)</small></label><textarea name="sizes" rows="3" placeholder="S&#10;M&#10;L&#10;XL">${(item.sizes || []).join("\n")}</textarea></div>
      <div class="adm-fg adm-fg--full"><label>Features <small>(one per line, start with ✔)</small></label><textarea name="features" rows="4" placeholder="✔ Premium quality&#10;✔ Comfortable fit">${(item.features || []).join("\n")}</textarea></div>
      <div class="adm-fg adm-fg--full"><label>Tags <small>(one per line)</small></label><textarea name="tags" rows="3" placeholder="Saree&#10;Handloom">${(item.tags || []).join("\n")}</textarea></div>

      <div class="adm-fg adm-fg--full" style="border-top:2px solid #f0ebe3;padding-top:1.25rem;margin-top:.25rem">
        <label style="font-weight:700;color:#be6b72;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase">✨ Outfit Builder Fields</label>
        <p style="font-size:.72rem;color:#9e8a7a;margin:.25rem 0 0;font-family:'Montserrat',sans-serif">Ye fields outfit-builder.html aur "Complete The Look" section ke liye hain.</p>
      </div>
      <div class="adm-fg">
        <label>Outfit Category <small>(outfit slot)</small></label>
        <select name="outfitCategory">
          <option value="">— Select —</option>
          <option value="sarees"      ${item.outfitCategory === "sarees"      ? "selected" : ""}>👘 Sarees</option>
          <option value="blouses"     ${item.outfitCategory === "blouses"     ? "selected" : ""}>👚 Blouses</option>
          <option value="kurtis"      ${item.outfitCategory === "kurtis"      ? "selected" : ""}>👗 Kurtis / Sets</option>
          <option value="lehengas"    ${item.outfitCategory === "lehengas"    ? "selected" : ""}>💃 Lehengas</option>
          <option value="dupattas"    ${item.outfitCategory === "dupattas"    ? "selected" : ""}>🧣 Dupattas</option>
          <option value="accessories" ${item.outfitCategory === "accessories" ? "selected" : ""}>💍 Accessories</option>
          <option value="kids"        ${item.outfitCategory === "kids"        ? "selected" : ""}>👧 Kids Wear</option>
        </select>
      </div>
      <div class="adm-fg">
        <label>Occasions <small>(one per line: wedding, reception, festival, party, casual, office)</small></label>
        <textarea name="occasions" rows="3" placeholder="festival&#10;casual&#10;office">${(item.occasions || []).join("\n")}</textarea>
      </div>
      <div class="adm-fg">
        <label>Suggested Products <small>(product IDs for "Complete The Look", one per line)</small></label>
        <textarea name="suggestedProducts" rows="2" placeholder="product-id-1&#10;product-id-2">${(item.suggestedProducts || []).join("\n")}</textarea>
      </div>
      <div class="adm-fg">
        <label>Compatible With <small>(product IDs that pair well, one per line)</small></label>
        <textarea name="compatibleWith" rows="2" placeholder="product-id-1">${(item.compatibleWith || []).join("\n")}</textarea>
      </div>
    </div>`;
    el("admEditModal").hidden = false;
    attachImgPickerListeners(el("admModalBody"));
  }

  function collectProductForm() {
    const f = el("admModalBody");
    const v = n => fv(f, n); const ls = n => lines(v(n)); const cb = n => fcb(f, n);
    const ex = S.editItem || {};
    const pType = f.querySelector('[name="productType"]:checked')?.value || ex.productType || "readymade";
    const selectedCategories = Array.from(f.querySelectorAll('[name="categories"]:checked')).map(cb => cb.value);
    const multiImgs = Array.from(f.querySelectorAll('[name="images[]"]'))
      .map(i => i.value.trim()).filter(u => u && !u.startsWith("⏳"));
    return {
      ...ex,
      id: ex.id || slug(v("title")) || uid(),
      title: v("title"), name: v("title"),
      categories: selectedCategories,
      category: selectedCategories[0] || ex.category || "",
      productType: pType,
      type: pType,
      price: parseFloat(v("price")) || 0,
      stock: v("stock") !== "" ? parseInt(v("stock"), 10) : (ex.stock !== undefined ? ex.stock : 0),
      status: v("status"), featured: cb("featured"),
      shortDescription: v("shortDescription"),
      image: v("image") || multiImgs[0] || "",
      images: multiImgs, colors: ls("colors"), sizes: ls("sizes"),
      features: ls("features"), tags: ls("tags"),
      outfitCategory: v("outfitCategory"),
      occasions: ls("occasions"),
      suggestedProducts: ls("suggestedProducts"),
      compatibleWith: ls("compatibleWith"),
      createdAt: ex.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /* ─────────────────────────────────────────────
     CATEGORIES
  ───────────────────────────────────────────── */
  function renderCategories() {
    const list = el("admCategoriesList");
    if (!list) return;
    if (!S.categories.length) {
      list.innerHTML = sheetsConnectedBanner() + '<div class="adm-empty">No categories yet. Click "+ Add Category" to create one.</div>';
      return;
    }
    list.innerHTML = sheetsConnectedBanner() + `<table class="adm-table">
      <thead><tr><th>Name</th><th>Slug / ID</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${S.categories.map((c, i) => `
        <tr>
          <td><strong>${esc(c.name)}</strong></td>
          <td><code>${esc(c.slug || c.id)}</code></td>
          <td>${esc(c.description || "")}</td>
          <td><span class="adm-badge ${c.status !== "inactive" ? "adm-badge--green" : "adm-badge--grey"}">${c.status || "active"}</span></td>
          <td class="adm-actions">
            <button class="adm-btn-sm adm-btn-edit" data-idx="${i}">✏️ Edit</button>
            <button class="adm-btn-sm adm-btn-del"  data-idx="${i}">🗑️</button>
          </td>
        </tr>`).join("")}
      </tbody></table>`;
    list.querySelectorAll(".adm-btn-edit").forEach(b => b.addEventListener("click", () => openCategoryForm(+b.dataset.idx)));
    list.querySelectorAll(".adm-btn-del").forEach(b => b.addEventListener("click", () => deleteCategory(+b.dataset.idx)));
  }

  function deleteCategory(idx) {
    const c = S.categories[idx];
    if (!c) return;
    if (!confirm(`"${c.name}" delete karein?`)) return;
    S.categories.splice(idx, 1);
    bustCatalogCaches();
    renderCategories();
    showToast("Category deleted. \"Generate JSON\" dabao aur commit karo.");
  }

  function openCategoryForm(idx) {
    S.editType = "category"; S.editItem = idx >= 0 ? S.categories[idx] : null; S.editIdx = idx;
    const item = S.editItem || {};
    el("admModalTitle").textContent = idx >= 0 ? "Edit Category" : "Add Category";
    el("admModalBody").innerHTML = `<div class="adm-form-grid">
      <div class="adm-fg adm-fg--full"><label>Category Name *</label><input type="text" name="name" value="${esc(item.name || "")}" placeholder="e.g. Sarees"></div>
      <div class="adm-fg adm-fg--full"><label>Description</label><textarea name="description" rows="2" placeholder="What this category contains...">${esc(item.description || "")}</textarea></div>
      <div class="adm-fg"><label>Status</label><select name="status"><option value="active" ${item.status !== "inactive" ? "selected" : ""}>Active</option><option value="inactive" ${item.status === "inactive" ? "selected" : ""}>Inactive</option></select></div>
    </div>`;
    el("admEditModal").hidden = false;
  }

  function collectCategoryForm() {
    const f = el("admModalBody"); const v = n => fv(f, n); const ex = S.editItem || {};
    const name = v("name");
    return { ...ex, id: ex.id || slug(name) || uid(), name, slug: ex.slug || slug(name), description: v("description"), status: v("status") };
  }

  /* ─────────────────────────────────────────────
     GALLERY
  ───────────────────────────────────────────── */
  function renderGallery() {
    const list = el("admGalleryList");
    if (!S.gallery.length) { list.innerHTML = '<div class="adm-empty">No gallery items yet. Click "+ Add Item" to create one.</div>'; return; }
    list.innerHTML = `<table class="adm-table">
      <thead><tr><th>Image</th><th>Title</th><th>Category</th><th>Layout</th><th>Featured</th><th>Actions</th></tr></thead>
      <tbody>${S.gallery.map((g, i) => `
        <tr>
          <td><img src="${esc(g.image || "")}" class="adm-table-img" onerror="this.style.display='none'"></td>
          <td><strong>${esc(g.title || "—")}</strong></td>
          <td><span class="adm-tag">${esc(g.category || "—")}</span></td>
          <td>${esc(g.layout || "default")}</td>
          <td>${g.featured ? "⭐" : "—"}</td>
          <td class="adm-actions">
            <button class="adm-btn-sm adm-btn-edit" data-idx="${i}">✏️ Edit</button>
            <button class="adm-btn-sm adm-btn-del"  data-idx="${i}">🗑️</button>
          </td>
        </tr>`).join("")}
      </tbody></table>`;
    list.querySelectorAll(".adm-btn-edit").forEach(b => b.addEventListener("click", () => openGalleryForm(+b.dataset.idx)));
    list.querySelectorAll(".adm-btn-del").forEach(b => b.addEventListener("click", () => {
      if (confirm("Delete this gallery item?")) { S.gallery.splice(+b.dataset.idx, 1); renderGallery(); showToast("Gallery item deleted."); }
    }));
  }

  function openGalleryForm(idx) {
    S.editType = "gallery"; S.editItem = idx >= 0 ? S.gallery[idx] : null; S.editIdx = idx;
    const item = S.editItem || {};
    el("admModalTitle").textContent = idx >= 0 ? "Edit Gallery Item" : "Add Gallery Item";
    el("admModalBody").innerHTML = `<div class="adm-form-grid">
      <div class="adm-fg adm-fg--full"><label>Title *</label><input type="text" name="title" value="${esc(item.title || "")}" placeholder="e.g. Designer Blouse"></div>
      <div class="adm-fg"><label>Category</label><input type="text" name="category" value="${esc(item.category || "")}" placeholder="e.g. Blouse"></div>
      <div class="adm-fg"><label>Layout</label><select name="layout"><option value="default" ${!item.layout || item.layout === "default" ? "selected" : ""}>Default</option><option value="tall" ${item.layout === "tall" ? "selected" : ""}>Tall</option><option value="wide" ${item.layout === "wide" ? "selected" : ""}>Wide</option></select></div>
      <div class="adm-fg adm-fg--check"><label><input type="checkbox" name="featured" ${item.featured ? "checked" : ""}> Featured</label></div>
      <div class="adm-fg adm-fg--full">${makeImgPicker("image", item.image || "", "Image", "URL type karo ya photo upload karo")}</div>
      <div class="adm-fg adm-fg--full"><label>Alt Text <small>(for accessibility)</small></label><input type="text" name="alt" value="${esc(item.alt || "")}" placeholder="Short image description"></div>
      <div class="adm-fg adm-fg--full"><label>Short Description</label><textarea name="shortDescription" rows="2">${esc(item.shortDescription || "")}</textarea></div>
      <div class="adm-fg adm-fg--full"><label>Tags <small>(one per line)</small></label><textarea name="tags" rows="2">${(item.tags || []).join("\n")}</textarea></div>
      <div class="adm-fg adm-fg--full"><label>WhatsApp Enquiry Message</label><textarea name="whatsappMessage" rows="2" placeholder="Hello, I am interested in this design...">${esc(item.whatsappMessage || "")}</textarea></div>
    </div>`;
    el("admEditModal").hidden = false;
    attachImgPickerListeners(el("admModalBody"));
  }

  function collectGalleryForm() {
    const f = el("admModalBody"); const v = n => fv(f, n); const cb = n => fcb(f, n); const ex = S.editItem || {};
    const title = v("title");
    return { ...ex, id: ex.id || slug(title) || uid(), title, category: v("category"), image: v("image"), alt: v("alt"), layout: v("layout"), featured: cb("featured"), shortDescription: v("shortDescription"), tags: lines(v("tags")), whatsappMessage: v("whatsappMessage") };
  }

  /* ─────────────────────────────────────────────
     NOTIFICATIONS
  ───────────────────────────────────────────── */
  function renderNotifications() {
    const list = el("admNotificationsList");
    if (!S.notifications.length) { list.innerHTML = '<div class="adm-empty">No notifications yet. Click "+ Add Notification" to create one.</div>'; return; }
    list.innerHTML = `<table class="adm-table">
      <thead><tr><th>Title</th><th>Scope</th><th>Priority</th><th>Popup</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${S.notifications.map((n, i) => `
        <tr>
          <td><strong>${esc(n.title || "—")}</strong><br><small>${esc(n.message || "").slice(0, 60)}…</small></td>
          <td><span class="adm-tag">${esc(n.scope || "—")}</span></td>
          <td><span class="adm-badge ${n.priority === "important" ? "adm-badge--orange" : "adm-badge--grey"}">${n.priority || "normal"}</span></td>
          <td>${n.showAsPopup ? "✅" : "—"}</td>
          <td><span class="adm-badge ${n.status !== "inactive" ? "adm-badge--green" : "adm-badge--grey"}">${n.status || "active"}</span></td>
          <td class="adm-actions">
            <button class="adm-btn-sm adm-btn-edit" data-idx="${i}">✏️ Edit</button>
            <button class="adm-btn-sm adm-btn-del"  data-idx="${i}">🗑️</button>
          </td>
        </tr>`).join("")}
      </tbody></table>`;
    list.querySelectorAll(".adm-btn-edit").forEach(b => b.addEventListener("click", () => openNotifForm(+b.dataset.idx)));
    list.querySelectorAll(".adm-btn-del").forEach(b => b.addEventListener("click", () => {
      if (confirm("Delete this notification?")) { S.notifications.splice(+b.dataset.idx, 1); renderNotifications(); showToast("Notification deleted."); }
    }));
  }

  function openNotifForm(idx) {
    S.editType = "notification"; S.editItem = idx >= 0 ? S.notifications[idx] : null; S.editIdx = idx;
    const item = S.editItem || {};
    const scopes = ["homepage","popup","admin","course","product"];
    el("admModalTitle").textContent = idx >= 0 ? "Edit Notification" : "Add Notification";
    el("admModalBody").innerHTML = `<div class="adm-form-grid">
      <div class="adm-fg adm-fg--full"><label>Title *</label><input type="text" name="title" value="${esc(item.title || "")}" placeholder="Notification title"></div>
      <div class="adm-fg adm-fg--full"><label>Message *</label><textarea name="message" rows="3" placeholder="Notification message shown to users...">${esc(item.message || "")}</textarea></div>
      <div class="adm-fg"><label>Scope <small>(where it appears)</small></label><select name="scope">${scopes.map(s => `<option value="${s}" ${item.scope === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      <div class="adm-fg"><label>Priority</label><select name="priority"><option value="normal" ${item.priority !== "important" ? "selected" : ""}>Normal</option><option value="important" ${item.priority === "important" ? "selected" : ""}>Important</option></select></div>
      <div class="adm-fg"><label>Status</label><select name="status"><option value="active" ${item.status !== "inactive" ? "selected" : ""}>Active</option><option value="inactive" ${item.status === "inactive" ? "selected" : ""}>Inactive</option></select></div>
      <div class="adm-fg"><label>Category</label><input type="text" name="category" value="${esc(item.category || "General Update")}" placeholder="General Update"></div>
      <div class="adm-fg"><label>Button Label</label><input type="text" name="ctaLabel" value="${esc(item.ctaLabel || "")}" placeholder="e.g. View Now"></div>
      <div class="adm-fg"><label>Button URL</label><input type="text" name="ctaUrl" value="${esc(item.ctaUrl || "")}" placeholder="shop.html or https://..."></div>
      <div class="adm-fg adm-fg--full">${makeImgPicker("image", item.image || "assets/logo.png", "Image", "URL type karo ya file upload karo")}</div>
      <div class="adm-fg adm-fg--check"><label><input type="checkbox" name="showAsPopup" ${item.showAsPopup ? "checked" : ""}> Show as Popup on page load</label></div>
      <div class="adm-fg adm-fg--check"><label><input type="checkbox" name="dismissible" ${item.dismissible !== false ? "checked" : ""}> Dismissible (user can close it)</label></div>
    </div>`;
    el("admEditModal").hidden = false;
    attachImgPickerListeners(el("admModalBody"));
  }

  function collectNotifForm() {
    const f = el("admModalBody"); const v = n => fv(f, n); const cb = n => fcb(f, n); const ex = S.editItem || {};
    const now = new Date().toISOString();
    return { ...ex, id: ex.id || slug(v("title")) || uid(), title: v("title"), message: v("message"), scope: v("scope"), category: v("category"), priority: v("priority"), status: v("status"), ctaLabel: v("ctaLabel"), ctaUrl: v("ctaUrl"), image: v("image"), showAsPopup: cb("showAsPopup"), dismissible: cb("dismissible"), audience: ex.audience || "All Users", deliveryMethod: ex.deliveryMethod || "Website Notification", startAt: ex.startAt || "", endAt: ex.endAt || "", createdAt: ex.createdAt || now, updatedAt: now };
  }

  /* ─────────────────────────────────────────────
     WEBSITE SETTINGS
  ───────────────────────────────────────────── */
  function renderWebsite() {
    const s = S.settings; const c = S.config;
    const socials = ["instagram","facebook","youtube","whatsapp","telegram","pinterest","twitter","linkedin"];
    el("admWebsiteForm").innerHTML = `
      <div class="adm-settings-section">
        <h3>🏪 Store Information</h3>
        <div class="adm-form-grid">
          <div class="adm-fg adm-fg--full"><label>Store Name</label><input type="text" name="siteName" value="${esc(s.siteName || "")}"></div>
          <div class="adm-fg adm-fg--full"><label>Tagline</label><input type="text" name="tagline" value="${esc(s.tagline || "")}"></div>
          <div class="adm-fg adm-fg--full"><label>Description</label><textarea name="description" rows="2">${esc(s.description || "")}</textarea></div>
          <div class="adm-fg adm-fg--full"><label>Footer Text</label><input type="text" name="footerText" value="${esc(s.footerText || "")}"></div>
        </div>
      </div>
      <div class="adm-settings-section">
        <h3>📞 Contact Information</h3>
        <div class="adm-form-grid">
          <div class="adm-fg"><label>Display Phone</label><input type="text" name="contactPhone" value="${esc(s.contact?.phone || "")}" placeholder="+91 76938 49472"></div>
          <div class="adm-fg"><label>WhatsApp Number <small>(with country code, no +)</small></label><input type="text" name="ownerPhone" value="${esc(c.ownerPhone || "")}" placeholder="917693849472"></div>
          <div class="adm-fg"><label>Email</label><input type="email" name="contactEmail" value="${esc(s.contact?.email || "")}"></div>
          <div class="adm-fg adm-fg--full"><label>Address</label><input type="text" name="contactAddress" value="${esc(s.contact?.address || "")}"></div>
          <div class="adm-fg adm-fg--full"><label>Business Hours</label><input type="text" name="contactHours" value="${esc(s.contact?.hours || "")}" placeholder="Mon - Sat · 10 AM - 7 PM"></div>
        </div>
      </div>
      <div class="adm-settings-section">
        <h3>💳 Payment Settings</h3>
        <div class="adm-form-grid">
          <div class="adm-fg"><label>UPI ID</label><input type="text" name="upiId" value="${esc(c.upiId || "")}" placeholder="yourname@upi"></div>
          <div class="adm-fg"><label>UPI Account Name</label><input type="text" name="upiName" value="${esc(c.upiName || "")}"></div>
          <div class="adm-fg"><label>UPI Phone</label><input type="text" name="upiPhone" value="${esc(c.upiPhone || "")}"></div>
        </div>
      </div>
      <div class="adm-settings-section">
        <h3>🏠 Homepage Banner</h3>
        <div class="adm-form-grid">
          <div class="adm-fg adm-fg--full"><label>Eyebrow Text <small>(small line above the title)</small></label><input type="text" name="bannerEyebrow" value="${esc(s.homepageBanner?.eyebrow || "")}"></div>
          <div class="adm-fg adm-fg--full"><label>Main Title</label><input type="text" name="bannerTitle" value="${esc(s.homepageBanner?.title || "")}"></div>
          <div class="adm-fg adm-fg--full"><label>Description</label><textarea name="bannerDescription" rows="2">${esc(s.homepageBanner?.description || "")}</textarea></div>
          <div class="adm-fg adm-fg--full"><label>Background Image URL</label><input type="text" name="bannerImage" value="${esc(s.homepageBanner?.image || "assets/hero-bg.jpg")}"></div>
          <div class="adm-fg"><label>Primary Button Text</label><input type="text" name="bannerPrimaryText" value="${esc(s.homepageBanner?.primaryButtonText || "")}"></div>
          <div class="adm-fg"><label>Primary Button URL</label><input type="text" name="bannerPrimaryUrl" value="${esc(s.homepageBanner?.primaryButtonUrl || "")}"></div>
          <div class="adm-fg"><label>Secondary Button Text</label><input type="text" name="bannerSecondaryText" value="${esc(s.homepageBanner?.secondaryButtonText || "")}"></div>
          <div class="adm-fg"><label>Secondary Button URL</label><input type="text" name="bannerSecondaryUrl" value="${esc(s.homepageBanner?.secondaryButtonUrl || "")}"></div>
          <div class="adm-fg"><label>Highlight Label</label><input type="text" name="bannerHighlightLabel" value="${esc(s.homepageBanner?.highlightLabel || "")}"></div>
          <div class="adm-fg"><label>Highlight Text</label><input type="text" name="bannerHighlightText" value="${esc(s.homepageBanner?.highlightText || "")}"></div>
        </div>
      </div>
      <div class="adm-settings-section">
        <h3>🔗 Social Links</h3>
        <div class="adm-form-grid">
          ${socials.map(net => `<div class="adm-fg"><label>${net.charAt(0).toUpperCase()+net.slice(1)}</label><input type="text" name="social_${net}" value="${esc(s.socialLinks?.[net] || "")}" placeholder="https://..."></div>`).join("")}
        </div>
      </div>`;
  }

  function collectWebsiteForm() {
    const f = el("admWebsiteForm"); const v = n => fv(f, n);
    const socials = ["instagram","facebook","youtube","whatsapp","telegram","pinterest","twitter","linkedin"];
    const socialLinks = {}; socials.forEach(n => { socialLinks[n] = v("social_" + n); }); socialLinks.showInFooter = S.settings.socialLinks?.showInFooter !== false;
    const ownerPhone = v("ownerPhone").replace(/\D/g,"");
    const newSettings = { ...S.settings, siteName: v("siteName"), tagline: v("tagline"), description: v("description"), footerText: v("footerText"), contact: { ...S.settings.contact, phone: v("contactPhone"), phoneHref: "+" + ownerPhone, email: v("contactEmail"), address: v("contactAddress"), hours: v("contactHours"), whatsappNumber: v("contactPhone"), whatsappUrl: ownerPhone ? "https://wa.me/" + ownerPhone : (S.settings.contact?.whatsappUrl || "") }, homepageBanner: { eyebrow: v("bannerEyebrow"), title: v("bannerTitle"), description: v("bannerDescription"), image: v("bannerImage"), primaryButtonText: v("bannerPrimaryText"), primaryButtonUrl: v("bannerPrimaryUrl"), secondaryButtonText: v("bannerSecondaryText"), secondaryButtonUrl: v("bannerSecondaryUrl"), highlightLabel: v("bannerHighlightLabel"), highlightText: v("bannerHighlightText") }, socialLinks, updatedAt: new Date().toISOString() };
    const newConfig = { ...S.config, storeName: v("siteName"), ownerPhone: v("ownerPhone"), upiId: v("upiId"), upiName: v("upiName"), upiPhone: v("upiPhone") };
    return { settings: newSettings, config: newConfig };
  }

  /* ─────────────────────────────────────────────
     THEME & SEO
  ───────────────────────────────────────────── */
  function renderTheme() {
    const theme = S.settings.theme || {}; const seo = S.settings.seo || {};
    el("admThemeForm").innerHTML = `
      <div class="adm-settings-section">
        <h3>🎨 Brand Colors</h3>
        <p class="adm-hint-text">These colors are applied as CSS variables across the website. After generating code, paste it into <code>data/settings.json</code>.</p>
        <div class="adm-form-grid">
          <div class="adm-fg">
            <label>Primary Color <small>(buttons, highlights)</small></label>
            <div class="adm-color-row">
              <input type="color" id="pcPicker" value="${theme.primaryColor || "#be6b72"}">
              <input type="text" name="primaryColor" value="${theme.primaryColor || "#be6b72"}" placeholder="#be6b72" class="adm-color-text">
            </div>
          </div>
          <div class="adm-fg">
            <label>Secondary Color <small>(dark backgrounds, text)</small></label>
            <div class="adm-color-row">
              <input type="color" id="scPicker" value="${theme.secondaryColor || "#100d0b"}">
              <input type="text" name="secondaryColor" value="${theme.secondaryColor || "#100d0b"}" placeholder="#100d0b" class="adm-color-text">
            </div>
          </div>
        </div>
        <div class="adm-theme-preview">
          <div class="adm-swatch" id="swatchPrimary" style="background:${theme.primaryColor || "#be6b72"}">Primary Color</div>
          <div class="adm-swatch adm-swatch--dark" id="swatchSecondary" style="background:${theme.secondaryColor || "#100d0b"}">Secondary Color</div>
        </div>
      </div>
      <div class="adm-settings-section">
        <h3>🔍 SEO Settings</h3>
        <div class="adm-form-grid">
          <div class="adm-fg adm-fg--full"><label>Page Title</label><input type="text" name="seoTitle" value="${esc(seo.metaTitle || "")}" placeholder="RD Advance Boutique | Luxury Tailoring"></div>
          <div class="adm-fg adm-fg--full"><label>Meta Description <small>(shown in Google results)</small></label><textarea name="seoDesc" rows="2" placeholder="Describe your boutique in 1-2 sentences...">${esc(seo.metaDescription || "")}</textarea></div>
          <div class="adm-fg adm-fg--full"><label>Keywords <small>(comma separated)</small></label><input type="text" name="seoKeywords" value="${esc(seo.metaKeywords || "")}" placeholder="boutique, sarees, stitching, Damoh"></div>
          <div class="adm-fg"><label>Google Analytics ID</label><input type="text" name="gaId" value="${esc(seo.googleAnalyticsId || "")}" placeholder="G-XXXXXXXXXX"></div>
          <div class="adm-fg"><label>Robots</label><select name="robots"><option value="index, follow" ${seo.robots !== "noindex, nofollow" ? "selected" : ""}>index, follow (Recommended)</option><option value="noindex, nofollow" ${seo.robots === "noindex, nofollow" ? "selected" : ""}>noindex, nofollow (Hide from Google)</option></select></div>
        </div>
      </div>`;
    const syncColor = (pickerId, textName, swatchId) => {
      const picker = el(pickerId);
      const text   = el("admThemeForm").querySelector(`[name="${textName}"]`);
      const swatch = el(swatchId);
      picker?.addEventListener("input", () => { text.value = picker.value; if (swatch) swatch.style.background = picker.value; });
      text?.addEventListener("input", () => { if (/^#[0-9a-f]{6}$/i.test(text.value)) { picker.value = text.value; if (swatch) swatch.style.background = text.value; } });
    };
    syncColor("pcPicker", "primaryColor", "swatchPrimary");
    syncColor("scPicker", "secondaryColor", "swatchSecondary");
  }

  function collectThemeForm() {
    const f = el("admThemeForm"); const v = n => fv(f, n);
    return {
      theme: { primaryColor: v("primaryColor"), secondaryColor: v("secondaryColor") },
      seo: { ...S.settings.seo, metaTitle: v("seoTitle"), metaDescription: v("seoDesc"), metaKeywords: v("seoKeywords"), googleAnalyticsId: v("gaId"), robots: v("robots"), googleIndexing: !v("robots").includes("noindex") },
    };
  }

  /* ─────────────────────────────────────────────
     SETTINGS / CONFIG SECTION
  ───────────────────────────────────────────── */
  function renderConfigSection() {
    const cldName   = S.config.cloudinaryCloudName   || "";
    const cldPreset = S.config.cloudinaryUploadPreset || "";
    const cldReady  = !!(cldName && cldPreset);

    el("admConfigForm").innerHTML = `
      <div class="adm-settings-section">
        <h3>🔐 Admin PIN</h3>
        <div class="adm-form-grid">
          <div class="adm-fg">
            <label>New Manager PIN <small>(leave blank to keep current)</small></label>
            <input type="text" name="managerPin" value="" placeholder="New PIN">
          </div>
        </div>
        <p class="adm-hint-text">⚠️ PIN change karne ke baad <strong>Save Changes</strong> dabao, phir <strong>Generate Config JSON</strong> dabao aur <code>data/config.json</code> mein paste karke GitHub commit karo.</p>
      </div>

      <div class="adm-settings-section">
        <h3>🖼️ Image Hosting (Cloudinary)</h3>
        <div class="adm-info-box" style="margin-bottom:14px">
          <p><strong>Status:</strong> <span style="color:${cldReady ? "#27ae60" : "#c0392b"};font-weight:700">${cldReady ? "🟢 Configured" : "⚡ Not Configured"}</span></p>
          <br>
          <p>When configured, product photos upload directly to Cloudinary (free CDN) — no GitHub commits needed for images.</p>
          <p style="margin-top:.5rem"><strong>Fallback:</strong> If not configured, photos upload to the server's <code>assets/</code> folder.</p>
        </div>
        <div class="adm-form-grid">
          <div class="adm-fg">
            <label>Cloudinary Cloud Name</label>
            <input type="text" name="cloudinaryCloudName" value="${esc(cldName)}" placeholder="e.g. my-boutique-xyz">
            <p class="adm-hint-text">Found at <a href="https://cloudinary.com/console" target="_blank">cloudinary.com/console</a> → Dashboard → Cloud name</p>
          </div>
          <div class="adm-fg">
            <label>Unsigned Upload Preset</label>
            <input type="text" name="cloudinaryUploadPreset" value="${esc(cldPreset)}" placeholder="e.g. rd_boutique_unsigned">
            <p class="adm-hint-text">Settings → Upload → Upload presets → Add unsigned preset</p>
          </div>
        </div>
      </div>

      <div class="adm-settings-section">
        <h3>📋 How Products Now Work</h3>
        <div class="adm-info-box">
          <p>Products and categories are now managed via <strong>live API</strong>:</p>
          <br>
          <ol>
            <li>Open Products or Categories section</li>
            <li>Add / Edit / Delete — changes save directly to Google Sheets</li>
            <li>The website loads products from the API automatically (5-min cache)</li>
            <li>No JSON files, no GitHub commits, no redeployment needed</li>
          </ol>
          <br>
          <p><strong>Gallery, Notifications, Website Settings, Theme</strong> still use the Generate Code → paste to file flow.</p>
        </div>
      </div>`;
  }

  /* ─────────────────────────────────────────────
     CODE OUTPUT MODAL
  ───────────────────────────────────────────── */
  function showCodeModal(files) {
    let html = "";
    files.forEach((f, i) => {
      html += `<div class="adm-code-file${i > 0 ? " adm-code-file--mt" : ""}">
        <div class="adm-code-file-header">
          <span class="adm-code-filename">📁 Paste into: <strong>${esc(f.name)}</strong></span>
          <button class="adm-code-copy-btn" data-idx="${i}">📋 Copy</button>
        </div>
        <textarea class="adm-code-ta" readonly rows="14">${esc(JSON.stringify(f.data, null, 2))}</textarea>
      </div>`;
    });
    html += `<div class="adm-code-instructions">
      <strong>✅ How to apply:</strong> Copy the code above → open the file in your repository → replace the entire content → commit &amp; push. Changes go live automatically.
    </div>`;
    el("admCodeBody").innerHTML = html;
    el("admCodeModal").hidden = false;
    el("admCodeBody").querySelectorAll(".adm-code-copy-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const ta = btn.closest(".adm-code-file").querySelector(".adm-code-ta");
        navigator.clipboard.writeText(ta.value).then(() => {
          btn.textContent = "✅ Copied!";
          setTimeout(() => { btn.textContent = "📋 Copy"; }, 2000);
        }).catch(() => { ta.select(); document.execCommand("copy"); btn.textContent = "✅ Copied!"; setTimeout(() => { btn.textContent = "📋 Copy"; }, 2000); });
      });
    });
  }

  /* ─────────────────────────────────────────────
     EDIT MODAL – SAVE (API-powered for products/categories)
  ───────────────────────────────────────────── */
  async function handleModalSave() {
    const modalSaveBtn = el("admModalSave");
    const collectors = { product: collectProductForm, category: collectCategoryForm, gallery: collectGalleryForm, notification: collectNotifForm };
    const arrayMap   = { product: "products", category: "categories", gallery: "gallery", notification: "notifications" };
    const renderers  = { product: renderProducts, category: renderCategories, gallery: renderGallery, notification: renderNotifications };

    const collect = collectors[S.editType];
    if (!collect) return;
    const item = collect();
    if (!item.title && !item.name) { showToast("Please enter a name / title.", "error"); return; }

      /* Update local state */
    const arr = S[arrayMap[S.editType]];
    if (S.editIdx >= 0) arr[S.editIdx] = item;
    else arr.push(item);

    bustCatalogCaches();
    renderers[S.editType]?.();
    el("admEditModal").hidden = true;

    if (S.editType === "product") {
      showToast("✅ Saved! Ab \"Generate JSON\" dabao → copy karo → data/products.json mein paste karo → GitHub commit karo.");
    } else if (S.editType === "category") {
      showToast("✅ Saved! Ab \"Generate JSON\" dabao → copy karo → data/categories.json mein paste karo → GitHub commit karo.");
    }
  }

  /* ─────────────────────────────────────────────
     TOAST
  ───────────────────────────────────────────── */
  function showToast(msg, type) {
    const t = document.createElement("div");
    t.className = "adm-toast" + (type === "error" ? " adm-toast--error" : "");
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => { requestAnimationFrame(() => { t.classList.add("adm-toast--show"); }); });
    setTimeout(() => { t.classList.remove("adm-toast--show"); setTimeout(() => t.remove(), 350); }, 3200);
  }

  /* ─────────────────────────────────────────────
     ORDER TABS
  ───────────────────────────────────────────── */
  function setupOrderTabs() {
    document.querySelectorAll(".mg-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".mg-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        S.activeFilter = tab.dataset.filter;
        renderOrderList();
      });
    });
    document.querySelectorAll(".mg-stat[data-filter]").forEach(stat => {
      stat.style.cursor = "pointer";
      stat.addEventListener("click", () => {
        S.activeFilter = stat.dataset.filter;
        document.querySelectorAll(".mg-tab").forEach(t => t.classList.toggle("active", t.dataset.filter === S.activeFilter));
        renderOrderList();
      });
    });
  }

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  async function init() {
    if (!document.querySelector(".manage-page")) return;
    await loadAll();

    // Login
    el("mgLoginForm")?.addEventListener("submit", handleLogin);
    el("admLogout")?.addEventListener("click", handleLogout);

    // Sidebar nav
    document.querySelectorAll(".adm-nav-item").forEach(item => {
      item.addEventListener("click", () => showSection(item.dataset.section));
    });

    // Mobile menu toggle
    el("admMenuToggle")?.addEventListener("click", () => {
      el("admSidebar")?.classList.toggle("adm-sidebar--open");
    });

    // Edit modal
    el("admModalClose")?.addEventListener("click",  () => { el("admEditModal").hidden = true; });
    el("admModalCancel")?.addEventListener("click", () => { el("admEditModal").hidden = true; });
    el("admModalSave")?.addEventListener("click",   handleModalSave);
    el("admZipDownload")?.addEventListener("click", downloadImagesZip);
    el("admEditModal")?.addEventListener("click",   e => { if (e.target === el("admEditModal")) el("admEditModal").hidden = true; });

    // Code modal
    el("admCodeClose")?.addEventListener("click",   () => { el("admCodeModal").hidden = true; });
    el("admCodeModal")?.addEventListener("click",   e => { if (e.target === el("admCodeModal")) el("admCodeModal").hidden = true; });

    // Products — Add + Generate JSON
    el("btnAddProduct")?.addEventListener("click", () => openProductForm(-1));
    el("btnSyncProducts")?.addEventListener("click", async () => {
      const btn = el("btnSyncProducts");
      if (btn) { btn.textContent = "⏳ Reloading…"; btn.disabled = true; }
      try {
        const fresh = await fetchJ("data/products.json");
        S.products = Array.isArray(fresh) ? fresh : S.products;
        renderProducts();
        showToast("✅ Products reloaded from data/products.json");
      } catch (e) { showToast("Reload failed: " + e.message, "error"); }
      finally { if (btn) { btn.textContent = "🔄 Reload"; btn.disabled = false; } }
    });
    el("btnGenProducts")?.addEventListener("click", () => showCodeModal([{ name: "data/products.json", data: S.products }]));

    // Categories — Add + Generate JSON
    el("btnAddCategory")?.addEventListener("click", () => openCategoryForm(-1));
    el("btnSyncCategories")?.addEventListener("click", async () => {
      const btn = el("btnSyncCategories");
      if (btn) { btn.textContent = "⏳ Reloading…"; btn.disabled = true; }
      try {
        const fresh = await fetchJ("data/categories.json");
        S.categories = Array.isArray(fresh) ? fresh : S.categories;
        renderCategories();
        showToast("✅ Categories reloaded from data/categories.json");
      } catch (e) { showToast("Reload failed: " + e.message, "error"); }
      finally { if (btn) { btn.textContent = "🔄 Reload"; btn.disabled = false; } }
    });
    el("btnGenCategories")?.addEventListener("click", () => showCodeModal([{ name: "data/categories.json", data: S.categories }]));

    // Gallery
    el("btnAddGallery")?.addEventListener("click", () => openGalleryForm(-1));
    el("btnGenGallery")?.addEventListener("click", () => showCodeModal([{ name: "data/gallery.json", data: S.gallery }]));

    // Notifications
    el("btnAddNotification")?.addEventListener("click", () => openNotifForm(-1));
    el("btnGenNotifications")?.addEventListener("click", () => showCodeModal([{ name: "data/notifications.json", data: S.notifications }]));

    // Website settings
    el("btnSaveWebsite")?.addEventListener("click", () => {
      const { settings, config } = collectWebsiteForm();
      S.settings = settings; S.config = config;
      showToast("Website settings saved!");
    });
    el("btnGenSettings")?.addEventListener("click", () => {
      const { settings, config } = collectWebsiteForm();
      showCodeModal([{ name: "data/settings.json", data: settings }, { name: "data/config.json", data: config }]);
    });

    // Theme & SEO
    el("btnSaveTheme")?.addEventListener("click", () => {
      const { theme, seo } = collectThemeForm();
      S.settings = { ...S.settings, theme, seo };
      showToast("Theme & SEO saved!");
    });
    el("btnGenTheme")?.addEventListener("click", () => {
      const { theme, seo } = collectThemeForm();
      showCodeModal([{ name: "data/settings.json", data: { ...S.settings, theme, seo, updatedAt: new Date().toISOString() } }]);
    });

    // Config / Settings — update local state + show code modal to persist
    el("btnSaveConfig")?.addEventListener("click", () => {
      const f         = el("admConfigForm");
      const newPin    = fv(f, "managerPin");
      const cldName   = fv(f, "cloudinaryCloudName");
      const cldPreset = fv(f, "cloudinaryUploadPreset");

      if (newPin) S.config.managerPin = newPin;
      if (cldName)   S.config.cloudinaryCloudName    = cldName;
      if (cldPreset) S.config.cloudinaryUploadPreset = cldPreset;

      showToast("✅ Settings updated. \"Generate Config JSON\" dabao aur data/config.json mein paste karo.");
      renderConfigSection();
    });
    el("btnGenConfig")?.addEventListener("click", () => {
      const { managerPin, ...safeConfig } = S.config;
      showCodeModal([{ name: "data/config.json", data: { ...safeConfig, managerPin: S.config.managerPin || "" } }]);
    });

    // Orders
    el("mgRefreshBtn")?.addEventListener("click", () => { renderOrders(); showToast("Refreshing orders…"); });
    el("mgRetryBtn")?.addEventListener("click",   () => { renderOrders(); });
    setupOrderTabs();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
