"use strict";
const inbox = {
  threads: [],
  page: 1,
  pages: 1,
  filter: "all",
  search: "",
  notifications: false,
  thread: null,
  messages: [],
  hasMore: false,
};
const selectedThreadId = () => new URLSearchParams(location.search).get("inzerat");
const messageDraftKey = (id) => "bazar-message-draft:" + state.user.id + ":" + id;
function threadRow(t) {
  const active = selectedThreadId() === t.id;
  return `<a class="thread-row ${active ? "active" : ""} ${t.unread ? "unread" : ""}" href="/spravy/?inzerat=${t.id}" data-thread="${t.id}"${active ? ' aria-current="page"' : ""}><img src="${esc(t.photo)}" alt=""><div><div class="thread-row-top"><strong>${esc(t.peer)}</strong>${t.unread ? `<span class="unread-dot">${t.unread}</span>` : ""}</div><span class="thread-ad-title">${esc(t.title)}</span><p>${t.last ? (t.lastOut ? L("Ty: ", "Ty: ") : "") + esc(t.last) : L("Zatiaľ bez správ", "Zatím bez zpráv")}</p></div></a>`;
}
function messageMarkup(m) {
  return `<article class="conversation-message ${m.direction === "out" ? "outgoing" : "incoming"}" data-message="${m.id}"><small>${m.direction === "out" ? L("Ty", "Ty") : esc(inbox.thread?.peer || "")} · ${fmtDateTime(m.sentAt)}</small><p>${esc(m.text)}</p>${m.direction === "out" ? `<small class="message-state">${m.read ? L("Prečítané", "Přečteno") : L("Odoslané", "Odesláno")}</small>` : ""}</article>`;
}
function renderThreadList() {
  const list = $("#threadList");
  if (!list) return;
  list.innerHTML = inbox.threads.length
    ? inbox.threads.map(threadRow).join("") +
      (inbox.page < inbox.pages ? `<button type="button" class="outline" id="moreThreads">${L("Načítať ďalšie", "Načíst další")}</button>` : "")
    : `<div class="thread-no-results"><p>${inbox.search || inbox.filter === "unread" ? L("Nič sa nenašlo.", "Nic nenalezeno.") : L("Zatiaľ tu nie sú žiadne rozhovory. Kontaktuj inzerujúceho pri konkrétnej ponuke.", "Zatím tu nejsou žádné rozhovory. Kontaktuj inzerujícího u konkrétní nabídky.")}</p><a href="/kategorie/">${L("Prehliadať kategórie", "Procházet kategorie")} ↗</a></div>`;
  if ($("#moreThreads"))
    $("#moreThreads").onclick = () =>
      operation($("#moreThreads"), async () => {
        await loadThreads(inbox.page + 1, true);
      });
}
async function loadThreads(pageNumber = 1, append = false) {
  const q = new URLSearchParams({ page: pageNumber });
  if (inbox.filter === "unread") q.set("filter", "unread");
  if (inbox.search) q.set("q", inbox.search);
  const r = await api("inbox?" + q);
  inbox.threads = append ? [...inbox.threads, ...r.threads] : r.threads;
  inbox.page = r.page;
  inbox.pages = r.pages;
  inbox.notifications = r.notificationEmail;
  state.unread = r.unread;
  updateHeader();
  renderThreadList();
}
function conversationMarkup() {
  const t = inbox.thread;
  if (!t)
    return `<div class="message-empty"><h2>${L("Vyber rozhovor.", "Vyber rozhovor.")}</h2><p>${L("Správy sú súkromné a viazané na konkrétny inzerát.", "Zprávy jsou soukromé a vázané na konkrétní inzerát.")}</p></div>`;
  const disabled = t.blocked || t.blockedBy || t.peerDeleted;
  const reason = t.peerDeleted
    ? L("Účet druhej strany už neexistuje.", "Účet druhé strany už neexistuje.")
    : t.blocked
      ? L("Kontakt je zablokovaný.", "Kontakt je zablokovaný.")
      : t.blockedBy
        ? L("Tento používateľ s tebou nekomunikuje.", "Tento uživatel s tebou nekomunikuje.")
        : L("Ctrl / ⌘ + Enter odošle správu.", "Ctrl / ⌘ + Enter odešle zprávu.");
  return `<div class="conversation-header"><a class="conversation-back" href="/spravy/">← ${L("Všetky správy", "Všechny zprávy")}</a><div class="conversation-person"><span class="peer-avatar">${esc((t.peer || "?")[0])}</span><h2>${esc(t.peer)}</h2></div><div class="conversation-tools"><button type="button" class="text-button" id="inboxBlock"${t.peerDeleted ? " hidden" : ""}>${t.blocked ? L("Odblokovať", "Odblokovat") : L("Blokovať", "Blokovat")}</button><button type="button" class="text-button delete-action" id="inboxDelete">${L("Skryť rozhovor", "Skrýt rozhovor")}</button><a href="/nahlasit/?inzerat=${t.adId}" class="text-button">${L("Nahlásiť", "Nahlásit")}</a></div></div><div class="conversation-ad"><img src="${esc(t.photo)}" alt=""><div><strong>${esc(t.title)}</strong><p>${price(t)}${t.closed ? " · " + L("ukončený", "ukončený") : ""}</p></div><a href="/inzerat/?id=${t.adId}">↗<span class="sr">${L("Otvoriť inzerát", "Otevřít inzerát")}</span></a></div><div class="conversation-safety">${L("Overený email nepotvrdzuje totožnosť. Neplať vopred a nezadávaj údaje karty do odkazov od iných používateľov.", "Ověřený email nepotvrzuje totožnost. Neplať předem a nezadávej údaje karty do odkazů od jiných uživatelů.")}</div><div class="conversation-log" id="conversationLog" role="log" aria-live="polite" aria-label="${L("História správ", "Historie zpráv")}">${inbox.hasMore ? `<button type="button" class="outline" id="olderMessages">${L("Staršie správy", "Starší zprávy")}</button>` : ""}${inbox.messages.map(messageMarkup).join("") || `<div class="message-empty"><h3>${t.role === "buyer" ? L("Začni otázkou.", "Začni otázkou.") : L("Zatiaľ bez správ.", "Zatím bez zpráv.")}</h3><p>${L("Je ponuka aktuálna? Kedy je možný odber?", "Je nabídka aktuální? Kdy je možný odběr?")}</p></div>`}</div><form class="message-composer" id="messageForm"><label for="messageText">${L("Tvoja správa", "Tvoje zpráva")}</label><textarea id="messageText" required maxlength="4000" rows="3"${disabled ? " disabled" : ""}></textarea><div class="composer-bottom"><p>${reason}</p><button class="primary" id="sendMessage"${disabled ? " disabled" : ""}>${L("Odoslať", "Odeslat")} ↗</button></div><p id="composerError" class="field-error" role="alert"></p></form>`;
}
function renderConversation() {
  const pane = $("#conversationPane");
  pane.innerHTML = conversationMarkup();
  $(".inbox-shell").classList.toggle("has-thread", !!inbox.thread);
  const t = inbox.thread;
  if (!t) return;
  const input = $("#messageText"),
    log = $("#conversationLog");
  log.scrollTop = log.scrollHeight;
  try {
    input.value = localStorage.getItem(messageDraftKey(t.id)) || "";
  } catch {}
  input.oninput = () => {
    try {
      input.value ? localStorage.setItem(messageDraftKey(t.id), input.value) : localStorage.removeItem(messageDraftKey(t.id));
    } catch {}
  };
  input.onkeydown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      $("#messageForm").requestSubmit();
    }
  };
  $("#messageForm").onsubmit = (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    operation(
      $("#sendMessage"),
      async () => {
        const r = await api("conversations/" + t.id + "/messages", "POST", { text: input.value });
        input.value = "";
        try {
          localStorage.removeItem(messageDraftKey(t.id));
        } catch {}
        if (!inbox.messages.some((m) => m.id === r.message.id)) inbox.messages.push(r.message);
        $(".message-empty", log)?.remove();
        log.insertAdjacentHTML("beforeend", messageMarkup(r.message));
        log.scrollTop = log.scrollHeight;
        $("#messageText").focus();
        loadThreads(1).catch(() => {});
      },
      $("#composerError"),
    );
  };
  $("#inboxBlock").onclick = async () => {
    const ok = await confirmDialog({
      title: t.blocked ? L("Odblokovať kontakt?", "Odblokovat kontakt?") : L("Blokovať kontakt?", "Blokovat kontakt?"),
      text: L("Blokovanie platí pre všetky rozhovory s týmto účtom. Nebude ti môcť písať a ty jemu tiež nie.", "Blokování platí pro všechny rozhovory s tímto účtem. Nebude ti moci psát a ty jemu také ne."),
    });
    if (!ok) return;
    await operation(null, async () => {
      await api("conversations/" + t.id + "/block", "POST", { block: !t.blocked });
      await openThread(t.id);
    });
  };
  $("#inboxDelete").onclick = async () => {
    const ok = await confirmDialog({
      title: L("Skryť rozhovor?", "Skrýt rozhovor?"),
      text: L("Skryje sa iba v tvojom účte. Nová správa ho opäť zobrazí.", "Skryje se pouze ve tvém účtu. Nová zpráva ho opět zobrazí."),
    });
    if (!ok) return;
    await operation(null, async () => {
      await api("conversations/" + t.id, "DELETE", {});
      location.assign("/spravy/");
    });
  };
  if ($("#olderMessages"))
    $("#olderMessages").onclick = () =>
      operation($("#olderMessages"), async () => {
        const firstMessage = inbox.messages[0];
        const r = await api(`conversations/${t.id}/messages?before=${firstMessage.sentAt}&beforeId=${firstMessage.id}`);
        const height = log.scrollHeight;
        inbox.messages = [...r.messages, ...inbox.messages];
        inbox.hasMore = r.hasMore;
        renderConversation();
        const after = $("#conversationLog");
        after.scrollTop = after.scrollHeight - height;
      });
}
async function markRead() {
  const t = inbox.thread;
  if (!t || document.visibilityState !== "visible" || !inbox.messages.some((m) => m.direction === "in" && !m.read)) return;
  try {
    const r = await api("conversations/" + t.id + "/read", "POST", {});
    inbox.messages.forEach((m) => m.direction === "in" && (m.read = true));
    state.unread = r.unread;
    updateHeader();
    const row = inbox.threads.find((x) => x.id === t.id);
    if (row) row.unread = 0;
    renderThreadList();
  } catch {}
}
async function openThread(id) {
  try {
    const r = await api("conversations/" + id);
    inbox.thread = r.thread;
    inbox.messages = r.messages;
    inbox.hasMore = r.hasMore;
  } catch (e) {
    inbox.thread = null;
    toast(e.message);
  }
  renderConversation();
  renderThreadList();
  await markRead();
}
async function pollThread() {
  const t = inbox.thread;
  if (!t || document.visibilityState !== "visible") return;
  const last = inbox.messages.at(-1);
  try {
    const r = await api(`conversations/${t.id}/messages?after=${last?.sentAt || 0}&afterId=${last?.id || 0}`);
    const log = $("#conversationLog");
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    const fresh = r.messages.filter((m) => !inbox.messages.some((x) => x.id === m.id));
    if (fresh.length) {
      $(".message-empty", log)?.remove();
      inbox.messages.push(...fresh);
      log.insertAdjacentHTML("beforeend", fresh.map(messageMarkup).join(""));
      if (nearBottom) log.scrollTop = log.scrollHeight;
      await markRead();
    }
    for (const id of r.readIds) {
      const m = inbox.messages.find((x) => x.id === id);
      if (m && !m.read) {
        m.read = true;
        const label = $(`[data-message="${id}"] .message-state`);
        if (label) label.textContent = L("Prečítané", "Přečteno");
      }
    }
  } catch {}
}
function notificationSettings() {
  openModal(
    `<form class="dialog-form" id="inboxNotificationForm"><h2 id="dialogTitle">${L("Upozornenia na správy", "Upozornění na zprávy")}</h2><label class="checkbox-row"><input type="checkbox" id="emailNotificationChoice"${inbox.notifications ? " checked" : ""}><span>${L("Poslať email pri novej správe.", "Poslat email při nové zprávě.")}</span></label><p class="modal-muted">${L("Email obsahuje odkaz na rozhovor. Odpovedá sa na webe, nie odpoveďou na email.", "Email obsahuje odkaz na rozhovor. Odpovídá se na webu, nikoli odpovědí na email.")}</p><p id="notificationsError" class="field-error" role="alert"></p><button class="primary" id="notificationsSave">${L("Uložiť", "Uložit")}</button></form>`,
  );
  $("#inboxNotificationForm").onsubmit = (e) => {
    e.preventDefault();
    operation(
      $("#notificationsSave"),
      async () => {
        inbox.notifications = $("#emailNotificationChoice").checked;
        await api("profile", "PATCH", { notifications: inbox.notifications });
        closeModal();
        toast(L("Nastavenie je uložené.", "Nastavení je uložené."));
      },
      $("#notificationsError"),
    );
  };
}
window.pageInit = async function () {
  const host = $("#inboxContent");
  if (!state.user?.verified) {
    host.innerHTML = `<div class="account-guest"><h1>${L("Tvoje správy.", "Tvoje zprávy.")}</h1><p>${L("Komunikácia vyžaduje účet s overeným emailom.", "Komunikace vyžaduje účet s ověřeným emailem.")}</p><button type="button" class="primary" id="inboxSignIn">${state.user ? L("Overiť email", "Ověřit email") : L("Prihlásiť sa", "Přihlásit se")}</button></div>`;
    $("#inboxSignIn").onclick = () => requireAccount(() => location.reload());
    return;
  }
  host.innerHTML = `<div class="inbox-heading"><div><span class="small-kicker">${L("KONVERZÁCIE", "KONVERZACE")}</span><h1>${L("Dohodni sa priamo.", "Domluv se přímo.")}</h1></div><button type="button" class="outline" id="inboxNotifications">${L("Emailové upozornenia", "Emailová upozornění")}</button></div><div class="inbox-shell"><aside class="thread-sidebar"><div class="thread-search"><label for="threadQuery">${L("Hľadať v rozhovoroch", "Hledat v rozhovorech")}</label><input id="threadQuery" type="search" maxlength="100"></div><div class="inbox-filters"><button type="button" data-thread-filter="all" class="active">${L("Všetky", "Všechny")}</button><button type="button" data-thread-filter="unread">${L("Neprečítané", "Nepřečtené")}</button></div><div id="threadList"><p class="loading-line">${L("Načítavam…", "Načítám…")}</p></div></aside><section class="conversation-pane" id="conversationPane"></section></div>`;
  $("#inboxNotifications").onclick = notificationSettings;
  let searchTimer;
  $("#threadQuery").oninput = (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      inbox.search = e.target.value.trim();
      loadThreads(1).catch((err) => toast(err.message));
    }, 300);
  };
  $$("[data-thread-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        inbox.filter = b.dataset.threadFilter;
        $$("[data-thread-filter]").forEach((x) => x.classList.toggle("active", x === b));
        loadThreads(1).catch((err) => toast(err.message));
      }),
  );
  $("#threadList").addEventListener("click", (e) => {
    const a = e.target.closest("[data-thread]");
    if (!a || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    history.pushState(null, "", "/spravy/?inzerat=" + a.dataset.thread);
    openThread(a.dataset.thread);
  });
  addEventListener("popstate", () => {
    const id = selectedThreadId();
    if (id) openThread(id);
    else {
      inbox.thread = null;
      renderConversation();
      renderThreadList();
    }
  });
  try {
    await loadThreads(1);
  } catch (e) {
    $("#threadList").innerHTML = `<p class="form-error">${esc(e.message)}</p>`;
  }
  if (selectedThreadId()) await openThread(selectedThreadId());
  else renderConversation();
  setInterval(pollThread, 8000);
  setInterval(() => document.visibilityState === "visible" && loadThreads(1).catch(() => {}), 30000);
  document.addEventListener("visibilitychange", () => {
    pollThread();
    markRead();
  });
};
