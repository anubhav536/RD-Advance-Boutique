(function () {
  const API_BASE = "/api/v1/data/settings";
  const FALLBACK_SETTINGS = "data/settings.json";
  let currentSettings = {};

  const get = (id) => document.getElementById(id);
  const deepMerge = (target, source) => {
    const output = { ...target };
    Object.entries(source || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        output[key] = deepMerge(output[key] || {}, value);
      } else {
        output[key] = value;
      }
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
  const setValue = (id, value) => {
    const field = get(id);
    if (!field) return;
    field.value = value ?? "";
  };
  const valueOf = (id) => get(id)?.value.trim() || "";

  const populate = () => {
    const social = currentSettings.socialLinks || {};
    setValue("instagramUrl", social.instagram);
    setValue("facebookUrl", social.facebook);
    setValue("youtubeUrl", social.youtube);
    setValue("whatsappUrl", social.whatsapp || currentSettings.contact?.whatsappUrl);
    setValue("telegramUrl", social.telegram);
    setValue("pinterestUrl", social.pinterest);
    setValue("twitterUrl", social.twitter);
    setValue("linkedinUrl", social.linkedin);
    setValue("showSocialFooter", social.showInFooter === false ? "no" : "yes");
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const form = get("socialLinksForm");
    if (!form) return;
    currentSettings = await loadSettings();
    populate();

    form.addEventListener("reset", () => setTimeout(populate, 0));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const whatsappUrl = valueOf("whatsappUrl");
        currentSettings = await saveSettings(deepMerge(currentSettings, {
          socialLinks: {
            instagram: valueOf("instagramUrl"),
            facebook: valueOf("facebookUrl"),
            youtube: valueOf("youtubeUrl"),
            whatsapp: whatsappUrl,
            telegram: valueOf("telegramUrl"),
            pinterest: valueOf("pinterestUrl"),
            twitter: valueOf("twitterUrl"),
            linkedin: valueOf("linkedinUrl"),
            showInFooter: valueOf("showSocialFooter") === "yes",
          },
          contact: {
            ...(currentSettings.contact || {}),
            whatsappUrl,
          },
        }));
        form.reset();
        populate();
        alert("Social Links Saved Successfully ✨");
      } catch (error) {
        alert(error.message);
      }
    });
  });
}());
