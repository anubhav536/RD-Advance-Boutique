(function () {
  const SETTINGS_ENDPOINT = "/api/v1/data/settings";
  const STATIC_SETTINGS = "data/settings.json";
  const DEFAULT_LOGO = "assets/logo.png";

  const selectAll = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const setText = (selector, value, root = document) => {
    if (!value) return;
    selectAll(selector, root).forEach((element) => {
      element.textContent = value;
    });
  };
  const setHref = (selector, value, root = document) => {
    if (!value) return;
    selectAll(selector, root).forEach((element) => {
      element.href = value;
    });
  };

  const normalizePhoneHref = (phoneHref, phone) => {
    const source = phoneHref || phone || "";
    const cleaned = String(source).replace(/[^+\d]/g, "");
    return cleaned ? `tel:${cleaned}` : "";
  };

  const getSettings = async () => {
    const sources = [SETTINGS_ENDPOINT, STATIC_SETTINGS];

    for (const source of sources) {
      try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok) continue;
        const payload = await response.json();
        return payload.data || payload;
      } catch (error) {
        // Try the next source so static pages still work without the API server.
      }
    }

    return null;
  };

  const applySeo = (settings) => {
    const seo = settings.seo || {};
    const title = seo.metaTitle || settings.siteName;
    if (title) document.title = title;

    const upsertMeta = (selector, attributes) => {
      let element = document.head.querySelector(selector);
      if (!element) {
        element = document.createElement("meta");
        document.head.appendChild(element);
      }

      Object.entries(attributes).forEach(([key, value]) => {
        if (value !== undefined && value !== null) element.setAttribute(key, value);
      });
    };

    if (seo.metaDescription) upsertMeta('meta[name="description"]', { name: "description", content: seo.metaDescription });
    if (seo.metaKeywords) upsertMeta('meta[name="keywords"]', { name: "keywords", content: seo.metaKeywords });
    if (seo.robots || seo.googleIndexing === false) {
      upsertMeta('meta[name="robots"]', { name: "robots", content: seo.googleIndexing === false ? "noindex, nofollow" : seo.robots });
    }
    if (seo.openGraphTitle) upsertMeta('meta[property="og:title"]', { property: "og:title", content: seo.openGraphTitle });
    if (seo.twitterDescription) upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: seo.twitterDescription });

    if (seo.canonicalUrl) {
      let canonical = document.head.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = seo.canonicalUrl;
    }

    if (settings.favicon) {
      let icon = document.head.querySelector('link[rel="icon"]');
      if (!icon) {
        icon = document.createElement("link");
        icon.rel = "icon";
        document.head.appendChild(icon);
      }
      icon.href = settings.favicon;
    }
  };

  const applyBranding = (settings) => {
    const logo = settings.logo || DEFAULT_LOGO;
    selectAll('img[src="assets/logo.png"], img[src="logo.png"]').forEach((image) => {
      image.src = logo;
      if (settings.siteName) image.alt = `${settings.siteName} logo`;
    });

    const [brandFirst = "RD Advance", ...brandRest] = String(settings.siteName || "RD Advance Boutique").split(" ");
    selectAll(".brand__text strong").forEach((element) => {
      element.textContent = brandRest.length ? `${brandFirst} ${brandRest.shift()}` : settings.siteName;
    });
    if (brandRest.length) setText(".brand__text span", brandRest.join(" "));

    if (settings.theme?.primaryColor) document.documentElement.style.setProperty("--rose", settings.theme.primaryColor);
    if (settings.theme?.secondaryColor) document.documentElement.style.setProperty("--black", settings.theme.secondaryColor);
  };

  const applyHomepageBanner = (settings) => {
    const banner = settings.homepageBanner || {};
    const hero = document.querySelector(".hero");
    if (!hero) return;

    setText(".hero .eyebrow", banner.eyebrow, hero);
    setText(".hero h1", banner.title, hero);
    setText(".hero__copy", banner.description, hero);
    setText(".hero__card span", banner.highlightLabel, hero);
    setText(".hero__card strong", banner.highlightText, hero);

    const actions = selectAll(".hero__actions .btn", hero);
    if (actions[0]) {
      if (banner.primaryButtonText) actions[0].textContent = banner.primaryButtonText;
      if (banner.primaryButtonUrl) actions[0].href = banner.primaryButtonUrl;
    }
    if (actions[1]) {
      if (banner.secondaryButtonText) actions[1].textContent = banner.secondaryButtonText;
      if (banner.secondaryButtonUrl) actions[1].href = banner.secondaryButtonUrl;
    }

    if (banner.image) {
      hero.style.backgroundImage = `linear-gradient(90deg, rgba(16, 13, 11, 0.78), rgba(16, 13, 11, 0.42), rgba(255, 248, 238, 0.2)), url("${banner.image}")`;
    }
  };

  const applyContact = (settings) => {
    const contact = settings.contact || {};
    const whatsappUrl = contact.whatsappUrl || settings.socialLinks?.whatsapp;
    const phoneUrl = normalizePhoneHref(contact.phoneHref, contact.phone);

    setHref('a[href^="https://wa.me/"]', whatsappUrl);
    setHref('a[href^="tel:"]', phoneUrl);
    setText(".footer__contact p", contact.address);
    setText(".footer__contact a", contact.phone);
    setText(".footer__bottom", settings.footerText);

    setText(".footer__brand h2", settings.siteName);
    setText(".footer__brand p", settings.description || settings.tagline);
    setText(".location-card h2", settings.siteName ? `${settings.siteName}, Damoh` : "");
    setText(".location-card__meta span:first-child", contact.address ? `📍 ${contact.address}` : "");
    setText(".location-card__meta a", contact.phone ? `☎ ${contact.phone}` : "");
    setText(".contact-hero__card strong", contact.hours);
  };

  const applySocialLinks = (settings) => {
    const social = settings.socialLinks || {};
    const labels = {
      instagram: "Instagram",
      facebook: "Facebook",
      youtube: "YouTube",
      telegram: "Telegram",
      pinterest: "Pinterest",
      twitter: "X / Twitter",
      linkedin: "LinkedIn",
    };
    const links = Object.entries(labels)
      .map(([key, label]) => ({ key, label, url: social[key] }))
      .filter((link) => link.url);
    const grid = document.querySelector(".social-grid");

    if (grid && links.length) {
      grid.innerHTML = links
        .map((link) => `
          <a href="${link.url}" class="social-card" aria-label="Visit ${settings.siteName || "RD Advance Boutique"} on ${link.label}" target="_blank" rel="noopener">
            <span>${link.label}</span>
            <strong>${new URL(link.url, window.location.href).hostname.replace(/^www\./, "")}</strong>
          </a>
        `)
        .join("");
    }
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const settings = await getSettings();
    if (!settings) return;

    applySeo(settings);
    applyBranding(settings);
    applyHomepageBanner(settings);
    applyContact(settings);
    applySocialLinks(settings);
  });
}());
