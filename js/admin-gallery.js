(() => {
  "use strict";

  const API_BASE = "/api/v1/gallery";
  const PLACEHOLDER_IMAGE = "assets/logo.png";
  const page = window.location.pathname.split("/").pop();
  let galleryItems = [];
  let selectedItem = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = value => String(value || "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) throw new Error(payload.message || "Gallery request failed.");
    return payload.data;
  };

  const loadGallery = async () => {
    const data = await request(API_BASE);
    galleryItems = Array.isArray(data) ? data : [];
    return galleryItems;
  };

  const cardHtml = item => `
    <div class="gallery-preview-card" data-gallery-id="${escapeHtml(item.id)}">
      <div class="gallery-preview-image">
        <img src="${escapeHtml(item.image || PLACEHOLDER_IMAGE)}" alt="${escapeHtml(item.alt || item.title || "Gallery image")}">
      </div>
      <div class="gallery-preview-content">
        <h3>${escapeHtml(item.title || item.name || "Untitled gallery")}</h3>
        <p>${escapeHtml(item.description || item.category || "Boutique gallery image")}</p>
        <div class="product-meta-grid">
          <div class="meta-item"><span>Category</span><p>${escapeHtml(item.category || "Gallery")}</p></div>
          <div class="meta-item"><span>Status</span><p>${escapeHtml(item.status || "active")}</p></div>
        </div>
        <div class="table-action-buttons">
          <a class="edit-btn" href="edit-gallery.html?id=${encodeURIComponent(item.id)}">Edit</a>
          <button type="button" class="delete-btn" data-delete-gallery="${escapeHtml(item.id)}">Delete</button>
        </div>
      </div>
    </div>`;

  const renderList = () => {
    const grid = $(".gallery-preview-grid");
    if (!grid) return;
    const search = String($("input[type='search'], .product-search")?.value || "").trim().toLowerCase();
    const visible = galleryItems.filter(item => [item.title, item.name, item.category, item.description, item.id]
      .filter(Boolean).join(" ").toLowerCase().includes(search));
    grid.innerHTML = visible.length ? visible.map(cardHtml).join("") : "<p>No gallery images found.</p>";
  };

  const setupList = async () => {
    const grid = $(".gallery-preview-grid");
    if (!grid) return;
    grid.innerHTML = "<p>Loading gallery...</p>";
    try {
      await loadGallery();
      renderList();
    } catch (error) {
      grid.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    }
    $("input[type='search'], .product-search")?.addEventListener("input", renderList);
    grid.addEventListener("click", async event => {
      const button = event.target.closest("[data-delete-gallery]");
      if (!button) return;
      if (!confirm("Are you sure you want to delete this gallery image?")) return;
      try {
        await request(`${API_BASE}/${encodeURIComponent(button.dataset.deleteGallery)}`, { method: "DELETE" });
        galleryItems = galleryItems.filter(item => String(item.id) !== String(button.dataset.deleteGallery));
        renderList();
        alert("Gallery Deleted Successfully ✨");
      } catch (error) {
        alert(error.message);
      }
    });
  };

  const formValue = (form, index, fallback = "") => String($$("input, select, textarea", form)[index]?.value || fallback).trim();

  const fillEditForm = item => {
    selectedItem = item;
    const form = $("#editGalleryForm");
    if (!form || !item) return;
    const fields = $$("input, select, textarea", form);
    if (fields[0]) fields[0].value = item.title || item.name || "";
    if (fields[1]) fields[1].value = item.category || "";
    if (fields[2]) fields[2].value = item.description || "";
    if (fields[4]) fields[4].value = item.featured ? "Yes" : "No";
    if (fields[5]) fields[5].value = Array.isArray(item.tags) ? item.tags.join(", ") : (item.tags || "");
    if (fields[6]) fields[6].value = item.status || "Active";
    const preview = $("#editGalleryPreviewContainer");
    if (preview) preview.innerHTML = `<div class="preview-image-box"><img src="${escapeHtml(item.image || PLACEHOLDER_IMAGE)}" alt="${escapeHtml(item.alt || item.title || "Preview")}"></div>`;
  };

  const setupEdit = async () => {
    const form = $("#editGalleryForm");
    if (!form) return;
    try {
      await loadGallery();
      const id = new URLSearchParams(window.location.search).get("id");
      fillEditForm(galleryItems.find(item => String(item.id) === String(id)) || galleryItems[0]);
    } catch (error) {
      alert(error.message);
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!selectedItem) return;
      try {
        const payload = {
          title: formValue(form, 0, selectedItem.title),
          category: formValue(form, 1, selectedItem.category),
          description: formValue(form, 2, selectedItem.description),
          image: selectedItem.image,
          featured: formValue(form, 4).toLowerCase() === "yes",
          tags: formValue(form, 5),
          status: formValue(form, 6, selectedItem.status || "Active")
        };
        selectedItem = await request(`${API_BASE}/${encodeURIComponent(selectedItem.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        alert("Gallery Updated Successfully ✨");
      } catch (error) {
        alert(error.message);
      }
    }, true);

    $$(".delete-btn").forEach(button => button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!selectedItem || !confirm("Are you sure you want to delete this gallery image?")) return;
      try {
        await request(`${API_BASE}/${encodeURIComponent(selectedItem.id)}`, { method: "DELETE" });
        alert("Gallery Deleted Successfully ✨");
        window.location.href = "all-gallery.html";
      } catch (error) {
        alert(error.message);
      }
    }, true));
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (page === "all-gallery.html" || page === "admin-gallery.html") setupList();
    if (page === "edit-gallery.html") setupEdit();
  });
})();
