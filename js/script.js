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
    const trigger = doc.querySelector(".site-header .brand");
    if (!trigger) return;

    const shortcutPath = "/admin-login.html?next=%2Fadmin-dashboard.html";
    const holdDurationMs = 2200;
    let holdTimer = 0;
    let shortcutOpened = false;

    const clearHoldTimer = () => {
      if (!holdTimer) return;
      window.clearTimeout(holdTimer);
      holdTimer = 0;
    };

    const openShortcut = () => {
      clearHoldTimer();
      shortcutOpened = true;
      window.location.assign(shortcutPath);
    };

    trigger.addEventListener("pointerdown", event => {
      if (event.button && event.button !== 0) return;
      clearHoldTimer();
      shortcutOpened = false;
      holdTimer = window.setTimeout(openShortcut, holdDurationMs);
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach(eventName => {
      trigger.addEventListener(eventName, clearHoldTimer);
    });

    trigger.addEventListener("contextmenu", event => {
      if (!holdTimer && !shortcutOpened) return;
      event.preventDefault();
    });

    trigger.addEventListener("click", event => {
      if (!shortcutOpened) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
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


  const setupFashionShop = () => {
    const productGrid = doc.getElementById("productGrid");
    const productSearch = doc.getElementById("productSearch");
    const productCount = doc.getElementById("productCount");
    const emptyProducts = doc.getElementById("emptyProducts");
    const filterButtons = Array.from(doc.querySelectorAll(".category-filter .filter-btn"));

    if (!productGrid) return;

    const emptyProductSlots = [
      { name: "Men Ready-Made Slot", category: "Men", section: "Ready-Made", tags: ["ready-made", "men"] },
      { name: "Women Ready-Made Slot", category: "Women", section: "Ready-Made", tags: ["ready-made", "women"] },
      { name: "Kids Ready-Made Slot", category: "Kids", section: "Ready-Made", tags: ["ready-made", "kids"] },
      { name: "Ethnic Wear Slot", category: "Ethnic Wear", section: "Ready-Made", tags: ["ready-made", "women"] },
      { name: "Casual Wear Slot", category: "Casual Wear", section: "Ready-Made", tags: ["ready-made", "men", "women"] },
      { name: "Party Wear Slot", category: "Party Wear", section: "Ready-Made", tags: ["ready-made", "men", "women"] },
      { name: "Winter Wear Slot", category: "Winter Wear", section: "Ready-Made", tags: ["ready-made", "men", "women", "kids"] },
      { name: "Accessories Slot", category: "Accessories", section: "Ready-Made", tags: ["ready-made", "accessories"] },
      { name: "Custom Blouse Design Slot", category: "Custom Blouse Designs", section: "Boutique", tags: ["boutique", "women"] },
      { name: "Designer Suit Slot", category: "Designer Suits", section: "Boutique", tags: ["boutique", "men", "women"] },
      { name: "Bridal Wear Slot", category: "Bridal Wear", section: "Boutique", tags: ["boutique", "bridal", "women"] },
      { name: "Boutique Dress Slot", category: "Boutique Dresses", section: "Boutique", tags: ["boutique", "women"] },
      { name: "Custom Stitching Slot", category: "Custom Stitching", section: "Boutique", tags: ["boutique", "men", "women", "kids"] },
      { name: "Premium Tailoring Slot", category: "Premium Tailoring", section: "Boutique", tags: ["boutique", "men", "women"] }
    ];

    const normalize = value => String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const createElement = (tagName, className, text) => {
      const element = doc.createElement(tagName);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    };

    const createMetaRow = (label, value, modifier = "") => {
      const row = createElement("div", `product-meta-row${modifier ? ` ${modifier}` : ""}`);
      row.append(createElement("span", "", label), createElement("span", "", value));
      return row;
    };

    const createEmptyProductCard = (slot, index) => {
      const card = createElement("article", "product-card product-card--empty");
      card.dataset.category = normalize(slot.category);
      card.dataset.section = normalize(slot.section);
      card.dataset.tags = [slot.section, slot.category, ...slot.tags].map(normalize).join(" ");
      card.setAttribute("aria-label", `${slot.name} empty product card`);

      const media = createElement("div", "product-card__media");
      const placeholder = createElement("div", "product-card__placeholder");
      const imageLabel = createElement("span", "product-card__image-label", "Product Image");
      const badge = createElement("span", "product-card__section-badge", slot.section);
      placeholder.setAttribute("aria-hidden", "true");
      media.append(placeholder, imageLabel, badge);

      const content = createElement("div", "product-content");
      const metaGrid = createElement("div", "product-meta-grid");
      const stock = createElement("span", "stock-status", "Awaiting Stock");
      const action = createElement("a", "product-card__action", "View Details");

      action.href = "#shop-products";
      action.setAttribute("aria-disabled", "true");
      action.addEventListener("click", event => event.preventDefault());

      metaGrid.append(
        createMetaRow("Price", "₹ —"),
        createMetaRow("Discount Price", "₹ —", "product-meta-row--discount"),
        createMetaRow("Stock Status", "Awaiting product")
      );

      content.append(
        createElement("span", "product-category", slot.category),
        createElement("h3", "", slot.name || `Product Slot ${index + 1}`),
        createElement("p", "product-description", "Empty dynamic card ready for future admin-added product image, name, pricing, stock, and details."),
        metaGrid,
        stock,
        action
      );

      card.append(media, content);
      return card;
    };

    const renderShopSlots = () => {
      const activeCategory = filterButtons.find(button => button.classList.contains("active"))?.dataset.category || "all";
      const searchTerm = normalize(productSearch ? productSearch.value : "");
      const visibleSlots = emptyProductSlots.filter(slot => {
        const tags = ["all", slot.section, slot.category, ...slot.tags].map(normalize);
        const searchableText = normalize(`${slot.name} ${slot.category} ${slot.section} ${slot.tags.join(" ")}`);
        return (activeCategory === "all" || tags.includes(activeCategory)) && (!searchTerm || searchableText.includes(searchTerm));
      });

      productGrid.replaceChildren(...visibleSlots.map(createEmptyProductCard));

      if (productCount) {
        productCount.textContent = `${visibleSlots.length} empty product card${visibleSlots.length === 1 ? "" : "s"} ready`;
      }

      if (emptyProducts) {
        emptyProducts.hidden = false;
      }
    };

    filterButtons.forEach(button => {
      button.addEventListener("click", () => {
        filterButtons.forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        renderShopSlots();
      });
    });

    if (productSearch) {
      productSearch.addEventListener("input", renderShopSlots);
    }

    renderShopSlots();
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

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve({
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        dataUrl: reader.result
      });
    });
    reader.addEventListener("error", () => reject(new Error(`Unable to read the ${label.toLowerCase()} file.`)));
    reader.readAsDataURL(file);
  });

  const formatStatus = status => String(status || "pending")
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

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
        trackingResult.innerHTML = "<strong>No request found.</strong><span>Please check the order number or phone number and try again.</span>";
        trackingResult.dataset.type = "error";
        return;
      }

      const appointment = [order.appointmentDate, order.appointmentTime].filter(Boolean).join(" at ") || "Appointment not set";
      trackingResult.dataset.type = "success";
      trackingResult.innerHTML = `
        <strong>${order.orderNumber || order.id} · ${formatStatus(order.status)}</strong>
        <span>${order.customer?.name || "Customer"} · ${order.stitchingDetails?.outfit || "Custom Stitching"}</span>
        <span>Fabric: ${order.fabricSelection?.type || "To be confirmed"}</span>
        <span>Appointment: ${appointment}</span>
        <span>Payment: ${formatStatus(order.payment?.status || "not-submitted")} · UPI ID: ${order.payment?.upiTransactionId || "Not submitted"}</span>
      `;
    };

    if (form) {
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const submitButton = form.querySelector("button[type='submit']");
        const formData = new FormData(form);

        try {
          if (submitButton) submitButton.disabled = true;
          setMessage("Saving your custom stitching request...", "info");

          const designReference = await readUploadFile(formData.get("reference_design"), { label: "Reference design" });
          const paymentScreenshot = await readUploadFile(formData.get("payment_screenshot"), {
            label: "Payment screenshot",
            maxFileSize: 2 * 1024 * 1024,
            required: true
          });
          const payload = {
            orderType: "custom-stitching",
            status: "pending",
            customer: {
              name: formData.get("name"),
              phone: formData.get("phone"),
              email: formData.get("email")
            },
            productName: formData.get("outfit"),
            stitchingDetails: {
              outfit: formData.get("outfit"),
              occasion: formData.get("occasion"),
              designInstructions: formData.get("design_instructions"),
              consultationType: formData.get("consultation_type"),
              timeline: formData.get("timeline")
            },
            measurements: {
              bust: formData.get("bust"),
              waist: formData.get("waist"),
              hip: formData.get("hip"),
              shoulder: formData.get("shoulder"),
              sleeve: formData.get("sleeve"),
              length: formData.get("length"),
              notes: formData.get("measurement_notes")
            },
            fabricSelection: {
              type: formData.get("fabric"),
              details: formData.get("fabric_details")
            },
            designReference,
            appointmentDate: formData.get("appointment_date"),
            appointmentTime: formData.get("appointment_time"),
            payment: {
              method: "manual-upi",
              status: "pending-verification",
              upiTransactionId: formData.get("upi_transaction_id"),
              amount: formData.get("payment_amount"),
              screenshot: paymentScreenshot
            },
            notes: formData.get("design_instructions")
          };

          const response = await fetch("/api/v1/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to save the request.");
          }

          form.reset();
          setMessage(`Request saved! Your order number is ${result.data.orderNumber}. Payment is pending admin verification. Current order status: ${formatStatus(result.data.status)}.`, "success");
          renderTrackingResult(result.data);
        } catch (error) {
          setMessage(error.message || "Unable to save the request right now.", "error");
        } finally {
          if (submitButton) submitButton.disabled = false;
        }
      });
    }

    if (trackingForm) {
      trackingForm.addEventListener("submit", async event => {
        event.preventDefault();
        const formData = new FormData(trackingForm);
        const query = String(formData.get("tracking_query") || "").trim();
        if (!query) return;

        try {
          if (trackingResult) {
            trackingResult.dataset.type = "info";
            trackingResult.textContent = "Checking request status...";
          }

          const response = await fetch(`/api/v1/orders/custom-stitching?search=${encodeURIComponent(query)}`);
          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to track the request.");
          }

          renderTrackingResult(result.data[0]);
        } catch (error) {
          if (trackingResult) {
            trackingResult.dataset.type = "error";
            trackingResult.textContent = error.message || "Unable to track the request right now.";
          }
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
