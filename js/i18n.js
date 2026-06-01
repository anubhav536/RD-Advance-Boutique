"use strict";

(function () {
  const LANG_KEY = "rdLanguage";
  const DEFAULT  = "en";

  const T = {
    en: {
      /* Nav */
      "nav.home": "Home", "nav.shop": "Shop", "nav.gallery": "Gallery",
      "nav.course": "Course", "nav.contact": "Contact", "nav.wishlist": "Wishlist",
      "nav.book": "Book a Fitting", "nav.whatsapp": "WhatsApp", "nav.enroll": "Enroll Now",
      /* Hero – index */
      "hero.eyebrow": "Luxury custom tailoring studio",
      "hero.h1": "Handcrafted boutique fashion for your signature moments.",
      "hero.copy": "Experience graceful Indian silhouettes, precision stitching, and thoughtful styling designed to make every celebration feel unforgettable.",
      "hero.cta1": "Explore Collection", "hero.cta2": "Start Custom Order",
      "hero.search.ph": "Search sarees, plazo suits, kurtis…",
      /* Shop hero */
      "shop.hero.rm.ey": "Ready-Made Collection",
      "shop.hero.rm.h2": "Tayaar kapde — seedha ghar pe.",
      "shop.hero.rm.p": "Premium sarees, kurtis, suits, kids wear and more. Choose size, colour and order instantly.",
      "shop.hero.rm.btn": "Shop Ready-Made →",
      "shop.hero.bt.ey": "Boutique Custom",
      "shop.hero.bt.h2": "Custom stitching — aapke nap par.",
      "shop.hero.bt.p": "Blouses, bridal wear, designer suits & premium tailoring — handcrafted to your measurements.",
      "shop.hero.bt.btn": "Explore Boutique →",
      /* Shop tabs */
      "shop.tab.all": "All Products", "shop.tab.rm": "Ready-Made", "shop.tab.bt": "Boutique Custom",
      "shop.tab.rm.sub": "Tayaar kapde", "shop.tab.bt.sub": "Custom stitching",
      /* Shop toolbar */
      "shop.search.ph": "Search sarees, blouses, kurtis…",
      /* Category browse */
      "cat.eyebrow": "Shop by Category", "cat.h2": "Kya dhundh rahi hain aap?",
      /* Buttons */
      "btn.buyNow": "Buy Now", "btn.viewDetails": "View Details",
      "btn.whatsapp": "WhatsApp", "btn.share": "Share",
      "btn.startCustom": "Start Custom Order", "btn.contactUs": "Contact Us",
      "btn.bookFitting": "Book a Fitting",
      /* Wishlist page */
      "wl.eyebrow": "Saved items", "wl.title": "My Wishlist",
      "wl.share": "Share Wishlist", "wl.clearAll": "Clear All",
      "wl.empty.h": "No products saved yet.",
      "wl.empty.p": "Tap the ♡ on any product to save it here.",
      "wl.continue": "Continue Shopping",
      "wl.remove": "✕ Remove",
      "wl.related.ey": "Based on your wishlist",
      "wl.related.h2": "You May Also Like",
      /* Size guide */
      "sg.tops": "Tops / Kurtis", "sg.bottoms": "Bottoms",
      "sg.blouse": "Blouse", "sg.kids": "Kids",
      /* Custom */
      "custom.eyebrow": "Bespoke appointment",
      "custom.h2": "Custom boutique order chahiye?",
      "custom.btn": "Start Custom Order",
      /* Contact banner */
      "contact.eyebrow": "Visit or message us",
      /* Footer */
      "footer.rights": "© 2026 RD Advance Boutique. All Rights Reserved.",
      /* Product detail */
      "detail.sizes": "Available sizes", "detail.colors": "Available colors",
      "detail.sizeguide": "📏 Size Guide",
      /* Gallery */
      "gallery.eyebrow": "Design portfolio",
      /* Course */
      "course.enroll": "Enroll Now",
      /* Common */
      "common.loading": "Loading…",
    },

    hi: {
      /* Nav */
      "nav.home": "होम", "nav.shop": "शॉप", "nav.gallery": "गैलरी",
      "nav.course": "कोर्स", "nav.contact": "संपर्क", "nav.wishlist": "विशलिस्ट",
      "nav.book": "अपॉइंटमेंट बुक करें", "nav.whatsapp": "व्हाट्सएप", "nav.enroll": "अभी जॉइन करें",
      /* Hero – index */
      "hero.eyebrow": "लक्जरी कस्टम टेलरिंग स्टूडियो",
      "hero.h1": "आपके खास पलों के लिए हस्तनिर्मित बुटीक फैशन।",
      "hero.copy": "खूबसूरत भारतीय पहनावा, बेहतरीन सिलाई, और आपकी पसंद के अनुसार स्टाइलिंग — हर जश्न को यादगार बनाने के लिए।",
      "hero.cta1": "कलेक्शन देखें", "hero.cta2": "कस्टम ऑर्डर शुरू करें",
      "hero.search.ph": "साड़ी, प्लाज़ो सूट, कुर्ती खोजें…",
      /* Shop hero */
      "shop.hero.rm.ey": "रेडीमेड कलेक्शन",
      "shop.hero.rm.h2": "तैयार कपड़े — सीधे घर पे।",
      "shop.hero.rm.p": "प्रीमियम साड़ी, कुर्ती, सूट, किड्स वेअर और बहुत कुछ। साइज़, रंग चुनें और तुरंत ऑर्डर करें।",
      "shop.hero.rm.btn": "रेडीमेड शॉप करें →",
      "shop.hero.bt.ey": "बुटीक कस्टम",
      "shop.hero.bt.h2": "कस्टम सिलाई — आपके नाप पर।",
      "shop.hero.bt.p": "ब्लाउज़, ब्राइडल वेअर, डिज़ाइनर सूट और प्रीमियम टेलरिंग — आपके माप पर हाथ से बनाया।",
      "shop.hero.bt.btn": "बुटीक एक्सप्लोर करें →",
      /* Shop tabs */
      "shop.tab.all": "सभी प्रोडक्ट", "shop.tab.rm": "रेडीमेड", "shop.tab.bt": "बुटीक कस्टम",
      "shop.tab.rm.sub": "तैयार कपड़े", "shop.tab.bt.sub": "कस्टम सिलाई",
      /* Shop toolbar */
      "shop.search.ph": "साड़ी, ब्लाउज़, कुर्ती खोजें…",
      /* Category browse */
      "cat.eyebrow": "केटेगरी से शॉप करें", "cat.h2": "क्या ढूंढ रही हैं आप?",
      /* Buttons */
      "btn.buyNow": "अभी खरीदें", "btn.viewDetails": "विवरण देखें",
      "btn.whatsapp": "व्हाट्सएप", "btn.share": "शेयर करें",
      "btn.startCustom": "कस्टम ऑर्डर शुरू करें", "btn.contactUs": "संपर्क करें",
      "btn.bookFitting": "फिटिंग बुक करें",
      /* Wishlist page */
      "wl.eyebrow": "सेव किए प्रोडक्ट", "wl.title": "मेरी विशलिस्ट",
      "wl.share": "विशलिस्ट शेयर करें", "wl.clearAll": "सब हटाएं",
      "wl.empty.h": "अभी तक कोई प्रोडक्ट सेव नहीं हुआ।",
      "wl.empty.p": "किसी भी प्रोडक्ट पर ♡ दबाएं और यहाँ सेव करें।",
      "wl.continue": "शॉपिंग जारी रखें",
      "wl.remove": "✕ हटाएं",
      "wl.related.ey": "आपकी विशलिस्ट के आधार पर",
      "wl.related.h2": "आपको ये भी पसंद आ सकते हैं",
      /* Size guide */
      "sg.tops": "टॉप्स / कुर्ती", "sg.bottoms": "बॉटम्स",
      "sg.blouse": "ब्लाउज़", "sg.kids": "बच्चों के लिए",
      /* Custom */
      "custom.eyebrow": "बेस्पोक अपॉइंटमेंट",
      "custom.h2": "कस्टम बुटीक ऑर्डर चाहिए?",
      "custom.btn": "कस्टम ऑर्डर शुरू करें",
      /* Contact */
      "contact.eyebrow": "विज़िट करें या मैसेज करें",
      /* Footer */
      "footer.rights": "© 2026 RD Advance Boutique. सभी अधिकार सुरक्षित।",
      /* Product detail */
      "detail.sizes": "उपलब्ध साइज़", "detail.colors": "उपलब्ध रंग",
      "detail.sizeguide": "📏 साइज़ गाइड",
      /* Gallery */
      "gallery.eyebrow": "डिज़ाइन पोर्टफोलियो",
      /* Course */
      "course.enroll": "अभी जॉइन करें",
      /* Common */
      "common.loading": "लोड हो रहा है…",
    }
  };

  /* ── Core ─────────────────────────────────── */
  function getLang() {
    return localStorage.getItem(LANG_KEY) || DEFAULT;
  }

  function setLang(lang) {
    if (!T[lang]) return;
    localStorage.setItem(LANG_KEY, lang);
    apply(lang);
    updateToggle(lang);
    document.documentElement.lang = lang === "hi" ? "hi" : "en";
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
  }

  function t(key, lang) {
    lang = lang || getLang();
    return (T[lang] && T[lang][key]) || (T[DEFAULT] && T[DEFAULT][key]) || key;
  }

  /* ── Apply to DOM ─────────────────────────── */
  function apply(lang) {
    // textContent
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.dataset.i18n;
      if (key) el.textContent = t(key, lang);
    });
    // placeholder
    document.querySelectorAll("[data-i18n-ph]").forEach(el => {
      const key = el.dataset.i18nPh;
      if (key) el.placeholder = t(key, lang);
    });
    // aria-label
    document.querySelectorAll("[data-i18n-aria]").forEach(el => {
      const key = el.dataset.i18nAria;
      if (key) el.setAttribute("aria-label", t(key, lang));
    });
    // html content (for rich text)
    document.querySelectorAll("[data-i18n-html]").forEach(el => {
      const key = el.dataset.i18nHtml;
      if (key) el.innerHTML = t(key, lang);
    });
  }

  /* ── Toggle button ────────────────────────── */
  function updateToggle(lang) {
    document.querySelectorAll(".lang-btn").forEach(btn => {
      btn.textContent = lang === "hi" ? "EN" : "हिं";
      btn.setAttribute("aria-label", lang === "hi" ? "Switch to English" : "हिंदी में बदलें");
      btn.dataset.currentLang = lang;
    });
  }

  /* ── Init ──────────────────────────────────── */
  function init() {
    const lang = getLang();
    apply(lang);
    updateToggle(lang);
    document.documentElement.lang = lang === "hi" ? "hi" : "en";

    // Wire all toggle buttons (present or future)
    document.addEventListener("click", function (e) {
      const btn = e.target.closest(".lang-btn");
      if (!btn) return;
      const current = getLang();
      setLang(current === "hi" ? "en" : "hi");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.RDi18n = { t, getLang, setLang };
})();
