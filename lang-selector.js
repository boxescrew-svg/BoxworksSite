(function () {
  const SITE_LANG = 'it'; // Lingua principale del sito

  const savedPreference = localStorage.getItem('user_lang_preference');
  if (savedPreference) {
    return;
  }

  const userFullLang = navigator.language || navigator.userLanguage || '';
  const userBaseLang = userFullLang.split('-')[0].toLowerCase();

  // Se la lingua del browser è Italiano, non mostrare il banner
  if (!userBaseLang || userBaseLang === SITE_LANG) {
    return;
  }

  const languageNames = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    pt: 'Português',
    zh: 'Chinese',
    ja: 'Japanese',
    ru: 'Russian'
  };
  const targetLangName = languageNames[userBaseLang] || userBaseLang.toUpperCase();

  showLangBanner(userBaseLang, targetLangName);

  function showLangBanner(targetLangCode, targetLangName) {
    const style = document.createElement('style');
    style.innerHTML = `
      #lang-banner-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        left: 20px;
        max-width: 440px;
        margin: 0 auto;
        background-color: #ffffff;
        color: #1a1a1a;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        border-radius: 12px;
        padding: 16px 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        display: flex;
        flex-direction: column;
        gap: 12px;
        border: 1px solid #e5e7eb;
        animation: slideUp 0.3s ease-out;
      }
      @keyframes slideUp {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .lang-banner-title {
        font-weight: 600;
        font-size: 14px;
        line-height: 1.4;
        color: #374151;
      }
      .lang-banner-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .lang-btn {
        padding: 8px 14px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: background-color 0.2s;
      }
      .lang-btn-primary {
        background-color: #2563eb;
        color: white;
      }
      .lang-btn-primary:hover {
        background-color: #1d4ed8;
      }
      .lang-btn-secondary {
        background-color: #f3f4f6;
        color: #4b5563;
      }
      .lang-btn-secondary:hover {
        background-color: #e5e7eb;
      }
    `;
    document.head.appendChild(style);

    const banner = document.createElement('div');
    banner.id = 'lang-banner-container';
    banner.innerHTML = `
      <div class="lang-banner-title">
        We noticed your browser language is not Italian. Would you like to translate this page to <strong>${targetLangName}</strong>?
      </div>
      <div class="lang-banner-actions">
        <button id="lang-btn-dismiss" class="lang-btn lang-btn-secondary">Keep original</button>
        <button id="lang-btn-translate" class="lang-btn lang-btn-primary">Translate to ${targetLangName}</button>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('lang-btn-translate').addEventListener('click', function () {
      localStorage.setItem('user_lang_preference', 'translated');
      const currentUrl = encodeURIComponent(window.location.href);
      window.location.href = `https://translate.google.com/translate?sl=${SITE_LANG}&tl=${targetLangCode}&u=${currentUrl}`;
    });

    document.getElementById('lang-btn-dismiss').addEventListener('click', function () {
      localStorage.setItem('user_lang_preference', 'dismissed');
      banner.remove();
    });
  }
})();
