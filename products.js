(function () {
  "use strict";

  const DATA_SOURCES = {
    products: "data/products.json",
    gallery: "data/gallery.json"
  };

  const WHATSAPP_LINK = "https://wa.me/917693849472";

  function getWhatsappUrl(message) {
    return `${WHATSAPP_LINK}?text=${encodeURIComponent(message)}`;
  }

  function getCurrentPageUrl(params) {
    const url = new URL(window.location.href);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
    return url.toString();
  }
  const PLACEHOLDER_CATEGORIES = ["Blouses", "Kurtis", "Bridal", "Kids Wear", "Accessories", "Custom Edit"];

  const state = {
    products: [],
    activeCategory: "all"
  };

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (text !== undefined && text !== null) {
      element.textContent = text;
    }

    return element;
  }

  async function loadJson(source) {
    const response = await fetch(source, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Unable to load ${source}: ${response.status}`);
    }

    return response.json();
  }

  function formatPrice(price) {
    if (price === undefined || price === null || price === "") {
      return "Price on request";
    }

    if (typeof price === "number") {
      return `₹${price.toLocaleString("en-IN")}`;
    }

    const value = String(price).trim();
    return value.toLowerCase().includes("request") ? value : value;
  }

  function getProductUrl(product) {
    const title = product.title || product.name || "Boutique Product";
    return getCurrentPageUrlForPath("product-details.html", { id: product.slug || product.id || normalize(title) });
  }

  function getGalleryUrl(item) {
    const title = item.title || item.name || "Boutique Design";
    return getCurrentPageUrlForPath("gallery-details.html", { id: item.slug || item.id || normalize(title) });
  }

  function getCurrentPageUrlForPath(pathname, params) {
    const url = new URL(pathname, window.location.href);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
    return url.toString();
  }

  function createProductOrderMessage(product) {
    const title = product.title || product.name || "Boutique Product";
    const category = product.category || "Boutique";
    const price = formatPrice(product.price || "");
    const productLink = getProductUrl(product);
    const customMessage = product.whatsappMessage ? `\nMessage: ${product.whatsappMessage}\n` : "";
    return `Hello RD Advance Boutique,\n\nI want to order this product.\n\nProduct Name: ${title}\nCategory: ${category}\nPrice: ${price}\nProduct URL: ${productLink}${customMessage}\nPlease guide me for payment and delivery.`;
  }

  function createDesignEnquiryMessage(item) {
    const title = item.title || item.name || "Boutique Design";
    const designLink = getGalleryUrl(item);
    const customMessage = item.whatsappMessage ? `\nMessage: ${item.whatsappMessage}\n` : "";
    return `Hello RD Advance Boutique,\n\nI am interested in this design.\n\nDesign Name: ${title}\nDesign URL: ${designLink}${customMessage}\nPlease provide stitching details and price.`;
  }

  async function shareCurrentPage(title, text) {
    const shareData = { title, text, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return "Shared successfully.";
      } catch (error) {
        if (error.name === "AbortError") return "Share cancelled.";
      }
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(window.location.href);
    } else {
      const field = document.createElement("textarea");
      field.value = window.location.href;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.left = "-9999px";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    return "Page link copied.";
  }

  function renderProductCard(product) {
    const title = product.title || product.name || "Boutique Product";
    const category = product.category || "Boutique";
    const image = product.image || product.images?.[0] || "assets/logo.png";
    const description = product.shortDescription || product.description || "Premium boutique fashion piece.";
    const link = getProductUrl(product);

    const article = createElement("article", "product-card");
    article.dataset.category = normalize(category);
    article.dataset.productId = product.id || normalize(title);

    const media = createElement("div", "product-card__media");
    const imageElement = document.createElement("img");
    imageElement.src = image;
    imageElement.alt = product.alt || title;
    imageElement.loading = "lazy";

    const wishlistButton = createElement("button", "wishlist-btn", "♡");
    wishlistButton.type = "button";
    wishlistButton.setAttribute("aria-label", `Add ${title} to wishlist`);

    const quickView = createElement("a", "quick-view-btn", "View Details");
    quickView.href = link;

    const content = createElement("div", "product-content");
    content.append(
      createElement("span", "product-category", category),
      createElement("h3", "", title),
      createElement("p", "product-price", formatPrice(product.price)),
      createElement("p", "product-description", description)
    );

    media.append(imageElement, wishlistButton, quickView);
    article.append(media, content);

    return article;
  }

  function renderPlaceholderCard(category, index) {
    const article = createElement("article", "product-card product-card--empty");
    article.setAttribute("aria-label", `Empty ${category} product card`);

    const media = createElement("div", "product-card__media");
    const placeholder = createElement("div", "product-card__placeholder");
    placeholder.setAttribute("aria-hidden", "true");

    const wishlistButton = createElement("button", "wishlist-btn", "♡");
    wishlistButton.type = "button";
    wishlistButton.setAttribute("aria-label", `Add future ${category} product to wishlist`);

    const quickView = createElement("button", "quick-view-btn", "Quick View");
    quickView.type = "button";
    quickView.disabled = true;

    const content = createElement("div", "product-content");
    content.append(
      createElement("span", "product-category", category),
      createElement("h3", "", `Product slot ${index + 1}`),
      createElement("p", "product-price", "Coming soon"),
      createElement("p", "product-description", "This dynamic card is ready for product image, price, category, and purchase link.")
    );

    media.append(placeholder, wishlistButton, quickView);
    article.append(media, content);

    return article;
  }

  function productMatches(product, searchTerm) {
    const matchesCategory = state.activeCategory === "all" || normalize(product.category) === state.activeCategory;
    const productText = normalize(`${product.title} ${product.category} ${product.description}`);
    const matchesSearch = !searchTerm || productText.includes(searchTerm);

    return matchesCategory && matchesSearch;
  }

  function renderProducts() {
    const productGrid = document.getElementById("productGrid");
    const productSearch = document.getElementById("productSearch");
    const productCount = document.getElementById("productCount");
    const emptyProducts = document.getElementById("emptyProducts");

    if (!productGrid) {
      return;
    }

    const searchTerm = normalize(productSearch ? productSearch.value : "");
    const filteredProducts = state.products.filter((product) => productMatches(product, searchTerm));
    productGrid.replaceChildren();

    if (state.products.length === 0) {
      productGrid.append(...PLACEHOLDER_CATEGORIES.map(renderPlaceholderCard));

      if (emptyProducts) {
        emptyProducts.hidden = false;
      }

      if (productCount) {
        productCount.textContent = "6 empty dynamic cards ready";
      }

      return;
    }

    productGrid.append(...filteredProducts.map(renderProductCard));

    if (emptyProducts) {
      emptyProducts.hidden = filteredProducts.length > 0;
    }

    if (productCount) {
      productCount.textContent = `${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"} found`;
    }
  }

  function bindProductControls() {
    const productSearch = document.getElementById("productSearch");
    const filterButtons = document.querySelectorAll(".category-filter .filter-btn");

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        filterButtons.forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        state.activeCategory = button.dataset.category || "all";
        renderProducts();
      });
    });

    if (productSearch) {
      productSearch.addEventListener("input", renderProducts);
    }
  }

  async function initShop() {
    const productGrid = document.getElementById("productGrid");

    if (!productGrid) {
      return;
    }

    bindProductControls();
    renderProducts();

    try {
      const products = await loadJson(DATA_SOURCES.products);
      state.products = Array.isArray(products) ? products : [];
    } catch (error) {
      console.error(error);
      state.products = [];
    }

    renderProducts();
  }

  function renderGalleryCard(item) {
    const title = item.title || item.name || "Boutique Design";
    const category = item.category || "Boutique";
    const previewId = `preview-${item.id || normalize(title)}`;
    const layoutClass = item.layout && item.layout !== "default" ? ` gallery-card--${normalize(item.layout)}` : "";

    const card = createElement("article", `gallery-card${layoutClass}`);
    card.dataset.category = normalize(category).replace("kids-wear", "kids");

    const preview = createElement("a", "gallery-card__preview");
    preview.href = getGalleryUrl(item);
    preview.setAttribute("aria-label", `Open details for ${title}`);

    const image = document.createElement("img");
    image.src = item.image || "assets/logo.png";
    image.alt = item.alt || title;
    image.loading = "lazy";

    const shade = createElement("span", "gallery-card__shade");
    const content = createElement("span", "gallery-card__content");
    content.append(createElement("small", "", category), createElement("strong", "", title), createElement("em", "", item.shortDescription || "View design details"));

    const enquire = createElement("a", "gallery-card__whatsapp", "Enquire on WhatsApp");
    enquire.href = getWhatsappUrl(createDesignEnquiryMessage(item));
    enquire.target = "_blank";
    enquire.rel = "noopener";
    enquire.dataset.noTransition = "true";

    preview.append(image, shade, content);
    card.append(preview, enquire);

    return card;
  }

  function renderLightbox(item) {
    const title = item.title || "Boutique Design";
    const previewId = `preview-${item.id || normalize(title)}`;
    const lightbox = createElement("div", "lightbox");
    lightbox.id = previewId;
    lightbox.setAttribute("aria-label", `Fullscreen preview of ${title}`);

    const closeLink = createElement("a", "lightbox__close", "×");
    closeLink.href = "#gallery-title";
    closeLink.setAttribute("aria-label", "Close image preview");

    const image = document.createElement("img");
    image.src = item.image || "assets/logo.png";
    image.alt = item.previewAlt || `${title} fullscreen preview`;

    lightbox.append(closeLink, image);

    return lightbox;
  }

  async function initGallery() {
    const galleryGrid = document.getElementById("galleryGrid");
    const galleryLightboxes = document.getElementById("galleryLightboxes");

    if (!galleryGrid) {
      return;
    }

    try {
      const galleryItems = await loadJson(DATA_SOURCES.gallery);
      const items = Array.isArray(galleryItems) ? galleryItems : [];

      galleryGrid.replaceChildren(...items.map(renderGalleryCard));

      if (galleryLightboxes) {
        galleryLightboxes.replaceChildren(...items.map(renderLightbox));
      }
    } catch (error) {
      console.error(error);
      galleryGrid.textContent = "Gallery images could not be loaded right now.";
    }
  }


  function getSelectedId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || params.get("product") || params.get("design") || "";
  }

  function renderList(container, items, className) {
    container.replaceChildren(...(items || []).map(item => createElement("span", className, item)));
  }

  async function initProductDetails() {
    const details = document.getElementById("productDetails");
    if (!details) return;

    const products = await loadJson(DATA_SOURCES.products).catch(() => []);
    const selectedId = normalize(getSelectedId());
    const product = (Array.isArray(products) ? products : []).find(item => normalize(item.id || item.slug || item.title || item.name) === selectedId) || products[0];
    if (!product) {
      details.textContent = "Product details are unavailable right now.";
      return;
    }

    const title = product.title || product.name || "Boutique Product";
    document.title = `${title} | RD Advance Boutique`;

    const allImages = (product.images && product.images.length > 0) ? product.images : [product.image || "assets/logo.png"];
    const gallery = document.getElementById("productGallery");
    if (gallery) {
      gallery.replaceChildren();
      allImages.forEach((imgSrc, index) => {
        const img = document.createElement("img");
        img.src = imgSrc;
        img.alt = `${product.alt || title} - image ${index + 1}`;
        img.loading = index === 0 ? "eager" : "lazy";
        gallery.appendChild(img);
      });
    }
    const mainImg = document.getElementById("productImage") || gallery?.querySelector("img");
    if (mainImg) {
      mainImg.src = allImages[0];
      mainImg.alt = product.alt || title;
    }
    document.getElementById("productCategory").textContent = product.category || "Boutique";
    document.getElementById("productTitle").textContent = title;
    document.getElementById("productPrice").textContent = formatPrice(product.price);
    const oldPrice = document.getElementById("productOldPrice");
    if (oldPrice) {
      oldPrice.textContent = product.oldPrice ? formatPrice(product.oldPrice) : "";
      oldPrice.hidden = !product.oldPrice;
    }
    document.getElementById("productLongDescription").textContent = product.longDescription || product.details || product.shortDescription || product.description || "Premium boutique fashion with personalized RD Advance Boutique guidance.";
    renderList(document.getElementById("productSizes"), product.sizes || ["Custom measurements"], "detail-chip");
    renderList(document.getElementById("productColors"), product.colors || ["As per fabric"], "detail-chip detail-chip--soft");
    const orderButton = document.getElementById("productWhatsapp");
    orderButton.href = getWhatsappUrl(createProductOrderMessage(product));
    const shareButton = document.getElementById("productShare");
    const shareStatus = document.getElementById("productShareStatus");
    shareButton.addEventListener("click", async () => {
      shareStatus.textContent = await shareCurrentPage(title, product.shortDescription || "RD Advance Boutique product");
    });

    const related = (Array.isArray(products) ? products : []).filter(item => item.id !== product.id && item.category === product.category).slice(0, 3);
    document.getElementById("relatedProducts").replaceChildren(...related.map(renderProductCard));
  }

  async function initGalleryDetails() {
    const details = document.getElementById("galleryDetails");
    if (!details) return;

    const galleryItems = await loadJson(DATA_SOURCES.gallery).catch(() => []);
    const selectedId = normalize(getSelectedId());
    const item = (Array.isArray(galleryItems) ? galleryItems : []).find(entry => normalize(entry.id || entry.slug || entry.title || entry.name) === selectedId) || galleryItems[0];
    if (!item) {
      details.textContent = "Gallery details are unavailable right now.";
      return;
    }

    const title = item.title || item.name || "Boutique Design";
    document.title = `${title} | RD Advance Boutique Gallery`;
    document.getElementById("galleryImage").src = item.image || "assets/logo.png";
    document.getElementById("galleryImage").alt = item.alt || title;
    document.getElementById("galleryCategory").textContent = item.category || "Boutique";
    document.getElementById("galleryTitle").textContent = title;
    document.getElementById("galleryLongDescription").textContent = item.longDescription || item.shortDescription || "Premium boutique design inspiration.";
    renderList(document.getElementById("galleryFeatures"), item.features || item.tags || ["Premium finishing", "Custom styling", "Boutique consultation"], "detail-feature");
    const enquiryButton = document.getElementById("galleryWhatsapp");
    enquiryButton.href = getWhatsappUrl(createDesignEnquiryMessage(item));
    const shareButton = document.getElementById("galleryShare");
    const shareStatus = document.getElementById("galleryShareStatus");
    shareButton.addEventListener("click", async () => {
      shareStatus.textContent = await shareCurrentPage(title, item.shortDescription || "RD Advance Boutique design");
    });
  }

  window.RDProductRenderer = {
    normalize,
    renderProductCard,
    renderGalleryCard,
    renderLightbox,
    renderProducts
  };

  document.addEventListener("DOMContentLoaded", () => {
    initShop();
    initGallery();
    initProductDetails();
    initGalleryDetails();
  });
})();
