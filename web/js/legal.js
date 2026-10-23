"use strict";
window.pageInit = async function () {
  const form = $("#legalReportForm");
  if (!form) return;
  const listingId = Number(params.get("inzerat"));
  if (listingId > 0) $("#reportUrl").value = location.origin + "/inzerat/?id=" + listingId;
  if (state.user) {
    $("#reportName").value = state.user.name;
    $("#reportEmail").value = state.user.email;
  }
  let captchaToken = () => "";
  if (!state.user && state.config.turnstile) {
    const box = document.createElement("div");
    box.className = "turnstile-box";
    $("#legalReportForm button.primary").before(box);
    captcha(box).then((get) => (captchaToken = get));
  }
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    operation(
      $("#legalReportForm button.primary"),
      async () => {
        let id = null,
          href = $("#reportUrl").value.trim();
        try {
          const target = new URL(href, location.origin);
          href = target.href;
          if (target.origin === location.origin) id = Number(target.searchParams.get("id")) || null;
        } catch {}
        await api("reports", "POST", {
          listingId: id,
          url: href,
          name: $("#reportName").value,
          reason: $("#reportReason").value,
          details: $("#reportExplanation").value,
          email: $("#reportEmail").value,
          confirm: $("#reportConfirm").checked,
          captcha: captchaToken(),
        });
        form.reset();
        $("#legalReportStatus").textContent = "Ďakujeme. Hlásenie je uložené a posúdime ho bez zbytočného odkladu.";
      },
      $("#legalReportStatus"),
    );
  };
};
