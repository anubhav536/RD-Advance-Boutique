(function () {
  "use strict";

  const DATA_SOURCES = {
    products: "/api/products",
    gallery: "data/gallery.json"
  };

  const STORAGE_KEYS = {
    recentlyViewed: "rd_recently_viewed_items",
    recommendationClicks: "rd_recommendation_clicks"
  };

  const MAX_RECENT_ITEMS = 12;

  const SECTION_CONFIGS = {
    youMayAlsoLike: {
      title: "You May Also Like",
      eyebrow: "Smart picks",
      description: "Chosen from same category, occasion, color, style, manual picks, trending, and featured items.",
      strategy: "similar"
    },
    completeTheLook: {
      title: "Complete The Look",
      eyebrow: "Style together",
      description: "Matching products and gallery styles that pair with this selection.",
      strategy: "matching"
    },
    occasion: {
      title: "Recommended For This Occasion",
      eyebrow: "Occasion-ready",
      description: "More boutique picks for the same celebration, office, party, or daily-wear need.",
      strategy: "occasion"
    },
    recentlyViewed: {
      title: "Recently Viewed",
      eyebrow: "Personalized",
      description: "Items you viewed recently on this device.",
      strategy: "recent"
    },
    trending: {
      title: "Trending Now",
      eyebrow: "Popular now",
      description: "Trending and featured boutique picks from products and gallery.",
      strategy: "trending"
    }
  };

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function toArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (value === undefined || value === null || value === "") return [];
    return [value];
  }

  function normalizedSet(value) {
    return new Set(toArray(value).map(normalize).filter(Boolean));
  }

  function intersects(a, b) {
    const aSet = normalizedSet(a);
    if (!aSet.size) return false;
    return toArray(b).some(item => aSet.has(normalize(item)));
  }

  function getItemId(item) {
    return String(item?.id || item?.slug || normalize(item?.title || item?.name || ""));
  }

  function getTypedId(item) {
    return `${item.source}:${getItemId(item)}`;
  }

  function formatPrice(price) {
    if (price === undefined || price === null || price === "") return "Price on request";
    const n = Number(price);
    if (Number.isFinite(n)) {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
    }
    return String(price);
  }

  function safeJsonRead(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn(`Unable to read ${key}`, error);
      return fallback;
    }
  }

  function safeJsonWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Unable to write ${key}`, error);
    }
  }

  async function loadJson(source) {
    const response = await fetch(source, { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load ${source}: ${response.status}`);
    return response.json();
  }

  async function loadCatalog() {
    const [productsResult, galleryResult] = await Promise.allSettled([
      loadJson(DATA_SOURCES.products),
      loadJson(DATA_SOURCES.gallery)
    ]);

    const products = productsResult.status === "fulfilled" && Array.isArray(productsResult.value) ? productsResult.value : [];
    const gallery = galleryResult.status === "fulfilled" && Array.isArray(galleryResult.value) ? galleryResult.value : [];

    return [
      ...products.filter(item => item.status !== "inactive").map(item => ({ ...item, source: "product" })),
      ...gallery.filter(item => item.status !== "inactive").map(item => ({ ...item, source: "gallery" }))
    ];
  }

  function getCurrentId() {
    const params = new URLSearchParams(window.location.search);
    return normalize(params.get("id") || params.get("product") || params.get("design") || "");
  }

  function getCurrentSource() {
    if (document.body.classList.contains("gallery-detail-page")) return "gallery";
    if (document.body.classList.contains("product-detail-page")) return "product";
    return "home";
  }

  function getDetailItem(catalog) {
    const selectedId = getCurrentId();
    const source = getCurrentSource();
    if (!selectedId || source === "home") return null;
    return catalog.find(item => item.source === source && normalize(getItemId(item)) === selectedId)
      || catalog.find(item => normalize(getItemId(item)) === selectedId)
      || null;
  }

  function getUrl(item) {
    const file = item.source === "gallery" ? "gallery-details.html" : "product-details.html";
    return `${file}?id=${encodeURIComponent(getItemId(item))}`;
  }

  function getOccasions(item) {
    return [...new Set([...toArray(item.occasion), ...toArray(item.occasions)].map(normalize).filter(Boolean))];
  }

  function getColors(item) {
    return [...new Set([...toArray(item.color), ...toArray(item.colors)].map(normalize).filter(Boolean))];
  }

  function getManualIds(item) {
    return [...new Set([
      ...toArray(item.recommendedProducts),
      ...toArray(item.manualRecommendations),
      ...toArray(item.suggestedProducts)
    ].map(normalize).filter(Boolean))];
  }

  function getMatchIds(item) {
    return [...new Set([
      ...toArray(item.matchWith),
      ...toArray(item.compatibleWith)
    ].map(normalize).filter(Boolean))];
  }

  function scoreCandidate(candidate, context, strategy) {
    if (!candidate) return 0;
    const current = context.currentItem;
    const clicked = context.clicks[normalize(getTypedId(candidate))] || context.clicks[normalize(getItemId(candidate))] || 0;
    let score = Number(candidate.recommendationPriority || 0) / 10 + Math.min(clicked, 5);

    if (candidate.trending) score += 16;
    if (candidate.featured) score += 10;

    if (!current) return score;

    const candidateId = normalize(getItemId(candidate));
    const currentId = normalize(getItemId(current));
    if (candidateId === currentId && candidate.source === current.source) return -999;

    if (normalize(candidate.category) && normalize(candidate.category) === normalize(current.category)) score += 35;
    if (intersects(getOccasions(candidate), getOccasions(current))) score += 30;
    if (intersects(getColors(candidate), getColors(current))) score += 20;
    if (intersects(candidate.style, current.style)) score += 25;
    if (intersects(candidate.audience, current.audience)) score += 12;

    const currentManualIds = getManualIds(current);
    const currentMatchIds = getMatchIds(current);
    const candidateManualIds = getManualIds(candidate);
    const candidateMatchIds = getMatchIds(candidate);

    if (currentManualIds.includes(candidateId)) score += 45;
    if (currentMatchIds.includes(candidateId)) score += 50;
    if (candidateManualIds.includes(currentId)) score += 18;
    if (candidateMatchIds.includes(currentId)) score += 30;

    if (strategy === "matching") {
      score += currentMatchIds.includes(candidateId) ? 70 : -12;
      if (candidate.source !== current.source) score += 12;
    }

    if (strategy === "occasion") {
      score += intersects(getOccasions(candidate), getOccasions(current)) ? 45 : -20;
    }

    if (strategy === "similar") {
      score += currentManualIds.includes(candidateId) ? 30 : 0;
    }

    return score;
  }

  function rankedItems(catalog, context, strategy, limit) {
    return catalog
      .map(item => ({ item, score: scoreCandidate(item, context, strategy) }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score || normalize(a.item.title || a.item.name).localeCompare(normalize(b.item.title || b.item.name)))
      .slice(0, limit)
      .map(entry => entry.item);
  }

  function getRecentItems(catalog, context, limit) {
    const currentTypedId = context.currentItem ? normalize(getTypedId(context.currentItem)) : "";
    const recent = safeJsonRead(STORAGE_KEYS.recentlyViewed, []);
    return recent
      .map(entry => catalog.find(item => getTypedId(item) === entry.typedId || (item.source === entry.source && getItemId(item) === entry.id)))
      .filter(Boolean)
      .filter(item => normalize(getTypedId(item)) !== currentTypedId)
      .slice(0, limit);
  }

  function getSectionItems(catalog, context, strategy, limit) {
    if (strategy === "recent") return getRecentItems(catalog, context, limit);
    if (strategy === "trending") {
      return catalog
        .filter(item => item.trending || item.featured)
        .sort((a, b) => Number(b.trending || false) - Number(a.trending || false) || Number(b.recommendationPriority || 0) - Number(a.recommendationPriority || 0))
        .slice(0, limit);
    }
    return rankedItems(catalog, context, strategy, limit);
  }

  function rememberItem(item) {
    if (!item) return;
    const entry = {
      source: item.source,
      id: getItemId(item),
      typedId: getTypedId(item),
      title: item.title || item.name || "Boutique item",
      image: item.image || item.images?.[0] || "assets/logo.png",
      viewedAt: new Date().toISOString()
    };
    const existing = safeJsonRead(STORAGE_KEYS.recentlyViewed, []);
    const next = [entry, ...existing.filter(old => old.typedId !== entry.typedId)].slice(0, MAX_RECENT_ITEMS);
    safeJsonWrite(STORAGE_KEYS.recentlyViewed, next);
  }

  function rememberClick(item) {
    const key = normalize(getTypedId(item));
    const clicks = safeJsonRead(STORAGE_KEYS.recommendationClicks, {});
    clicks[key] = Number(clicks[key] || 0) + 1;
    safeJsonWrite(STORAGE_KEYS.recommendationClicks, clicks);
  }

  function createRecommendationCard(item) {
    const title = item.title || item.name || "Boutique item";
    const category = item.category || (item.source === "gallery" ? "Design" : "Boutique");
    const image = item.image || item.images?.[0] || "assets/logo.png";
    const card = document.createElement("a");
    card.className = "recommendation-card";
    card.href = getUrl(item);
    card.dataset.source = item.source;
    card.dataset.itemId = getItemId(item);
    card.innerHTML = `
      <span class="recommendation-card__badge">${item.source === "gallery" ? "Design" : "Product"}</span>
      <div class="recommendation-card__media">
        <img src="${image}" alt="${title}" loading="lazy" onerror="this.src='assets/logo.png'">
      </div>
      <div class="recommendation-card__body">
        <span class="recommendation-card__category">${category}</span>
        <h3>${title}</h3>
        <p>${item.source === "product" ? formatPrice(item.price) : (item.shortDescription || "Boutique design inspiration")}</p>
      </div>`;
    card.addEventListener("click", () => rememberClick(item));
    return card;
  }

  function renderSection(container, config, items) {
    if (!container || !items.length) return;
    const section = document.createElement("section");
    section.className = "recommendation-section section";
    section.innerHTML = `
      <div class="section__intro recommendation-section__intro">
        <p class="eyebrow">${config.eyebrow}</p>
        <h2>${config.title}</h2>
        <p>${config.description}</p>
      </div>
      <div class="recommendation-grid"></div>`;
    section.querySelector(".recommendation-grid").replaceChildren(...items.map(createRecommendationCard));
    container.appendChild(section);
  }

  function renderRecommendations(catalog, currentItem) {
    const containers = document.querySelectorAll("[data-recommendations]");
    if (!containers.length) return;

    const context = {
      currentItem,
      clicks: safeJsonRead(STORAGE_KEYS.recommendationClicks, {})
    };

    containers.forEach(container => {
      const keys = (container.dataset.recommendations || "")
        .split(",")
        .map(key => key.trim())
        .filter(Boolean);
      const limit = Number(container.dataset.recommendationLimit || 4);
      container.replaceChildren();
      keys.forEach(key => {
        const config = SECTION_CONFIGS[key];
        if (!config) return;
        const items = getSectionItems(catalog, context, config.strategy, limit);
        renderSection(container, config, items);
      });
    });
  }

  async function initRecommendations() {
    const containers = document.querySelectorAll("[data-recommendations]");
    const isDetailPage = document.body.classList.contains("product-detail-page") || document.body.classList.contains("gallery-detail-page");
    if (!containers.length && !isDetailPage) return;

    try {
      const catalog = await loadCatalog();
      const currentItem = getDetailItem(catalog);
      rememberItem(currentItem);
      renderRecommendations(catalog, currentItem);
    } catch (error) {
      console.warn("Recommendations could not be loaded.", error);
    }
  }

  window.RDRecommendations = {
    loadCatalog,
    rememberItem,
    renderRecommendations
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRecommendations, { once: true });
  } else {
    initRecommendations();
  }
})();
