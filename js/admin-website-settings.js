(function () {
  const API_BASE = "/api/v1/admin/data/settings";
  const FALLBACK_SETTINGS = "data/settings.json";
  const MAX_IMAGE_BYTES = 1024 * 1024;

  const defaults = {
    siteName: "RD Advance Boutique",
    tagline: "Premium boutique fashion, stitching, and design courses.",
    description: "Luxury tailoring, boutique fashion, and professional stitching courses in Damoh.",
    logo: "assets/logo.png",
    favicon: "assets/logo.png",
    theme: { primaryColor: "#be6b72", secondaryColor: "#100d0b" },
    maintenanceMode: false,
    currency: "INR",
    footerText: "© 2026 RD Advance Boutique. All rights reserved.",
    homepageBanner: {
      eyebrow: "Luxury custom tailoring studio",
      title: "Handcrafted boutique fashion for your signature moments.",
      description: "Experience graceful Indian silhouettes, precision stitching, and thoughtful styling designed to make every celebration feel unforgettable.",
      image: "assets/hero-bg.jpg",
      primaryButtonText: "Explore Collection",
      primaryButtonUrl: "shop.html",
      secondaryButtonText: "Start Custom Order",
      secondaryButtonUrl: "custom.html",
      highlightLabel: "Premium Finish",
      highlightText: "Custom bridal, blouse & occasion wear",
    },
    socialLinks: {},
    seo: {},
    contact: {
      phone: "+91 76938 49472",
      phoneHref: "+917693849472",
      email: "",
      address: "Damoh, Madhya Pradesh",
      hours: "Mon - Sat · 10:30 AM - 7:30 PM",
      whatsappNumber: "+91 76938 49472",
      whatsappUrl: "https://wa.me/917693849472",
    },
  };

  let currentSettings = { ...defaults };

  const get = (id) => document.getElementById(id);
  const deepMerge = (target, source) => {
    const output = { ...target };
    Object.entries(source || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        output[key] = deepMerge(output[key] || {}, value);
      } else if (value !== undefined) {
        output[key] = value;
      }
    });
    return output;
  };

  const requestSettings = async () => {
    const sources = [API_BASE, FALLBACK_SETTINGS];
    for (const source of sources) {
      try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok) continue;
        const payload = await response.json();
        return payload.data || payload;
      } catch (error) {
        // Continue to the fallback source.
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

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Unable to save settings. Please run the API server.");
    }

    const payload = await response.json();
    return payload.data || payload;
  };

  const setValue = (id, value) => {
    const field = get(id);
    if (!field || value === undefined || value === null) return;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value;
  };

  const valueOf = (id) => {
    const field = get(id);
    if (!field) return "";
    return field.type === "checkbox" ? field.checked : field.value.trim();
  };

  const readImageFile = (input) => new Promise((resolve, reject) => {
    const file = input?.files?.[0];
    if (!file) {
      resolve("");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("Image uploads for settings must be 1MB or smaller."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read selected image."));
    reader.readAsDataURL(file);
  });

  const renderImagePreview = (containerId, image, label) => {
    const container = get(containerId);
    if (!container) return;
    container.innerHTML = image ? `<div class="preview-image-box"><img src="${image}" alt="${label}"></div>` : "";
  };

  const flash = (message) => {
    alert(message);
  };

  const populateWebsiteForm = () => {
    setValue("siteName", currentSettings.siteName);
    setValue("siteTagline", currentSettings.tagline);
    setValue("siteDescription", currentSettings.description);
    setValue("primaryColor", currentSettings.theme?.primaryColor);
    setValue("secondaryColor", currentSettings.theme?.secondaryColor);
    setValue("websiteStatus", currentSettings.maintenanceMode ? "maintenance" : "live");
    setValue("footerText", currentSettings.footerText);
    setValue("bannerEyebrow", currentSettings.homepageBanner?.eyebrow);
    setValue("bannerTitle", currentSettings.homepageBanner?.title);
    setValue("bannerDescription", currentSettings.homepageBanner?.description);
    setValue("bannerPrimaryText", currentSettings.homepageBanner?.primaryButtonText);
    setValue("bannerPrimaryUrl", currentSettings.homepageBanner?.primaryButtonUrl);
    setValue("bannerSecondaryText", currentSettings.homepageBanner?.secondaryButtonText);
    setValue("bannerSecondaryUrl", currentSettings.homepageBanner?.secondaryButtonUrl);
    setValue("bannerHighlightLabel", currentSettings.homepageBanner?.highlightLabel);
    setValue("bannerHighlightText", currentSettings.homepageBanner?.highlightText);
    setValue("contactPhone", currentSettings.contact?.phone);
    setValue("contactPhoneHref", currentSettings.contact?.phoneHref);
    setValue("contactEmail", currentSettings.contact?.email);
    setValue("contactAddress", currentSettings.contact?.address);
    setValue("contactHours", currentSettings.contact?.hours);
    setValue("contactWhatsapp", currentSettings.contact?.whatsappUrl);
    renderImagePreview("logoPreviewContainer", currentSettings.logo, "Logo preview");
    renderImagePreview("bannerPreviewContainer", currentSettings.homepageBanner?.image, "Homepage banner preview");
  };

  const initWebsiteForm = () => {
    const form = get("websiteSettingsForm");
    if (!form) return;
    populateWebsiteForm();

    [
      ["logoUpload", "logoPreviewContainer", "Logo preview"],
      ["bannerImageUpload", "bannerPreviewContainer", "Homepage banner preview"],
    ].forEach(([inputId, containerId, label]) => {
      get(inputId)?.addEventListener("change", async (event) => {
        try {
          const image = await readImageFile(event.currentTarget);
          renderImagePreview(containerId, image, label);
        } catch (error) {
          flash(error.message);
          event.currentTarget.value = "";
        }
      });
    });

    form.addEventListener("reset", () => setTimeout(populateWebsiteForm, 0));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const [logoImage, faviconImage, bannerImage] = await Promise.all([
          readImageFile(get("logoUpload")),
          readImageFile(get("faviconUpload")),
          readImageFile(get("bannerImageUpload")),
        ]);
        currentSettings = await saveSettings(deepMerge(currentSettings, {
          siteName: valueOf("siteName"),
          tagline: valueOf("siteTagline"),
          description: valueOf("siteDescription"),
          logo: logoImage || currentSettings.logo,
          favicon: faviconImage || currentSettings.favicon,
          theme: {
            primaryColor: valueOf("primaryColor"),
            secondaryColor: valueOf("secondaryColor"),
          },
          maintenanceMode: valueOf("websiteStatus") === "maintenance",
          footerText: valueOf("footerText"),
          homepageBanner: {
            eyebrow: valueOf("bannerEyebrow"),
            title: valueOf("bannerTitle"),
            description: valueOf("bannerDescription"),
            image: bannerImage || currentSettings.homepageBanner?.image,
            primaryButtonText: valueOf("bannerPrimaryText"),
            primaryButtonUrl: valueOf("bannerPrimaryUrl"),
            secondaryButtonText: valueOf("bannerSecondaryText"),
            secondaryButtonUrl: valueOf("bannerSecondaryUrl"),
            highlightLabel: valueOf("bannerHighlightLabel"),
            highlightText: valueOf("bannerHighlightText"),
          },
          contact: {
            phone: valueOf("contactPhone"),
            phoneHref: valueOf("contactPhoneHref"),
            email: valueOf("contactEmail"),
            address: valueOf("contactAddress"),
            hours: valueOf("contactHours"),
            whatsappNumber: valueOf("contactPhone"),
            whatsappUrl: valueOf("contactWhatsapp"),
          },
        }));
        form.reset();
        populateWebsiteForm();
        flash("Website Settings Saved Successfully ✨");
      } catch (error) {
        flash(error.message);
      }
    });
  };

  document.addEventListener("DOMContentLoaded", async () => {
    currentSettings = deepMerge(defaults, await requestSettings());
    initWebsiteForm();
  });
}());
