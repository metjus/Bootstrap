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
  return `<a class="thread-row ${active ? "active" : ""} ${t.unread ? "unread" : ""}" href="/spravy/?inzerat=${t.id}" data-thread="${t.id}"${active ? ' aria-current="page"' : ""}><img src="${esc(t.photo)}" alt=""><div><div class="thread-row-top"><strong>${esc(t.peer)}</strong>${t.unread ? `<span class="unread-dot">${t.unread}</span>` : ""}</div><span class="thread-ad-title">${esc(t.title)}</span><p>${t.last ? (t.lastOut ? "Ty: " : "") + esc(t.last) : "Zatiaľ bez správ"}</p></div></a>`;
}
function messageMarkup(m) {
  return `<article class="conversation-message ${m.direction === "out" ? "outgoing" : "incoming"}" data-message="${m.id}"><small>${m.direction === "out" ? "Ty" : esc(inbox.thread?.peer || "")} · ${fmtDateTime(m.sentAt)}</small><p>${esc(m.text)}</p>${m.direction === "out" ? `<small class="message-state">${m.read ? "Prečítané" : "Odoslané"}</small>` : ""}</article>`;
}
function renderThreadList() {
  const list = $("#threadList");
  if (!list) return;
  list.innerHTML = inbox.threads.length
    ? inbox.threads.map(threadRow).join("") +
      (inbox.page < inbox.pages ? `<button type="button" class="outline" id="moreThreads">Načítať ďalšie</button>` : "")
    : `<div class="thread-no-results"><p>${inbox.search || inbox.filter === "unread" ? "Nič sa nenašlo." : "Zatiaľ tu nie sú žiadne rozhovory. Kontaktuj inzerujúceho pri konkrétnej ponuke."}</p><a href="/kategorie/">Prehliadať kategórie ↗</a></div>`;
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
    return `<div class="message-empty"><h2>Vyber rozhovor.</h2><p>Správy sú súkromné a viazané na konkrétny inzerát.</p></div>`;
  const disabled = t.blocked || t.blockedBy || t.peerDeleted;
  const reason = t.peerDeleted
    ? "Účet druhej strany už neexistuje."
    : t.blocked
      ? "Kontakt je zablokovaný."
      : t.blockedBy
        ? "Tento používateľ s tebou nekomunikuje."
        : "Ctrl / ⌘ + Enter odošle správu.";
  return `<div class="conversation-header"><a class="conversation-back" href="/spravy/">← Všetky správy</a><div class="conversation-person"><span class="peer-avatar">${esc((t.peer || "?")[0])}</span><h2>${esc(t.peer)}</h2></div><div class="conversation-tools"><button type="button" class="text-button" id="inboxBlock"${t.peerDeleted ? " hidden" : ""}>${t.blocked ? "Odblokovať" : "Blokovať"}</button><button type="button" class="text-button delete-action" id="inboxDelete">Skryť rozhovor</button><a href="/nahlasit/?inzerat=${t.adId}" class="text-button">Nahlásiť</a></div></div><div class="conversation-ad"><img src="${esc(t.photo)}" alt=""><div><strong>${esc(t.title)}</strong><p>${price(t)}${t.closed ? " · " + "ukončený" : ""}</p></div><a href="/inzerat/?id=${t.adId}">↗<span class="sr">Otvoriť inzerát</span></a></div><div class="conversation-safety">Overený email nepotvrdzuje totožnosť. Neplať vopred a nezadávaj údaje karty do odkazov od iných používateľov.</div><div class="conversation-log" id="conversationLog" role="log" aria-live="polite" aria-label="História správ">${inbox.hasMore ? `<button type="button" class="outline" id="olderMessages">Staršie správy</button>` : ""}${inbox.messages.map(messageMarkup).join("") || `<div class="message-empty"><h3>${t.role === "buyer" ? "Začni otázkou." : "Zatiaľ bez správ."}</h3><p>Je ponuka aktuálna? Kedy je možný odber?</p></div>`}</div><form class="message-composer" id="messageForm"><label for="messageText">Tvoja správa</label><textarea id="messageText" required maxlength="4000" rows="3"${disabled ? " disabled" : ""}></textarea><div class="composer-bottom"><p>${reason}</p><button class="primary" id="sendMessage"${disabled ? " disabled" : ""}>Odoslať ↗</button></div><p id="composerError" class="field-error" role="alert"></p></form>`;
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
      input.value
        ? localStorage.setItem(messageDraftKey(t.id), input.value)
        : localStorage.removeItem(messageDraftKey(t.id));
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
      title: t.blocked ? "Odblokovať kontakt?" : "Blokovať kontakt?",
      text: "Blokovanie platí pre všetky rozhovory s týmto účtom. Nebude ti môcť písať a ty jemu tiež nie.",
    });
    if (!ok) return;
    await operation(null, async () => {
      await api("conversations/" + t.id + "/block", "POST", { block: !t.blocked });
      await openThread(t.id);
    });
  };
  $("#inboxDelete").onclick = async () => {
    const ok = await confirmDialog({
      title: "Skryť rozhovor?",
      text: "Skryje sa iba v tvojom účte. Nová správa ho opäť zobrazí.",
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
  if (!t || document.visibilityState !== "visible" || !inbox.messages.some((m) => m.direction === "in" && !m.read))
    return;
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
        if (label) label.textContent = "Prečítané";
      }
    }
  } catch {}
}
function notificationSettings() {
  openModal(
    `<form class="dialog-form" id="inboxNotificationForm"><h2 id="dialogTitle">Upozornenia na správy</h2><label class="checkbox-row"><input type="checkbox" id="emailNotificationChoice"${inbox.notifications ? " checked" : ""}><span>Poslať email pri novej správe.</span></label><p class="modal-muted">Email obsahuje odkaz na rozhovor. Odpovedá sa na webe, nie odpoveďou na email.</p><p id="notificationsError" class="field-error" role="alert"></p><button class="primary" id="notificationsSave">Uložiť</button></form>`,
  );
  $("#inboxNotificationForm").onsubmit = (e) => {
    e.preventDefault();
    operation(
      $("#notificationsSave"),
      async () => {
        inbox.notifications = $("#emailNotificationChoice").checked;
        await api("profile", "PATCH", { notifications: inbox.notifications });
        closeModal();
        toast("Nastavenie je uložené.");
      },
      $("#notificationsError"),
    );
  };
}
window.pageInit = async function () {
  const host = $("#inboxContent");
  if (!state.user?.verified) {
    host.innerHTML = `<div class="account-guest"><h1>Tvoje správy.</h1><p>Komunikácia vyžaduje účet s overeným emailom.</p><button type="button" class="primary" id="inboxSignIn">${state.user ? "Overiť email" : "Prihlásiť sa"}</button></div>`;
    $("#inboxSignIn").onclick = () => requireAccount(() => location.reload());
    return;
  }
  host.innerHTML = `<div class="inbox-heading"><div><span class="small-kicker">KONVERZÁCIE</span><h1>Dohodni sa priamo.</h1></div><button type="button" class="outline" id="inboxNotifications">Emailové upozornenia</button></div><div class="inbox-shell"><aside class="thread-sidebar"><div class="thread-search"><label for="threadQuery">Hľadať v rozhovoroch</label><input id="threadQuery" type="search" maxlength="100"></div><div class="inbox-filters"><button type="button" data-thread-filter="all" class="active">Všetky</button><button type="button" data-thread-filter="unread">Neprečítané</button></div><div id="threadList"><p class="loading-line">Načítavam…</p></div></aside><section class="conversation-pane" id="conversationPane"></section></div>`;
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
