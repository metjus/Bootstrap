"use strict";
// Three-step listing editor with a local draft, simple photo editing and server publishing.
let createStep = 1,
  createDraft = null,
  uploadPhotos = [],
  selectedPhotoIndex = 0,
  draftTimer = null,
  draftBusy = false,
  draftSaved = false,
  draftConflict = false,
  createCompleted = false;
const uploadedDraft = new Map();
const draftKey = () => "bazar-listing-draft:" + state.user.id;
function blankDraft() {
  return {
    version: 2,
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    country: lang,
    type: "sell",
    category: "",
    title: "",
    description: "",
    price: null,
    city: "",
    state: "Používané",
    phone: state.user.phone || "",
    boost: false,
    step: 1,
  };
}
function validateDraft(d) {
  const errors = {};
  if (!CATEGORIES.some((c) => c[0] === d.category)) errors.category = L("Vyber kategóriu.", "Vyber kategorii.");
  if (d.title.trim().length < 5) errors.title = L("Napíš názov aspoň na 5 znakov.", "Napiš název alespoň na 5 znaků.");
  if (d.description.trim().length < 15)
    errors.description = L("Popis musí mať aspoň 15 znakov.", "Popis musí mít alespoň 15 znaků.");
  if (d.price === null || !Number.isFinite(d.price) || d.price < 0 || d.price > 100000000)
    errors.price = L("Zadaj cenu, napríklad 0 pri darovaní.", "Zadej cenu, například 0 při darování.");
  if (d.city.trim().length < 2) errors.city = L("Doplň mesto alebo obec.", "Doplň město nebo obec.");
  if (d.phone.trim() && !/^[+\d ()-]{5,30}$/.test(d.phone.trim()))
    errors.phone = L("Telefón môže obsahovať číslice, medzery a znaky + ( ) -.", "Telefon může obsahovat číslice, mezery a znaky + ( ) -.");
  return errors;
}
function collectDraft() {
  if (!createDraft || createStep !== 1 || !$("#draftTitle")) return;
  for (const [key, id] of [
    ["type", "draftType"],
    ["category", "draftCategory"],
    ["title", "draftTitle"],
    ["description", "draftDescription"],
    ["city", "draftCity"],
    ["state", "draftState"],
    ["phone", "draftPhone"],
    ["country", "draftCountry"],
  ])
    createDraft[key] = $("#" + id).value;
  createDraft.price = $("#draftPrice").value === "" ? null : Number($("#draftPrice").value);
}
function setDraftStatus(t) {
  if ($("#draftStatus")) $("#draftStatus").textContent = t;
}
function saveDraft() {
  clearTimeout(draftTimer);
  if (!createDraft || draftBusy || createCompleted || draftConflict) return false;
  collectDraft();
  try {
    localStorage.setItem(
      draftKey(),
      JSON.stringify({
        ...createDraft,
        savedAt: Date.now(),
        step: createStep,
        photos: uploadPhotos.map((p) => ({ original: p.original, src: p.src === p.original ? "" : p.src, editor: { ...p.editor } })),
      }),
    );
    draftSaved = true;
    setDraftStatus(L("Rozpracované uložené v tomto prehliadači.", "Rozpracováno uloženo v tomto prohlížeči."));
    return true;
  } catch {
    draftSaved = false;
    setDraftStatus(
      L(
        "Rozpracované sa neuložilo — úložisko prehliadača je plné. Pokračuj bez zatvorenia stránky.",
        "Rozpracováno se neuložilo — úložiště prohlížeče je plné. Pokračuj bez zavření stránky.",
      ),
    );
    return false;
  }
}
function scheduleSave() {
  if (draftBusy || createCompleted) return;
  clearTimeout(draftTimer);
  setDraftStatus(L("Ukladám rozpracované…", "Ukládám rozpracováno…"));
  draftTimer = setTimeout(saveDraft, 400);
}
const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(Error(L("Fotografiu sa nepodarilo načítať.", "Fotografii se nepodařilo načíst.")));
    image.src = src;
  });
async function restoreDraft() {
  createDraft = blankDraft();
  uploadPhotos = [];
  createStep = 1;
  let restored = false;
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey()) || "null");
    if (
      saved?.version === 2 &&
      Date.now() - saved.savedAt < 7 * 86400000 &&
      ["title", "description", "city", "phone"].every((k) => typeof saved[k] === "string") &&
      Array.isArray(saved.photos) &&
      saved.photos.length <= 8
    ) {
      createDraft = { ...createDraft, ...saved };
      for (const p of saved.photos) {
        if (!/^data:image\/jpeg;base64,/.test(p.original) || (p.src && !/^data:image\/jpeg;base64,/.test(p.src))) continue;
        try {
          uploadPhotos.push({
            original: p.original,
            image: await loadImage(p.original),
            src: p.src || p.original,
            editor: {
              rotation: [0, 90, 180, 270].includes(p.editor?.rotation) ? p.editor.rotation : 0,
              brightness: Math.min(130, Math.max(70, Number(p.editor?.brightness) || 100)),
              crop: p.editor?.crop === "square" ? "square" : "original",
            },
          });
        } catch {}
      }
      restored = true;
      draftSaved = true;
      createStep = [1, 2, 3].includes(saved.step) ? saved.step : 1;
      if (Object.keys(validateDraft(createDraft)).length) createStep = 1;
      else if (createDraft.type !== "buy" && !uploadPhotos.length && createStep === 3) createStep = 2;
    } else if (saved) localStorage.removeItem(draftKey());
  } catch {}
  return restored;
}
function stepLink(step, label) {
  return `<button type="button" data-create-step="${step}" class="${createStep === step ? "active" : createStep > step ? "complete" : ""}"${createStep === step ? ' aria-current="step"' : ""}><span>${createStep > step ? "✓" : step}</span>${label}</button>`;
}
function renderCreate() {
  const host = $("#createContent"),
    d = createDraft;
  host.innerHTML = `<div class="create-top"><a href="/ucet/" class="text-button">← ${L("Môj účet", "Můj účet")}</a><span class="free-label">${L("Pridanie je zadarmo", "Přidání je zdarma")}</span></div><div class="create-heading"><span class="small-kicker">${L("NOVÝ INZERÁT", "NOVÝ INZERÁT")}</span><h1>${L("Dobrá ponuka.<br>Začína dobrým inzerátom.", "Dobrá nabídka.<br>Začíná dobrým inzerátem.")}</h1><p>${L("Pár údajov. Dobré fotografie. Posledný pohľad pred zverejnením.", "Pár údajů. Dobré fotografie. Poslední pohled před zveřejněním.")}</p></div><nav class="create-steps" aria-label="${L("Kroky pridania", "Kroky přidání")}">${stepLink(1, L("Údaje", "Údaje"))}${stepLink(2, L("Fotografie", "Fotografie"))}${stepLink(3, L("Náhľad", "Náhled"))}</nav><div class="create-layout"><section class="create-workspace"><div id="draftConflict" class="notice"${draftConflict ? "" : " hidden"}>${L("Rozpracovaný inzerát sa zmenil v inej karte. Obnov stránku, aby si neprepísal novšie zmeny.", "Rozpracovaný inzerát se změnil v jiné kartě. Obnov stránku, abys nepřepsal novější změny.")} <button type="button" id="reloadDraft" class="text-button">${L("Obnoviť", "Obnovit")} ↻</button></div>${createStep === 1 ? detailsMarkup(d) : createStep === 2 ? photosMarkup() : previewMarkup(d)}<p id="createError" class="form-error" role="alert"></p><div class="create-bottom"><div><p id="draftStatus" role="status">${draftSaved ? L("Rozpracované uložené v tomto prehliadači.", "Rozpracováno uloženo v tomto prohlížeči.") : L("Rozpracované sa uloží po tvojej úprave.", "Rozpracováno se uloží po tvé úpravě.")}</p><button type="button" id="clearDraft" class="text-button delete-action">${L("Zahodiť rozpracované", "Zahodit rozpracované")}</button></div><div class="create-navigation">${createStep > 1 ? `<button type="button" class="outline" id="previousStep">← ${L("Späť", "Zpět")}</button>` : ""}<button type="button" class="primary" id="nextStep"${draftBusy || draftConflict ? " disabled" : ""}>${createStep === 3 ? L("Zverejniť inzerát", "Zveřejnit inzerát") : L("Pokračovať", "Pokračovat")} ↗</button></div></div></section><aside class="create-help"><span class="help-symbol" aria-hidden="true">↗</span><h2>${createStep === 1 ? L("Jasne a konkrétne.", "Jasně a konkrétně.") : createStep === 2 ? L("Nech hovoria fotky.", "Ať mluví fotky.") : L("Posledný pohľad.", "Poslední pohled.")}</h2><p>${createStep === 1 ? L("Uveď stav, prípadné chyby a možnosti odovzdania. Dobré údaje ušetria zbytočné otázky.", "Uveď stav, případné vady a možnosti předání. Dobré údaje ušetří zbytečné otázky.") : createStep === 2 ? L("Pridaj celok, detail aj prípadné poškodenie. Prvá fotografia bude titulná. Použi vlastné fotky bez citlivých údajov.", "Přidej celek, detail i případné poškození. První fotografie bude titulní. Použij vlastní fotky bez citlivých údajů.") : L("Skontroluj názov, cenu aj kontakty. Dohodu riešiš priamo so záujemcom.", "Zkontroluj název, cenu i kontakty. Dohodu řešíš přímo se zájemcem.")}</p><div class="create-help-note">${L("Rozpracovaný inzerát sa ukladá v tomto prehliadači najviac 7 dní. Po zverejnení sa uloží na server.", "Rozpracovaný inzerát se ukládá v tomto prohlížeči nejvýše 7 dní. Po zveřejnění se uloží na server.")}</div><a href="/pravidla-inzercie/" target="_blank" rel="noopener">${L("Pravidlá inzercie", "Pravidla inzerce")} ↗</a></aside></div>`;
  $("#nextStep").onclick = () => (createStep === 3 ? publishDraft() : goStep(createStep + 1));
  if ($("#previousStep")) $("#previousStep").onclick = () => goStep(createStep - 1);
  $("#clearDraft").onclick = confirmClearDraft;
  $("#reloadDraft").onclick = () => location.reload();
  host.onclick = (e) => {
    const b = e.target.closest("[data-create-step]");
    if (b) goStep(Number(b.dataset.createStep));
  };
  if (createStep === 1) {
    fillCityList($("#draftCities"));
    $("#draftDetails").oninput = scheduleSave;
    $("#draftDetails").onchange = (e) => {
      collectDraft();
      if (e.target.id === "draftType" || e.target.id === "draftCountry") {
        renderCreate();
        $("#" + e.target.id).focus();
      }
      scheduleSave();
    };
    $("#draftDetails").onsubmit = (e) => {
      e.preventDefault();
      goStep(2);
    };
  }
  if (createStep === 2) wirePhotos();
  if (createStep === 3)
    $("#previewBoost").onchange = (e) => {
      createDraft.boost = e.target.checked;
      scheduleSave();
    };
}
function detailsMarkup(d) {
  const currency = d.country === "cz" ? "Kč" : "€";
  return `<form id="draftDetails" class="dialog-form create-form" novalidate><div class="workspace-heading"><h2>${L("Čo ponúkaš alebo hľadáš?", "Co nabízíš nebo hledáš?")}</h2></div><div class="form-row"><label for="draftType">${L("Typ inzerátu", "Typ inzerátu")}<select id="draftType"><option value="sell"${d.type === "sell" ? " selected" : ""}>${L("Predám", "Prodám")}</option><option value="buy"${d.type === "buy" ? " selected" : ""}>${L("Kúpim", "Koupím")}</option></select></label><label for="draftCategory">${L("Kategória", "Kategorie")} *<select id="draftCategory" required aria-describedby="draftCategoryError"><option value="">${L("Vyber kategóriu", "Vyber kategorii")}</option>${CATEGORIES.map((c) => `<option value="${esc(c[0])}"${c[0] === d.category ? " selected" : ""}>${esc(catName(c[0]))}</option>`).join("")}</select><small class="field-error" id="draftCategoryError"></small></label></div><label for="draftTitle">${L("Názov inzerátu", "Název inzerátu")} *</label><input id="draftTitle" required minlength="5" maxlength="140" value="${esc(d.title)}" placeholder="${L("Napr. mestský bicykel po servise", "Např. městské kolo po servisu")}" aria-describedby="draftTitleError"><p class="field-error" id="draftTitleError"></p><label for="draftDescription">${L("Popis", "Popis")} *</label><textarea id="draftDescription" required minlength="15" maxlength="10000" rows="7" placeholder="${L("Stav, rozmery, príslušenstvo a možnosti odovzdania…", "Stav, rozměry, příslušenství a možnosti předání…")}" aria-describedby="draftDescriptionError">${esc(d.description)}</textarea><p class="field-error" id="draftDescriptionError"></p><div class="form-row"><label for="draftCountry">${L("Krajina", "Země")}<select id="draftCountry"><option value="sk"${d.country === "sk" ? " selected" : ""}>${L("Slovensko (€)", "Slovensko (€)")}</option><option value="cz"${d.country === "cz" ? " selected" : ""}>${L("Česko (Kč)", "Česko (Kč)")}</option></select></label><label for="draftPrice">${d.type === "buy" ? L("Rozpočet do", "Rozpočet do") : L("Cena", "Cena")} (${currency}) *<input id="draftPrice" type="number" min="0" max="100000000" step="any" required inputmode="decimal" value="${d.price === null ? "" : d.price}" aria-describedby="draftPriceError"><small class="field-error" id="draftPriceError"></small></label></div><div class="form-row"><label for="draftCity">${L("Mesto alebo obec", "Město nebo obec")} *<input id="draftCity" required maxlength="100" value="${esc(d.city)}" list="draftCities" autocomplete="address-level2" aria-describedby="draftCityError"><datalist id="draftCities"></datalist><small class="field-error" id="draftCityError"></small></label><label for="draftState">${L("Stav predmetu", "Stav předmětu")}<select id="draftState"><option value="Používané"${d.state === "Používané" ? " selected" : ""}>${L("Používané", "Použité")}</option><option value="Nové"${d.state === "Nové" ? " selected" : ""}>${L("Nové", "Nové")}</option></select></label></div><label for="draftPhone">${L("Telefón (nepovinné)", "Telefon (nepovinné)")}<input id="draftPhone" type="tel" maxlength="30" autocomplete="tel" value="${esc(d.phone)}" aria-describedby="draftPhoneError"><small class="field-error" id="draftPhoneError"></small></label><div class="draft-contact"><span>✓ ${L("Kontaktný email", "Kontaktní email")}</span><strong>${esc(state.user.email)}</strong><p>${L("Email a voliteľný telefón zobrazíme iba prihláseným záujemcom.", "Email a volitelný telefon zobrazíme pouze přihlášeným zájemcům.")}</p></div><p class="field-hint">* ${L("Povinné údaje. Cena 0 znamená darovanie.", "Povinné údaje. Cena 0 znamená darování.")}</p></form>`;
}
function showDraftErrors(errors) {
  for (const key of ["category", "title", "description", "price", "city", "phone"]) {
    const id = key[0].toUpperCase() + key.slice(1);
    $("#draft" + id)?.setAttribute("aria-invalid", errors[key] ? "true" : "false");
    if ($("#draft" + id + "Error")) $("#draft" + id + "Error").textContent = errors[key] || "";
  }
  const firstKey = Object.keys(errors)[0];
  if (firstKey) $("#draft" + firstKey[0].toUpperCase() + firstKey.slice(1))?.focus();
}
function goStep(step) {
  if (draftBusy || draftConflict || createCompleted) return;
  collectDraft();
  const errors = validateDraft(createDraft);
  if (step > 1 && Object.keys(errors).length) {
    if (createStep !== 1) {
      createStep = 1;
      renderCreate();
    }
    showDraftErrors(errors);
    return;
  }
  if (step === 3 && createDraft.type === "sell" && !uploadPhotos.length) {
    if (createStep !== 2) {
      createStep = 2;
      renderCreate();
    }
    $("#createError").textContent = L("Pridaj aspoň jednu fotografiu predmetu.", "Přidej alespoň jednu fotografii předmětu.");
    $("#draftUpload").focus();
    return;
  }
  createStep = Math.min(3, Math.max(1, step));
  renderCreate();
  saveDraft();
  $("#createContent").scrollIntoView({ block: "start" });
  const h = $(".workspace-heading h2");
  if (h) {
    h.setAttribute("tabindex", "-1");
    h.focus();
  }
}
function photosMarkup() {
  return `<div class="workspace-heading"><h2>${L("Ukáž predmet zo všetkých strán.", "Ukaž předmět ze všech stran.")}</h2><span>${uploadPhotos.length} / 8</span></div><label class="upload-zone" for="draftUpload"><span aria-hidden="true">＋</span><strong>${L("Pridať fotografie", "Přidat fotografie")}</strong><small>JPG, PNG, WebP · ${L("najviac 8 fotografií", "nejvýše 8 fotografií")}</small><input id="draftUpload" type="file" multiple accept="image/jpeg,image/png,image/webp"${draftBusy || uploadPhotos.length >= 8 ? " disabled" : ""}></label><p class="field-hint">${createDraft.type === "buy" ? L("Pri dopyte sú fotografie nepovinné.", "U poptávky jsou fotografie nepovinné.") : L("Pri ponuke pridaj aspoň jednu fotografiu.", "U nabídky přidej alespoň jednu fotografii.")} ${L("Poradie meníš šípkami. Prvá fotka je titulná.", "Pořadí měníš šipkami. První fotka je titulní.")}</p><div id="uploadThumbnails" class="draft-photo-grid"></div><div id="editor" class="photo-editor" hidden><div class="photo-edit-title"><h3>${L("Základná úprava", "Základní úprava")}</h3><span id="photoPosition"></span></div><canvas id="photoCanvas"></canvas><div class="editor-actions"><button type="button" class="outline" id="rotate">${L("Otočiť", "Otočit")} ↻</button><button type="button" class="outline" id="square">${L("Štvorcový orez", "Čtvercový ořez")}</button><button type="button" class="outline" id="uncrop">${L("Pôvodný pomer", "Původní poměr")}</button></div><label for="brightness">${L("Jas", "Jas")}</label><input type="range" id="brightness" min="70" max="130" value="100"><button type="button" class="text-button" id="resetPhoto">${L("Obnoviť pôvodnú fotku", "Obnovit původní fotku")}</button></div>`;
}
function renderThumbs() {
  $("#uploadThumbnails").innerHTML = uploadPhotos
    .map(
      (p, i) =>
        `<article class="draft-photo ${i === selectedPhotoIndex ? "selected" : ""}"><button type="button" class="draft-photo-preview" data-photo-action="edit" data-photo-index="${i}" aria-label="${L("Upraviť fotografiu", "Upravit fotografii")} ${i + 1}" aria-pressed="${i === selectedPhotoIndex}"><img src="${esc(p.src)}" alt="${L("Fotografia", "Fotografie")} ${i + 1}"><span>${i === 0 ? L("Titulná", "Titulní") : i + 1}</span></button><div class="draft-photo-actions"><button type="button" data-photo-action="left" data-photo-index="${i}" aria-label="${L("Posunúť skôr", "Posunout dříve")}"${i === 0 ? " disabled" : ""}>←</button><button type="button" data-photo-action="cover" data-photo-index="${i}"${i === 0 ? " disabled" : ""}>${L("Titulná", "Titulní")}</button><button type="button" data-photo-action="right" data-photo-index="${i}" aria-label="${L("Posunúť ďalej", "Posunout dále")}"${i === uploadPhotos.length - 1 ? " disabled" : ""}>→</button><button type="button" data-photo-action="remove" data-photo-index="${i}" aria-label="${L("Odobrať fotografiu", "Odebrat fotografii")} ${i + 1}">×</button></div></article>`,
    )
    .join("");
  if ($("#photoPosition")) $("#photoPosition").textContent = selectedPhotoIndex + 1 + " / " + uploadPhotos.length;
  const count = $(".workspace-heading span");
  if (count) count.textContent = uploadPhotos.length + " / 8";
  if ($("#draftUpload")) $("#draftUpload").disabled = draftBusy || uploadPhotos.length >= 8;
}
function drawPhoto() {
  const p = uploadPhotos[selectedPhotoIndex];
  if (!p) return;
  const { image, editor } = p,
    c = $("#photoCanvas"),
    ctx = c.getContext("2d"),
    turn = editor.rotation % 180 !== 0;
  let w = turn ? image.height : image.width,
    h = turn ? image.width : image.height;
  const scale = Math.min(1600 / w, 1600 / h, 1);
  w = Math.round(w * scale);
  h = Math.round(h * scale);
  const side = Math.min(w, h);
  c.width = editor.crop === "square" ? side : w;
  c.height = editor.crop === "square" ? side : h;
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((editor.rotation * Math.PI) / 180);
  ctx.filter = `brightness(${editor.brightness}%)`;
  ctx.drawImage(image, (-image.width * scale) / 2, (-image.height * scale) / 2, image.width * scale, image.height * scale);
  ctx.restore();
  const untouched = editor.rotation === 0 && editor.brightness === 100 && editor.crop === "original";
  p.src = untouched ? p.original : c.toDataURL("image/jpeg", 0.84);
  renderThumbs();
  scheduleSave();
}
function selectPhoto(index) {
  selectedPhotoIndex = index;
  $("#editor").hidden = false;
  $("#brightness").value = uploadPhotos[index].editor.brightness;
  drawPhoto();
}
function movePhoto(index, to) {
  if (to < 0 || to >= uploadPhotos.length) return;
  const selected = uploadPhotos[selectedPhotoIndex],
    moved = uploadPhotos.splice(index, 1)[0];
  uploadPhotos.splice(to, 0, moved);
  selectedPhotoIndex = uploadPhotos.indexOf(selected);
  renderThumbs();
  saveDraft();
}
function removePhoto(index) {
  const selected = uploadPhotos[selectedPhotoIndex];
  uploadPhotos.splice(index, 1);
  if (uploadPhotos.length) selectPhoto(Math.max(0, uploadPhotos.indexOf(selected)));
  else {
    $("#editor").hidden = true;
    renderThumbs();
  }
  saveDraft();
}
function wirePhotos() {
  renderThumbs();
  if (uploadPhotos.length) selectPhoto(Math.min(selectedPhotoIndex, uploadPhotos.length - 1));
  $("#draftUpload").onchange = importPhotos;
  $("#uploadThumbnails").onclick = (e) => {
    const b = e.target.closest("[data-photo-action]");
    if (!b || draftBusy) return;
    const i = Number(b.dataset.photoIndex),
      action = b.dataset.photoAction;
    if (action === "edit") selectPhoto(i);
    if (action === "left") movePhoto(i, i - 1);
    if (action === "right") movePhoto(i, i + 1);
    if (action === "cover") movePhoto(i, 0);
    if (action === "remove") removePhoto(i);
  };
  const editor = () => uploadPhotos[selectedPhotoIndex].editor;
  $("#rotate").onclick = () => {
    editor().rotation = (editor().rotation + 90) % 360;
    drawPhoto();
  };
  $("#square").onclick = () => {
    editor().crop = "square";
    drawPhoto();
  };
  $("#uncrop").onclick = () => {
    editor().crop = "original";
    drawPhoto();
  };
  $("#brightness").oninput = (e) => {
    editor().brightness = Number(e.target.value);
    drawPhoto();
  };
  $("#resetPhoto").onclick = () => {
    Object.assign(editor(), { rotation: 0, brightness: 100, crop: "original" });
    $("#brightness").value = 100;
    drawPhoto();
  };
}
async function importPhotos(e) {
  const files = [...e.target.files];
  e.target.value = "";
  if (files.length > 8 - uploadPhotos.length) {
    $("#createError").textContent = L("Môžeš pridať najviac 8 fotografií.", "Můžeš přidat nejvýše 8 fotografií.");
    return;
  }
  draftBusy = true;
  $("#nextStep").disabled = true;
  $("#createError").textContent = "";
  setDraftStatus(L("Spracúvam fotografie…", "Zpracovávám fotografie…"));
  try {
    for (const file of files) {
      const blob = await preparePhoto(file),
        original = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.readAsDataURL(blob);
        });
      uploadPhotos.push({ original, image: await loadImage(original), src: original, editor: { rotation: 0, brightness: 100, crop: "original" } });
      selectedPhotoIndex = uploadPhotos.length - 1;
    }
  } catch (error) {
    $("#createError").textContent = error.message;
  } finally {
    draftBusy = false;
    $("#nextStep").disabled = draftConflict;
    if (uploadPhotos.length) selectPhoto(selectedPhotoIndex);
    else renderThumbs();
    saveDraft();
  }
}
function previewMarkup(d) {
  const item = { price: d.price, country: d.country, buy: d.type === "buy" };
  return `<div class="workspace-heading"><h2>${L("Takto bude vyzerať tvoj inzerát.", "Takto bude vypadat tvůj inzerát.")}</h2></div><div class="draft-preview">${uploadPhotos.length ? `<img class="draft-cover" src="${esc(uploadPhotos[0].src)}" alt="${esc(d.title)}"><div class="draft-preview-thumbs">${uploadPhotos.map((p, i) => `<img src="${esc(p.src)}" alt="${L("Fotografia", "Fotografie")} ${i + 1}">`).join("")}</div>` : `<div class="draft-no-photo">${L("Dopyt bez fotografie", "Poptávka bez fotografie")}</div>`}<span class="small-kicker">${d.type === "buy" ? L("KÚPIM", "KOUPÍM") : L("PREDÁM", "PRODÁM")} · ${esc(catName(d.category))}</span><h3>${esc(d.title)}</h3><div class="detail-price">${price(item)}</div><p class="preview-facts">${esc(d.city)} · ${esc(conditionName(d.state))}</p><p class="draft-description">${esc(d.description)}</p><div class="draft-contact"><span>${L("Kontakty pre prihlásených záujemcov", "Kontakty pro přihlášené zájemce")}</span><strong>${esc(state.user.email)}</strong>${d.phone.trim() ? `<strong>${esc(d.phone)}</strong>` : ""}<p>${L("Inzerent", "Inzerent")}: ${esc(state.user.name)}</p></div></div><label class="checkbox-row preview-boost"><input id="previewBoost" type="checkbox"${d.boost ? " checked" : ""}><span><strong>↑ ${L("Zvýrazniť inzerát (Boost)", "Zvýraznit inzerát (Boost)")}</strong><small>${L("Bezplatne na 7 dní: vyššie vo výsledkoch a vo výbere na úvode.", "Zdarma na 7 dní: výše ve výsledcích a ve výběru na úvodu.")}</small></span></label><p class="field-hint">${L("Zverejnením potvrdzuješ, že inzerát zodpovedá", "Zveřejněním potvrzuješ, že inzerát odpovídá")} <a href="/pravidla-inzercie/" target="_blank" rel="noopener">${L("pravidlám inzercie", "pravidlům inzerce")}</a>.</p>`;
}
async function publishDraft() {
  if (draftBusy || draftConflict || createCompleted) return;
  const errors = validateDraft(createDraft);
  if (Object.keys(errors).length) return goStep(1);
  if (createDraft.type === "sell" && !uploadPhotos.length) return goStep(3);
  await operation(
    $("#nextStep"),
    async () => {
      draftBusy = true;
      try {
        const ids = [];
        for (const [i, p] of uploadPhotos.entries()) {
          setDraftStatus(L(`Nahrávam fotografiu ${i + 1} z ${uploadPhotos.length}…`, `Nahrávám fotografii ${i + 1} z ${uploadPhotos.length}…`));
          if (!uploadedDraft.has(p.src)) {
            const blob = await (await fetch(p.src)).blob();
            uploadedDraft.set(p.src, (await api("uploads", "POST", new Blob([blob], { type: "image/jpeg" }))).id);
          }
          ids.push(uploadedDraft.get(p.src));
        }
        setDraftStatus(L("Zverejňujem…", "Zveřejňuji…"));
        const d = createDraft,
          r = await api("listings", "POST", {
            submission: String(d.id),
            title: d.title,
            desc: d.description,
            cat: d.category,
            price: d.price,
            city: d.city,
            state: d.state,
            phone: d.phone,
            buy: d.type === "buy",
            country: d.country,
            uploadIds: ids,
          });
        if (d.boost) await api("listings/" + r.id + "/boost", "POST", { days: 7 }).catch(() => {});
        createCompleted = true;
        clearTimeout(draftTimer);
        try {
          localStorage.removeItem(draftKey());
        } catch {}
        $("#createContent").innerHTML =
          `<div class="create-success"><span class="success-mark" aria-hidden="true">✓</span><span class="small-kicker">${L("HOTOVO", "HOTOVO")}</span><h1 tabindex="-1">${L("Inzerát je zverejnený.", "Inzerát je zveřejněný.")}</h1><p>${esc(d.title)}</p><div><a class="primary" href="/inzerat/?id=${r.id}">${L("Otvoriť inzerát", "Otevřít inzerát")} ↗</a> <a class="outline" href="/ucet/">${L("Moje inzeráty", "Moje inzeráty")}</a></div><a class="text-button" href="/pridat/">＋ ${L("Pridať ďalší", "Přidat další")}</a></div>`;
        $(".create-success h1").focus();
      } finally {
        draftBusy = false;
        if (!createCompleted) setDraftStatus("");
      }
    },
    $("#createError"),
  );
}
async function confirmClearDraft() {
  if (draftBusy) return;
  const ok = await confirmDialog({
    title: L("Zahodiť rozpracovaný inzerát?", "Zahodit rozpracovaný inzerát?"),
    text: L("Údaje a fotografie sa odstránia z tohto prehliadača.", "Údaje a fotografie se odstraní z tohoto prohlížeče."),
    confirm: L("Zahodiť", "Zahodit"),
    danger: true,
  });
  if (!ok) return;
  clearTimeout(draftTimer);
  try {
    localStorage.removeItem(draftKey());
  } catch {}
  createDraft = blankDraft();
  uploadPhotos = [];
  createStep = 1;
  draftSaved = false;
  draftConflict = false;
  renderCreate();
}
window.pageInit = async function () {
  const host = $("#createContent");
  if (!state.user || !state.user.verified) {
    host.innerHTML = `<div class="account-guest"><span class="small-kicker">${L("PRIDANIE ZADARMO", "PŘIDÁNÍ ZDARMA")}</span><h1>${L("Daj veciam<br>ďalší príbeh.", "Dej věcem<br>další příběh.")}</h1><p>${state.user ? L("Najprv potvrď svoj email cez odkaz, ktorý sme ti poslali.", "Nejprve potvrď svůj email přes odkaz, který jsme ti poslali.") : L("Na pridanie potrebuješ účet s overeným emailom. Potom stačia údaje, fotografie a posledná kontrola.", "Pro přidání potřebuješ účet s ověřeným emailem. Potom stačí údaje, fotografie a poslední kontrola.")}</p><button type="button" class="primary" id="createSignIn">${state.user ? L("Poslať overovací email", "Poslat ověřovací email") : L("Prihlásiť sa a pokračovať", "Přihlásit se a pokračovat")} ↗</button>${state.user ? "" : `<a class="outline" href="/registracia/">${L("Vytvoriť účet", "Vytvořit účet")}</a>`}</div>`;
    $("#createSignIn").onclick = () => requireAccount(() => location.reload());
    return;
  }
  const restored = await restoreDraft();
  renderCreate();
  if (restored) setDraftStatus(L("Rozpracovaný inzerát obnovený. Pokračuj, kde si skončil.", "Rozpracovaný inzerát obnoven. Pokračuj, kde jsi skončil."));
  addEventListener("pagehide", saveDraft);
  addEventListener("storage", (e) => {
    if (e.key === draftKey() && !createCompleted) {
      draftConflict = true;
      clearTimeout(draftTimer);
      collectDraft();
      renderCreate();
    }
  });
};
