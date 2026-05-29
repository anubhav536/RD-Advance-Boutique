(() => {
  "use strict";

  const API_BASE = "/api/v1/products";
  const ASSET_API_BASE = "/api/v1/admin/assets/products";
  const DATA_SOURCE = "data/products.json";
  const PLACEHOLDER_IMAGE = "assets/logo.png";

  const page = window.location.pathname.split("/").pop() || "all-products.html";
  const params = new URLSearchParams(window.location.search);
  let products = [];
  let selectedProduct = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const normalize = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const formatPrice = (value) => {
    if (value === undefined || value === null || value === "") return "On request";
    if (typeof value === "string" && Number.isNaN(Number(value))) return value;
    return `₹${Number(value).toLocaleString("en-IN")}`;
  };

  const typeLabel = (type) => {
    const normalized = normalize(type);
    if (normalized === "affiliate") return "Affiliate Product";
    if (normalized === "ready-made") return "Ready-Made";
    return "Own Product";
  };

  const normalizeType = (value) => {
    const normalized = normalize(value);
    if (normalized.includes("affiliate")) return "affiliate";
    if (normalized.includes("ready")) return "ready-made";
    return "boutique";
  };

  const textList = (value) => {
    if (Array.isArray(value)) return value;
    return String(value || "")
      .split(/\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  };

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || "Unable to update products.json.");
    }

    return payload;
  };

  const loadProducts = async () => {
    try {
      const payload = await request(API_BASE);
      products = Array.isArray(payload.data) ? payload.data : [];
    } catch (apiError) {
      const response = await fetch(DATA_SOURCE, { cache: "no-store" });
      products = response.ok ? await response.json() : [];
    }

    products = Array.isArray(products) ? products : [];
    return products;
  };

  const uploadProductImage = async (file) => {
    const formData = new FormData();
    formData.append("asset", file);
    formData.append("title", file.name.replace(/\.[^.]+$/, ""));

    const response = await fetch(ASSET_API_BASE, {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || "Unable to upload product image locally.");
    }

    return payload.data?.url || payload.data?.path || PLACEHOLDER_IMAGE;
  };

  const readFilesAsImages = async (input, fallback = []) => {
    const files = Array.from(input?.files || []);
    if (files.length === 0) return fallback;

    return Promise.all(files.map(uploadProductImage));
  };

  const readForm = async (form, current = {}) => {
    const inputs = $$("input, select, textarea", form);
    const isEditForm = form.id === "editProductForm";
    const titleInput = inputs[0];
    const categoryInput = inputs[1];
    const typeInput = isEditForm ? null : inputs[2];
    const priceInput = isEditForm ? inputs[2] : inputs[3];
    const discountInput = isEditForm ? inputs[3] : inputs[4];
    const descriptionInput = isEditForm ? inputs[4] : inputs[5];
    const featuresInput = isEditForm ? inputs[5] : inputs[6];
    const tagsInput = isEditForm ? null : inputs[7];
    const stockInput = isEditForm ? inputs[6] : inputs[8];
    const fileInput = inputs.find((input) => input.type === "file");
    const linkInput = inputs.find((input) => input.type === "url");
    const images = await readFilesAsImages(fileInput, current.images || (current.image ? [current.image] : []));
    const priceValue = priceInput?.value?.trim();
    const discountValue = discountInput?.value?.trim();
    const stockValue = stockInput?.value?.trim();
    const title = titleInput?.value?.trim();
    const productType = typeInput ? normalizeType(typeInput.value) : (current.productType || current.type || "boutique");

    return {
      title,
      name: title,
      category: categoryInput?.value?.trim(),
      productType,
      type: productType,
      price: priceValue === "" ? "On request" : Number(priceValue),
      discountPrice: discountValue === "" ? null : Number(discountValue),
      description: descriptionInput?.value?.trim(),
      details: current.details || descriptionInput?.value?.trim(),
      features: textList(featuresInput?.value),
      tags: tagsInput ? textList(tagsInput.value) : (current.tags || []),
      stockQuantity: stockValue === "" ? 0 : Number(stockValue),
      stock: stockValue === "" ? 0 : Number(stockValue),
      image: images[0] || PLACEHOLDER_IMAGE,
      images: images.length > 0 ? images : [PLACEHOLDER_IMAGE],
      link: linkInput?.value?.trim() || current.link || "",
      affiliateUrl: productType === "affiliate" ? (linkInput?.value?.trim() || current.affiliateUrl || "") : "",
      featured: current.featured || false,
      status: Number(stockValue || current.stockQuantity || 0) === 0 ? "out-of-stock" : "active",
    };
  };

  const productMatches = (product, searchTerm, category, type) => {
    const haystack = normalize(`${product.title} ${product.name} ${product.category} ${product.description}`);
    const matchesSearch = !searchTerm || haystack.includes(searchTerm);
    const matchesCategory = !category || category === "all-categories" || normalize(product.category) === category;
    const matchesType = !type || type === "all-types" || normalize(product.productType || product.type) === type || normalize(typeLabel(product.productType || product.type)) === type;
    return matchesSearch && matchesCategory && matchesType;
  };

  const renderStatus = (product) => {
    const status = product.status || (Number(product.stockQuantity || product.stock || 0) > 0 ? "active" : "out-of-stock");
    const className = normalize(status) === "active" ? "status-active" : "status-inactive";
    return `<span class="${className}">${status.replace(/-/g, " ")}</span>`;
  };

  const deleteProduct = async (id) => {
    if (!id || !confirm("Are you sure you want to delete this product?")) return;
    await request(`${API_BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
    products = products.filter((product) => String(product.id) !== String(id));
    alert("Product Deleted Successfully");
  };

  const renderAllProducts = () => {
    const tbody = $("#productsTableBody");
    if (!tbody) return;

    const searchTerm = normalize($(".product-search")?.value);
    const filters = $$(".product-filter-select").map((select) => normalize(select.value));
    const filtered = products.filter((product) => productMatches(product, searchTerm, filters[0], filters[1]));

    tbody.innerHTML = filtered.map((product) => `
      <tr data-product-id="${product.id}">
        <td><img src="${product.image || PLACEHOLDER_IMAGE}" class="table-product-image" alt="${product.title || product.name || "Product"}"></td>
        <td><a href="product-details.html?id=${encodeURIComponent(product.id)}">${product.title || product.name || "Untitled Product"}</a></td>
        <td>${product.category || "Boutique"}</td>
        <td>${formatPrice(product.discountPrice || product.price)}</td>
        <td>${typeLabel(product.productType || product.type)}</td>
        <td>${renderStatus(product)}</td>
        <td>
          <div class="table-action-buttons">
            <a href="edit-product.html?id=${encodeURIComponent(product.id)}" class="edit-btn">Edit</a>
            <button type="button" class="delete-btn" data-product-id="${product.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="7">No products found in products.json.</td></tr>`;

    const cards = $$(".analytics-card h2");
    if (cards[0]) cards[0].textContent = products.length;
    if (cards[1]) cards[1].textContent = products.filter((product) => normalize(product.status) === "active").length;
    if (cards[2]) cards[2].textContent = products.filter((product) => normalize(product.productType || product.type) === "affiliate").length;
    if (cards[3]) cards[3].textContent = new Set(products.map((product) => normalize(product.category)).filter(Boolean)).size;
  };

  const populateFilters = () => {
    const selects = $$(".product-filter-select");
    if (selects[0]) {
      const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort();
      selects[0].innerHTML = `<option>All Categories</option>${categories.map((category) => `<option>${category}</option>`).join("")}`;
    }
    if (selects[1]) {
      selects[1].innerHTML = `<option>All Types</option><option>Own Product</option><option>Ready-Made</option><option>Affiliate Product</option>`;
    }
  };

  const setupAllProducts = async () => {
    await loadProducts();
    populateFilters();
    renderAllProducts();
    $(".product-search")?.addEventListener("input", renderAllProducts);
    $$(".product-filter-select").forEach((select) => select.addEventListener("change", renderAllProducts));
    $("#productsTableBody")?.addEventListener("click", async (event) => {
      const button = event.target.closest(".delete-btn");
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        await deleteProduct(button.dataset.productId);
        renderAllProducts();
      } catch (error) {
        alert(error.message);
      }
    }, true);
  };

  const setSelectValue = (select, value) => {
    if (!select) return;
    const normalizedValue = normalize(value);
    const option = Array.from(select.options).find((item) => normalize(item.value || item.textContent) === normalizedValue);
    if (option) select.value = option.value || option.textContent.trim();
  };

  const fillEditForm = (product) => {
    const form = $("#editProductForm");
    if (!form || !product) return;
    selectedProduct = product;
    const inputs = $$('input, select, textarea', form);
    const [titleInput, categoryInput, priceInput, discountInput, descriptionInput, featuresInput, stockInput] = inputs;
    const typeSelect = inputs.find((input) => input.tagName === "SELECT" && input !== categoryInput);
    const linkInput = inputs.find((input) => input.type === "url");

    if (titleInput) titleInput.value = product.title || product.name || "";
    setSelectValue(categoryInput, product.category);
    setSelectValue(typeSelect, typeLabel(product.productType || product.type));
    if (priceInput) priceInput.value = Number.isFinite(Number(product.price)) ? product.price : "";
    if (discountInput) discountInput.value = product.discountPrice || "";
    if (descriptionInput) descriptionInput.value = product.description || "";
    if (featuresInput) featuresInput.value = (product.features || []).join("\n");
    if (stockInput) stockInput.value = product.stockQuantity ?? product.stock ?? 0;
    if (linkInput) linkInput.value = product.link || product.affiliateUrl || "";
    renderPreview(product.images || (product.image ? [product.image] : []), "editPreviewContainer");
  };

  const renderEditList = () => {
    const list = $(".admin-product-list");
    if (!list) return;
    const searchTerm = normalize($("#searchProduct")?.value);
    const filtered = products.filter((product) => productMatches(product, searchTerm));

    list.innerHTML = filtered.map((product) => `
      <div class="admin-product-item" data-product-id="${product.id}">
        <div class="admin-product-image"><img src="${product.image || PLACEHOLDER_IMAGE}" alt="${product.title || product.name || "Product"}"></div>
        <div class="admin-product-info">
          <h3>${product.title || product.name || "Untitled Product"}</h3>
          <p>${product.description || "No description added."}</p>
        </div>
        <div class="admin-product-actions">
          <button type="button" class="edit-btn" data-product-id="${product.id}">Edit</button>
          <button type="button" class="delete-btn" data-product-id="${product.id}">Delete</button>
        </div>
      </div>
    `).join("") || `<p>No products found in products.json.</p>`;
  };

  const setupEditProduct = async () => {
    await loadProducts();
    renderEditList();
    const requestedId = params.get("id");
    fillEditForm(products.find((product) => String(product.id) === String(requestedId)) || products[0]);

    $("#searchProduct")?.addEventListener("input", renderEditList);
    $(".admin-product-list")?.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const product = products.find((item) => String(item.id) === String(button.dataset.productId));
      if (button.classList.contains("edit-btn")) {
        fillEditForm(product);
        $("#editProductForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (button.classList.contains("delete-btn")) {
        try {
          await deleteProduct(button.dataset.productId);
          renderEditList();
          fillEditForm(products[0]);
        } catch (error) {
          alert(error.message);
        }
      }
    }, true);

    $("#editProductForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        const payload = await readForm(event.currentTarget, selectedProduct || {});
        const saved = await request(`${API_BASE}/${encodeURIComponent(selectedProduct.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        selectedProduct = saved.data;
        await loadProducts();
        renderEditList();
        fillEditForm(selectedProduct);
        alert("Product Updated Successfully ✨");
      } catch (error) {
        alert(error.message);
      }
    }, true);
  };

  const renderPreview = (images, containerId) => {
    const container = $(`#${containerId}`);
    if (!container) return;
    const imageList = images.length ? images : [PLACEHOLDER_IMAGE];
    container.innerHTML = imageList.map((image) => `
      <div class="preview-image-box"><img src="${image}" alt="Preview"></div>
    `).join("");
  };

  const setupAddProduct = () => {
    $("#addProductForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        const payload = await readForm(event.currentTarget);
        await request(API_BASE, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        alert("Product Published Successfully ✨");
        window.location.href = "all-products.html";
      } catch (error) {
        alert(error.message);
      }
    }, true);
  };

  const setupDetails = async () => {
    await loadProducts();
    selectedProduct = products.find((product) => String(product.id) === String(params.get("id"))) || products[0];
    if (!selectedProduct) return;

    const product = selectedProduct;
    const detailBox = $(".product-details-info");
    const images = product.images?.length ? product.images : [product.image || PLACEHOLDER_IMAGE];
    $("#mainProductImage")?.setAttribute("src", images[0]);
    $("#mainProductImage")?.setAttribute("alt", product.title || product.name || "Product");
    $(".product-category-badge", detailBox).textContent = product.category || "Boutique Collection";
    $("h1", detailBox).textContent = product.title || product.name || "Untitled Product";
    $(".main-price", detailBox).textContent = formatPrice(product.discountPrice || product.price);
    $(".old-price", detailBox).textContent = product.discountPrice ? formatPrice(product.price) : "";
    $(".product-main-description", detailBox).textContent = product.description || "No product description added.";

    const metaValues = $$(".product-meta-grid .meta-item p", detailBox);
    if (metaValues[0]) metaValues[0].textContent = typeLabel(product.productType || product.type);
    if (metaValues[1]) metaValues[1].textContent = product.category || "Boutique";
    if (metaValues[2]) metaValues[2].textContent = `${product.stockQuantity ?? product.stock ?? 0} Available`;
    if (metaValues[3]) {
      metaValues[3].textContent = product.status || "active";
      metaValues[3].className = normalize(product.status) === "active" ? "status-active" : "status-inactive";
    }

    const editLink = $(".product-detail-buttons .edit-btn");
    if (editLink) editLink.href = `edit-product.html?id=${encodeURIComponent(product.id)}`;

    const gallery = $(".product-gallery-grid");
    if (gallery) {
      gallery.innerHTML = images.map((image) => `<div class="gallery-preview-image"><img src="${image}" alt="${product.title || "Product gallery"}"></div>`).join("");
    }

    const features = $(".overview-content");
    if (features) {
      const featureList = product.features?.length ? product.features : ["Premium boutique finish", "Carefully selected design", "Ready for customer enquiry"];
      features.innerHTML = featureList.map((feature) => `<div class="overview-card"><h3>✨ ${feature}</h3><p>${feature}</p></div>`).join("");
    }

    const description = $(".product-long-description");
    if (description) description.innerHTML = `<p>${product.details || product.description || "No detailed description added."}</p>`;

    const tags = $(".product-tags");
    if (tags) {
      const tagList = product.tags?.length ? product.tags : [product.category || "Boutique"];
      tags.innerHTML = tagList.map((tag) => `<span class="product-tag">${tag}</span>`).join("");
    }

    $(".product-detail-buttons .delete-btn")?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        await deleteProduct(product.id);
        window.location.href = "all-products.html";
      } catch (error) {
        alert(error.message);
      }
    }, true);
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (page === "add-product.html") setupAddProduct();
    if (page === "edit-product.html") setupEditProduct();
    if (page === "all-products.html") setupAllProducts();
    if (page === "product-details.html") setupDetails();
  });
})();
