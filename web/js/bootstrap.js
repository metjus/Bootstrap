(() => {
  const build = document.currentScript?.dataset.build || "";
  const modules = {
    home: "home",
    listings: "listings",
    detail: "detail",
    create: "create",
    account: "account",
    inbox: "inbox",
    admin: "admin",
    signin: "auth",
    signup: "auth",
    "auth-action": "auth",
    legal: "legal",
  };
  const load = (name) =>
    new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/" + name + ".js?v=" + build;
      s.onload = resolve;
      s.onerror = () => reject(Error("Skript " + name + " sa nenačítal."));
      document.body.append(s);
    });
  (async () => {
    try {
      const response = await fetch("/api/bootstrap", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw Error("Server nie je dostupný.");
      window.BAZAR_BOOT = await response.json();
      for (const name of ["places", "core", modules[document.body.dataset.page]].filter(Boolean)) await load(name);
      await window.startBazaro();
    } catch (e) {
      console.error(e);
      const main = document.querySelector("main");
      if (main)
        main.innerHTML =
          '<section class="wrap account-guest"><h1>Stránku sa nepodarilo načítať.</h1><p>Skontroluj pripojenie a skús to znova. Tvoje údaje na serveri zostávajú uložené.</p><button class="primary" type="button" id="retryBoot">Skúsiť znova</button></section>';
      document.querySelector("#retryBoot")?.addEventListener("click", () => location.reload());
    }
  })();
})();
