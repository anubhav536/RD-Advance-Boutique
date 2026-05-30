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
    requestAnimationFrame(() => body.classList.add("luxury-page-ready"));
  };

  const setupPageTransitions = () => {
    doc.addEventListener("click", event => {
      const link = event.target.closest("a[href]");
      if (!isInternalPageLink(link) || reduceMotion) return;

      event.preventDefault();
      body.classList.add("luxury-page-exit");
      window.setTimeout(() => {
        window.location.href = link.href;
      }, 360);
    });
  };

  const setupScrollReveal = () => {
    const revealItems = Array.from(doc.querySelectorAll(revealSelectors));
    revealItems.forEach((item, index) => {
      if (item.classList.contains("luxury-reveal")) return;

      item.classList.add("luxury-reveal");
      item.style.setProperty("--luxury-index", index % 5);

      if (item.matches(".course__media, .booking-intro")) item.dataset.luxuryReveal = "left";
      if (item.matches(".course__content, .booking-layout")) item.dataset.luxuryReveal = "right";
      if (item.matches(".design-card, .product-card, .gallery-card, .fabric-card")) item.dataset.luxuryReveal = "scale";
    });

    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealItems.forEach(item => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12%", threshold: 0.16 });

    revealItems.forEach(item => observer.observe(item));
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
    const trigger = doc.querySelector(".site-header .brand__logo");
    if (!trigger) return;

    const shortcutPath = "admin-signup.html";
    const requiredTapCount = 5;
    const tapWindowMs = 2800;
    const requiredHoldDurationMs = 2500;
    let holdTimer = 0;
    let tapCount = 0;
    let tapResetTimer = 0;

    const resetTaps = () => {
      tapCount = 0;
      if (!tapResetTimer) return;
      window.clearTimeout(tapResetTimer);
      tapResetTimer = 0;
    };

    const cancelHold = () => {
      if (!holdTimer) return;
      window.clearTimeout(holdTimer);
      holdTimer = 0;
    };

    const openAdminSignup = () => {
      cancelHold();
      resetTaps();
      window.location.assign(shortcutPath);
    };

    const registerTap = () => {
      tapCount += 1;
      if (tapCount >= requiredTapCount) {
        openAdminSignup();
        return;
      }

      if (tapResetTimer) window.clearTimeout(tapResetTimer);
      tapResetTimer = window.setTimeout(resetTaps, tapWindowMs);
    };

    trigger.addEventListener("pointerdown", () => {
      cancelHold();
      holdTimer = window.setTimeout(openAdminSignup, requiredHoldDurationMs);
    });

    trigger.addEventListener("pointerup", () => {
      cancelHold();
      registerTap();
    });

    ["pointercancel", "pointerleave", "blur"].forEach(eventName => {
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
    const productGrid = doc.getElementById("productGrid");
    const productSearch = doc.getElementById("productSearch");
    const productCount = doc.getElementById("productCount");
    const emptyProducts = doc.getElementById("emptyProducts");
    const filterButtons = Array.from(doc.querySelectorAll(".category-filter .filter-btn"));

    if (!productGrid) return;

    let products = [];

    const normalize = value => String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const formatPrice = value => {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue) || value === "") return value ? String(value) : "Price on request";
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(numberValue);
    };

    const createElement = (tagName, className, text) => {
      const element = doc.createElement(tagName);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    };

    const createProductOrderMessage = product => {
      const title = product.title || product.name || "Boutique Product";
      const category = product.category || "Boutique";
      const price = formatPrice(product.discountPrice || product.price || "");
      const productLink = getCurrentPageUrl({ product: product.slug || product.id || normalize(title) });
      return `Hello RD Advance Boutique,\n\nI want to order this product.\n\nProduct Name: ${title}\nCategory: ${category}\nPrice: ${price}\nProduct Link: ${productLink}\n\nPlease guide me for payment and delivery.`;
    };

    const createProductCard = product => {
      const title = product.title || product.name || "Ready-made product";
      const category = product.category || "Ready-Made";
      const stock = Number(product.stockQuantity ?? product.stock ?? 1);
      const card = createElement("article", "product-card");
      card.dataset.category = normalize(category);
      card.dataset.section = normalize(product.productType || product.type || "ready-made");
      card.dataset.tags = [category, product.productType, product.type, ...(product.tags || [])].map(normalize).join(" ");

      const media = createElement("div", "product-card__media");
      const image = doc.createElement("img");
      image.src = product.image || product.images?.[0] || "assets/logo.png";
      image.alt = product.alt || title;
      image.loading = "lazy";
      const badge = createElement("span", "product-card__section-badge", product.productType === "boutique" ? "Boutique" : "Ready-Made");
      media.append(image, badge);

      const content = createElement("div", "product-content");
      const action = createElement("a", "product-card__action", stock > 0 ? "WhatsApp Order" : "Enquire on WhatsApp");
      action.href = getWhatsappUrl(createProductOrderMessage(product));
      action.target = "_blank";
      action.rel = "noopener";
      action.dataset.noTransition = "true";
      content.append(
        createElement("span", "product-category", category),
        createElement("h3", "", title),
        createElement("p", "product-description", product.description || "Premium boutique product."),
        createElement("p", "product-price", formatPrice(product.discountPrice || product.price)),
        createElement("span", stock > 0 ? "stock-status" : "stock-status status-inactive", stock > 0 ? `${stock} available` : "Confirm availability"),
        action
      );
      card.append(media, content);
      return card;
    };

    const renderProducts = () => {
      const activeCategory = filterButtons.find(button => button.classList.contains("active"))?.dataset.category || "all";
      const searchTerm = normalize(productSearch ? productSearch.value : "");
      const visible = products.filter(product => {
        const tags = ["all", product.category, product.productType, product.type, ...(product.tags || [])].map(normalize);
        const searchableText = normalize(`${product.title || product.name} ${product.category} ${product.description} ${tags.join(" ")}`);
        return (activeCategory === "all" || tags.includes(activeCategory)) && (!searchTerm || searchableText.includes(searchTerm));
      });

      productGrid.replaceChildren(...visible.map(createProductCard));
      if (productCount) productCount.textContent = products.length ? `${visible.length} product${visible.length === 1 ? "" : "s"} available` : "No products in products.json yet";
      if (emptyProducts) emptyProducts.hidden = visible.length > 0;
      if (!visible.length) productGrid.innerHTML = "<p>No matching products are available right now. Please message us on WhatsApp for current designs.</p>";
    };

    filterButtons.forEach(button => {
      button.addEventListener("click", () => {
        filterButtons.forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        renderProducts();
      });
    });

    productSearch?.addEventListener("input", renderProducts);
    productGrid.innerHTML = "<p>Loading products from data/products.json...</p>";
    loadStaticJson("data/products.json", [])
      .then(data => {
        products = Array.isArray(data) ? data : [];
        renderProducts();
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

  const init = () => {
    markPageReady();
    setupPageTransitions();
    setupResponsiveNavigation();
    setupSecretAdminShortcut();
    setupFashionShop();
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
