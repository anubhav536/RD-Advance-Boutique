(function () {
  "use strict";

  /* ── CONSTANTS ─────────────────────────────────────── */
  const WA_NUMBER = "917693849472";

  const OCCASIONS = [
    { id: "all",       label: "All Occasions", icon: "✨" },
    { id: "wedding",   label: "Wedding",       icon: "👰" },
    { id: "reception", label: "Reception",     icon: "🎉" },
    { id: "festival",  label: "Festival",      icon: "🪔" },
    { id: "party",     label: "Party",         icon: "🎊" },
    { id: "casual",    label: "Casual",        icon: "☕" },
    { id: "office",    label: "Office",        icon: "💼" },
  ];

  const BROWSE_CATS = [
    { id: "all",         label: "All",         icon: "🏪" },
    { id: "sarees",      label: "Sarees",      icon: "👘" },
    { id: "blouses",     label: "Blouses",     icon: "👚" },
    { id: "kurtis",      label: "Kurtis",      icon: "👗" },
    { id: "lehengas",    label: "Lehengas",    icon: "💃" },
    { id: "dupattas",    label: "Dupattas",    icon: "🧣" },
    { id: "accessories", label: "Accessories", icon: "💍" },
    { id: "kids",        label: "Kids",        icon: "👧" },
  ];

  /* Board slots — one item per slot */
  const OUTFIT_SLOTS = [
    { id: "sarees",      label: "Saree / Lehenga", icon: "👘", cats: ["sarees", "lehengas"],   position: "main",   hint: "Add a saree or lehenga" },
    { id: "kurtis",      label: "Kurti / Top / Set",icon: "👗", cats: ["kurtis", "blouses"],   position: "side",   hint: "Add a kurti, set or top" },
    { id: "dupattas",    label: "Dupatta",          icon: "🧣", cats: ["dupattas"],             position: "side",   hint: "Add a dupatta" },
    { id: "accessories", label: "Accessories",      icon: "💍", cats: ["accessories"],          position: "bottom", hint: "Add accessories" },
    { id: "kids",        label: "Kids Wear",        icon: "👧", cats: ["kids"],                 position: "bottom", hint: "Add kids wear" },
  ];

  /* ── STATE ────────────────────────────────────────── */
  const S = {
    allProducts: [],
    activeOccasion: "all",
    activeCat: "all",
    searchTerm: "",
    outfit: new Map(),
  };

  /* ── DOM HELPERS ──────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const esc = s => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fmt = p => { const n = Number(p); return (Number.isFinite(n) && n > 0) ? "₹" + n.toLocaleString("en-IN") : "Price on request"; };
  const norm = s => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/, "");

  /* ── CATEGORY DETECTION ───────────────────────────── */
  function getOutfitCat(product) {
    if (product.outfitCategory) return norm(product.outfitCategory);
    const cats = (product.categories || [product.category || ""]).map(norm);
    const cat = cats.join(" ");
    if (cat.includes("saree") || cat.includes("sari")) return "sarees";
    if (cat.includes("leheng")) return "lehengas";
    if (cat.includes("blouse")) return "blouses";
    if (cat.includes("dupatta")) return "dupattas";
    if (cat.includes("kid") || cat.includes("child")) return "kids";
    /* Kurtis + co-ord sets + suit sets → kurtis slot */
    if (cat.includes("kurti") || cat.includes("kurta") || cat.includes("co-ord") || cat.includes("co ord") || cat.includes("suit") || cat.includes("set")) return "kurtis";
    if (cat.includes("access") || cat.includes("jewel") || cat.includes("bag") || cat.includes("footwear")) return "accessories";
    return "other";
  }

  function getSlotId(product) {
    const oc = getOutfitCat(product);
    for (const slot of OUTFIT_SLOTS) {
      if (slot.cats.includes(oc)) return slot.id;
    }
    return null;
  }

  /* ── FILTERING ────────────────────────────────────── */
  function matchesOccasion(p) {
    if (S.activeOccasion === "all") return true;
    const combined = [
      ...(p.occasions || []).map(norm),
      ...(p.tags || []).map(norm),
    ];
    return combined.some(t => t.includes(S.activeOccasion));
  }

  function matchesCat(p) {
    if (S.activeCat === "all") return true;
    return getOutfitCat(p) === S.activeCat;
  }

  function filteredProducts() {
    return S.allProducts.filter(p => {
      if (p.status === "inactive") return false;
      if (!matchesOccasion(p)) return false;
      if (!matchesCat(p)) return false;
      if (S.searchTerm) {
        const hay = norm([p.title, p.name, p.category, ...(p.tags || [])].join(" "));
        if (!hay.includes(S.searchTerm)) return false;
      }
      return true;
    });
  }

  /* ── OUTFIT TOTAL ─────────────────────────────────── */
  function outfitTotal() {
    let t = 0;
    S.outfit.forEach(p => { t += Number(p.price) || 0; });
    return t;
  }

  /* ── RENDER: OCCASION BAR ─────────────────────────── */
  function renderOccasionBar() {
    const bar = $("obOccasionBar");
    if (!bar) return;
    bar.innerHTML = OCCASIONS.map(o => `
      <button class="ob-occ-btn${S.activeOccasion === o.id ? " active" : ""}" data-occ="${o.id}" type="button">
        <span class="ob-occ-icon">${o.icon}</span><span>${o.label}</span>
      </button>`).join("");
    bar.querySelectorAll(".ob-occ-btn").forEach(btn =>
      btn.addEventListener("click", () => { S.activeOccasion = btn.dataset.occ; renderOccasionBar(); renderBrowse(); }));
  }

  /* ── RENDER: CATEGORY TABS ────────────────────────── */
  function renderCatTabs() {
    const wrap = $("obCatTabs");
    if (!wrap) return;
    wrap.innerHTML = BROWSE_CATS.map(c => `
      <button class="ob-cat-tab${S.activeCat === c.id ? " active" : ""}" data-cat="${c.id}" type="button">${c.icon} ${c.label}</button>`).join("");
    wrap.querySelectorAll(".ob-cat-tab").forEach(btn =>
      btn.addEventListener("click", () => { S.activeCat = btn.dataset.cat; renderCatTabs(); renderBrowse(); }));
  }

  /* ── RENDER: PRODUCT BROWSER ──────────────────────── */
  function renderBrowse() {
    const grid = $("obProductGrid");
    if (!grid) return;
    const list = filteredProducts();

    if (!list.length) {
      grid.innerHTML = `<div class="ob-empty">
        <span class="ob-empty-icon">${S.allProducts.length ? "🔍" : "⏳"}</span>
        <p>${S.allProducts.length ? "No products found." : "Loading products..."}</p>
        <small>${S.allProducts.length ? "Try a different category or occasion." : "Please wait..."}</small>
      </div>`;
      return;
    }

    grid.innerHTML = list.map(p => {
      const slotId = getSlotId(p);
      const inOutfit = slotId && S.outfit.has(slotId) && S.outfit.get(slotId).id === p.id;
      const img = p.image || (p.images && p.images[0]) || "assets/logo.png";
      return `<div class="ob-product-card${inOutfit ? " ob-product-card--selected" : ""}" data-id="${esc(p.id)}">
        <div class="ob-product-card__img-wrap">
          <img src="${esc(img)}" alt="${esc(p.title || p.name)}" loading="lazy" onerror="this.src='assets/logo.png'">
          ${inOutfit ? '<span class="ob-check">✓</span>' : ""}
        </div>
        <div class="ob-product-card__body">
          <span class="ob-product-card__cat">${esc(p.category || getOutfitCat(p))}</span>
          <p class="ob-product-card__title">${esc(p.title || p.name || "Product")}</p>
          <span class="ob-product-card__price">${fmt(p.price)}</span>
        </div>
        <button class="ob-add-btn${inOutfit ? " ob-add-btn--remove" : ""}" type="button" data-id="${esc(p.id)}">
          ${inOutfit ? "✓ Added" : "+ Add to Outfit"}
        </button>
      </div>`;
    }).join("");

    grid.querySelectorAll(".ob-add-btn").forEach(btn =>
      btn.addEventListener("click", () => toggleItem(btn.dataset.id)));
  }

  /* ── TOGGLE ITEM ──────────────────────────────────── */
  function toggleItem(productId) {
    const product = S.allProducts.find(p => p.id === productId);
    if (!product) return;
    const slotId = getSlotId(product) || ("other-" + productId);
    const already = S.outfit.has(slotId) && S.outfit.get(slotId).id === productId;
    if (already) {
      S.outfit.delete(slotId);
    } else {
      S.outfit.set(slotId, product);
    }
    renderAll();
    saveToStorage();
  }

  /* ── RENDER: OUTFIT BOARD ─────────────────────────── */
  function renderBoard() {
    const board = $("obOutfitBoard");
    if (!board) return;
    const hasItems = S.outfit.size > 0;

    board.innerHTML = (!hasItems ? `<div class="ob-board-empty">
      <span class="ob-board-empty-icon">👗</span>
      <p>Your outfit board is empty</p>
      <small>Browse products on the left and click "+ Add to Outfit" to start building your look.</small>
    </div>` : "") +
    `<div class="ob-board-slots${hasItems ? " ob-board-slots--has-items" : ""}">
      ${OUTFIT_SLOTS.map(slot => renderSlot(slot)).join("")}
    </div>`;

    board.querySelectorAll(".ob-slot-remove").forEach(btn =>
      btn.addEventListener("click", () => {
        S.outfit.delete(btn.dataset.slotId);
        renderAll();
        saveToStorage();
      }));
  }

  function renderSlot(slot) {
    const p = S.outfit.get(slot.id);
    const pos = slot.position;
    if (!p) {
      return `<div class="ob-slot ob-slot--empty ob-slot--${pos}" data-slot="${slot.id}">
        <span class="ob-slot__icon">${slot.icon}</span>
        <span class="ob-slot__label">${slot.label}</span>
        <span class="ob-slot__hint">${slot.hint}</span>
      </div>`;
    }
    const img = p.image || (p.images && p.images[0]) || "assets/logo.png";
    return `<div class="ob-slot ob-slot--filled ob-slot--${pos}" data-slot="${slot.id}">
      <button class="ob-slot-remove" type="button" data-slot-id="${slot.id}" aria-label="Remove">✕</button>
      <img class="ob-slot__img" src="${esc(img)}" alt="${esc(p.title || p.name)}" loading="lazy" onerror="this.src='assets/logo.png'">
      <div class="ob-slot__info">
        <span class="ob-slot__label">${slot.label}</span>
        <p class="ob-slot__name">${esc(p.title || p.name || "Product")}</p>
        <span class="ob-slot__price">${fmt(p.price)}</span>
      </div>
    </div>`;
  }

  /* ── RENDER: SUMMARY ──────────────────────────────── */
  function renderSummary() {
    const listEl = $("obSummaryList");
    const totalEl = $("obSummaryTotal");
    const emptyMsg = $("obSummaryEmpty");
    const orderBtn = $("obOrderBtn");
    const shareBtn = $("obShareBtn");

    const items = Array.from(S.outfit.values());
    const total = outfitTotal();

    if (emptyMsg) emptyMsg.hidden = items.length > 0;
    if (orderBtn) orderBtn.disabled = items.length === 0;
    if (shareBtn) shareBtn.hidden = items.length === 0;

    if (!listEl) return;
    listEl.innerHTML = items.map(p => {
      const img = p.image || (p.images && p.images[0]) || "assets/logo.png";
      return `<div class="ob-summary-item">
        <img class="ob-summary-item__img" src="${esc(img)}" alt="${esc(p.title || p.name)}" onerror="this.src='assets/logo.png'">
        <div class="ob-summary-item__info">
          <span class="ob-summary-item__cat">${esc(p.category || getOutfitCat(p))}</span>
          <p class="ob-summary-item__name">${esc(p.title || p.name || "Product")}</p>
          <span class="ob-summary-item__price">${fmt(p.price)}</span>
        </div>
        <button class="ob-summary-remove" type="button" data-id="${esc(p.id)}" aria-label="Remove">✕</button>
      </div>`;
    }).join("");

    if (totalEl) {
      totalEl.innerHTML = items.length
        ? `<span>Total (${items.length} item${items.length !== 1 ? "s" : ""})</span><strong>${fmt(total)}</strong>`
        : "";
    }

    listEl.querySelectorAll(".ob-summary-remove").forEach(btn =>
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        S.outfit.forEach((prod, slotId) => { if (prod.id === id) S.outfit.delete(slotId); });
        renderAll();
        saveToStorage();
      }));
  }

  /* ── RENDER: MOBILE DRAWER ────────────────────────── */
  function renderMobileDrawer() {
    const drawer = $("obMobileDrawer");
    if (!drawer) return;
    const count = S.outfit.size;
    drawer.hidden = count === 0;
    const countEl = $("obMobileCount");
    const totalEl = $("obMobileTotal");
    if (countEl) countEl.textContent = count;
    if (totalEl) totalEl.textContent = fmt(outfitTotal());
  }

  /* ── RENDER ALL ───────────────────────────────────── */
  function renderAll() {
    renderBrowse();
    renderBoard();
    renderSummary();
    renderMobileDrawer();
  }

  /* ── LOCAL STORAGE ────────────────────────────────── */
  function saveToStorage() {
    try {
      const data = {
        items: Array.from(S.outfit.entries()).map(([slotId, p]) => ({ slotId, productId: p.id })),
        occasion: S.activeOccasion,
        savedAt: Date.now(),
      };
      localStorage.setItem("rdOutfitDraft", JSON.stringify(data));
    } catch (_) {}
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem("rdOutfitDraft");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.items)) return;
      data.items.forEach(({ slotId, productId }) => {
        const p = S.allProducts.find(x => x.id === productId);
        if (p) S.outfit.set(slotId, p);
      });
      if (data.occasion) S.activeOccasion = data.occasion;
    } catch (_) {}
  }

  /* ── URL PARAMS (pre-load product) ───────────────── */
  function loadFromUrl() {
    const params = new URLSearchParams(location.search);
    const startId = params.get("start");
    const outfitIds = params.get("outfit");

    if (startId) {
      const p = S.allProducts.find(x => x.id === startId);
      if (p) { const slotId = getSlotId(p); if (slotId) S.outfit.set(slotId, p); }
    }
    if (outfitIds) {
      outfitIds.split(",").forEach(id => {
        const p = S.allProducts.find(x => x.id === id.trim());
        if (p) { const slotId = getSlotId(p); if (slotId) S.outfit.set(slotId, p); }
      });
    }
  }

  /* ── ORDER MODAL ──────────────────────────────────── */
  function openModal() {
    const modal = $("obOrderModal");
    if (!modal) return;

    const items = Array.from(S.outfit.values());
    const total = outfitTotal();
    const summaryEl = $("obModalSummary");

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="ob-modal-items">
          ${items.map(p => {
            const img = p.image || (p.images && p.images[0]) || "assets/logo.png";
            return `<div class="ob-modal-item">
              <img src="${esc(img)}" alt="${esc(p.title || p.name)}" onerror="this.src='assets/logo.png'">
              <span>${esc(p.title || p.name || "Product")}</span>
              <strong>${fmt(p.price)}</strong>
            </div>`;
          }).join("")}
        </div>
        <div class="ob-modal-total">
          <span>Outfit Total (${items.length} item${items.length !== 1 ? "s" : ""})</span>
          <strong>${fmt(total)}</strong>
        </div>`;
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("obOrderName")?.focus(), 100);
  }

  function closeModal() {
    const modal = $("obOrderModal");
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  /* ── BUILD WHATSAPP MESSAGE ───────────────────────── */
  function buildWAMessage(name, phone) {
    const items = Array.from(S.outfit.values());
    const total = outfitTotal();
    const occasion = OCCASIONS.find(o => o.id === S.activeOccasion)?.label || "Not specified";
    const outfitName = $("obOutfitName")?.value.trim() || "My Custom Look";

    const lines = items.map((p, i) => {
      const cat = p.category || getOutfitCat(p);
      return `${i + 1}. *${p.title || p.name || "Product"}*\n   Category: ${cat}\n   Price: ${fmt(p.price)}`;
    }).join("\n\n");

    return `🎀 *OUTFIT ORDER — RD Advance Boutique*

*Look Name:* ${outfitName}
*Occasion:* ${occasion}

━━━━━━━━━━━━━━━━━━━
*OUTFIT ITEMS (${items.length})*
━━━━━━━━━━━━━━━━━━━
${lines}

━━━━━━━━━━━━━━━━━━━
*OUTFIT TOTAL: ${fmt(total)}*
━━━━━━━━━━━━━━━━━━━

*Customer Details*
Name: ${name || "Not provided"}
Phone: ${phone || "Not provided"}

Kripya is outfit order ko confirm karke payment aur delivery ke baare mein bataein. 🙏`;
  }

  function submitOrder(e) {
    e.preventDefault();
    const name  = $("obOrderName")?.value.trim() || "";
    const phone = $("obOrderPhone")?.value.trim() || "";
    if (!name || !phone) { showToast("Please enter your name and phone number."); return; }
    const msg = buildWAMessage(name, phone);
    window.open("https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(msg), "_blank", "noopener,noreferrer");
    closeModal();
    showToast("Order sent via WhatsApp! ✅");
  }

  /* ── SHARE LOOK ───────────────────────────────────── */
  function shareOutfit() {
    const ids = Array.from(S.outfit.values()).map(p => p.id).join(",");
    const url = location.origin + location.pathname + "?outfit=" + encodeURIComponent(ids);
    if (navigator.share) {
      navigator.share({ title: "My RD Boutique Outfit Look", url }).catch(() => copyLink(url));
    } else {
      copyLink(url);
    }
  }

  function copyLink(url) {
    navigator.clipboard?.writeText(url).then(() => showToast("Link copied to clipboard! 🔗")).catch(() => showToast("Could not copy. Please copy the URL manually."));
  }

  /* ── TOAST ────────────────────────────────────────── */
  function showToast(msg) {
    const t = $("obToast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("ob-toast--show");
    setTimeout(() => t.classList.remove("ob-toast--show"), 3000);
  }

  /* ── INIT ─────────────────────────────────────────── */
  async function init() {
    /* Load products */
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      const data = await res.json();
      S.allProducts = Array.isArray(data) ? data.filter(p => p.status !== "inactive") : [];
    } catch (_) {
      S.allProducts = [];
    }

    /* Load state: URL params override localStorage */
    const hasUrlParams = new URLSearchParams(location.search).has("start") || new URLSearchParams(location.search).has("outfit");
    if (hasUrlParams) {
      loadFromUrl();
    } else {
      loadFromStorage();
      if (S.outfit.size === 0) loadFromUrl();
    }

    /* Initial render */
    renderOccasionBar();
    renderCatTabs();
    renderAll();

    /* Search */
    $("obSearch")?.addEventListener("input", e => {
      S.searchTerm = norm(e.target.value);
      renderBrowse();
    });

    /* Order button */
    $("obOrderBtn")?.addEventListener("click", openModal);
    $("obMobileOrderBtn")?.addEventListener("click", openModal);

    /* Modal close */
    $("obModalClose")?.addEventListener("click", closeModal);
    $("obOrderModal")?.addEventListener("click", e => { if (e.target === $("obOrderModal")) closeModal(); });

    /* Order form submit */
    $("obOrderForm")?.addEventListener("submit", submitOrder);

    /* Share */
    $("obShareBtn")?.addEventListener("click", shareOutfit);

    /* Clear outfit */
    $("obClearBtn")?.addEventListener("click", () => {
      if (!confirm("Clear your outfit? All selected items will be removed.")) return;
      S.outfit.clear();
      try { localStorage.removeItem("rdOutfitDraft"); } catch (_) {}
      renderAll();
      showToast("Outfit cleared.");
    });

    /* Escape key */
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
