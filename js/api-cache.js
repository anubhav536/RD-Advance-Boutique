"use strict";

/**
 * RD Boutique — Client-Side API Cache
 * TTL: 5 minutes (sessionStorage). Falls back to local JSON files.
 * Usage: window.RDApi.getProducts() / window.RDApi.getCategories()
 */
(function () {
  const TTL_MS     = 5 * 60 * 1000;
  const KEY_PRE    = "rd_apicache_";
  const KEY_TS_PRE = "rd_apicache_ts_";

  function cacheRead(key) {
    try {
      const ts = parseInt(sessionStorage.getItem(KEY_TS_PRE + key) || "0", 10);
      if (Date.now() - ts > TTL_MS) return null;
      const raw = sessionStorage.getItem(KEY_PRE + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function cacheWrite(key, data) {
    try {
      sessionStorage.setItem(KEY_PRE + key, JSON.stringify(data));
      sessionStorage.setItem(KEY_TS_PRE + key, String(Date.now()));
    } catch (_) {}
  }

  function cacheBust(key) {
    try {
      sessionStorage.removeItem(KEY_PRE + key);
      sessionStorage.removeItem(KEY_TS_PRE + key);
    } catch (_) {}
  }

  async function fetchJson(url, fallbackUrl) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) {
      console.warn("[RDApi] Primary fetch failed:", url, e.message);
      if (fallbackUrl) {
        try {
          const res2 = await fetch(fallbackUrl, { cache: "no-store" });
          if (res2.ok) return await res2.json();
        } catch (e2) {
          console.warn("[RDApi] Fallback fetch also failed:", fallbackUrl, e2.message);
        }
      }
      return null;
    }
  }

  async function getProducts({ forceRefresh = false } = {}) {
    if (!forceRefresh) {
      const cached = cacheRead("products");
      if (cached) return cached;
    }
    const data = await fetchJson("/api/products", "data/products.json");
    const arr  = Array.isArray(data) ? data : [];
    if (arr.length) cacheWrite("products", arr);
    return arr;
  }

  async function getCategories({ forceRefresh = false } = {}) {
    if (!forceRefresh) {
      const cached = cacheRead("categories");
      if (cached) return cached;
    }
    const data = await fetchJson("/api/categories", "data/categories.json");
    const arr  = Array.isArray(data) ? data : [];
    if (arr.length) cacheWrite("categories", arr);
    return arr;
  }

  function bustProducts()   { cacheBust("products"); }
  function bustCategories() { cacheBust("categories"); }
  function bustAll()        { bustProducts(); bustCategories(); }

  window.RDApi = { getProducts, getCategories, bustProducts, bustCategories, bustAll };
})();
