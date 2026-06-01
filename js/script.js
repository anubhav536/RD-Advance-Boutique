(() => {
  "use strict";

  const doc = document;
  const body = doc.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealSelectors = [
    ".section__intro",
    ".design-card",
    ".course__media",
    ".course__content",
    ".why-card",
    ".testimonial-card",
    ".cta__content",
    ".shop-toolbar",
    ".collection-panel",
    ".product-card",
    ".empty-box",
    ".info-card",
    ".custom-banner-content",
    ".contact-card",
    ".contact-box",
    ".gallery-card",
    ".gallery-info > *",
    ".booking-intro",
    ".booking-layout",
    ".form-card",
    ".fabric-card",
    ".process-card",
    ".faq-section details",
    ".social-card",
    ".admissions-cta__stats > div"
  ].join(",");
  const buttonSelectors = [
    ".btn",
    ".header-cta",
    ".primary-btn",
    ".secondary-btn",
    ".view-btn",
    ".order-btn",
    ".filter-btn",
    ".product-card__action",
    ".action-btn",
    ".edit-btn",
    ".delete-btn"
  ].join(",");

  const isInternalPageLink = link => {
    if (!link || link.target || link.hasAttribute("download")) return false;
    if (link.dataset.noTransition === "true") return false;

    const url = new URL(link.href, window.location.href);
    const isSameOrigin = url.origin === window.location.origin;
    const isPage = /\.html$|\/$/.test(url.pathname) || url.pathname === window.location.pathname;
    const onlyHashChange = url.pathname === window.location.pathname && url.hash;

    return isSameOrigin && isPage && !onlyHashChange;
  };

  const markPageReady = () => {
    body.classList.add("luxury-page-ready");
  };

  const setupPageTransitions = () => {
    // Intentionally disabled so GitHub Pages content is visible and clickable immediately.
  };

  const setupScrollReveal = () => {
    const revealItems = Array.from(doc.querySelectorAll(revealSelectors));
    revealItems.forEach(item => item.classList.add("is-visible"));
  };

  const setupResponsiveNavigation = () => {
    const headers = Array.from(doc.querySelectorAll(".site-header, .navbar"));

    headers.forEach((header, index) => {
      const nav = header.querySelector(".nav, .nav-links");
      if (!nav) return;

      const navId = nav.id || `primary-navigation-${index + 1}`;
      nav.id = navId;

      let toggle = header.querySelector(".nav-toggle");
      if (!toggle) {
        toggle = doc.createElement("button");
        toggle.className = "nav-toggle";
        toggle.type = "button";
        toggle.setAttribute("aria-label", "Open navigation menu");
        toggle.setAttribute("aria-controls", navId);
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = "<span></span><span></span><span></span>";
        nav.before(toggle);
      }

      const closeMenu = () => {
        header.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation menu");
      };

      const openMenu = () => {
        header.classList.add("nav-open");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Close navigation menu");
      };

      toggle.addEventListener("click", () => {
        if (header.classList.contains("nav-open")) {
          closeMenu();
        } else {
          openMenu();
        }
      });

      nav.addEventListener("click", event => {
        if (event.target.closest("a")) closeMenu();
      });

      doc.addEventListener("keydown", event => {
        if (event.key === "Escape") closeMenu();
      });

      window.addEventListener("resize", () => {
        if (window.innerWidth >= 900) closeMenu();
      }, { passive: true });
    });
  };

  const setupSecretAdminShortcut = () => {
    const isHomePage = /(^|\/)index\.html$/.test(window.location.pathname) || /\/$/.test(window.location.pathname);
    if (!isHomePage) return;

    const trigger = doc.querySelector(".site-header .brand__logo");
    if (!trigger) return;

    const shortcutPath = "manage.html";
    const requiredHoldDurationMs = 11000;
    let holdTimer = 0;

    const cancelHold = () => {
      if (!holdTimer) return;
      window.clearTimeout(holdTimer);
      holdTimer = 0;
    };

    const openContentManager = () => {
      cancelHold();
      window.location.assign(shortcutPath);
    };

    trigger.addEventListener("pointerdown", () => {
      cancelHold();
      holdTimer = window.setTimeout(openContentManager, requiredHoldDurationMs);
    });

    ["pointerup", "pointercancel", "pointerleave", "blur"].forEach(eventName => {
      trigger.addEventListener(eventName, cancelHold);
    });

    trigger.addEventListener("contextmenu", event => {
      if (!holdTimer) return;
      event.preventDefault();
    });
  };

  const setupLuxuryButtons = () => {
    doc.addEventListener("pointerdown", event => {
      const button = event.target.closest(buttonSelectors);
      if (!button || reduceMotion) return;

      const rect = button.getBoundingClientRect();
      const ripple = doc.createElement("span");
      ripple.className = "luxury-ripple";
      ripple.style.setProperty("--ripple-x", `${event.clientX - rect.left}px`);
      ripple.style.setProperty("--ripple-y", `${event.clientY - rect.top}px`);
      button.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    });
  };

  const setupFloatingHero = () => {
    const floatingItems = doc.querySelectorAll(".hero__card, .shop-hero__panel, .custom-hero__card, .contact-hero__card");
    if (reduceMotion) return;

    window.addEventListener("scroll", () => {
      const offset = Math.min(window.scrollY * 0.035, 18);
      floatingItems.forEach(item => {
        item.style.setProperty("translate", `0 ${offset}px`);
      });
    }, { passive: true });
  };

  const setupPointerGlow = () => {
    if (reduceMotion) return;

    window.addEventListener("pointermove", event => {
      body.style.setProperty("--cursor-x", `${event.clientX}px`);
      body.style.setProperty("--cursor-y", `${event.clientY}px`);
    }, { passive: true });
  };

  const setupContactAppointmentForm = () => {
    const form = doc.getElementById("appointmentForm");
    if (!form) return;

    const statusBox = doc.getElementById("appointmentFormStatus");
    const submitButton = form.querySelector("button[type='submit']");
    const fields = {
      name: form.elements.name,
      phone: form.elements.phone,
      occasion: form.elements.occasion,
      message: form.elements.message
    };
    const errorMessages = {
      name: "Please enter your full name.",
      phone: "Please enter your phone number.",
      occasion: "Please select the service you need.",
      message: "Please share your design notes."
    };

    const setStatus = (message, type = "success") => {
      if (!statusBox) return;
      statusBox.textContent = message;
      statusBox.dataset.type = type;
      statusBox.hidden = false;
    };

    const clearStatus = () => {
      if (!statusBox) return;
      statusBox.textContent = "";
      statusBox.removeAttribute("data-type");
      statusBox.hidden = true;
    };

    const getErrorElement = field => {
      const errorId = field?.getAttribute("aria-describedby");
      return errorId ? doc.getElementById(errorId) : null;
    };

    const setFieldError = (field, message = "") => {
      if (!field) return;
      const errorElement = getErrorElement(field);
      field.setAttribute("aria-invalid", message ? "true" : "false");
      if (errorElement) errorElement.textContent = message;
    };

    const validateForm = () => {
      let firstInvalidField = null;

      Object.entries(fields).forEach(([fieldName, field]) => {
        const value = String(field?.value || "").trim();
        const errorMessage = value ? "" : errorMessages[fieldName];
        setFieldError(field, errorMessage);
        if (errorMessage && !firstInvalidField) firstInvalidField = field;
      });

      if (firstInvalidField) {
        setStatus("Please correct the highlighted fields before submitting.", "error");
        firstInvalidField.focus();
        return false;
      }

      clearStatus();
      return true;
    };

    const clearFieldErrors = () => {
      Object.values(fields).forEach(field => setFieldError(field));
    };

    Object.values(fields).forEach(field => {
      if (!field) return;
      field.addEventListener("input", () => {
        if (String(field.value || "").trim()) setFieldError(field);
      });
      field.addEventListener("change", () => {
        if (String(field.value || "").trim()) setFieldError(field);
      });
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!validateForm()) return;

      const formData = new FormData(form);
      const payload = {
        name: String(formData.get("name") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        occasion: String(formData.get("occasion") || "").trim(),
        message: String(formData.get("message") || "").trim(),
        source: "contact.html appointment form"
      };

      if (submitButton) submitButton.disabled = true;
      const whatsappMessage = `Hello RD Advance Boutique,\n\nI want to contact you.\n\nName: ${payload.name}\nMobile: ${payload.phone}\nService / Occasion: ${payload.occasion}\nMessage: ${payload.message}\nPage Link: ${window.location.href}\n\nPlease guide me.`;
      window.open(getWhatsappUrl(whatsappMessage), "_blank", "noopener");
      form.reset();
      clearFieldErrors();
      setStatus("Your WhatsApp message is ready. Please send it in WhatsApp to complete the enquiry.", "success");
      if (submitButton) submitButton.disabled = false;
    });
  };

  const getWhatsappUrl = message => `https://wa.me/917693849472?text=${encodeURIComponent(message)}`;

  const getCurrentPageUrl = (params = {}) => {
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
    return url.toString();
  };

  const loadStaticJson = async (source, fallback = []) => {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load ${source}.`);
      const data = await response.json();
      return data || fallback;
    } catch (error) {
      console.warn(error);
      return fallback;
    }
  };

  const setupFashionShop = () => {
    const productGrid     = doc.getElementById("productGrid");
    const productSearch   = doc.getElementById("productSearch");
    const productCount    = doc.getElementById("productCount");
    const emptyProducts   = doc.getElementById("emptyProducts");
    const categoryFilter  = doc.getElementById("categoryFilter");
    const typeTabs        = Array.from(doc.querySelectorAll(".type-tab"));
    const boutiqueEmptyCta = doc.getElementById("boutiqueEmptyCta");

    if (!productGrid) return;

    let allProducts   = [];
    let activeType    = "all";
    let activeCategory = "all";
    let searchTerm    = "";

    const normalize = v => String(v || "").trim().toLowerCase()
      .replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const formatPrice = value => {
      const n = Number(value);
      if (!Number.isFinite(n) || value === "") return value ? String(value) : "Price on request";
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
    };

    // Determine a product's section: "boutique" or "readymade"
    const getProductType = p => {
      const t = normalize(p.productType || p.type || "readymade");
      return t === "boutique" ? "boutique" : "readymade";
    };

    const getFilteredProducts = () => allProducts.filter(p => {
      if (p.status === "inactive") return false;
      const pType = getProductType(p);
      const typeMatch = activeType === "all" || pType === activeType;
      const catNorm   = normalize(p.category || "");
      const catMatch  = activeCategory === "all" || catNorm === activeCategory;
      const text = normalize([p.title, p.name, p.category, ...(p.tags || [])].join(" "));
      const searchMatch = !searchTerm || text.includes(searchTerm);
      return typeMatch && catMatch && searchMatch;
    });

    const buildCategoryChips = type => {
      const relevant = allProducts.filter(p =>
        p.status !== "inactive" && (type === "all" || getProductType(p) === type)
      );
      return [...new Set(relevant.map(p => p.category).filter(Boolean))];
    };

    const renderCategoryChips = type => {
      if (!categoryFilter) return;
      const cats = buildCategoryChips(type);
      categoryFilter.innerHTML = [
        `<button class="filter-btn active" type="button" data-category="all" role="listitem">All</button>`,
        ...cats.map(c =>
          `<button class="filter-btn" type="button" data-category="${normalize(c)}" role="listitem">${c}</button>`
        )
      ].join("");
      activeCategory = "all";
      categoryFilter.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          categoryFilter.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          activeCategory = btn.dataset.category;
          renderProductGrid();
        });
      });
    };

    const createProductCard = product => {
      const title    = product.title || product.name || "Product";
      const category = product.category || "";
      const pType    = getProductType(product);
      const stock    = Number(product.stockQuantity ?? product.stock ?? 1);

      const card = doc.createElement("article");
      card.className = "product-card";
      card.dataset.type     = pType;
      card.dataset.category = normalize(category);

      // Media
      const img = doc.createElement("img");
      img.src     = product.image || product.images?.[0] || "assets/logo.png";
      img.alt     = product.alt || title;
      img.loading = "lazy";

      const badge = doc.createElement("span");
      if (pType === "boutique") {
        badge.className   = "product-card__section-badge product-card__section-badge--boutique";
        badge.textContent = "✂️ Boutique";
      } else {
        badge.className   = "product-card__section-badge product-card__section-badge--readymade";
        badge.textContent = "🛍️ Ready-Made";
      }

      const heartBtn = doc.createElement("button");
      heartBtn.type = "button";
      heartBtn.className = "wishlist-btn";
      const pid = String(product.slug || product.id || normalize(title));
      heartBtn.dataset.wlId = pid;
      const isSaved = window.RDWishlist ? window.RDWishlist.has(pid) : false;
      heartBtn.classList.toggle("wl-saved", isSaved);
      heartBtn.innerHTML = isSaved ? "♥" : "♡";
      heartBtn.setAttribute("aria-label", isSaved ? "Remove from wishlist" : "Add to wishlist");

      const media = doc.createElement("div");
      media.className = "product-card__media";
      media.append(img, badge, heartBtn);

      // Content
      const detailUrl = new URL(
        `product-details.html?id=${encodeURIComponent(product.slug || product.id || normalize(title))}`,
        window.location.href
      ).toString();
      const action = doc.createElement("a");
      action.className   = "product-card__action";
      action.href        = detailUrl;
      action.textContent = "View Details";

      const content = doc.createElement("div");
      content.className = "product-content";
      content.innerHTML = `
        <span class="product-category">${category}</span>
        <h3>${title}</h3>
        <p class="product-description">${product.shortDescription || product.description || "Premium boutique product."}</p>
        <p class="product-price">${formatPrice(product.price)}</p>
        <span class="${stock > 0 ? "stock-status" : "stock-status status-inactive"}">
          ${stock > 0 ? stock + " available" : "Confirm availability"}
        </span>
      `;
      content.append(action);
      card.append(media, content);
      return card;
    };

    const renderProductGrid = () => {
      const visible       = getFilteredProducts();
      const isBoutiqueTab = activeType === "boutique";
      const hasItems      = visible.length > 0;
      const showBoutiqueCta = isBoutiqueTab && !hasItems;
      const showNoMatch     = !showBoutiqueCta && !hasItems;

      if (emptyProducts)    emptyProducts.hidden    = !showNoMatch;
      if (boutiqueEmptyCta) boutiqueEmptyCta.hidden = !showBoutiqueCta;

      productGrid.innerHTML = "";
      if (hasItems) {
        productGrid.replaceChildren(...visible.map(createProductCard));
      } else if (showNoMatch) {
        productGrid.innerHTML = '<p class="shop-no-results">No matching products found. Try a different filter or search term.</p>';
      }

      if (productCount) {
        const total = allProducts.filter(p =>
          p.status !== "inactive" && (activeType === "all" || getProductType(p) === activeType)
        ).length;
        productCount.textContent = hasItems
          ? `${visible.length} of ${total} product${total !== 1 ? "s" : ""}`
          : "";
      }
    };

    // Type tab switching
    typeTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        typeTabs.forEach(t => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        activeType = tab.dataset.type;
        renderCategoryChips(activeType);
        renderProductGrid();
      });
    });

    // Hero jump links: "Shop Ready-Made →" / "Explore Boutique →"
    doc.querySelectorAll(".shop-type-jump").forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        const jump = link.dataset.jump;
        const target = doc.getElementById("shop-products");
        if (target) target.scrollIntoView({ behavior: "smooth" });
        const matchTab = typeTabs.find(t => t.dataset.type === jump);
        if (matchTab) matchTab.click();
      });
    });

    // Search
    productSearch?.addEventListener("input", () => {
      searchTerm = normalize(productSearch.value);
      renderProductGrid();
    });

    // Pre-fill search from URL ?q= param (homepage search bar)
    const urlQ = new URLSearchParams(window.location.search).get("q") || "";
    if (urlQ && productSearch) {
      productSearch.value = urlQ;
      searchTerm = normalize(urlQ);
      doc.getElementById("shop-products")?.scrollIntoView({ behavior: "smooth" });
    }

    // Load products
    productGrid.innerHTML = '<p class="shop-loading">Loading products…</p>';
    loadStaticJson("data/products.json", []).then(data => {
      allProducts = Array.isArray(data) ? data : [];
      renderCategoryChips("all");
      renderProductGrid();
    });

    // Allow external category clicks (from browse grid) to set filter
    doc.addEventListener("catBrowseSelect", e => {
      const catSlug = e.detail?.slug;
      if (!catSlug) return;
      // Switch to "all" tab first
      typeTabs.forEach(t => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
      const allTab = typeTabs.find(t => t.dataset.type === "all");
      if (allTab) { allTab.classList.add("active"); allTab.setAttribute("aria-selected", "true"); }
      activeType = "all";
      renderCategoryChips("all");
      // Activate matching chip
      activeCategory = catSlug;
      const chips = categoryFilter?.querySelectorAll(".filter-btn") || [];
      chips.forEach(b => {
        b.classList.toggle("active", b.dataset.category === catSlug || (catSlug === "all" && b.dataset.category === "all"));
      });
      renderProductGrid();
      doc.getElementById("shop-products")?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const readUploadFile = (file, { label = "Upload", maxFileSize = 4 * 1024 * 1024, required = false } = {}) => new Promise((resolve, reject) => {
    if (!file || !file.name) {
      if (required) {
        reject(new Error(`${label} is required.`));
        return;
      }

      resolve({});
      return;
    }

    if (file.size > maxFileSize) {
      reject(new Error(`${label} must be smaller than ${Math.round(maxFileSize / (1024 * 1024))} MB.`));
      return;
    }

    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-");
    resolve({
      fileName: safeName,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      path: `customer-uploads/${safeName}`
    });
  });

  const setupCustomStitchingRequests = () => {
    const form = doc.querySelector("#custom-stitching-request-form");
    const message = doc.querySelector("#custom-booking-message");
    const trackingForm = doc.querySelector("#custom-order-tracking-form");
    const trackingResult = doc.querySelector("#custom-tracking-result");

    const setMessage = (text, type = "") => {
      if (!message) return;
      message.textContent = text;
      message.dataset.type = type;
    };

    const renderTrackingResult = (order) => {
      if (!trackingResult) return;

      if (!order) {
        trackingResult.innerHTML = "<strong>No request found.</strong><span>Please check the order ID and try again.</span>";
        trackingResult.dataset.type = "error";
        return;
      }

      const appointment = [order.appointmentDate, order.appointmentTime].filter(Boolean).join(" at ") || "Appointment not set";
      const timeline = Array.isArray(order.timeline) ? order.timeline : [];
      const timelineHtml = timeline.map(step => {
        const state = step.state || "upcoming";
        const date = formatTimelineDate(step.date);
        return `
          <li class="tracking-timeline__step tracking-timeline__step--${escapeHtml(state)}">
            <span class="tracking-timeline__marker" aria-hidden="true"></span>
            <span class="tracking-timeline__content">
              <strong>${escapeHtml(step.label)}</strong>
              <small>${escapeHtml(state === "current" ? "Current step" : formatStatus(state))}${date ? ` · ${escapeHtml(date)}` : ""}</small>
            </span>
          </li>
        `;
      }).join("");

      trackingResult.dataset.type = "success";
      trackingResult.innerHTML = `
        <strong>${escapeHtml(order.orderNumber || order.id)} · ${escapeHtml(formatStatus(order.status))}</strong>
        <span>${escapeHtml(order.item || "Boutique order")}</span>
        <span>Fabric: ${escapeHtml(order.fabric || "To be confirmed")}</span>
        <span>Appointment: ${escapeHtml(appointment)}</span>
        <span>Payment: ${escapeHtml(formatStatus(order.payment?.status || "not-submitted"))}</span>
        <ol class="tracking-timeline" aria-label="Order status timeline">
          ${timelineHtml}
        </ol>
      `;
    };

    if (form) {
      form.addEventListener("submit", event => {
        event.preventDefault();
        const submitButton = form.querySelector("button[type='submit']");
        const formData = new FormData(form);
        const measurements = [
          ["Bust", formData.get("bust")],
          ["Waist", formData.get("waist")],
          ["Hip", formData.get("hip")],
          ["Shoulder", formData.get("shoulder")],
          ["Sleeve", formData.get("sleeve")],
          ["Garment Length", formData.get("length")],
          ["Notes", formData.get("measurement_notes")]
        ]
          .filter(([, value]) => String(value || "").trim())
          .map(([label, value]) => `${label}: ${value}`)
          .join("; ") || "To be shared on WhatsApp";
        const fabricPreference = [formData.get("fabric"), formData.get("fabric_details")]
          .filter(Boolean)
          .join(" - ") || "To be confirmed";
        const designPreferences = [
          formData.get("outfit"),
          formData.get("occasion"),
          formData.get("design_instructions"),
          formData.get("consultation_type"),
          formData.get("timeline"),
          formData.get("appointment_date") && `Preferred date: ${formData.get("appointment_date")}`,
          formData.get("appointment_time") && `Preferred time: ${formData.get("appointment_time")}`
        ].filter(Boolean).join("; ") || "To be discussed";

        const whatsappMessage = `Hello RD Advance Boutique,\n\nI want to place a custom stitching request.\n\nName: ${formData.get("name") || ""}\nMobile: ${formData.get("phone") || ""}\nMeasurements: ${measurements}\nDesign preferences: ${designPreferences}\nFabric preference: ${fabricPreference}\n\nPlease guide me for stitching details, payment, and delivery.`;

        if (submitButton) submitButton.disabled = true;
        window.open(getWhatsappUrl(whatsappMessage), "_blank", "noopener");
        form.reset();
        setMessage("Your custom stitching WhatsApp message is ready. Please send it in WhatsApp to complete the request.", "success");
        if (submitButton) submitButton.disabled = false;
      });
    }

    if (trackingForm) {
      trackingForm.addEventListener("submit", event => {
        event.preventDefault();
        if (trackingResult) {
          trackingResult.dataset.type = "info";
          trackingResult.textContent = "Order tracking is handled on WhatsApp for the static website. Please send your order ID to RD Advance Boutique on WhatsApp.";
        }
      });
    }
  };

  const setupCourseWhatsappLinks = () => {
    const links = doc.querySelectorAll('a[href*="wa.me"][href*="tailoring%20course"], a[href*="wa.me"][href*="tailoring course"]');
    if (!links.length) return;

    const message = `Hello RD Advance Boutique,\n\nI am interested in joining your tailoring course.\n\nCourse Name: Basic to Advance Tailoring\nWebsite URL: ${window.location.href}\n\nPlease send complete details.`;
    links.forEach(link => {
      link.href = getWhatsappUrl(message);
      link.dataset.noTransition = "true";
    });
  };

  const CAT_ICONS = {
    "sarees": "🥻", "blouses": "👗", "kurtis": "👘", "kurta-pant-dupatta": "🩱",
    "suits-salwar": "👔", "plazo-suits": "🧣", "anarkali-suits": "✨", "patiala-suits": "🎀",
    "pakistani-suits": "🌸", "churidar-sets": "🧵", "sharara-sets": "💃", "dhoti-sets": "🪬",
    "lehengas": "👰", "gowns": "🌟", "coord-sets": "🎽", "indo-western": "🔮",
    "tops-tunics": "👚", "maxi-dresses": "🌺", "jumpsuits": "🎯", "ethnic-jackets": "🧥",
    "bridal": "💍", "festive-wear": "🪔", "chikankari": "🌿", "banarasi": "🏅",
    "embroidery-work": "🪡", "printed-collection": "🎨", "bandhani": "🌈",
    "dupattas": "🧤", "nightwear": "🌙", "maternity-wear": "🤱", "kids-wear": "🧒",
    "kaftans": "🌴", "skirts": "💫", "accessories": "💎"
  };

  const setupCategoryBrowse = () => {
    const grid = doc.getElementById("catBrowseGrid");
    if (!grid) return;

    grid.innerHTML = '<p class="shop-loading">Loading categories…</p>';

    loadStaticJson("data/categories.json", []).then(cats => {
      const active = cats.filter(c => c.status !== "inactive");
      if (!active.length) { grid.closest(".cat-browse-section").hidden = true; return; }

      grid.innerHTML = active.map(c => `
        <button class="cat-browse-card" type="button" data-slug="${c.slug || c.id}" aria-label="Browse ${c.name}">
          <span class="cat-browse-card__icon">${CAT_ICONS[c.id] || CAT_ICONS[c.slug] || "🛍️"}</span>
          <span class="cat-browse-card__name">${c.name}</span>
        </button>
      `).join("");

      grid.querySelectorAll(".cat-browse-card").forEach(btn => {
        btn.addEventListener("click", () => {
          grid.querySelectorAll(".cat-browse-card").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          const normalize = v => String(v || "").trim().toLowerCase()
            .replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          doc.dispatchEvent(new CustomEvent("catBrowseSelect", { detail: { slug: normalize(btn.dataset.slug) } }));
        });
      });
    });
  };

  const init = () => {
    markPageReady();
    setupPageTransitions();
    setupResponsiveNavigation();
    setupSecretAdminShortcut();
    setupCategoryBrowse();
    setupFashionShop();
    setupCourseWhatsappLinks();
    setupContactAppointmentForm();
    setupCustomStitchingRequests();
    setupScrollReveal();
    setupLuxuryButtons();
    setupFloatingHero();
    setupPointerGlow();
  };

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
