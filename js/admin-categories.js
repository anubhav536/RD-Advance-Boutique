(() => {
  "use strict";

  const API_BASE = "/api/v1/admin/data/categories";
  const PLACEHOLDER_IMAGE = "assets/logo.png";

  let categories = [];
  let currentEditId = "";

  const $ = (selector, root = document) => root.querySelector(selector);

  const normalize = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char]));

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "Unable to save categories.json.");
    return payload;
  };

  const loadCategories = async () => {
    const payload = await request(API_BASE);
    categories = Array.isArray(payload.data) ? payload.data : [];
    return categories;
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => reject(new Error("Unable to read the selected category image."));
    reader.readAsDataURL(file);
  });

  const renderPreview = (container, image) => {
    if (!container) return;
    container.innerHTML = image ? `<div class="preview-image-box"><img src="${escapeHtml(image)}" alt="Category preview"></div>` : "";
  };

  const getCategoryImage = (category) => category.image || category.coverImage || category.imageUrl || PLACEHOLDER_IMAGE;

  const readCategoryForm = async (form, current = {}) => {
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const slug = normalize(formData.get("slug") || name);
    const fileInput = $("input[type='file']", form);
    const uploadedImage = await readFileAsDataUrl(fileInput?.files?.[0]);

    if (!name) throw new Error("Please enter a category name.");
    if (!slug) throw new Error("Please enter a valid category slug.");

    return {
      id: current.id || slug,
      name,
      slug,
      description: String(formData.get("description") || "").trim(),
      image: uploadedImage || current.image || current.coverImage || current.imageUrl || "",
      featured: formData.get("featured") === "true",
      status: formData.get("status") || "active",
    };
  };

  const initImagePreview = (inputId, containerId) => {
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);
    if (!input || !container) return;

    input.addEventListener("change", async () => {
      try {
        const image = await readFileAsDataUrl(input.files?.[0]);
        renderPreview(container, image);
      } catch (error) {
        alert(error.message);
        input.value = "";
        renderPreview(container, "");
      }
    });
  };

  const initSlugSync = (nameId, slugId) => {
    const nameInput = document.getElementById(nameId);
    const slugInput = document.getElementById(slugId);
    if (!nameInput || !slugInput) return;

    nameInput.addEventListener("input", () => {
      if (!slugInput.dataset.manualSlug) slugInput.value = normalize(nameInput.value);
    });
    slugInput.addEventListener("input", () => {
      slugInput.dataset.manualSlug = "true";
      slugInput.value = normalize(slugInput.value);
    });
  };

  const initAddCategory = () => {
    const form = document.getElementById("categoryForm");
    if (!form) return;

    initImagePreview("categoryImage", "imagePreviewContainer");
    initSlugSync("categoryName", "categorySlug");

    form.addEventListener("reset", () => {
      setTimeout(() => renderPreview(document.getElementById("imagePreviewContainer"), ""));
      const slugInput = document.getElementById("categorySlug");
      if (slugInput) delete slugInput.dataset.manualSlug;
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = $("button[type='submit']", form);
      submitButton.disabled = true;

      try {
        const category = await readCategoryForm(form);
        await request(API_BASE, {
          method: "POST",
          body: JSON.stringify(category),
        });
        alert("Category Created Successfully ✨");
        window.location.href = "all-categories.html";
      } catch (error) {
        alert(error.message);
      } finally {
        submitButton.disabled = false;
      }
    });
  };

  const categoryMatches = (category) => {
    const search = String(document.getElementById("categorySearch")?.value || "").trim().toLowerCase();
    const type = String(document.getElementById("categoryTypeFilter")?.value || "").trim().toLowerCase();
    const status = String(document.getElementById("categoryStatusFilter")?.value || "").trim().toLowerCase();
    const haystack = [category.name, category.slug, category.id, category.description, category.type].join(" ").toLowerCase();

    if (search && !haystack.includes(search)) return false;
    if (type && type !== "all types" && !haystack.includes(type)) return false;
    if (status && status !== "status" && String(category.status || "active").toLowerCase() !== status) return false;
    return true;
  };

  const renderCategoryGrid = () => {
    const grid = document.getElementById("categoryGrid");
    if (!grid) return;

    const visibleCategories = categories.filter(categoryMatches);
    if (!visibleCategories.length) {
      grid.innerHTML = `
        <div class="gallery-preview-card">
          <img src="${PLACEHOLDER_IMAGE}" alt="Category">
          <div class="gallery-preview-content">
            <h3>No Categories Found</h3>
            <p>Create a category or adjust your search filters.</p>
          </div>
        </div>
      `;
      return;
    }

    grid.innerHTML = visibleCategories.map((category) => `
      <div class="gallery-preview-card" data-category-id="${escapeHtml(category.id)}">
        <img src="${escapeHtml(getCategoryImage(category))}" alt="${escapeHtml(category.name || "Category")}">
        <div class="gallery-preview-content">
          <h3>${escapeHtml(category.name || "Untitled Category")}</h3>
          <p>${escapeHtml(category.description || "Boutique category collection.")}</p>
          <div class="table-action-buttons">
            <a href="edit-category.html?id=${encodeURIComponent(category.id)}" class="edit-btn">Edit</a>
            <button type="button" class="delete-btn" data-action="delete" data-category-id="${escapeHtml(category.id)}">Delete</button>
          </div>
        </div>
      </div>
    `).join("");
  };

  const renderCategoryStats = () => {
    const total = categories.length;
    const active = categories.filter((category) => String(category.status || "active").toLowerCase() === "active").length;
    const featured = categories.filter((category) => Boolean(category.featured)).length;
    const hidden = categories.filter((category) => String(category.status || "active").toLowerCase() === "hidden").length;

    if (document.getElementById("totalCategories")) document.getElementById("totalCategories").textContent = total;
    if (document.getElementById("activeCategories")) document.getElementById("activeCategories").textContent = active;
    if (document.getElementById("featuredCategories")) document.getElementById("featuredCategories").textContent = featured;
    if (document.getElementById("hiddenCategories")) document.getElementById("hiddenCategories").textContent = hidden;
  };

  const deleteCategory = async (id, redirectAfterDelete = false) => {
    if (!id) throw new Error("Missing category id.");
    if (!confirm("Are you sure you want to delete this category?")) return;

    await request(`${API_BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
    categories = categories.filter((category) => String(category.id) !== String(id));
    alert("Category Deleted Successfully ✨");

    if (redirectAfterDelete) {
      window.location.href = "all-categories.html";
      return;
    }

    renderCategoryGrid();
    renderCategoryStats();
    renderEditCategoryList();
  };

  const initAllCategories = async () => {
    const grid = document.getElementById("categoryGrid");
    if (!grid) return;

    try {
      await loadCategories();
      renderCategoryGrid();
      renderCategoryStats();
    } catch (error) {
      grid.innerHTML = `
        <div class="gallery-preview-card">
          <img src="${PLACEHOLDER_IMAGE}" alt="Category">
          <div class="gallery-preview-content">
            <h3>Unable to Load Categories</h3>
            <p>${escapeHtml(error.message)}</p>
          </div>
        </div>
      `;
    }

    ["categorySearch", "categoryTypeFilter", "categoryStatusFilter"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", renderCategoryGrid);
      document.getElementById(id)?.addEventListener("change", renderCategoryGrid);
    });

    grid.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action='delete']");
      if (!button) return;
      try {
        button.disabled = true;
        await deleteCategory(button.dataset.categoryId);
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
      }
    });
  };

  const fillEditForm = (category) => {
    const form = document.getElementById("editCategoryForm");
    if (!form || !category) return;

    currentEditId = category.id;
    form.elements.name.value = category.name || "";
    form.elements.slug.value = category.slug || category.id || "";
    form.elements.description.value = category.description || "";
    form.elements.featured.value = String(Boolean(category.featured));
    form.elements.status.value = category.status || "active";
    renderPreview(document.getElementById("editPreviewContainer"), getCategoryImage(category));
  };

  const renderEditCategoryList = () => {
    const list = document.getElementById("editCategoryList");
    if (!list) return;

    if (!categories.length) {
      list.innerHTML = `
        <div class="overview-card">
          <h3>No Categories</h3>
          <p>Create a category before editing.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = categories.map((category) => `
      <div class="overview-card" data-category-id="${escapeHtml(category.id)}">
        <h3>📂 ${escapeHtml(category.name || "Untitled Category")}</h3>
        <p>${escapeHtml(category.description || "Boutique category collection.")}</p>
        <div class="table-action-buttons">
          <button type="button" class="edit-btn" data-action="edit" data-category-id="${escapeHtml(category.id)}">Edit</button>
          <button type="button" class="delete-btn" data-action="delete" data-category-id="${escapeHtml(category.id)}">Delete</button>
        </div>
      </div>
    `).join("");
  };

  const initEditCategory = async () => {
    const form = document.getElementById("editCategoryForm");
    if (!form) return;

    initImagePreview("editCategoryImage", "editPreviewContainer");
    initSlugSync("editCategoryName", "editCategorySlug");

    const requestedId = new URLSearchParams(window.location.search).get("id");
    try {
      await loadCategories();
      renderEditCategoryList();
      const category = categories.find((item) => String(item.id) === String(requestedId)) || categories[0];
      if (category) fillEditForm(category);
    } catch (error) {
      alert(error.message);
    }

    document.getElementById("editCategoryList")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const categoryId = button.dataset.categoryId;
      const category = categories.find((item) => String(item.id) === String(categoryId));

      if (button.dataset.action === "edit") {
        fillEditForm(category);
        history.replaceState(null, "", `edit-category.html?id=${encodeURIComponent(categoryId)}`);
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      try {
        button.disabled = true;
        await deleteCategory(categoryId, String(categoryId) === String(currentEditId));
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
      }
    });

    form.addEventListener("reset", () => {
      setTimeout(() => {
        const category = categories.find((item) => String(item.id) === String(currentEditId));
        fillEditForm(category);
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = $("button[type='submit']", form);
      const current = categories.find((category) => String(category.id) === String(currentEditId));
      if (!current) {
        alert("Choose a category to edit.");
        return;
      }

      submitButton.disabled = true;
      try {
        const category = await readCategoryForm(form, current);
        const payload = await request(`${API_BASE}/${encodeURIComponent(current.id)}`, {
          method: "PATCH",
          body: JSON.stringify(category),
        });
        const updatedCategory = payload.data || category;
        categories = categories.map((item) => String(item.id) === String(current.id) ? updatedCategory : item);
        currentEditId = updatedCategory.id || current.id;
        renderEditCategoryList();
        fillEditForm(updatedCategory);
        alert("Category Updated Successfully ✨");
      } catch (error) {
        alert(error.message);
      } finally {
        submitButton.disabled = false;
      }
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    initAddCategory();
    initAllCategories();
    initEditCategory();
  });
})();
