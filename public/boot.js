// До отрисовки: язык по браузеру (только на главной и только если язык не выбирали вручную).
(function () {
  try {
    var d = document.documentElement;
    d.classList.remove("no-js");
    if (location.pathname !== "/" || /bot|crawl|spider|lighthouse/i.test(navigator.userAgent)) return;
    var saved = localStorage.getItem("osiris_site_lang");
    var pick = saved;
    if (!pick) {
      var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"];
      for (var i = 0; i < list.length && !pick; i++) {
        var c = String(list[i]).slice(0, 2).toLowerCase();
        if (c === "pl") pick = "pl";
        else if (c === "ru" || c === "uk" || c === "be") pick = "ru";
        else if (c === "en") pick = "en";
      }
    }
    if (pick === "pl" || pick === "ru") location.replace("/" + pick + "/" + location.search + location.hash);
  } catch (e) {}
})();
