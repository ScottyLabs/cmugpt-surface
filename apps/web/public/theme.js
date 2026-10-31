// Run before first paint; CSS handles live system appearance changes.
(() => {
  const apply = (value) => {
    const theme = ["light", "dark"].includes(value) ? value : "system";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "system" ? "light dark" : theme;
    document.querySelectorAll("[data-theme-select]").forEach((select) => { select.value = theme; });
  };
  try { apply(localStorage.getItem("bark-theme")); } catch { apply("system"); }
  document.addEventListener("change", ({ target }) => {
    if (!(target instanceof HTMLSelectElement) || !target.matches("[data-theme-select]")) return;
    apply(target.value);
    try { localStorage.setItem("bark-theme", target.value); } catch { /* Storage is optional. */ }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "bark-theme" || event.key === null) apply(event.newValue);
  });
})();
