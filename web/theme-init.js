(function () {
  var saved = localStorage.getItem("ricicla_theme");
  var theme = (saved === "light" || saved === "dark")
    ? saved
    : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  var meta = document.getElementById("meta-theme-color");
  if (meta) meta.content = theme === "dark" ? "#0b1218" : "#006390";
})();
