(function () {
  "use strict";

  /* ─────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────── */
  const S = {
    config: {}, settings: {}, products: [], categories: [],
    gallery: [], notifications: [], orders: [],
    activeFilter: "all", editType: null, editItem: null, editIdx: -1,
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
      fetchJ("data/config.json"), fetchJ("data/settings.json"),
      fetchJ("data/products.json"), fetchJ("data/categories.json"),
      fetchJ("data/gallery.json"), fetchJ("data/notifications.json"),
    ]);
    S.config        = cfg   || {};
    S.settings      = set   || {};
    S.products      = pro   || [];
    S.categories    = cat   || [];
    S.gallery       = gal   || [];
    S.notifications = notif || [];
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
  async function handleLogin(e) {
    e.preventDefault();
    const pin = el("mgPin").value.trim();
    if (!pin) return;
    if (pin === String(S.config.managerPin || "1234")) {
      el("mgLoginScreen").hidden = true;
      el("mgApp").hidden = false;
      showSection("dashboard");
    } else {
      el("mgLoginErr").hidden = false;
      el("mgPin").select();
    }
  }

  function handleLogout() {
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

  function renderOrders() {
    S.orders = loadLocalOrders();
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
    showToast("Status updated to: " + newStatus);
  }

  /* ─────────────────────────────────────────────
     PRODUCTS
  ───────────────────────────────────────────── */
  function renderProducts() {
    const list = el("admProductsList");
    if (!S.products.length) {
      list.innerHTML = '<div class="adm-empty">No products yet. Click "+ Add Product" to create one.</div>';
      return;
    }
    list.innerHTML = `<table class="adm-table">
      <thead><tr><th>Image</th><th>Title</th><th>Category</th><th>Price</th><th>Status</th><th>Featured</th><th>Actions</th></tr></thead>
      <tbody>${S.products.map((p, i) => `
        <tr>
          <td><img src="${esc(p.image || (p.images && p.images[0]) || "")}" class="adm-table-img" onerror="this.style.display='none'"></td>
          <td><strong>${esc(p.title || p.name || "—")}</strong></td>
          <td><span class="adm-tag">${esc(p.category || "—")}</span></td>
          <td>${p.price ? "₹" + p.price : "—"}</td>
          <td><span class="adm-badge ${p.status !== "inactive" ? "adm-badge--green" : "adm-badge--grey"}">${p.status || "active"}</span></td>
          <td>${p.featured ? "⭐" : "—"}</td>
          <td class="adm-actions">
            <button class="adm-btn-sm adm-btn-edit" data-idx="${i}">✏️ Edit</button>
            <button class="adm-btn-sm adm-btn-del" data-idx="${i}">🗑️</button>
          </td>
        </tr>`).join("")}
      </tbody></table>`;
    list.querySelectorAll(".adm-btn-edit").forEach(b => b.addEventListener("click", () => openProductForm(+b.dataset.idx)));
    list.querySelectorAll(".adm-btn-del").forEach(b => b.addEventListener("click", () => {
      if (confirm("Delete this product?")) { S.products.splice(+b.dataset.idx, 1); renderProducts(); showToast("Product deleted. Generate code to apply."); }
    }));
  }

  function openProductForm(idx) {
    S.editType = "product"; S.editItem = idx >= 0 ? S.products[idx] : null; S.editIdx = idx;
    const item = S.editItem || {};
    const catOpts = S.categories.map(c => `<option value="${esc(c.name)}" ${item.category === c.name ? "selected" : ""}>${esc(c.name)}</option>`).join("");
    el("admModalTitle").textContent = idx >= 0 ? "Edit Product" : "Add Product";
    el("admModalBody").innerHTML = `<div class="adm-form-grid">
      <div class="adm-fg adm-fg--full"><label>Product Title *</label><input type="text" name="title" value="${esc(item.title || item.name || "")}" placeholder="e.g. Woven Handloom Cotton Saree"></div>
      <div class="adm-fg"><label>Category</label><select name="category"><option value="">— Select —</option>${catOpts}</select></div>
      <div class="adm-fg"><label>Price (₹)</label><input type="number" name="price" value="${item.price || ""}" min="0" placeholder="349"></div>
      <div class="adm-fg"><label>Status</label><select name="status"><option value="active" ${item.status !== "inactive" ? "selected" : ""}>Active</option><option value="inactive" ${item.status === "inactive" ? "selected" : ""}>Inactive</option></select></div>
      <div class="adm-fg adm-fg--check"><label><input type="checkbox" name="featured" ${item.featured ? "checked" : ""}> Featured Product</label></div>
      <div class="adm-fg adm-fg--full"><label>Short Description</label><textarea name="shortDescription" rows="2" placeholder="Brief product description...">${esc(item.shortDescription || "")}</textarea></div>
      <div class="adm-fg adm-fg--full"><label>Main Image URL</label><input type="text" name="image" value="${esc(item.image || "")}" placeholder="assets/product.jpg"></div>
      <div class="adm-fg adm-fg--full"><label>All Image URLs <small>(one per line)</small></label><textarea name="images" rows="4" placeholder="assets/img1.jpg&#10;assets/img2.jpg">${(item.images || []).join("\n")}</textarea></div>
      <div class="adm-fg adm-fg--full"><label>Available Colors <small>(one per line)</small></label><textarea name="colors" rows="3" placeholder="Black &amp; Maroon&#10;Royal Blue &amp; Green">${(item.colors || []).join("\n")}</textarea></div>
      <div class="adm-fg adm-fg--full"><label>Available Sizes <small>(one per line)</small></label><textarea name="sizes" rows="3" placeholder="S&#10;M&#10;L&#10;XL">${(item.sizes || []).join("\n")}</textarea></div>
      <div class="adm-fg adm-fg--full"><label>Features <small>(one per line, start with ✔)</small></label><textarea name="features" rows="4" placeholder="✔ Premium quality&#10;✔ Comfortable fit">${(item.features || []).join("\n")}</textarea></div>
      <div class="adm-fg adm-fg--full"><label>Tags <small>(one per line)</small></label><textarea name="tags" rows="3" placeholder="Saree&#10;Handloom">${(item.tags || []).join("\n")}</textarea></div>
    </div>`;
    el("admEditModal").hidden = false;
  }

  function collectProductForm() {
    const f = el("admModalBody");
    const v = n => fv(f, n); const ls = n => lines(v(n)); const cb = n => fcb(f, n);
    const ex = S.editItem || {};
    return {
      ...ex,
      id: ex.id || slug(v("title")) || uid(),
      title: v("title"), name: v("title"),
      category: v("category"),
      productType: ex.productType || "boutique", type: ex.type || "boutique",
      price: parseFloat(v("price")) || 0,
      status: v("status"), featured: cb("featured"),
      shortDescription: v("shortDescription"),
      image: v("image") || ls("images")[0] || "",
      images: ls("images"), colors: ls("colors"), sizes: ls("sizes"),
      features: ls("features"), tags: ls("tags"),
      createdAt: ex.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /* ─────────────────────────────────────────────
     CATEGORIES
  ───────────────────────────────────────────── */
  function renderCategories() {
    const list = el("admCategoriesList");
    if (!S.categories.length) { list.innerHTML = '<div class="adm-empty">No categories yet. Click "+ Add Category" to create one.</div>'; return; }
    list.innerHTML = `<table class="adm-table">
      <thead><tr><th>Name</th><th>Slug / ID</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${S.categories.map((c, i) => `
        <tr>
          <td><strong>${esc(c.name)}</strong></td>
          <td><code>${esc(c.slug || c.id)}</code></td>
          <td>${esc(c.description || "")}</td>
          <td><span class="adm-badge ${c.status !== "inactive" ? "adm-badge--green" : "adm-badge--grey"}">${c.status || "active"}</span></td>
          <td class="adm-actions">
            <button class="adm-btn-sm adm-btn-edit" data-idx="${i}">✏️ Edit</button>
            <button class="adm-btn-sm adm-btn-del" data-idx="${i}">🗑️</button>
          </td>
        </tr>`).join("")}
      </tbody></table>`;
    list.querySelectorAll(".adm-btn-edit").forEach(b => b.addEventListener("click", () => openCategoryForm(+b.dataset.idx)));
    list.querySelectorAll(".adm-btn-del").forEach(b => b.addEventListener("click", () => {
      if (confirm("Delete this category?")) { S.categories.splice(+b.dataset.idx, 1); renderCategories(); showToast("Category deleted."); }
    }));
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
            <button class="adm-btn-sm adm-btn-del" data-idx="${i}">🗑️</button>
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
      <div class="adm-fg adm-fg--full"><label>Image URL</label><input type="text" name="image" value="${esc(item.image || "")}" placeholder="assets/design1.jpg"></div>
      <div class="adm-fg adm-fg--full"><label>Alt Text <small>(for accessibility)</small></label><input type="text" name="alt" value="${esc(item.alt || "")}" placeholder="Short image description"></div>
      <div class="adm-fg adm-fg--full"><label>Short Description</label><textarea name="shortDescription" rows="2">${esc(item.shortDescription || "")}</textarea></div>
      <div class="adm-fg adm-fg--full"><label>Tags <small>(one per line)</small></label><textarea name="tags" rows="2">${(item.tags || []).join("\n")}</textarea></div>
      <div class="adm-fg adm-fg--full"><label>WhatsApp Enquiry Message</label><textarea name="whatsappMessage" rows="2" placeholder="Hello, I am interested in this design...">${esc(item.whatsappMessage || "")}</textarea></div>
    </div>`;
    el("admEditModal").hidden = false;
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
            <button class="adm-btn-sm adm-btn-del" data-idx="${i}">🗑️</button>
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
      <div class="adm-fg adm-fg--full"><label>Image URL</label><input type="text" name="image" value="${esc(item.image || "assets/logo.png")}" placeholder="assets/logo.png"></div>
      <div class="adm-fg adm-fg--check"><label><input type="checkbox" name="showAsPopup" ${item.showAsPopup ? "checked" : ""}> Show as Popup on page load</label></div>
      <div class="adm-fg adm-fg--check"><label><input type="checkbox" name="dismissible" ${item.dismissible !== false ? "checked" : ""}> Dismissible (user can close it)</label></div>
    </div>`;
    el("admEditModal").hidden = false;
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
    // Color picker sync
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
    el("admConfigForm").innerHTML = `
      <div class="adm-settings-section">
        <h3>🔐 Admin PIN</h3>
        <div class="adm-form-grid">
          <div class="adm-fg">
            <label>Manager PIN <small>(used to log in to this panel)</small></label>
            <input type="text" name="managerPin" value="${esc(S.config.managerPin || "1234")}" placeholder="1234">
          </div>
        </div>
        <p class="adm-hint-text">⚠️ After changing the PIN and generating code, paste the new <code>data/config.json</code> into your repository. Your next login will use the new PIN.</p>
      </div>
      <div class="adm-settings-section">
        <h3>📋 How This Panel Works</h3>
        <div class="adm-info-box">
          <p>This admin panel loads your website data and lets you manage everything from one place. Since your site is hosted as static files on GitHub, changes don't save automatically.</p>
          <br>
          <p><strong>To apply any change:</strong></p>
          <ol>
            <li>Make your edits in any section</li>
            <li>Click <strong>"Save Changes"</strong> (saves in memory for this session)</li>
            <li>Click <strong>"📋 Generate Code"</strong></li>
            <li>Copy the code shown in the popup</li>
            <li>Open the matching <code>data/</code> file in your GitHub repository</li>
            <li>Replace its entire content with your copied code</li>
            <li>Commit and push — your site updates automatically</li>
          </ol>
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
     EDIT MODAL – SAVE
  ───────────────────────────────────────────── */
  function handleModalSave() {
    const collectors = { product: collectProductForm, category: collectCategoryForm, gallery: collectGalleryForm, notification: collectNotifForm };
    const arrayMap   = { product: "products", category: "categories", gallery: "gallery", notification: "notifications" };
    const renderers  = { product: renderProducts, category: renderCategories, gallery: renderGallery, notification: renderNotifications };

    const collect = collectors[S.editType];
    if (!collect) return;
    const item = collect();
    if (!item.title && !item.name) { showToast("Please enter a name / title.", "error"); return; }

    const arr = S[arrayMap[S.editType]];
    if (S.editIdx >= 0) arr[S.editIdx] = item;
    else arr.push(item);

    renderers[S.editType]?.();
    el("admEditModal").hidden = true;
    showToast("Saved! Click \"Generate Code\" to export the updated file.");
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
    el("admEditModal")?.addEventListener("click",   e => { if (e.target === el("admEditModal")) el("admEditModal").hidden = true; });

    // Code modal
    el("admCodeClose")?.addEventListener("click",   () => { el("admCodeModal").hidden = true; });
    el("admCodeModal")?.addEventListener("click",   e => { if (e.target === el("admCodeModal")) el("admCodeModal").hidden = true; });

    // Products
    el("btnAddProduct")?.addEventListener("click", () => openProductForm(-1));
    el("btnGenProducts")?.addEventListener("click", () => showCodeModal([{ name: "data/products.json", data: S.products }]));

    // Categories
    el("btnAddCategory")?.addEventListener("click", () => openCategoryForm(-1));
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

    // Config / Settings
    el("btnSaveConfig")?.addEventListener("click", () => {
      const f = el("admConfigForm");
      S.config = { ...S.config, managerPin: fv(f, "managerPin") };
      showToast("Settings saved!");
    });
    el("btnGenConfig")?.addEventListener("click", () => {
      const f = el("admConfigForm");
      showCodeModal([{ name: "data/config.json", data: { ...S.config, managerPin: fv(f, "managerPin") } }]);
    });

    // Orders
    el("mgRefreshBtn")?.addEventListener("click", () => { S.orders = loadLocalOrders(); updateOrderStats(); renderOrderList(); showToast("Orders refreshed."); });
    el("mgRetryBtn")?.addEventListener("click",   () => { S.orders = loadLocalOrders(); updateOrderStats(); renderOrderList(); });
    setupOrderTabs();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
