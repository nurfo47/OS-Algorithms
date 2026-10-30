const THEME_KEY = "algoritmi-theme";

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

function setTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  updateThemeButton();
}

function updateThemeButton() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const dark = document.documentElement.dataset.theme === "dark";
  btn.innerHTML = dark
    ? '<span class="theme-icon" aria-hidden="true">☀</span>'
    : '<span class="theme-icon" aria-hidden="true">🌙</span>';
  btn.setAttribute("aria-label", typeof t === "function" ? t(dark ? "theme.light" : "theme.dark") : "");
}

function buildSiteChrome() {
  if (document.querySelector(".site-header")) return;

  const body = document.body;
  const scripts = [...body.querySelectorAll(":scope > script")];

  const main = document.createElement("main");
  main.className = "site-main";
  [...body.children].filter(el => el.tagName !== "SCRIPT").forEach(el => main.appendChild(el));

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <a href="index.html" class="site-brand" data-i18n="brand">Algoritmi</a>
    <nav class="site-nav" aria-label="Main">
      <a class="nav-link" data-nav="memory" href="memory_menagment.html" data-i18n="nav.memory">Raspodjela memorije</a>
      <a class="nav-link" data-nav="process" href="process_menagment.html" data-i18n="nav.process">Raspodjela procesa</a>
      <a class="nav-link" data-nav="paging" href="paging_menagment.html" data-i18n="nav.paging">Zamjena stranica</a>
    </nav>
    <div class="site-controls">
      <button type="button" id="theme-toggle" class="icon-btn" aria-label="Toggle theme"></button>
      <div class="lang-switch" role="group" aria-label="Language">
        <button type="button" class="lang-btn" data-lang="en" aria-pressed="false">EN</button>
        <button type="button" class="lang-btn" data-lang="bs" aria-pressed="false">BS</button>
      </div>
    </div>
  `;

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `<p>© <span id="footer-year"></span> Design by Nurfet Mehulić</p>`;

  body.insertBefore(header, scripts[0] || null);
  body.insertBefore(main, scripts[0] || null);
  body.insertBefore(footer, scripts[0] || null);

  const yearEl = document.getElementById("footer-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  document.documentElement.dataset.theme = getStoredTheme() === "dark" ? "dark" : "light";
  updateThemeButton();

  document.getElementById("theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof applyLanguage === "function") applyLanguage(getLang());
  });

  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });

  applyLanguage(getLang());
  updateNavHighlight();
}

function currentNavSection() {
  const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const memory = ["memory_menagment.html", "first_fit.html", "next_fit.html", "best_fit.html", "worst_fit.html", "quick_fit.html"];
  const process = ["process_menagment.html", "fcfs.html", "sjf.html", "priority.html", "round_robin.html"];
  const paging = ["paging_menagment.html", "opt.html", "lru.html", "fifo.html", "nfu.html", "second_chance.html", "clock.html"];
  if (memory.includes(file)) return "memory";
  if (process.includes(file)) return "process";
  if (paging.includes(file)) return "paging";
  return "";
}

function updateNavHighlight() {
  const section = currentNavSection();
  document.querySelectorAll(".nav-link").forEach(link => {
    const active = link.dataset.nav === section;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

document.addEventListener("DOMContentLoaded", buildSiteChrome);

// Apply theme before paint to reduce flash
document.documentElement.dataset.theme = getStoredTheme() === "dark" ? "dark" : "light";
