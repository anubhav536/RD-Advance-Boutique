(() => {
  "use strict";

  const DATA_SOURCE = "data/notifications.json";
  const DISMISS_PREFIX = "rd_notification_dismissed_";

  const page = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const isAdmin = page.startsWith("admin") || page.includes("orders") || page.includes("dashboard");

  const pageScopes = new Set(["popup"]);
  if (page === "index.html" || page === "") pageScopes.add("homepage");
  if (["learn.html", "admissions.html", "admin-course.html", "course-enquiries.html"].includes(page)) pageScopes.add("course");
  if (["shop.html", "all-products.html", "product-details.html", "admin-products.html", "add-product.html", "edit-product.html"].includes(page)) pageScopes.add("product");
  if (isAdmin) pageScopes.add("admin");

  const createElement = (tagName, className, text) => {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  };

  const normalize = (value) => String(value || "").trim().toLowerCase();

  const isCurrentlyVisible = (notification) => {
    const now = Date.now();
    const status = normalize(notification.status || "active");
    const startAt = notification.startAt || notification.scheduledAt;
    const endAt = notification.endAt;

    if (!["active", "sent", "scheduled"].includes(status)) return false;
    if (startAt && Date.parse(startAt) > now) return false;
    if (endAt && Date.parse(endAt) < now) return false;

    return true;
  };

  const notificationMatchesPage = (notification) => {
    const scope = normalize(notification.scope || notification.type || "homepage");
    return pageScopes.has(scope) || (notification.showAsPopup && pageScopes.has("popup"));
  };

  const loadNotifications = async () => {
    const response = await fetch(DATA_SOURCE, { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load ${DATA_SOURCE}`);
    const notifications = await response.json();
    return Array.isArray(notifications) ? notifications : [];
  };

  const buildCard = (notification) => {
    const card = createElement("article", `notification-card notification-card--${normalize(notification.priority || "normal")}`);
    const content = createElement("div", "notification-card__content");
    const label = createElement("span", "notification-card__label", notification.category || notification.scope || "Announcement");
    const title = createElement("h2", "", notification.title || "Boutique announcement");
    const message = createElement("p", "", notification.message || "New update from RD Advance Boutique.");

    content.append(label, title, message);

    if (notification.ctaLabel && notification.ctaUrl) {
      const action = createElement("a", "notification-card__action", notification.ctaLabel);
      action.href = notification.ctaUrl;
      content.appendChild(action);
    }

    if (notification.image) {
      const image = document.createElement("img");
      image.src = notification.image;
      image.alt = notification.title || "Announcement banner";
      image.loading = "lazy";
      card.appendChild(image);
    }

    card.appendChild(content);
    return card;
  };

  const renderInlineAnnouncements = (notifications) => {
    const inlineNotifications = notifications.filter((notification) => {
      const scope = normalize(notification.scope || "homepage");
      return scope !== "popup" && notificationMatchesPage(notification);
    });

    if (inlineNotifications.length === 0) return;

    const region = createElement("section", "notification-region");
    region.setAttribute("aria-label", "Current announcements");
    inlineNotifications.slice(0, 3).forEach((notification) => region.appendChild(buildCard(notification)));

    const target = document.querySelector("main") || document.body;
    target.insertBefore(region, target.firstElementChild || null);
  };

  const renderPopupNotice = (notifications) => {
    const popup = notifications.find((notification) => {
      const scope = normalize(notification.scope || "");
      const dismissed = localStorage.getItem(`${DISMISS_PREFIX}${notification.id}`);
      return (scope === "popup" || notification.showAsPopup) && !dismissed;
    });

    if (!popup) return;

    const overlay = createElement("div", "notification-popup", null);
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", popup.title || "Notice");

    const panel = createElement("div", "notification-popup__panel");
    const closeButton = createElement("button", "notification-popup__close", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close notice");

    const card = buildCard(popup);
    panel.append(closeButton, card);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const closePopup = () => {
      if (popup.dismissible !== false) localStorage.setItem(`${DISMISS_PREFIX}${popup.id}`, "true");
      overlay.remove();
    };

    closeButton.addEventListener("click", closePopup);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closePopup();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.body.contains(overlay)) closePopup();
    }, { once: true });
  };

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const notifications = (await loadNotifications())
        .filter(isCurrentlyVisible)
        .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

      renderInlineAnnouncements(notifications);
      renderPopupNotice(notifications);
    } catch (error) {
      console.warn("Notifications unavailable", error);
    }
  });
})();
