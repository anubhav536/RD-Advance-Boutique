"use strict";

(function () {
  /* ─── STORAGE ─────────────────────────────── */
  const KEY = "rdWishlist";

  function get() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function save(ids) {
    localStorage.setItem(KEY, JSON.stringify([...new Set(ids.map(String))]));
    _updateAllBadges();
    _updateAllHearts();
  }
  function has(id)    { return get().includes(String(id)); }
  function add(id)    { const l = get(); if (!l.includes(String(id))) save([...l, id]); }
  function remove(id) { save(get().filter(i => i !== String(id))); }
  function toggle(id) { has(id) ? remove(id) : add(id); }
  function count()    { return get().length; }
  function clear()    { localStorage.removeItem(KEY); _updateAllBadges(); _updateAllHearts(); }

  /* ─── DOM UPDATES ─────────────────────────── */
  function _updateAllBadges() {
    const c = count();
    document.querySelectorAll(".wl-badge").forEach(el => {
      el.textContent = c;
      el.hidden = c === 0;
    });
  }

  function _updateAllHearts() {
    document.querySelectorAll("[data-wl-id]").forEach(btn => {
      const saved = has(btn.dataset.wlId);
      btn.classList.toggle("wl-saved", saved);
      btn.innerHTML = saved ? "♥" : "♡";
      btn.setAttribute("aria-label", saved ? "Remove from wishlist" : "Add to wishlist");
      btn.title = saved ? "Remove from wishlist" : "Save to wishlist";
    });
  }

  /* ─── HEART BUTTON FACTORY ────────────────── */
  function makeHeart(productId) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wishlist-btn";
    btn.dataset.wlId = String(productId);
    const saved = has(productId);
    btn.classList.toggle("wl-saved", saved);
    btn.innerHTML = saved ? "♥" : "♡";
    btn.setAttribute("aria-label", saved ? "Remove from wishlist" : "Add to wishlist");
    btn.title = saved ? "Remove from wishlist" : "Save to wishlist";
    return btn;
  }

  /* ─── EVENT DELEGATION ────────────────────── */
  function _delegateClicks() {
    document.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-wl-id]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      toggle(btn.dataset.wlId);
    }, true);
  }

  /* ─── WISHLIST PAGE ────────────────────────── */
  async function initWishlistPage() {
    const grid    = document.getElementById("wlGrid");
    const empty   = document.getElementById("wlEmpty");
    const counter = document.getElementById("wlCounter");
    const clearBtn = document.getElementById("wlClearAll");
    const shareBtn = document.getElementById("wlShareBtn");
    const relGrid  = document.getElementById("wlRelated");

    if (!grid) return;

    async function loadProducts() {
      try {
        const res = await fetch("data/products.json", { cache: "no-store" });
        return await res.json();
      } catch { return []; }
    }

    function formatPrice(p) {
      if (!p && p !== 0) return "Price on request";
      if (typeof p === "number" && p > 0) return "₹" + p.toLocaleString("en-IN");
      return String(p);
    }

    function getProductId(p) { return String(p.slug || p.id || ""); }

    function renderCard(product) {
      const pid   = getProductId(product);
      const title = product.title || product.name || "Product";
      const image = product.image || product.images?.[0] || "assets/logo.png";
      const detailUrl = `product-details.html?id=${encodeURIComponent(pid)}`;
      const checkoutUrl = `checkout.html?id=${encodeURIComponent(pid)}`;

      const card = document.createElement("article");
      card.className = "wl-card";
      card.dataset.pid = pid;

      card.innerHTML = `
        <a class="wl-card__img-wrap" href="${detailUrl}">
          <img class="wl-card__img" src="${image}" alt="${title}" loading="lazy">
        </a>
        <div class="wl-card__body">
          <span class="wl-card__cat">${product.category || "Boutique"}</span>
          <h3 class="wl-card__title"><a href="${detailUrl}">${title}</a></h3>
          <p class="wl-card__price">${formatPrice(product.price)}</p>
          <p class="wl-card__desc">${product.shortDescription || (product.description || "").slice(0, 100) || "Premium boutique product."}</p>
          <div class="wl-card__actions">
            <a class="btn btn--primary wl-card__buy" href="${checkoutUrl}" data-i18n="btn.buyNow">Buy Now</a>
            <a class="btn btn--ghost wl-card__view" href="${detailUrl}" data-i18n="btn.viewDetails">View Details</a>
            <button class="wl-card__remove" type="button" data-remove-id="${pid}" data-i18n="wl.remove">✕ Remove</button>
          </div>
        </div>
      `;

      // heart
      const heart = makeHeart(pid);
      card.querySelector(".wl-card__img-wrap").appendChild(heart);

      // remove button
      card.querySelector("[data-remove-id]").addEventListener("click", () => {
        remove(pid);
        card.classList.add("wl-card--removing");
        setTimeout(() => { card.remove(); render(allProducts); }, 280);
      });

      return card;
    }

    function renderRelated(allProducts, wishedCats) {
      if (!relGrid) return;
      const wishedIds = get();
      const related = allProducts.filter(p =>
        !wishedIds.includes(getProductId(p)) &&
        p.status !== "inactive" &&
        wishedCats.has(p.category)
      ).slice(0, 4);

      const section = document.getElementById("wlRelatedSection");
      if (!related.length) { if (section) section.hidden = true; return; }
      if (section) section.hidden = false;

      relGrid.innerHTML = "";
      related.forEach(p => {
        const pid = getProductId(p);
        const title = p.title || p.name || "Product";
        const image = p.image || p.images?.[0] || "assets/logo.png";
        const card = document.createElement("article");
        card.className = "product-card";
        card.innerHTML = `
          <div class="product-card__media">
            <img src="${image}" alt="${title}" loading="lazy">
          </div>
          <div class="product-content">
            <span class="product-category">${p.category || ""}</span>
            <h3>${title}</h3>
            <p class="product-price">${formatPrice(p.price)}</p>
            <a class="product-card__action" href="product-details.html?id=${encodeURIComponent(pid)}">View Details</a>
          </div>
        `;
        const heart = makeHeart(pid);
        card.querySelector(".product-card__media").appendChild(heart);
        relGrid.appendChild(card);
      });
    }

    let allProducts = [];

    async function render(products) {
      allProducts = products;
      const ids = get();
      const wished = products.filter(p => ids.includes(getProductId(p)));

      if (counter) counter.textContent = wished.length;

      if (wished.length === 0) {
        grid.innerHTML = "";
        if (empty) empty.hidden = false;
        if (clearBtn) clearBtn.hidden = true;
        const section = document.getElementById("wlRelatedSection");
        if (section) section.hidden = true;
        return;
      }

      if (empty) empty.hidden = true;
      if (clearBtn) clearBtn.hidden = false;

      grid.innerHTML = "";
      wished.forEach(p => grid.appendChild(renderCard(p)));

      // Related
      const wishedCats = new Set(wished.map(p => p.category).filter(Boolean));
      renderRelated(allProducts, wishedCats);
    }

    allProducts = await loadProducts();
    await render(allProducts);

    // Clear all
    clearBtn?.addEventListener("click", () => {
      if (!confirm("Wishlist clear karein? Sabhi saved products hata diye jaayenge.")) return;
      clear();
      render(allProducts);
    });

    // Share wishlist
    shareBtn?.addEventListener("click", async () => {
      const ids = get();
      const params = new URLSearchParams({ wl: ids.join(",") });
      const shareUrl = `${location.origin}${location.pathname}?${params}`;
      const shareData = {
        title: "RD Advance Boutique – Meri Wishlist",
        text: `Ye products mujhe pasand aaye hain RD Advance Boutique se!`,
        url: shareUrl
      };
      if (navigator.share) {
        try { await navigator.share(shareData); return; } catch {}
      }
      try {
        await navigator.clipboard.writeText(shareUrl);
        const status = document.getElementById("wlShareStatus");
        if (status) { status.textContent = "Link copied!"; setTimeout(() => status.textContent = "", 2500); }
      } catch {}
    });

    // Load shared wishlist from URL
    const urlWl = new URLSearchParams(location.search).get("wl");
    if (urlWl) {
      const sharedIds = urlWl.split(",").filter(Boolean);
      sharedIds.forEach(id => add(id));
      history.replaceState({}, "", location.pathname);
      await render(allProducts);
    }

    // Listen for storage changes (other tabs)
    window.addEventListener("storage", e => {
      if (e.key === KEY) render(allProducts);
    });
  }

  /* ─── INIT ─────────────────────────────────── */
  function init() {
    _updateAllBadges();
    _updateAllHearts();
    _delegateClicks();
    if (document.getElementById("wlGrid")) initWishlistPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.RDWishlist = { get, has, add, remove, toggle, count, clear, makeHeart };
})();
