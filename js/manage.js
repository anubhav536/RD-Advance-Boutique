(function () {
  "use strict";

  /* ─────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────── */
  let appConfig    = {};
  let allOrders    = [];
  let activeFilter = "all";
  let sessionPin   = "";

  /* ─────────────────────────────────────────────
     UTILS
  ───────────────────────────────────────────── */
  const el = id => document.getElementById(id);

  function escHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function relTime(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return "just now";
    if (mins < 60)  return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return hrs + "h ago";
    const days = Math.floor(hrs / 24);
    if (days < 7)   return days + "d ago";
    return d.toLocaleDateString("en-IN");
  }

  const STATUS_CONFIG = {
    "Pending Verification" : { cls: "badge--warn",  label: "⏳ Pending Verification" },
    "Confirmed – COD"      : { cls: "badge--teal",  label: "🏠 Confirmed – COD"      },
    "Verified"             : { cls: "badge--blue",  label: "✅ Verified"              },
    "Completed"            : { cls: "badge--green", label: "📦 Completed"             },
    "Cancelled"            : { cls: "badge--red",   label: "❌ Cancelled"             },
    "Rejected"             : { cls: "badge--red",   label: "🚫 Rejected"              },
  };

  const ALL_STATUSES = Object.keys(STATUS_CONFIG);

  /* ─────────────────────────────────────────────
     LOAD CONFIG
  ───────────────────────────────────────────── */
  async function loadConfig() {
    try {
      const res = await fetch("data/config.json", { cache: "no-store" });
      appConfig = await res.json();
    } catch (_) { appConfig = {}; }
  }

  /* ─────────────────────────────────────────────
     LOGIN
  ───────────────────────────────────────────── */
  async function handleLogin(e) {
    e.preventDefault();
    const pin = el("mgPin").value.trim();
    if (!pin) return;

    const scriptUrl = appConfig.appsScriptUrl || "";
    let ok = false;

    if (!scriptUrl || scriptUrl.includes("PASTE_YOUR")) {
      // Offline — compare to config pin
      ok = (pin === String(appConfig.managerPin || "1234"));
    } else {
      try {
        const res  = await fetch(scriptUrl, {
          method  : "POST",
          body    : JSON.stringify({ action: "verifyPin", pin }),
          headers : { "Content-Type": "application/json" },
          redirect: "follow",
        });
        const data = await res.json();
        ok = !!data.ok;
      } catch (_) {
        // Fallback to local compare
        ok = (pin === String(appConfig.managerPin || "1234"));
      }
    }

    if (ok) {
      sessionPin = pin;
      el("mgLoginScreen").hidden = true;
      el("mgApp").hidden         = false;
      if (!scriptUrl || scriptUrl.includes("PASTE_YOUR")) {
        el("mgSetupBanner").hidden = false;
      }
      loadOrders();
    } else {
      el("mgLoginErr").hidden = false;
      el("mgPin").select();
    }
  }

  /* ─────────────────────────────────────────────
     LOAD ORDERS
  ───────────────────────────────────────────── */
  async function loadOrders() {
    el("mgLoadingState").hidden = false;
    el("mgEmptyState").hidden   = true;
    el("mgErrorState").hidden   = true;
    el("mgOrdersList").innerHTML= "";

    const scriptUrl = appConfig.appsScriptUrl || "";

    try {
      if (!scriptUrl || scriptUrl.includes("PASTE_YOUR")) {
        allOrders = loadLocalOrders();
      } else {
        const res  = await fetch(scriptUrl + "?action=getOrders&status=all", { redirect: "follow" });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Failed to load");
        allOrders = data.orders || [];
      }

      updateStats();
      renderOrders();
    } catch (err) {
      el("mgLoadingState").hidden = true;
      el("mgErrorState").hidden   = false;
      el("mgErrorMsg").textContent = "Failed to load orders: " + err.message;
    }
  }

  function loadLocalOrders() {
    try {
      const raw = JSON.parse(localStorage.getItem("rdOrders") || "[]");
      return raw.map(o => ({
        "Order ID"         : o.orderId    || "—",
        "Created Date"     : o.createdAt  || "",
        "Status"           : o.paymentMethod === "UPI" ? "Pending Verification" : "Confirmed – COD",
        "Product ID"       : o.productId  || "",
        "Product Name"     : o.productName|| "",
        "Product URL"      : o.productUrl || "",
        "Quantity"         : o.quantity   || 1,
        "Selected Options" : o.selectedOptions || {},
        "Customer Name"    : o.customerName || "",
        "Mobile Number"    : o.phone      || "",
        "Address"          : o.address    || "",
        "City"             : o.city       || "",
        "State"            : o.state      || "",
        "Pincode"          : o.pincode    || "",
        "Payment Method"   : o.paymentMethod || "",
        "UTR Number"       : o.utrNumber  || "",
        "Amount Paid"      : o.amountPaid || "",
        "Screenshot URL"   : "",
        "Notes"            : o.notes      || "",
        _local             : true,
      }));
    } catch (_) { return []; }
  }

  /* ─────────────────────────────────────────────
     STATS
  ───────────────────────────────────────────── */
  function updateStats() {
    el("statAll").textContent       = allOrders.length;
    el("statPending").textContent   = allOrders.filter(o => o["Status"] === "Pending Verification").length;
    el("statCod").textContent       = allOrders.filter(o => o["Status"] === "Confirmed – COD").length;
    el("statVerified").textContent  = allOrders.filter(o => o["Status"] === "Verified").length;
    el("statCompleted").textContent = allOrders.filter(o => o["Status"] === "Completed").length;
    el("statCancelled").textContent = allOrders.filter(o => o["Status"] === "Cancelled").length;

    // Highlight pending tab if new orders
    const pendingCount = allOrders.filter(o => o["Status"] === "Pending Verification").length;
    document.querySelector('.mg-tab[data-filter="Pending Verification"]')
      ?.classList.toggle("mg-tab--has-badge", pendingCount > 0);
  }

  /* ─────────────────────────────────────────────
     RENDER ORDERS
  ───────────────────────────────────────────── */
  function renderOrders() {
    el("mgLoadingState").hidden = true;

    const filtered = activeFilter === "all"
      ? allOrders
      : allOrders.filter(o => o["Status"] === activeFilter);

    if (filtered.length === 0) {
      el("mgEmptyState").hidden  = false;
      el("mgOrdersList").innerHTML = "";
      return;
    }

    el("mgEmptyState").hidden = true;
    el("mgOrdersList").innerHTML = filtered.map(order => renderOrderCard(order)).join("");

    // Bind expand toggles
    el("mgOrdersList").querySelectorAll(".mg-order-card").forEach(card => {
      card.querySelector(".mg-order-header")?.addEventListener("click", () => {
        card.classList.toggle("mg-order-card--open");
      });
    });

    // Bind status selects
    el("mgOrdersList").querySelectorAll(".mg-status-select").forEach(sel => {
      sel.addEventListener("change", () => {
        const orderId = sel.dataset.orderId;
        const status  = sel.value;
        updateOrderStatus(orderId, status, sel);
      });
    });

    // Bind screenshot links
    el("mgOrdersList").querySelectorAll(".mg-screenshot-link").forEach(a => {
      a.addEventListener("click", e => { e.stopPropagation(); });
    });
  }

  function renderOrderCard(order) {
    const orderId   = escHtml(order["Order ID"]       || "—");
    const date      = order["Created Date"]            || "";
    const status    = order["Status"]                  || "—";
    const custName  = escHtml(order["Customer Name"]  || "—");
    const phone     = escHtml(order["Mobile Number"]  || "—");
    const product   = escHtml(order["Product Name"]   || "—");
    const qty       = order["Quantity"]               || 1;
    const payment   = escHtml(order["Payment Method"] || "—");
    const utr       = escHtml(order["UTR Number"]     || "");
    const amount    = order["Amount Paid"]            || "";
    const address   = escHtml([order["Address"], order["City"], order["State"], order["Pincode"]].filter(Boolean).join(", "));
    const notes     = escHtml(order["Notes"]          || "");
    const shotUrl   = order["Screenshot URL"]         || "";
    const prodUrl   = order["Product URL"]            || "";
    const isLocal   = !!order._local;

    const opts      = order["Selected Options"] || {};
    const optHtml   = typeof opts === "object" && !Array.isArray(opts)
      ? Object.entries(opts).map(([k,v]) => `<div class="mg-opt-row"><span>${escHtml(k)}</span><strong>${escHtml(v)}</strong></div>`).join("")
      : escHtml(String(opts));

    const sc        = STATUS_CONFIG[status] || { cls: "badge--blue", label: status };

    const statusOptions = ALL_STATUSES.map(s =>
      `<option value="${s}" ${s === status ? "selected" : ""}>${s}</option>`
    ).join("");

    const waMsg = buildWAMsg(order);
    const waUrl = "https://wa.me/" + (appConfig.ownerPhone || "917693849472") + "?text=" + encodeURIComponent(waMsg);

    return `
<div class="mg-order-card" data-order-id="${orderId}" data-status="${escHtml(status)}">
  <div class="mg-order-header">
    <div class="mg-order-header-left">
      <span class="mg-order-id">#${orderId}</span>
      <span class="co-badge ${sc.cls}">${sc.label}</span>
      ${isLocal ? '<span class="mg-offline-badge">Local</span>' : ""}
    </div>
    <div class="mg-order-header-right">
      <span class="mg-order-meta">${escHtml(custName)} · ${escHtml(payment)}</span>
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
        ${prodUrl ? `<div class="mg-info-row"><span>URL</span><a href="${escHtml(prodUrl)}" target="_blank" class="mg-product-link">View →</a></div>` : ""}
      </div>

      <div class="mg-order-section">
        <h4 class="mg-section-title">Options</h4>
        ${optHtml || "<p class='mg-no-opts'>—</p>"}
      </div>

      <div class="mg-order-section">
        <h4 class="mg-section-title">Customer</h4>
        <div class="mg-info-row"><span>Name</span><strong>${custName}</strong></div>
        <div class="mg-info-row"><span>Phone</span><a href="tel:${escHtml(phone)}" class="mg-phone-link">${phone}</a></div>
        <div class="mg-info-row"><span>Address</span><strong>${address}</strong></div>
        ${notes ? `<div class="mg-info-row"><span>Notes</span><strong>${notes}</strong></div>` : ""}
      </div>

      <div class="mg-order-section">
        <h4 class="mg-section-title">Payment</h4>
        <div class="mg-info-row"><span>Method</span><strong>${payment}</strong></div>
        ${utr    ? `<div class="mg-info-row"><span>UTR</span><strong>${utr}</strong></div>` : ""}
        ${amount ? `<div class="mg-info-row"><span>Amount</span><strong>₹${escHtml(String(amount))}</strong></div>` : ""}
        ${shotUrl ? `<div class="mg-info-row"><span>Screenshot</span><a href="${escHtml(shotUrl)}" target="_blank" class="mg-screenshot-link">View Screenshot →</a></div>` : ""}
      </div>

    </div>

    <div class="mg-order-actions">
      <div class="mg-status-change">
        <label>Status:</label>
        <select class="mg-status-select" data-order-id="${orderId}">
          ${statusOptions}
        </select>
      </div>
      <div class="mg-action-btns">
        <a href="${waUrl}" target="_blank" class="btn mg-wa-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </a>
        <a href="tel:${escHtml(phone)}" class="btn btn--ghost mg-call-btn">📞 Call</a>
      </div>
    </div>
  </div>
</div>`;
  }

  /* ─────────────────────────────────────────────
     WA MESSAGE FOR MANAGER PANEL
  ───────────────────────────────────────────── */
  function buildWAMsg(order) {
    const opts    = order["Selected Options"] || {};
    const optStr  = typeof opts === "object"
      ? Object.entries(opts).map(([k,v]) => `• ${k}: ${v}`).join("\n")
      : String(opts);

    return `📋 *Order Update — RD Advance Boutique*

*Order ID:* ${order["Order ID"] || "—"}
*Status:* ${order["Status"] || "—"}

*Product:* ${order["Product Name"] || "—"}
*Qty:* ${order["Quantity"] || 1}
${optStr ? "\n*Options:*\n" + optStr : ""}

*Customer:* ${order["Customer Name"] || "—"}
*Phone:* ${order["Mobile Number"] || "—"}
*Address:* ${[order["Address"], order["City"], order["State"], order["Pincode"]].filter(Boolean).join(", ")}

*Payment:* ${order["Payment Method"] || "—"}${order["UTR Number"] ? "\n*UTR:* " + order["UTR Number"] : ""}${order["Amount Paid"] ? "\n*Amount:* ₹" + order["Amount Paid"] : ""}`;
  }

  /* ─────────────────────────────────────────────
     UPDATE STATUS
  ───────────────────────────────────────────── */
  async function updateOrderStatus(orderId, newStatus, selectEl) {
    const scriptUrl = appConfig.appsScriptUrl || "";
    selectEl.disabled = true;

    try {
      if (!scriptUrl || scriptUrl.includes("PASTE_YOUR")) {
        // Local update
        const idx = allOrders.findIndex(o => o["Order ID"] === orderId);
        if (idx >= 0) allOrders[idx]["Status"] = newStatus;
        updateStats();
        renderOrders();
        return;
      }

      const res  = await fetch(scriptUrl, {
        method  : "POST",
        body    : JSON.stringify({ action: "updateStatus", orderId, status: newStatus, pin: sessionPin }),
        headers : { "Content-Type": "application/json" },
        redirect: "follow",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Update failed");

      // Update local state
      const idx = allOrders.findIndex(o => o["Order ID"] === orderId);
      if (idx >= 0) allOrders[idx]["Status"] = newStatus;
      updateStats();
      renderOrders();

    } catch (err) {
      selectEl.disabled = false;
      alert("Status update failed: " + err.message);
    }
  }

  /* ─────────────────────────────────────────────
     TABS
  ───────────────────────────────────────────── */
  function setupTabs() {
    document.querySelectorAll(".mg-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".mg-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        activeFilter = tab.dataset.filter;
        renderOrders();
      });
    });

    // Stats bar clicks
    document.querySelectorAll(".mg-stat[data-filter]").forEach(stat => {
      stat.style.cursor = "pointer";
      stat.addEventListener("click", () => {
        activeFilter = stat.dataset.filter;
        document.querySelectorAll(".mg-tab").forEach(t => {
          t.classList.toggle("active", t.dataset.filter === activeFilter);
        });
        renderOrders();
      });
    });
  }

  /* ─────────────────────────────────────────────
     SETUP MODAL
  ───────────────────────────────────────────── */
  function setupModal() {
    const modal     = el("mgSetupModal");
    const openBtns  = [el("mgSetupBannerBtn")].filter(Boolean);
    const closeBtn  = el("mgSetupClose");

    openBtns.forEach(btn => btn?.addEventListener("click", () => { modal.hidden = false; }));
    closeBtn?.addEventListener("click",  () => { modal.hidden = true; });
    modal?.addEventListener("click", e => { if (e.target === modal) modal.hidden = true; });
  }

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  async function init() {
    await loadConfig();

    el("mgLoginForm")?.addEventListener("submit", handleLogin);
    el("mgRefreshBtn")?.addEventListener("click", loadOrders);
    el("mgRetryBtn")?.addEventListener("click",   loadOrders);

    setupTabs();
    setupModal();

    // Auto-refresh every 2 minutes if logged in
    setInterval(() => {
      if (!el("mgApp").hidden) loadOrders();
    }, 2 * 60 * 1000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
