"use strict";
/* ── RD Advance Boutique — Compare Manager ──────────────────────
   Shared across all pages. Load BEFORE script.js.
   localStorage key : "rd_compare_list"  →  array of product IDs
   Max products      : 4
   Min to compare    : 2
─────────────────────────────────────────────────────────────── */
window.RDCompare = (function () {
  const KEY = "rd_compare_list";
  const MAX = 4;

  /* ── Storage ──────────────────────────────────────── */
  function getList() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function _save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
    _updateBadges();
    _updateButtons();
    window.dispatchEvent(new CustomEvent("compareUpdate", { detail: { list } }));
  }

  /* ── Public API ───────────────────────────────────── */
  function has(id)      { return getList().includes(String(id)); }
  function getCount()   { return getList().length; }
  function clear()      { _save([]); }

  function add(id) {
    id = String(id);
    const list = getList();
    if (list.includes(id)) return "already";
    if (list.length >= MAX) return "max";
    list.push(id);
    _save(list);
    return "added";
  }
  function remove(id) {
    _save(getList().filter(x => x !== String(id)));
  }
  function toggle(id) {
    if (has(id)) { remove(id); return "removed"; }
    return add(id);
  }

  /* ── UI — badges in nav ───────────────────────────── */
  function _updateBadges() {
    const count = getCount();
    document.querySelectorAll(".cmp-badge").forEach(el => {
      el.textContent = count;
      el.hidden = count === 0;
    });
    document.querySelectorAll(".nav-cmp-link").forEach(el => {
      el.classList.toggle("nav-cmp-link--has", count > 0);
    });
  }

  /* ── UI — compare buttons on product cards ────────── */
  function _updateButtons() {
    document.querySelectorAll("[data-cmp-id]").forEach(btn => {
      const active = has(btn.dataset.cmpId);
      btn.classList.toggle("cmp-btn--active", active);
      btn.setAttribute("aria-pressed", String(active));
      if (btn.classList.contains("cmp-card-btn")) {
        btn.textContent = active ? "✓ Comparing" : "⊞ Compare";
      }
    });
  }

  /* ── Toast notification ────────────────────────────── */
  function showToast(msg) {
    let el = document.getElementById("cmpToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "cmpToast";
      el.className = "cmp-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("cmp-toast--show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("cmp-toast--show"), 2600);
  }

  /* ── Init on DOMContentLoaded ──────────────────────── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { _updateBadges(); _updateButtons(); });
  } else {
    _updateBadges(); _updateButtons();
  }
  window.addEventListener("compareUpdate", () => { _updateButtons(); _updateBadges(); });

  return { getList, has, getCount, add, remove, toggle, clear, showToast, refresh: _updateButtons };
})();
