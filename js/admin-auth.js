(() => {
  "use strict";

  const AUTH_BASE = "/api/v1/admin/auth";
  const LOGIN_PAGE = "admin-login.html";
  const currentPage = window.location.pathname.split("/").pop() || "admin-dashboard.html";

  const request = async (path, options = {}) => {
    const response = await fetch(`${AUTH_BASE}${path}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "Admin authentication failed.");
    return payload;
  };

  const redirectToLogin = () => {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.replace(`${LOGIN_PAGE}?next=${next}`);
  };

  const addLogoutButton = () => {
    const profile = document.querySelector(".admin-profile");
    if (!profile || document.querySelector("[data-admin-logout]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Logout";
    button.dataset.adminLogout = "true";
    button.className = "admin-logout-btn";
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await request("/logout", { method: "POST" });
      } finally {
        window.location.replace(LOGIN_PAGE);
      }
    });
    profile.appendChild(button);
  };

  document.addEventListener("DOMContentLoaded", async () => {
    if (currentPage === LOGIN_PAGE) return;

    try {
      await request("/session");
      addLogoutButton();
    } catch (error) {
      redirectToLogin();
    }
  });
})();
