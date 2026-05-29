(function () {
  const API_BASE = "/api/v1/data/settings";
  const FALLBACK_SETTINGS = "data/settings.json";
  let currentSettings = {};

  const get = (id) => document.getElementById(id);
  const valueOf = (id) => get(id)?.value.trim() || "";
  const setValue = (id, value) => {
    const field = get(id);
    if (field) field.value = value ?? "";
  };
  const deepMerge = (target, source) => {
    const output = { ...target };
    Object.entries(source || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) output[key] = deepMerge(output[key] || {}, value);
      else output[key] = value;
    });
    return output;
  };
  const loadSettings = async () => {
    for (const source of [API_BASE, FALLBACK_SETTINGS]) {
      try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok) continue;
        const payload = await response.json();
        return payload.data || payload;
      } catch (error) {
        // Continue to fallback.
      }
    }
    return {};
  };
  const saveSettings = async (settings) => {
    const response = await fetch(API_BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...settings, updatedAt: new Date().toISOString() }),
    });
    if (!response.ok) throw new Error("Unable to save settings. Please run the API server.");
    const payload = await response.json();
    return payload.data || payload;
  };
  const populate = () => {
    const seo = currentSettings.seo || {};
    setValue("metaTitle", seo.metaTitle);
    setValue("metaDescription", seo.metaDescription);
    setValue("metaKeywords", seo.metaKeywords);
    setValue("googleIndexing", seo.googleIndexing === false ? "disabled" : "enabled");
    setValue("robotsMeta", seo.robots || "index, follow");
    setValue("canonicalUrl", seo.canonicalUrl);
    setValue("googleAnalyticsId", seo.googleAnalyticsId);
    setValue("openGraphTitle", seo.openGraphTitle);
    setValue("twitterDescription", seo.twitterDescription);
    setValue("sitemapEnabled", seo.sitemapEnabled === false ? "disabled" : "enabled");
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const form = get("seoSettingsForm");
    if (!form) return;
    currentSettings = await loadSettings();
    populate();

    form.addEventListener("reset", () => setTimeout(populate, 0));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        currentSettings = await saveSettings(deepMerge(currentSettings, {
          seo: {
            metaTitle: valueOf("metaTitle"),
            metaDescription: valueOf("metaDescription"),
            metaKeywords: valueOf("metaKeywords"),
            googleIndexing: valueOf("googleIndexing") === "enabled",
            robots: valueOf("robotsMeta"),
            canonicalUrl: valueOf("canonicalUrl"),
            googleAnalyticsId: valueOf("googleAnalyticsId"),
            openGraphTitle: valueOf("openGraphTitle"),
            twitterDescription: valueOf("twitterDescription"),
            sitemapEnabled: valueOf("sitemapEnabled") === "enabled",
          },
        }));
        form.reset();
        populate();
        alert("SEO Settings Saved Successfully ✨");
      } catch (error) {
        alert(error.message);
      }
    });
  });
}());
