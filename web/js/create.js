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
    version: 3,
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    type: "sell",
    category: "",
    sub: "",
    title: "",
    description: "",
    priceType: "fixed",
    price: null,
    zip: "",
    city: "",
    state: "Používané",
    phone: state.user.phone || "",
    boost: false,
    step: 1,
  };
}
function validateDraft(d) {
  const errors = {};
  if (!category(d.category)) errors.category = "Vyber kategóriu.";
  else if (!subcategory(d.category, d.sub)) errors.sub = "Vyber podkategóriu.";
  if (d.title.trim().length < 5) errors.title = "Napíš názov aspoň na 5 znakov.";
  if (d.description.trim().length < 15) errors.description = "Popis musí mať aspoň 15 znakov.";
  if (d.priceType === "fixed" && (d.price === null || !Number.isFinite(d.price) || d.price <= 0 || d.price > 100000000))
    errors.price = "Zadaj cenu alebo vyber Zadarmo, Dohodou či V texte.";
  if (!/^\d{5}$/.test(d.zip.replace(/\s/g, ""))) errors.zip = "Zadaj PSČ (5 číslic).";
  if (d.city.trim().length < 2) errors.city = "Doplň obec.";
  if (d.phone.trim() && !/^[+\d ()-]{5,30}$/.test(d.phone.trim()))
    errors.phone = "Telefón môže obsahovať číslice, medzery a znaky + ( ) -.";
  return errors;
}
function collectDraft() {
  if (!createDraft || createStep !== 1 || !$("#draftTitle")) return;
  for (const [key, id] of [
    ["category", "draftCategory"],
    ["sub", "draftSub"],
    ["title", "draftTitle"],
    ["description", "draftDescription"],
    ["zip", "draftZip"],
    ["city", "draftCity"],
    ["state", "draftState"],
    ["phone", "draftPhone"],
  ])
    createDraft[key] = $("#" + id).value;
  createDraft.type = $('input[name="draftType"]:checked')?.value || "sell";
  createDraft.priceType = $('input[name="priceType"]:checked')?.value || "fixed";
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
        photos: uploadPhotos.map((p) => ({
          original: p.original,
          src: p.src === p.original ? "" : p.src,
          editor: { ...p.editor },
        })),
      }),
    );
    draftSaved = true;
    setDraftStatus("Rozpracované uložené v tomto prehliadači.");
    return true;
  } catch {
    draftSaved = false;
    setDraftStatus("Rozpracované sa neuložilo — úložisko prehliadača je plné. Pokračuj bez zatvorenia stránky.");
    return false;
  }
}
function scheduleSave() {
  if (draftBusy || createCompleted) return;
  clearTimeout(draftTimer);
  setDraftStatus("Ukladám rozpracované…");
  draftTimer = setTimeout(saveDraft, 400);
}
const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(Error("Fotografiu sa nepodarilo načítať."));
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
      saved?.version === 3 &&
      Date.now() - saved.savedAt < 7 * 86400000 &&
      ["title", "description", "city", "zip", "phone"].every((k) => typeof saved[k] === "string") &&
      Array.isArray(saved.photos) &&
      saved.photos.length <= 8
    ) {
      createDraft = { ...createDraft, ...saved };
      for (const p of saved.photos) {
        if (!/^data:image\/jpeg;base64,/.test(p.original) || (p.src && !/^data:image\/jpeg;base64,/.test(p.src)))
          continue;
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
  host.innerHTML = `<div class="create-top"><a href="/ucet/" class="text-button">← Môj účet</a><span class="free-label">Pridanie je zadarmo</span></div><div class="create-heading"><span class="small-kicker">NOVÝ INZERÁT</span><h1>Dobrá ponuka.<br>Začína dobrým inzerátom.</h1><p>Pár údajov. Dobré fotografie. Posledný pohľad pred zverejnením.</p></div><nav class="create-steps" aria-label="Kroky pridania">${stepLink(1, "Údaje")}${stepLink(2, "Fotografie")}${stepLink(3, "Náhľad")}</nav><div class="create-layout"><section class="create-workspace"><div id="draftConflict" class="notice"${draftConflict ? "" : " hidden"}>Rozpracovaný inzerát sa zmenil v inej karte. Obnov stránku, aby si neprepísal novšie zmeny. <button type="button" id="reloadDraft" class="text-button">Obnoviť ↻</button></div>${createStep === 1 ? detailsMarkup(d) : createStep === 2 ? photosMarkup() : previewMarkup(d)}<p id="createError" class="form-error" role="alert"></p><div class="create-bottom"><div><p id="draftStatus" role="status">${draftSaved ? "Rozpracované uložené v tomto prehliadači." : "Rozpracované sa uloží po tvojej úprave."}</p><button type="button" id="clearDraft" class="text-button delete-action">Zahodiť rozpracované</button></div><div class="create-navigation">${createStep > 1 ? `<button type="button" class="outline" id="previousStep">← Späť</button>` : ""}<button type="button" class="primary" id="nextStep"${draftBusy || draftConflict ? " disabled" : ""}>${createStep === 3 ? "Zverejniť inzerát" : "Pokračovať"} ↗</button></div></div></section><aside class="create-help"><span class="help-symbol" aria-hidden="true">↗</span><h2>${createStep === 1 ? "Jasne a konkrétne." : createStep === 2 ? "Nech hovoria fotky." : "Posledný pohľad."}</h2><p>${createStep === 1 ? "Uveď stav, prípadné chyby a možnosti odovzdania. Dobré údaje ušetria zbytočné otázky." : createStep === 2 ? "Pridaj celok, detail aj prípadné poškodenie. Prvá fotografia bude titulná. Použi vlastné fotky bez citlivých údajov." : "Skontroluj názov, cenu aj kontakty. Dohodu riešiš priamo so záujemcom."}</p><div class="create-help-note">Rozpracovaný inzerát sa ukladá v tomto prehliadači najviac 7 dní. Po zverejnení sa uloží na server.</div><a href="/pravidla-inzercie/" target="_blank" rel="noopener">Pravidlá inzercie ↗</a></aside></div>`;
  $("#nextStep").onclick = () => (createStep === 3 ? publishDraft() : goStep(createStep + 1));
  if ($("#previousStep")) $("#previousStep").onclick = () => goStep(createStep - 1);
  $("#clearDraft").onclick = confirmClearDraft;
  $("#reloadDraft").onclick = () => location.reload();
  host.onclick = (e) => {
    const b = e.target.closest("[data-create-step]");
    if (b) goStep(Number(b.dataset.createStep));
  };
  if (createStep === 1) {
    $("#draftDetails").oninput = (e) => {
      if (e.target.id === "draftZip" || e.target.id === "draftCity") checkPlace();
      scheduleSave();
    };
    $("#draftDetails").onchange = (e) => {
      collectDraft();
      if (e.target.id === "draftCategory") createDraft.sub = "";
      if (["draftCategory"].includes(e.target.id) || ["draftType", "priceType"].includes(e.target.name)) {
        const focus = e.target.id ? "#" + e.target.id : `input[name="${e.target.name}"]:checked`;
        renderCreate();
        $(focus)?.focus();
      }
      scheduleSave();
    };
    checkPlace();
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
  const cat = category(d.category),
    radio = (name, value, label, current) =>
      `<label><input type="radio" name="${name}" value="${value}"${current === value ? " checked" : ""}><span>${label}</span></label>`;
  return `<form id="draftDetails" class="dialog-form create-form" novalidate><div class="workspace-heading"><h2>Čo ponúkaš alebo hľadáš?</h2></div>
<div class="segmented" role="radiogroup" aria-label="Typ inzerátu">${radio("draftType", "sell", "Predám", d.type)}${radio("draftType", "buy", "Kúpim", d.type)}</div>
<div class="form-row"><label for="draftCategory">Kategória *<select id="draftCategory" required aria-describedby="draftCategoryError"><option value="">Vyber kategóriu</option>${CATALOG.map((c) => `<option value="${c.slug}"${c.slug === d.category ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select><small class="field-error" id="draftCategoryError"></small></label><label for="draftSub">Podkategória *<select id="draftSub" required aria-describedby="draftSubError"${cat ? "" : " disabled"}><option value="">${cat ? "Vyber podkategóriu" : "Najprv vyber kategóriu"}</option>${(cat?.subs || []).map((x) => `<option value="${x.slug}"${x.slug === d.sub ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select><small class="field-error" id="draftSubError"></small></label></div>
<label for="draftTitle">Názov inzerátu *<input id="draftTitle" required minlength="5" maxlength="140" value="${esc(d.title)}" placeholder="Napr. Horský bicykel Trek, veľkosť M" aria-describedby="draftTitleError"></label><p class="field-error" id="draftTitleError"></p>
<label for="draftDescription">Popis *<textarea id="draftDescription" required minlength="15" maxlength="10000" rows="7" placeholder="Stav, rozmery, príslušenstvo, prípadné chyby a možnosti odovzdania…" aria-describedby="draftDescriptionError">${esc(d.description)}</textarea></label><p class="field-error" id="draftDescriptionError"></p>
<fieldset class="price-choice" style="border:0;padding:0;margin:0"><legend style="font-weight:600;font-size:13.5px;margin-bottom:8px">${d.type === "buy" ? "Rozpočet" : "Cena"} *</legend><div class="segmented" role="radiogroup" aria-label="Typ ceny">${radio("priceType", "fixed", d.type === "buy" ? "Do sumy" : "Pevná cena", d.priceType)}${radio("priceType", "free", "Zadarmo", d.priceType)}${radio("priceType", "negotiable", "Dohodou", d.priceType)}${radio("priceType", "text", "V texte", d.priceType)}</div><label for="draftPrice"${d.priceType === "fixed" ? "" : " hidden"}><span class="sr">Suma v eurách</span><input id="draftPrice" type="number" min="0" max="100000000" step="any" inputmode="decimal" placeholder="Suma v €" value="${d.price === null ? "" : d.price}" aria-describedby="draftPriceError"></label><small class="field-error" id="draftPriceError"></small></fieldset>
<div class="form-row"><label for="draftZip">PSČ *<input id="draftZip" required inputmode="numeric" maxlength="6" placeholder="Napr. 811 01" value="${esc(d.zip)}" autocomplete="postal-code" aria-describedby="draftZipError draftPlace"><small class="field-error" id="draftZipError"></small><span class="place-hint" id="draftPlace"></span></label><label for="draftCity">Obec *<input id="draftCity" required maxlength="100" value="${esc(d.city)}" list="placeList" autocomplete="address-level2" aria-describedby="draftCityError"><small class="field-error" id="draftCityError"></small></label></div>
<div class="form-row"><label for="draftState">Stav<select id="draftState"><option value="Používané"${d.state === "Používané" ? " selected" : ""}>Používané</option><option value="Nové"${d.state === "Nové" ? " selected" : ""}>Nové</option></select></label><label for="draftPhone">Telefón (nepovinné)<input id="draftPhone" type="tel" maxlength="30" autocomplete="tel" value="${esc(d.phone)}" aria-describedby="draftPhoneError"><small class="field-error" id="draftPhoneError"></small></label></div>
<div class="draft-contact"><span>Kontaktný email</span><strong>${esc(state.user.email)}</strong><p>Email a telefón uvidia iba prihlásení záujemcovia.</p></div><p class="field-hint">* povinné údaje · inzerát bude zverejnený ${state.config.listingDays || 60} dní</p></form>`;
}
let placeTimer = null;
function checkPlace() {
  const zip = ($("#draftZip")?.value || "").replace(/\s/g, ""),
    hint = $("#draftPlace");
  if (!hint) return;
  clearTimeout(placeTimer);
  if (!/^\d{5}$/.test(zip)) {
    hint.textContent = "";
    return;
  }
  placeTimer = setTimeout(async () => {
    try {
      const r = await api(`places?zip=${zip}&city=${encodeURIComponent($("#draftCity").value)}`);
      hint.className = "place-hint";
      hint.innerHTML = `${icon("pin")}${r.exact ? esc(r.area) : "okolie " + esc(r.area)}`;
      if (!$("#draftCity").value.trim() && r.exact) {
        $("#draftCity").value = r.area;
        collectDraft();
        scheduleSave();
      }
    } catch {
      hint.className = "place-hint warn";
      hint.textContent = "Toto PSČ nepoznáme, skontroluj ho.";
    }
  }, 300);
}
function showDraftErrors(errors) {
  for (const key of ["category", "sub", "title", "description", "price", "zip", "city", "phone"]) {
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
    $("#createError").textContent = "Pridaj aspoň jednu fotografiu predmetu.";
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
  return `<div class="workspace-heading"><h2>Ukáž predmet zo všetkých strán.</h2><span>${uploadPhotos.length} / 8</span></div><label class="upload-zone" for="draftUpload"><span aria-hidden="true">＋</span><strong>Pridať fotografie</strong><small>JPG, PNG, WebP · najviac 8 fotografií</small><input id="draftUpload" type="file" multiple accept="image/jpeg,image/png,image/webp"${draftBusy || uploadPhotos.length >= 8 ? " disabled" : ""}></label><p class="field-hint">${createDraft.type === "buy" ? "Pri dopyte sú fotografie nepovinné." : "Pri ponuke pridaj aspoň jednu fotografiu."} Poradie meníš šípkami. Prvá fotka je titulná.</p><div id="uploadThumbnails" class="draft-photo-grid"></div><div id="editor" class="photo-editor" hidden><div class="photo-edit-title"><h3>Základná úprava</h3><span id="photoPosition"></span></div><canvas id="photoCanvas"></canvas><div class="editor-actions"><button type="button" class="outline" id="rotate">Otočiť ↻</button><button type="button" class="outline" id="square">Štvorcový orez</button><button type="button" class="outline" id="uncrop">Pôvodný pomer</button></div><label for="brightness">Jas</label><input type="range" id="brightness" min="70" max="130" value="100"><button type="button" class="text-button" id="resetPhoto">Obnoviť pôvodnú fotku</button></div>`;
}
function renderThumbs() {
  $("#uploadThumbnails").innerHTML = uploadPhotos
    .map(
      (p, i) =>
        `<article class="draft-photo ${i === selectedPhotoIndex ? "selected" : ""}"><button type="button" class="draft-photo-preview" data-photo-action="edit" data-photo-index="${i}" aria-label="Upraviť fotografiu ${i + 1}" aria-pressed="${i === selectedPhotoIndex}"><img src="${esc(p.src)}" alt="Fotografia ${i + 1}"><span>${i === 0 ? "Titulná" : i + 1}</span></button><div class="draft-photo-actions"><button type="button" data-photo-action="left" data-photo-index="${i}" aria-label="Posunúť skôr"${i === 0 ? " disabled" : ""}>←</button><button type="button" data-photo-action="cover" data-photo-index="${i}"${i === 0 ? " disabled" : ""}>Titulná</button><button type="button" data-photo-action="right" data-photo-index="${i}" aria-label="Posunúť ďalej"${i === uploadPhotos.length - 1 ? " disabled" : ""}>→</button><button type="button" data-photo-action="remove" data-photo-index="${i}" aria-label="Odobrať fotografiu ${i + 1}">×</button></div></article>`,
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
  ctx.drawImage(
    image,
    (-image.width * scale) / 2,
    (-image.height * scale) / 2,
    image.width * scale,
    image.height * scale,
  );
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
    $("#createError").textContent = "Môžeš pridať najviac 8 fotografií.";
    return;
  }
  draftBusy = true;
  $("#nextStep").disabled = true;
  $("#createError").textContent = "";
  setDraftStatus("Spracúvam fotografie…");
  try {
    for (const file of files) {
      const blob = await preparePhoto(file),
        original = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.readAsDataURL(blob);
        });
      uploadPhotos.push({
        original,
        image: await loadImage(original),
        src: original,
        editor: { rotation: 0, brightness: 100, crop: "original" },
      });
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
  const item = { price: d.price, priceType: d.priceType, buy: d.type === "buy" };
  return `<div class="workspace-heading"><h2>Takto bude vyzerať tvoj inzerát.</h2></div><div class="draft-preview">${uploadPhotos.length ? `<img class="draft-cover" src="${esc(uploadPhotos[0].src)}" alt="${esc(d.title)}"><div class="draft-preview-thumbs">${uploadPhotos.map((p, i) => `<img src="${esc(p.src)}" alt="Fotografia ${i + 1}">`).join("")}</div>` : `<div class="draft-no-photo">Dopyt bez fotografie</div>`}<span class="kicker">${d.type === "buy" ? "Kúpim" : "Predám"} · ${esc(catName(d.category))} › ${esc(subcategory(d.category, d.sub)?.name || "")}</span><h3>${esc(d.title)}</h3><div>${priceTag(item, "tag-lg")}</div><p class="preview-facts">${esc(d.city)}, ${formatZip(d.zip.replace(/\s/g, ""))} · ${esc(conditionName(d.state))}</p><p class="draft-description">${esc(d.description)}</p><div class="draft-contact"><span>Kontakty pre prihlásených záujemcov</span><strong>${esc(state.user.email)}</strong>${d.phone.trim() ? `<strong>${esc(d.phone)}</strong>` : ""}<p>Inzerent: ${esc(state.user.name)}</p></div></div><label class="checkbox-row preview-boost"><input id="previewBoost" type="checkbox"${d.boost ? " checked" : ""}><span><strong>↑ Zvýrazniť inzerát (Boost)</strong><small>Bezplatne na 7 dní: vyššie vo výsledkoch a vo výbere na úvode.</small></span></label><p class="field-hint">Zverejnením potvrdzuješ, že inzerát zodpovedá <a href="/pravidla-inzercie/" target="_blank" rel="noopener">pravidlám inzercie</a>.</p>`;
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
          setDraftStatus(`Nahrávam fotografiu ${i + 1} z ${uploadPhotos.length}…`);
          if (!uploadedDraft.has(p.src)) {
            const blob = await (await fetch(p.src)).blob();
            uploadedDraft.set(p.src, await uploadPhoto(blob));
          }
          ids.push(uploadedDraft.get(p.src));
        }
        setDraftStatus("Zverejňujem…");
        const d = createDraft,
          r = await api("listings", "POST", {
            submission: String(d.id),
            title: d.title,
            desc: d.description,
            cat: d.category,
            sub: d.sub,
            priceType: d.priceType,
            price: d.priceType === "fixed" ? d.price : 0,
            zip: d.zip,
            city: d.city,
            state: d.state,
            phone: d.phone,
            buy: d.type === "buy",
            uploadIds: ids,
          });
        if (d.boost) await api("listings/" + r.id + "/boost", "POST", { days: 7 }).catch(() => {});
        createCompleted = true;
        clearTimeout(draftTimer);
        try {
          localStorage.removeItem(draftKey());
        } catch {}
        $("#createContent").innerHTML =
          `<div class="create-success"><span class="success-mark" aria-hidden="true">✓</span><span class="small-kicker">HOTOVO</span><h1 tabindex="-1">Inzerát je zverejnený.</h1><p>${esc(d.title)}</p><div><a class="primary" href="/inzerat/?id=${r.id}">Otvoriť inzerát ↗</a> <a class="outline" href="/ucet/">Moje inzeráty</a></div><a class="text-button" href="/pridat/">＋ Pridať ďalší</a></div>`;
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
    title: "Zahodiť rozpracovaný inzerát?",
    text: "Údaje a fotografie sa odstránia z tohto prehliadača.",
    confirm: "Zahodiť",
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
    host.innerHTML = `<div class="account-guest"><span class="small-kicker">PRIDANIE ZADARMO</span><h1>Daj veciam<br>ďalší príbeh.</h1><p>${state.user ? "Najprv potvrď svoj email cez odkaz, ktorý sme ti poslali." : "Na pridanie potrebuješ účet s overeným emailom. Potom stačia údaje, fotografie a posledná kontrola."}</p><button type="button" class="primary" id="createSignIn">${state.user ? "Poslať overovací email" : "Prihlásiť sa a pokračovať"} ↗</button>${state.user ? "" : `<a class="outline" href="/registracia/">Vytvoriť účet</a>`}</div>`;
    $("#createSignIn").onclick = () => requireAccount(() => location.reload());
    return;
  }
  const restored = await restoreDraft();
  renderCreate();
  if (restored) setDraftStatus("Rozpracovaný inzerát obnovený. Pokračuj, kde si skončil.");
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
