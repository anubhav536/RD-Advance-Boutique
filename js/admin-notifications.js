(() => {
  "use strict";

  const API_BASE = "/api/v1/admin/data/notifications";
  const DATA_SOURCE = "data/notifications.json";
  const PLACEHOLDER_IMAGE = "assets/logo.png";

  let notifications = [];
  let editingId = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const normalize = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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
    if (!response.ok) throw new Error(payload.message || "Unable to save notifications.json.");
    return payload;
  };

  const loadNotifications = async () => {
    try {
      const payload = await request(API_BASE);
      notifications = Array.isArray(payload.data) ? payload.data : [];
    } catch (error) {
      const response = await fetch(DATA_SOURCE, { cache: "no-store" });
      notifications = response.ok ? await response.json() : [];
      $("#notificationStatus").textContent = "Preview mode: start the Node server to save changes.";
    }

    notifications = Array.isArray(notifications) ? notifications : [];
    return notifications;
  };

  const readImage = (input, currentImage = "") => {
    const file = input?.files?.[0];
    if (!file) return currentImage;
    return `assets/${file.name}`;
  };

  const readForm = (form) => {
    const current = notifications.find((item) => String(item.id) === String(editingId)) || {};
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const startAt = formData.get("startAt") || "";
    const endAt = formData.get("endAt") || "";
    const scope = formData.get("scope") || "homepage";

    return {
      title,
      id: current.id || normalize(`${scope}-${title}`),
      scope,
      category: formData.get("category") || "General Update",
      audience: formData.get("audience") || "All Users",
      deliveryMethod: formData.get("deliveryMethod") || "Website Notification",
      priority: formData.get("priority") || "normal",
      status: formData.get("status") || "active",
      message: String(formData.get("message") || "").trim(),
      image: readImage($("#notificationImage"), current.image || ""),
      ctaLabel: String(formData.get("ctaLabel") || "").trim(),
      ctaUrl: String(formData.get("ctaUrl") || "").trim(),
      startAt,
      endAt,
      showAsPopup: formData.get("showAsPopup") === "on" || scope === "popup",
      dismissible: formData.get("dismissible") === "on",
      updatedAt: new Date().toISOString(),
    };
  };

  const scopeLabel = (scope) => ({
    admin: "Admin Notification",
    homepage: "Homepage Announcement",
    course: "Course Announcement",
    product: "Product Announcement",
    popup: "Popup Notice",
  }[scope] || scope || "Homepage Announcement");

  const statusClass = (status) => ["active", "sent", "scheduled"].includes(status) ? "status-active" : "status-inactive";

  const renderRows = () => {
    const tbody = $("#notificationsTableBody");
    if (!tbody) return;

    if (notifications.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">No notifications yet. Create your first announcement above.</td></tr>';
      return;
    }

    tbody.innerHTML = notifications.map((notification) => `
      <tr data-notification-id="${notification.id}">
        <td>
          <strong>${notification.title || "Untitled"}</strong>
          <small>${notification.message || "No message"}</small>
        </td>
        <td>${scopeLabel(notification.scope)}</td>
        <td>${notification.audience || "All Users"}</td>
        <td>${notification.priority || "normal"}</td>
        <td>${notification.deliveryMethod || "Website Notification"}</td>
        <td><span class="${statusClass(notification.status)}">${notification.status || "active"}</span></td>
        <td>
          <div class="table-action-buttons">
            <button type="button" class="edit-btn" data-action="edit">Edit</button>
            <button type="button" class="delete-btn" data-action="delete">Delete</button>
          </div>
        </td>
      </tr>
    `).join("");
  };

  const renderStats = () => {
    const active = notifications.filter((notification) => ["active", "sent", "scheduled"].includes(notification.status || "active")).length;
    const popup = notifications.filter((notification) => notification.scope === "popup" || notification.showAsPopup).length;
    const product = notifications.filter((notification) => notification.scope === "product").length;
    const course = notifications.filter((notification) => notification.scope === "course").length;

    $("#totalNotifications").textContent = notifications.length;
    $("#activeNotifications").textContent = active;
    $("#popupNotifications").textContent = popup;
    $("#targetedNotifications").textContent = product + course;
  };

  const renderPreview = (image = "") => {
    const preview = $("#notificationPreview");
    if (!preview) return;
    preview.innerHTML = image ? `<div class="preview-image-box"><img src="${image}" alt="Notification banner preview"></div>` : "";
  };

  const resetForm = () => {
    editingId = null;
    $("#notificationForm").reset();
    $("#formMode").textContent = "Create Notification";
    $("#submitNotification").textContent = "Save Notification";
    renderPreview();
  };

  const fillForm = (notification) => {
    const form = $("#notificationForm");
    editingId = notification.id;
    form.elements.title.value = notification.title || "";
    form.elements.scope.value = notification.scope || "homepage";
    form.elements.category.value = notification.category || "General Update";
    form.elements.audience.value = notification.audience || "All Users";
    form.elements.message.value = notification.message || "";
    form.elements.priority.value = notification.priority || "normal";
    form.elements.deliveryMethod.value = notification.deliveryMethod || "Website Notification";
    form.elements.status.value = notification.status || "active";
    form.elements.startAt.value = notification.startAt || "";
    form.elements.endAt.value = notification.endAt || "";
    form.elements.ctaLabel.value = notification.ctaLabel || "";
    form.elements.ctaUrl.value = notification.ctaUrl || "";
    form.elements.showAsPopup.checked = Boolean(notification.showAsPopup || notification.scope === "popup");
    form.elements.dismissible.checked = notification.dismissible !== false;
    $("#formMode").textContent = "Edit Notification";
    $("#submitNotification").textContent = "Update Notification";
    renderPreview(notification.image || PLACEHOLDER_IMAGE);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const saveNotification = async (notification) => {
    if (editingId) {
      const payload = await request(`${API_BASE}/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        body: JSON.stringify(notification),
      });
      notifications = notifications.map((item) => String(item.id) === String(editingId) ? payload.data : item);
      return;
    }

    const payload = await request(API_BASE, {
      method: "POST",
      body: JSON.stringify(notification),
    });
    notifications = [payload.data, ...notifications];
  };

  const deleteNotification = async (id) => {
    await request(`${API_BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
    notifications = notifications.filter((notification) => String(notification.id) !== String(id));
  };

  const refresh = () => {
    renderRows();
    renderStats();
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const form = $("#notificationForm");
    if (!form) return;

    await loadNotifications();
    refresh();

    $("#notificationImage").addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return renderPreview();
      const reader = new FileReader();
      reader.onload = (loadEvent) => renderPreview(loadEvent.target.result);
      reader.readAsDataURL(file);
    });

    form.addEventListener("reset", () => setTimeout(resetForm, 0));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const notification = readForm(form);

      if (!notification.title || !notification.message) {
        $("#notificationStatus").textContent = "Please add a title and message.";
        return;
      }

      try {
        await saveNotification(notification);
        $("#notificationStatus").textContent = "Notification saved to notifications.json.";
        resetForm();
        refresh();
      } catch (error) {
        $("#notificationStatus").textContent = error.message;
      }
    });

    $("#notificationsTableBody").addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const row = event.target.closest("tr[data-notification-id]");
      const id = row?.dataset.notificationId;
      const notification = notifications.find((item) => String(item.id) === String(id));
      if (!notification) return;

      if (button.dataset.action === "edit") {
        fillForm(notification);
        return;
      }

      if (confirm("Delete this notification from notifications.json?")) {
        try {
          await deleteNotification(id);
          $("#notificationStatus").textContent = "Notification deleted.";
          refresh();
        } catch (error) {
          $("#notificationStatus").textContent = error.message;
        }
      }
    });
  });
})();
