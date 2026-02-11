// wwwroot/js/receteGruplariClient.js
(function (window, $) {
    "use strict";

    // ======================================================
    // ✅ RECETE GRUPLARI CLIENT
    // - UI + AJAX + Events + Init
    // - Birden fazla view'de çalışsın diye "config" ile selector/endpoint override edilebilir
    // - ✅ ADD + ✅ REMOVE (bulk) + her iki modalda ✅ arama + ✅ select all / clear
    // - ✅ REMOVE tarafında: hem eski id setini hem senin view id setini otomatik yakalar
    // ======================================================

    const DEFAULTS = {
        endpoints: {
            myGroups: "/ReceteGruplari/My",
            createGroup: "/ReceteGruplari/Create",
            members: "/ReceteGruplari/Members",
            addMember: "/ReceteGruplari/AddMember",
            addMembers: "/ReceteGruplari/AddMembers",
            removeMember: "/ReceteGruplari/RemoveMember",
            removeMembers: "/ReceteGruplari/RemoveMembers", // ✅ endpoint
            myPatients: "/ReceteGruplari/MyPatients",
            findGroupForTc: "/ReceteGruplari/FindGroupForTc",


            // ✅ Grup sil (soft delete)
            deleteGroup: "/ReceteGruplari/DeleteGroup",

            // ✅ ReviewRecept için üyelik kontrolü (kullanım kaldırıldı; ama DEFAULTS içinde durabilir)
            membership: "/ReceteGruplari/Membership"
        },
        selectors: {
            grupSelect: "#grupSelect",
            btnGrupEkle: "#btnGrupEkle",

            // ✅ Grup sil butonu (select sağındaki çarpı)
            btnGrupSil: "#btnGrupSil",

            uyeSelect: "#uyeSelect",
            btnGrubaUyeEkle: "#btnGrubaUyeEkle",

            tcInput: "#tcInput",
            personelSelect: "#personelSelect",

            // Grup ekle modal
            grupEkleModal: "grupEkleModal",
            confirmGrupEkleBtn: "#confirmGrupEkleBtn",
            grupAdiInput: "#grupAdiInput",
            grupAdiValidation: "#grupAdiValidation",

            // Üye ekle modal (ADD)
            grubaUyeEkleModal: "grubaUyeEkleModal",
            confirmGrubaUyeEkleBtn: "#confirmGrubaUyeEkleBtn",
            seciliGrupAdiInput: "#seciliGrupAdiInput",
            seciliGrupValidationModal: "#seciliGrupValidationModal",
            uyeSelectModal: "#uyeSelectModal",
            uyeSelectModalValidation: "#uyeSelectModalValidation",
            grubaUyeEkleStatus: "#grubaUyeEkleStatus",

            // ADD modal checkbox list + search
            uyeCheckboxList: "#uyeCheckboxList",
            uyeSearchInput: "#uyeSearchInput",
            uyeSelectedCountText: "#uyeSelectedCountText",
            selectAllBtn: "#uye-modal-select-all",
            deselectAllBtn: "#uye-modal-deselect-all",

            // ✅ Üye çıkar modal (REMOVE)  (eski default isimler)
            gruptanUyeCikarModal: "gruptanUyeCikarModal",
            confirmGruptanUyeCikarBtn: "#confirmGruptanUyeCikarBtn",
            seciliGrupAdiRemoveInput: "#seciliGrupAdiRemoveInput",
            seciliGrupRemoveValidation: "#seciliGrupRemoveValidation",
            uyeRemoveSelectModal: "#uyeRemoveSelectModal",
            uyeRemoveSelectModalValidation: "#uyeRemoveSelectModalValidation",
            gruptanUyeCikarStatus: "#gruptanUyeCikarStatus",

            // REMOVE modal checkbox list + search (eski default isimler)
            uyeRemoveCheckboxList: "#uyeRemoveCheckboxList",
            uyeRemoveSearchInput: "#uyeRemoveSearchInput",
            uyeRemoveSelectedCountText: "#uyeRemoveSelectedCountText",
            removeSelectAllBtn: "#uye-remove-modal-select-all",
            removeDeselectAllBtn: "#uye-remove-modal-deselect-all"
        },

        hooks: {
            updateButtons: () => { if (typeof window.updateButtons === "function") window.updateButtons(); }
        }
    };

    // ---- module config
    let cfg = null;

    // ---- state
    let grupCache = [];
    let doktorHastaCache = [];      // { tc, adSoyad, text }
    let doktorHastaMap = new Map(); // tc -> "Ad Soyad (TC)"
    let seciliGrupUyeSet = new Set(); // group members (aktif)

    // remove modal state
    let removeUyeSet = new Set(); // same as seciliGrupUyeSet snapshot for remove modal

    let inited = false;

    // modal buttons bind flags
    let addModalButtonsBound = false;
    let removeModalButtonsBound = false;

    // ---- selector helper
    function S(name) { return cfg.selectors[name] || name; }

    function antiforgeryToken() {
        return $('input[name="__RequestVerificationToken"]').val();
    }

    function hasEl(selector) {
        try { return $(selector).length > 0; } catch (e) { return false; }
    }

    function pickSelector(primary, fallbacks) {
        if (primary && hasEl(primary)) return primary;
        for (const f of (fallbacks || [])) {
            if (f && hasEl(f)) return f;
        }
        return primary;
    }

    function hasId(id) {
        try { return !!document.getElementById(id); } catch (e) { return false; }
    }

    function pickModalId(primaryId, fallbackIds) {
        if (primaryId && hasId(primaryId)) return primaryId;
        for (const id of (fallbackIds || [])) {
            if (id && hasId(id)) return id;
        }
        return primaryId;
    }

    // ✅ SELECT PLACEHOLDER: view'deki ilk option text'ini kullan (hardcoded yok)
    function getSelectPlaceholder(selectSelector, fallbackText) {
        try {
            const $sel = $(selectSelector);
            if (!$sel.length) return fallbackText;
            const txt = ($sel.find("option:first").text() || "").trim();
            return txt || fallbackText;
        } catch (e) {
            return fallbackText;
        }
    }

    // ✅ REMOVE tarafında view-id'lerini otomatik yakala (senin view: grupUyeleriCikarModal vs)
    function resolveRemoveSelectorsOnce() {
        // modal id resolve
        const resolvedModalId = pickModalId(cfg.selectors.gruptanUyeCikarModal, [
            "grupUyeleriCikarModal" // ✅ senin view
        ]);
        cfg.selectors.gruptanUyeCikarModal = resolvedModalId;

        // input/validation/select/list/search/button resolve
        cfg.selectors.confirmGruptanUyeCikarBtn = pickSelector(cfg.selectors.confirmGruptanUyeCikarBtn, [
            "#confirmGrupUyeleriCikarBtn" // ✅ senin view
        ]);

        cfg.selectors.seciliGrupAdiRemoveInput = pickSelector(cfg.selectors.seciliGrupAdiRemoveInput, [
            "#seciliGrupAdiUyelerCikarInput" // ✅ senin view
        ]);

        cfg.selectors.seciliGrupRemoveValidation = pickSelector(cfg.selectors.seciliGrupRemoveValidation, [
            "#seciliGrupUyelerCikarValidation" // ✅ senin view
        ]);

        cfg.selectors.uyeRemoveSearchInput = pickSelector(cfg.selectors.uyeRemoveSearchInput, [
            "#uyeCikarSearchInput" // ✅ senin view
        ]);

        cfg.selectors.uyeRemoveCheckboxList = pickSelector(cfg.selectors.uyeRemoveCheckboxList, [
            "#uyeCikarCheckboxList" // ✅ senin view
        ]);

        cfg.selectors.uyeRemoveSelectModal = pickSelector(cfg.selectors.uyeRemoveSelectModal, [
            "#uyeCikarSelectModal" // ✅ senin view
        ]);

        cfg.selectors.uyeRemoveSelectModalValidation = pickSelector(cfg.selectors.uyeRemoveSelectModalValidation, [
            "#uyeCikarSelectModalValidation" // ✅ senin view
        ]);

        cfg.selectors.uyeRemoveSelectedCountText = pickSelector(cfg.selectors.uyeRemoveSelectedCountText, [
            "#uyeCikarSelectedCountText" // ✅ senin view
        ]);

        cfg.selectors.removeSelectAllBtn = pickSelector(cfg.selectors.removeSelectAllBtn, [
            "#uye-cikar-modal-select-all" // ✅ senin view
        ]);

        cfg.selectors.removeDeselectAllBtn = pickSelector(cfg.selectors.removeDeselectAllBtn, [
            "#uye-cikar-modal-deselect-all" // ✅ senin view
        ]);

        cfg.selectors.gruptanUyeCikarStatus = pickSelector(cfg.selectors.gruptanUyeCikarStatus, [
            "#grupUyeleriCikarStatus" // ✅ senin view
        ]);
    }

    // ✅ modal trigger butonlarını (Görüntüle) grup seçimine göre enable et
    function setModalTriggerEnabled(modalId, enabled) {
        if (!modalId) return;
        const target = `#${modalId}`;
        const triggers = document.querySelectorAll(`[data-bs-toggle="modal"][data-bs-target="${target}"]`);
        triggers.forEach(btn => {
            try {
                if (enabled) {
                    btn.removeAttribute("disabled");
                    btn.classList.remove("disabled");
                    btn.setAttribute("aria-disabled", "false");
                    btn.style.pointerEvents = "";
                } else {
                    btn.setAttribute("disabled", "disabled");
                    btn.classList.add("disabled");
                    btn.setAttribute("aria-disabled", "true");
                }
            } catch (e) { }
        });
    }

    // ✅ DTO alan adları camelCase/PascalCase uyumlu
    function normalizePatientItem(p) {
        const tc =
            (p.tcKimlikNo || p.TcKimlikNo ||
                p.tc || p.Tc ||
                p.value || p.Value ||
                p.TcKimlikNoStr || p.tcKimlikNoStr || "").toString().trim();

        const adSoyad =
            (p.hastaAdSoyad || p.HastaAdSoyad ||
                p.adSoyad || p.AdSoyad ||
                p.name || p.Name ||
                p.text || p.Text || "").toString().trim();

        const finalText = adSoyad ? `${adSoyad} (${tc})` : (tc ? tc : "Bilinmeyen");
        return { tc, adSoyad, text: finalText };
    }

    function setGroupAreaEnabled(enabled) {
        $(S("grupSelect")).prop("disabled", !enabled);
        $(S("btnGrupEkle")).prop("disabled", !enabled);

        // ✅ grup sil butonu enable/disable (seçim varsa enable)
        $(S("btnGrupSil")).prop("disabled", !enabled || !$(S("grupSelect")).val());

        if (!enabled) {
            const uyePh = getSelectPlaceholder(S("uyeSelect"), "— Üye Seç —");
            $(S("uyeSelect")).prop("disabled", true).html(`<option value="">${uyePh}</option>`);
            $(S("btnGrubaUyeEkle")).prop("disabled", true);
        }

        // ✅ remove modal trigger’ı da
        setModalTriggerEnabled(cfg.selectors.gruptanUyeCikarModal, enabled && !!$(S("grupSelect")).val());
        // senin view id’si varsa onu da ayrıca
        setModalTriggerEnabled("grupUyeleriCikarModal", enabled && !!$(S("grupSelect")).val());
    }

    function resetGroupSelections() {
        $(S("grupSelect")).val("");

        const uyePh = getSelectPlaceholder(S("uyeSelect"), "— Üye Seç —");
        $(S("uyeSelect")).val("").prop("disabled", true).html(`<option value="">${uyePh}</option>`);

        $(S("btnGrubaUyeEkle")).prop("disabled", true);

        // ✅ grup sil butonu disable
        $(S("btnGrupSil")).prop("disabled", true);

        seciliGrupUyeSet = new Set();

        // ✅ remove modal trigger disable
        setModalTriggerEnabled(cfg.selectors.gruptanUyeCikarModal, false);
        setModalTriggerEnabled("grupUyeleriCikarModal", false);
    }

    // ======================================================
    // ✅ LOAD: doctor patients
    // ======================================================
    async function loadDoktorPatients(take = 500) {
        try {
            const res = await fetch(`${cfg.endpoints.myPatients}?take=${encodeURIComponent(take)}`, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });
            const json = await res.json();

            if (!json?.success) {
                console.warn("MyPatients başarısız:", json);
                doktorHastaCache = [];
                doktorHastaMap = new Map();
                return;
            }

            const list = Array.isArray(json.data) ? json.data : [];
            const normalized = list
                .map(normalizePatientItem)
                .filter(x => x.tc && x.tc.length === 11);

            doktorHastaCache = normalized;
            doktorHastaMap = new Map();
            normalized.forEach(x => doktorHastaMap.set(x.tc, x.text));

        } catch (e) {
            console.warn("loadDoktorPatients hata:", e);
            doktorHastaCache = [];
            doktorHastaMap = new Map();
        }
    }

    // ======================================================
    // ✅ LOAD: groups
    async function loadGruplar(selectGrupIdAfter = null) {
        try {
            const res = await fetch(cfg.endpoints.myGroups, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });
            const json = await res.json();

            if (!json?.success) {
                console.warn("Gruplar yüklenemedi:", json);
                setGroupAreaEnabled(false);
                return;
            }

            grupCache = Array.isArray(json.data) ? json.data : [];
            setGroupAreaEnabled(true);

            const $grup = $(S("grupSelect"));

            // ✅ Placeholder'ı view'den yakala (dil flicker'ı biter)
            const placeholderText = ($grup.find("option:first").text() || "— Grup Seç —").trim();

            // ✅ Tek seferde HTML bas (repaint azalır)
            const htmlParts = [`<option value="">${placeholderText}</option>`];

            grupCache.forEach(g => {
                const id = (g.GrupId ?? g.grupId);
                const name = (g.GrupAdi ?? g.grupAdi);
                const uyeSayisi = (g.UyeSayisi ?? g.uyeSayisi ?? 0);
                const label = uyeSayisi > 0 ? `${name} (${uyeSayisi})` : `${name}`;
                htmlParts.push(`<option value="${id}">${label}</option>`);
            });

            $grup.html(htmlParts.join(""));

            if (selectGrupIdAfter) {
                $grup.val(String(selectGrupIdAfter));
                $grup.trigger("change");
            } else {
                const cur = $grup.data("last-selected");
                if (cur) {
                    $grup.val(String(cur));
                    $grup.trigger("change");
                }
            }

            // ✅ grup sil butonu: seçim yoksa kapalı kalsın
            $(S("btnGrupSil")).prop("disabled", !$(S("grupSelect")).val());

        } catch (e) {
            console.warn("loadGruplar hata:", e);
            setGroupAreaEnabled(false);
        }
    }

    // ======================================================
    // ✅ LOAD: group members (fills seciliGrupUyeSet + uyeSelect)
    // ======================================================
    async function loadGrupUyeleri(grupId) {
        seciliGrupUyeSet = new Set();
        const $uye = $(S("uyeSelect"));

        const uyePh = getSelectPlaceholder(S("uyeSelect"), "— Üye Seç —");

        // ✅ remove modal trigger enable/disable
        setModalTriggerEnabled(cfg.selectors.gruptanUyeCikarModal, !!grupId);
        setModalTriggerEnabled("grupUyeleriCikarModal", !!grupId);

        // ✅ grup sil butonu enable/disable
        $(S("btnGrupSil")).prop("disabled", !grupId);

        if (!grupId) {
            $uye.prop("disabled", true).html(`<option value="">${uyePh}</option>`);
            $(S("btnGrubaUyeEkle")).prop("disabled", true);
            return;
        }

        try {
            const res = await fetch(`${cfg.endpoints.members}?grupId=${encodeURIComponent(grupId)}`, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });
            const json = await res.json();

            if (!json?.success) {
                console.warn("Members başarısız:", json);
                $uye.prop("disabled", true).html(`<option value="">${uyePh}</option>`);
                $(S("btnGrubaUyeEkle")).prop("disabled", false);
                return;
            }

            const list = Array.isArray(json.data) ? json.data : [];

            const aktifUyeler = list
                .filter(x => (x.IsAktif ?? x.isAktif) !== false)
                .map(x => (x.TcKimlikNo || x.tcKimlikNo || "").toString().trim())
                .filter(tc => tc.length === 11);

            aktifUyeler.forEach(tc => seciliGrupUyeSet.add(tc));

            $uye.empty().append(`<option value="">${uyePh}</option>`);

            if (aktifUyeler.length === 0) {
                $uye.append(`<option value="">(Bu grupta üye yok)</option>`);
                $uye.prop("disabled", true);
            } else {
                aktifUyeler.forEach(tc => {
                    const label = doktorHastaMap.get(tc) || tc;
                    $uye.append(`<option value="${tc}">${label}</option>`);
                });
                $uye.prop("disabled", false);
            }

            $(S("btnGrubaUyeEkle")).prop("disabled", false);

        } catch (e) {
            console.warn("loadGrupUyeleri hata:", e);
            $uye.prop("disabled", true).html(`<option value="">${uyePh}</option>`);
            $(S("btnGrubaUyeEkle")).prop("disabled", false);
        }
    }

    // ======================================================
    // ✅ ADD MODAL: CHECKBOX LIST + SEARCH + HIDDEN SELECT SYNC
    // ======================================================
    function renderUyeCheckboxList(items) {
        const $list = $(S("uyeCheckboxList"));
        $list.empty();

        if (!items || !items.length) {
            $list.html(`<div class="text-muted small py-3 text-center">Liste boş</div>`);
            return;
        }

        items.forEach(x => {
            const already = seciliGrupUyeSet.has(x.tc);
            const labelText = x.text || (doktorHastaMap.get(x.tc) || x.tc);

            const rowId = `uye_cb_${x.tc}`;
            const disabledAttr = already ? "disabled" : "";
            const alreadyBadge = already
                ? `<span class="badge bg-success-subtle text-success border border-success-subtle ms-2">✅ Zaten grupta</span>`
                : "";

            const dataText = (labelText || "")
                .toString()
                .trim()
                .toLocaleLowerCase("tr-TR")
                .replace(/\s+/g, " ");

            $list.append(`
        <label class="list-group-item d-flex align-items-center gap-2 py-2" for="${rowId}" data-text="${dataText}">
          <input class="form-check-input mt-0" type="checkbox" value="${x.tc}" id="${rowId}" ${disabledAttr}>
          <span class="flex-grow-1">${labelText}</span>
          ${alreadyBadge}
        </label>
      `);
        });
    }

    function updateUyeModalSelectedCount() {
        const select = document.querySelector(S("uyeSelectModal"));
        const countEl = document.querySelector(S("uyeSelectedCountText"));
        if (!select || !countEl) return;

        const selectedCount = Array.from(select.selectedOptions)
            .filter(o => o.value && o.value.length === 11)
            .length;

        countEl.textContent = `Seçilen: ${selectedCount}`;
        countEl.style.display = "inline";
    }

    function syncHiddenSelectFromCheckboxes() {
        const select = document.querySelector(S("uyeSelectModal"));
        if (!select) return;

        Array.from(select.options).forEach(opt => {
            if (opt.value && opt.value.length === 11) opt.selected = false;
        });

        document.querySelectorAll(`${S("uyeCheckboxList")} input[type="checkbox"]:checked`).forEach(cb => {
            const tc = (cb.value || "").toString().trim();
            const opt = select.querySelector(`option[value="${tc}"]`);
            if (opt && !opt.disabled) opt.selected = true;
        });

        updateUyeModalSelectedCount();
    }

    function applyHiddenSelectToCheckboxes() {
        const select = document.querySelector(S("uyeSelectModal"));
        if (!select) return;

        const selectedSet = new Set(
            Array.from(select.selectedOptions || []).map(o => o.value)
        );

        document.querySelectorAll(`${S("uyeCheckboxList")} input[type="checkbox"]`).forEach(cb => {
            if (cb.disabled) return;
            cb.checked = selectedSet.has(cb.value);
        });

        updateUyeModalSelectedCount();
    }

    function filterUyeCheckboxList(query) {
        const q = (query || "")
            .toString()
            .trim()
            .toLocaleLowerCase("tr-TR")
            .replace(/\s+/g, " ");

        const listEl = document.querySelector(S("uyeCheckboxList"));
        if (!listEl) return;

        const rows = listEl.querySelectorAll(".list-group-item[data-text]");
        rows.forEach(row => {
            const text = row.getAttribute("data-text") || "";
            row.classList.toggle("d-none", !!q && !text.includes(q));
        });
    }

    function selectAllUyeModal(silent = false) {
        const select = document.querySelector(S("uyeSelectModal"));
        if (!select) return;

        Array.from(select.options).forEach(opt => {
            if (!opt.disabled && opt.value && opt.value.length === 11) opt.selected = true;
        });

        applyHiddenSelectToCheckboxes();

        if (!silent && window.Swal) {
            Swal.fire({
                icon: "success",
                title: window.translations?.Success || "Başarılı",
                text: window.translations?.AllSelected || "Tümü seçildi!",
                toast: true,
                position: "top-end",
                showConfirmButton: false,
                timer: 1500
            });
        }
    }

    function deselectAllUyeModal(silent = false) {
        const select = document.querySelector(S("uyeSelectModal"));
        if (!select) return;

        Array.from(select.options).forEach(opt => {
            if (opt.value && opt.value.length === 11) opt.selected = false;
        });

        applyHiddenSelectToCheckboxes();

        if (!silent && window.Swal) {
            Swal.fire({
                icon: "info",
                title: window.translations?.Info || "Bilgi",
                text: window.translations?.AllCleared || "Seçimler temizlendi!",
                toast: true,
                position: "top-end",
                showConfirmButton: false,
                timer: 1500
            });
        }
    }

    function bindAddModalButtonsOnce() {
        if (addModalButtonsBound) return;
        addModalButtonsBound = true;

        const btnAll = document.querySelector(S("selectAllBtn"));
        const btnNone = document.querySelector(S("deselectAllBtn"));

        if (btnAll) btnAll.addEventListener("click", () => selectAllUyeModal(false));
        if (btnNone) btnNone.addEventListener("click", () => deselectAllUyeModal(false));
    }

    function fillUyeSelectModalOptions() {
        const placeholderText = getSelectPlaceholder(S("uyeSelectModal"), "— Üye Seç —");

        const $modalSel = $(S("uyeSelectModal"));
        $modalSel.empty().append(`<option value="">${placeholderText}</option>`);

        try { $(S("uyeSearchInput")).val(""); } catch (e) { }

        if (!doktorHastaCache.length) {
            $(S("uyeCheckboxList")).html(`<div class="text-muted small py-3 text-center">(Hasta listesi boş)</div>`);
            $modalSel.append(`<option value="">(Hasta listesi boş)</option>`);
            updateUyeModalSelectedCount();
            return;
        }

        doktorHastaCache.forEach(x => {
            const already = seciliGrupUyeSet.has(x.tc);
            const baseText = x.text || (doktorHastaMap.get(x.tc) || x.tc);

            if (already) {
                $modalSel.append(`<option value="${x.tc}" disabled>${baseText}  ✅ Zaten grupta</option>`);
            } else {
                $modalSel.append(`<option value="${x.tc}">${baseText}</option>`);
            }
        });

        const selectableCount = doktorHastaCache.filter(x => !seciliGrupUyeSet.has(x.tc)).length;
        if (selectableCount === 0) {
            $modalSel.append(`<option value="" disabled>— Bu gruba eklenebilecek yeni kişi yok —</option>`);
        }

        renderUyeCheckboxList(doktorHastaCache);

        $(S("uyeCheckboxList"))
            .off("change.uyeModalCb")
            .on("change.uyeModalCb", 'input[type="checkbox"]', function () {
                syncHiddenSelectFromCheckboxes();
            });

        filterUyeCheckboxList("");
        deselectAllUyeModal(true);
        updateUyeModalSelectedCount();
    }

    // ======================================================
    // ✅ REMOVE MODAL: CHECKBOX LIST + SEARCH + HIDDEN SELECT SYNC
    // ======================================================
    function renderRemoveCheckboxList(tcs) {
        const $list = $(S("uyeRemoveCheckboxList"));
        $list.empty();

        const arr = Array.from(tcs || []);
        if (!arr.length) {
            $list.html(`<div class="text-muted small py-3 text-center">(Bu grupta üye yok)</div>`);
            return;
        }

        arr.forEach(tc => {
            const labelText = doktorHastaMap.get(tc) || tc;
            const rowId = `uye_rm_cb_${tc}`;

            const dataText = (labelText || "")
                .toString()
                .trim()
                .toLocaleLowerCase("tr-TR")
                .replace(/\s+/g, " ");

            $list.append(`
        <label class="list-group-item d-flex align-items-center gap-2 py-2" for="${rowId}" data-text="${dataText}">
          <input class="form-check-input mt-0" type="checkbox" value="${tc}" id="${rowId}">
          <span class="flex-grow-1">${labelText}</span>
        </label>
      `);
        });
    }

    function updateRemoveSelectedCount() {
        const select = document.querySelector(S("uyeRemoveSelectModal"));
        const countEl = document.querySelector(S("uyeRemoveSelectedCountText"));
        if (!select || !countEl) return;

        const selectedCount = Array.from(select.selectedOptions)
            .filter(o => o.value && o.value.length === 11)
            .length;

        countEl.textContent = `Seçilen: ${selectedCount}`;
        countEl.style.display = "inline";
    }

    function syncRemoveHiddenSelectFromCheckboxes() {
        const select = document.querySelector(S("uyeRemoveSelectModal"));
        if (!select) return;

        Array.from(select.options).forEach(opt => {
            if (opt.value && opt.value.length === 11) opt.selected = false;
        });

        document.querySelectorAll(`${S("uyeRemoveCheckboxList")} input[type="checkbox"]:checked`).forEach(cb => {
            const tc = (cb.value || "").toString().trim();
            const opt = select.querySelector(`option[value="${tc}"]`);
            if (opt) opt.selected = true;
        });

        updateRemoveSelectedCount();
    }

    function applyRemoveHiddenSelectToCheckboxes() {
        const select = document.querySelector(S("uyeRemoveSelectModal"));
        if (!select) return;

        const selectedSet = new Set(
            Array.from(select.selectedOptions || []).map(o => o.value)
        );

        document.querySelectorAll(`${S("uyeRemoveCheckboxList")} input[type="checkbox"]`).forEach(cb => {
            cb.checked = selectedSet.has(cb.value);
        });

        updateRemoveSelectedCount();
    }

    function filterRemoveCheckboxList(query) {
        const q = (query || "")
            .toString()
            .trim()
            .toLocaleLowerCase("tr-TR")
            .replace(/\s+/g, " ");

        const listEl = document.querySelector(S("uyeRemoveCheckboxList"));
        if (!listEl) return;

        const rows = listEl.querySelectorAll(".list-group-item[data-text]");
        rows.forEach(row => {
            const text = row.getAttribute("data-text") || "";
            row.classList.toggle("d-none", !!q && !text.includes(q));
        });
    }

    function removeSelectAll(silent = false) {
        const select = document.querySelector(S("uyeRemoveSelectModal"));
        if (!select) return;

        Array.from(select.options).forEach(opt => {
            if (opt.value && opt.value.length === 11) opt.selected = true;
        });

        applyRemoveHiddenSelectToCheckboxes();

        if (!silent && window.Swal) {
            Swal.fire({
                icon: "success",
                title: window.translations?.Success || "Başarılı",
                text: "Tümü seçildi!",
                toast: true,
                position: "top-end",
                showConfirmButton: false,
                timer: 1500
            });
        }
    }

    function removeDeselectAll(silent = false) {
        const select = document.querySelector(S("uyeRemoveSelectModal"));
        if (!select) return;

        Array.from(select.options).forEach(opt => {
            if (opt.value && opt.value.length === 11) opt.selected = false;
        });

        applyRemoveHiddenSelectToCheckboxes();

        if (!silent && window.Swal) {
            Swal.fire({
                icon: "info",
                title: window.translations?.Info || "Bilgi",
                text: "Seçimler temizlendi!",
                toast: true,
                position: "top-end",
                showConfirmButton: false,
                timer: 1500
            });
        }
    }

    function bindRemoveModalButtonsOnce() {
        if (removeModalButtonsBound) return;
        removeModalButtonsBound = true;

        const btnAll = document.querySelector(S("removeSelectAllBtn"));
        const btnNone = document.querySelector(S("removeDeselectAllBtn"));

        if (btnAll) btnAll.addEventListener("click", () => removeSelectAll(false));
        if (btnNone) btnNone.addEventListener("click", () => removeDeselectAll(false));
    }

    function fillRemoveModalOptions() {
        const placeholderText = getSelectPlaceholder(S("uyeRemoveSelectModal"), "— Üye Seç —");

        const $sel = $(S("uyeRemoveSelectModal"));
        $sel.empty().append(`<option value="">${placeholderText}</option>`);

        removeUyeSet = new Set(Array.from(seciliGrupUyeSet || []));

        const arr = Array.from(removeUyeSet);
        if (!arr.length) {
            $(S("uyeRemoveCheckboxList")).html(`<div class="text-muted small py-3 text-center">(Bu grupta üye yok)</div>`);
            $sel.append(`<option value="">(Bu grupta üye yok)</option>`);
            updateRemoveSelectedCount();
            return;
        }

        arr.forEach(tc => {
            const label = doktorHastaMap.get(tc) || tc;
            $sel.append(`<option value="${tc}">${label}</option>`);
        });

        renderRemoveCheckboxList(removeUyeSet);

        $(S("uyeRemoveCheckboxList"))
            .off("change.uyeRemoveCb")
            .on("change.uyeRemoveCb", 'input[type="checkbox"]', function () {
                syncRemoveHiddenSelectFromCheckboxes();
            });

        try { $(S("uyeRemoveSearchInput")).val(""); } catch (e) { }
        filterRemoveCheckboxList("");
        removeDeselectAll(true);
        updateRemoveSelectedCount();
    }

    // ======================================================
    // ✅ Search delegates (ADD + REMOVE)
    // ======================================================
    function bindSearchDelegatesOnce() {
        // ADD
        $(document)
            .off("input.uyeSearch keyup.uyeSearch compositionend.uyeSearch", S("uyeSearchInput"))
            .on("input.uyeSearch keyup.uyeSearch compositionend.uyeSearch", S("uyeSearchInput"), function () {
                filterUyeCheckboxList(this.value);
            });

        $(document)
            .off("keydown.uyeSearch", S("uyeSearchInput"))
            .on("keydown.uyeSearch", S("uyeSearchInput"), function (e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    filterUyeCheckboxList(this.value);
                }
            });

        // REMOVE
        $(document)
            .off("input.uyeRemoveSearch keyup.uyeRemoveSearch compositionend.uyeRemoveSearch", S("uyeRemoveSearchInput"))
            .on("input.uyeRemoveSearch keyup.uyeRemoveSearch compositionend.uyeRemoveSearch", S("uyeRemoveSearchInput"), function () {
                filterRemoveCheckboxList(this.value);
            });

        $(document)
            .off("keydown.uyeRemoveSearch", S("uyeRemoveSearchInput"))
            .on("keydown.uyeRemoveSearch", S("uyeRemoveSearchInput"), function (e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    filterRemoveCheckboxList(this.value);
                }
            });
    }

    // ======================================================
    // ✅ AJAX: create + add/remove members + delete group
    // ======================================================
    async function createGrup(grupAdi) {
        const body = new URLSearchParams();
        body.set("grupAdi", grupAdi);

        const res = await fetch(cfg.endpoints.createGroup, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "RequestVerificationToken": antiforgeryToken()
            },
            body: body.toString()
        });

        return await res.json();
    }

    async function addMembersToGrup(grupId, tcKimlikNos) {
        const body = new URLSearchParams();
        body.set("grupId", String(grupId));

        (tcKimlikNos || []).forEach(tc => {
            const v = (tc || "").toString().trim();
            if (v) body.append("tcKimlikNos", v);
        });

        const res = await fetch(cfg.endpoints.addMembers, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "RequestVerificationToken": antiforgeryToken()
            },
            body: body.toString()
        });

        return await res.json();
    }

    async function removeMembersFromGrup(grupId, tcKimlikNos) {
        const body = new URLSearchParams();
        body.set("grupId", String(grupId));

        (tcKimlikNos || []).forEach(tc => {
            const v = (tc || "").toString().trim();
            if (v) body.append("tcKimlikNos", v);
        });

        const res = await fetch(cfg.endpoints.removeMembers, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "RequestVerificationToken": antiforgeryToken()
            },
            body: body.toString()
        });

        return await res.json();
    }

    // ✅ Grup sil (soft delete: IsAktif=0)
    async function deleteGroupSoft(grupId) {
        const body = new URLSearchParams();
        body.set("grupId", String(grupId));

        const res = await fetch(cfg.endpoints.deleteGroup, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "RequestVerificationToken": antiforgeryToken()
            },
            body: body.toString()
        });

        return await res.json();
    }

    // ======================================================
    // ✅ EVENTS
    // ======================================================

    // ======================================================
    // ✅ EVENTS (Helpers + TC sync)
    // ======================================================

    let tcSetByUyeSelect = false;

    function setTcFromUyeSelect(tc) {
        tcSetByUyeSelect = true;
        $(S("tcInput")).val(tc);
        // updateButtons içindeki trigger(input/change) yüzünden flag aynı tick’te kalsın
        setTimeout(() => { tcSetByUyeSelect = false; }, 0);
    }

    function trySelectUyeIfExists(tc) {
        const $uye = $(S("uyeSelect"));
        if (!$uye.length) return false;

        const exists = $uye.find(`option[value="${tc}"]`).length > 0;
        if (exists) {
            $uye.val(tc);
            return true;
        }
        return false;
    }

    // ✅ debounce + state
    let tcLookupTimer = null;
    let groupSetByTcInput = false;

    // ✅ endpoint: TC -> grup(lar) + preferred members (aynı endpoint adı)
    async function fetchGroupForTc(tc) {
        try {
            const res = await fetch(`${cfg.endpoints.findGroupForTc}?tcKimlikNo=${encodeURIComponent(tc)}`, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });
            return await res.json();
        } catch (e) {
            console.warn("findGroupForTc hata:", e);
            return null;
        }
    }

    // ✅ endpointten gelen members ile hızlı üye select doldur
    function fillUyeSelectFromMemberList(memberTcs) {
        const $uye = $(S("uyeSelect"));
        const uyePh = getSelectPlaceholder(S("uyeSelect"), "— Üye Seç —");

        const arr = Array.isArray(memberTcs) ? memberTcs : [];
        const aktifUyeler = arr
            .map(x => (x || "").toString().trim())
            .filter(tc => tc.length === 11);

        seciliGrupUyeSet = new Set(aktifUyeler);

        if (!aktifUyeler.length) {
            $uye.prop("disabled", true).html(`<option value="">${uyePh}</option><option value="">(Bu grupta üye yok)</option>`);
            $(S("btnGrubaUyeEkle")).prop("disabled", false);
            return;
        }

        const parts = [`<option value="">${uyePh}</option>`];
        aktifUyeler.forEach(tc => {
            const label = doktorHastaMap.get(tc) || tc;
            parts.push(`<option value="${tc}">${label}</option>`);
        });

        $uye.html(parts.join(""));
        $uye.prop("disabled", false);
        $(S("btnGrubaUyeEkle")).prop("disabled", false);
    }

    // ✅ grup set + (hızlıysa) üyeleri endpointten doldur + tc’yi uyeSelect’te seç
    async function setGroupAndSelectMember(grupId, tcToSelect, membersFromEndpoint) {
        if (!grupId) return;

        groupSetByTcInput = true;

        const $grup = $(S("grupSelect"));
        $grup.val(String(grupId));
        $grup.data("last-selected", String(grupId));

        // ✅ HIZ: members geldiyse Members endpointine gitmeden doldur
        if (Array.isArray(membersFromEndpoint)) {
            fillUyeSelectFromMemberList(membersFromEndpoint);
        } else {
            // fallback
            await loadGrupUyeleri(grupId);
        }

        // buton/trigger enable-disable
        setModalTriggerEnabled(cfg.selectors.gruptanUyeCikarModal, !!grupId);
        setModalTriggerEnabled("grupUyeleriCikarModal", !!grupId);
        $(S("btnGrupSil")).prop("disabled", !grupId);

        groupSetByTcInput = false;

        if (tcToSelect && tcToSelect.length === 11) {
            trySelectUyeIfExists(tcToSelect);
        }
    }


    function bindReceteGruplariEvents() {
        // grup seçimi -> üyeleri yükle
        // grup seçimi -> üyeleri yükle
        $(S("grupSelect")).off("change.receteGrup").on("change.receteGrup", async function () {
            const grupId = $(this).val();
            $(this).data("last-selected", grupId || "");

            // ✅ TC input tarafından programatik set edildiyse,
            // (setGroupAndSelectMember içinde) üyeler zaten doldurulmuş olabilir.
            if (!groupSetByTcInput) {
                await loadGrupUyeleri(grupId);
            }

            // ✅ remove modal trigger enable/disable
            setModalTriggerEnabled(cfg.selectors.gruptanUyeCikarModal, !!grupId);
            setModalTriggerEnabled("grupUyeleriCikarModal", !!grupId);

            // ✅ grup sil enable/disable
            $(S("btnGrupSil")).prop("disabled", !grupId);
        });


        // ✅ grup sil (çarpı)
        $(S("btnGrupSil")).off("click.grupSil").on("click.grupSil", async function () {
            const grupId = $(S("grupSelect")).val();
            const grupAdi = ($(S("grupSelect") + " option:selected").text() || "").trim();

            if (!grupId) {
                Swal.fire({
                    icon: "warning",
                    title: "Uyarı",
                    text: "Önce bir grup seçmelisiniz.",
                    confirmButtonColor: "#012F51"
                });
                return;
            }

            const ok = await Swal.fire({
                icon: "warning",
                title: "Grubu silmek istiyor musunuz?",
                html: `<b>${grupAdi || "Seçili Grup"}</b><br/><small>Bu işlem reçete grubunu silicektir.</small>`,
                showCancelButton: true,
                confirmButtonText: "Evet, sil",
                cancelButtonText: "Vazgeç",
                confirmButtonColor: "#d33",
                cancelButtonColor: "#6c757d"
            });

            if (!ok.isConfirmed) return;

            $(this).prop("disabled", true);

            try {
                const result = await deleteGroupSoft(grupId);

                if (!result?.success) {
                    Swal.fire({
                        icon: "error",
                        title: "Hata",
                        text: result?.message || "Grup silinemedi.",
                        confirmButtonColor: "#012F51"
                    });
                    return;
                }

                Swal.fire({
                    icon: "success",
                    title: "Başarılı",
                    text: result?.message || "Grup pasif edildi.",
                    timer: 1400,
                    showConfirmButton: false
                });

                // ✅ seçimleri sıfırla + grupları yeniden çek
                resetGroupSelections();
                await loadGruplar(null);

            } catch (e) {
                console.error("Grup silme hata:", e);
                Swal.fire({
                    icon: "error",
                    title: "Hata",
                    text: e?.message || "Grup silme sırasında hata oluştu.",
                    confirmButtonColor: "#012F51"
                });
            } finally {
                // tekrar enable/disable: seçim yoksa yine kapalı kalsın
                const cur = $(S("grupSelect")).val();
                $(this).prop("disabled", !cur);
            }
        });

        // tekli select -> tc input sync
        $(S("uyeSelect")).off("change.receteUye").on("change.receteUye", function () {
            const tc = ($(this).val() || "").toString().trim();
            if (tc && tc.length === 11) {
                setTcFromUyeSelect(tc);          // ✅ kritik
                $(S("personelSelect")).val("");
                cfg.hooks.updateButtons();
            }
        });


        // tc input yazılınca -> uyeSelect temizle
        // ======================================================
        // ✅ tc input yazılınca -> uyeSelect temizle / seç / grup bul
        // ======================================================
        $(S("tcInput")).off("input.receteGrupSync").on("input.receteGrupSync", function () {
            const tc = ($(this).val() || "").toString().trim();
            const $grup = $(S("grupSelect"));

            // ✅ Üyeden gelen programatik TC setinde temizleme yapma
            if (tcSetByUyeSelect) {
                if (tc.length === 11) trySelectUyeIfExists(tc);
                return;
            }

            // ✅ TC boşsa: hem uyeSelect hem grupSelect temizlensin
            if (!tc) {
                // grup/uye tüm reset (senin fonksiyon)
                resetGroupSelections();
                return;
            }

            // ✅ kullanıcı TC’ye bir şey yazdıysa => uyeSelect temizle
            if (tc.length > 0) $(S("uyeSelect")).val("");

            // ✅ 11 hane -> önce seçili grupta varsa seç
            if (tc.length === 11) {
                if (trySelectUyeIfExists(tc)) return;

                // ✅ grup yoksa endpointten bulup set et
                const curGrupId = ($grup.val() || "").toString().trim();
                if (!curGrupId) {
                    clearTimeout(tcLookupTimer);
                    tcLookupTimer = setTimeout(async () => {
                        const json = await fetchGroupForTc(tc);
                        const gid = json?.data?.preferredGroupId;
                        const members = json?.data?.members; // ✅ endpointten

                        if (gid) {
                            await setGroupAndSelectMember(gid, tc, members);
                        }
                    }, 150); // daha hızlı hissiyat
                }
            }
        });


        // grup oluştur
        $(S("confirmGrupEkleBtn")).off("click.grupEkle").on("click.grupEkle", async function () {
            const grupAdi = ($(S("grupAdiInput")).val() || "").toString().trim();

            if (!grupAdi) {
                $(S("grupAdiValidation")).text("Grup adı zorunlu.");
                return;
            }
            $(S("grupAdiValidation")).text("");

            $(this).prop("disabled", true);

            try {
                const result = await createGrup(grupAdi);

                if (!result?.success) {
                    Swal.fire({
                        icon: "error",
                        title: "Hata",
                        text: result?.message || "Grup oluşturulamadı.",
                        confirmButtonColor: "#012F51"
                    });
                    return;
                }

                $(S("grupAdiInput")).val("");
                bootstrap.Modal.getInstance(document.getElementById(cfg.selectors.grupEkleModal))?.hide();

                Swal.fire({
                    icon: "success",
                    title: "Başarılı",
                    text: result?.message || "Grup oluşturuldu.",
                    timer: 1500,
                    confirmButtonColor: "#012F51"
                });

                const newId = result?.data?.grupId || result?.data?.GrupId;
                await loadGruplar(newId);

            } catch (e) {
                console.error("Grup oluşturma hata:", e);
                Swal.fire({
                    icon: "error",
                    title: "Hata",
                    text: e?.message || "Grup oluşturma sırasında hata oluştu.",
                    confirmButtonColor: "#012F51"
                });
            } finally {
                $(this).prop("disabled", false);
            }
        });

        // ✅ ADD modal açılınca
        $("#" + cfg.selectors.grubaUyeEkleModal).off("show.bs.modal.receteGrup").on("show.bs.modal.receteGrup", function () {
            const grupId = $(S("grupSelect")).val();
            const grupAdi = $(S("grupSelect") + " option:selected").text();

            if (!grupId) {
                setTimeout(() => {
                    bootstrap.Modal.getInstance(document.getElementById(cfg.selectors.grubaUyeEkleModal))?.hide();
                }, 0);

                Swal.fire({
                    icon: "warning",
                    title: "Uyarı",
                    text: "Önce bir grup seçmelisiniz.",
                    confirmButtonColor: "#012F51"
                });
                return;
            }

            $(S("seciliGrupAdiInput")).val(grupAdi || "");
            $(S("seciliGrupValidationModal")).text("");
            $(S("uyeSelectModalValidation")).text("");
            $(S("grubaUyeEkleStatus")).hide();

            fillUyeSelectModalOptions();
            bindAddModalButtonsOnce();

            try { $(S("uyeSearchInput")).val(""); } catch (e) { }
            setTimeout(() => {
                updateUyeModalSelectedCount();
                filterUyeCheckboxList("");
            }, 0);
        });

        // ✅ bulk ADD
        $(S("confirmGrubaUyeEkleBtn")).off("click.grubaUyeEkle").on("click.grubaUyeEkle", async function () {
            const grupId = $(S("grupSelect")).val();

            const selected = $(S("uyeSelectModal")).val() || [];
            const tcListRaw = (Array.isArray(selected) ? selected : [selected])
                .map(x => (x || "").toString().trim())
                .filter(x => x.length === 11);

            if (!grupId) {
                $(S("seciliGrupValidationModal")).text("Grup seçimi bulunamadı.");
                return;
            }
            $(S("seciliGrupValidationModal")).text("");

            if (!tcListRaw.length) {
                $(S("uyeSelectModalValidation")).text("En az 1 üye seçmelisiniz.");
                return;
            }
            $(S("uyeSelectModalValidation")).text("");

            const tcList = tcListRaw.filter(tc => !seciliGrupUyeSet.has(tc));

            if (!tcList.length) {
                Swal.fire({
                    icon: "info",
                    title: "Bilgi",
                    text: "Seçtiğiniz kişiler zaten seçili grupta.",
                    confirmButtonColor: "#012F51"
                });
                return;
            }

            $(this).prop("disabled", true);
            $(S("grubaUyeEkleStatus")).show();

            try {
                const result = await addMembersToGrup(grupId, tcList);

                if (!result?.success) {
                    Swal.fire({
                        icon: "error",
                        title: "Hata",
                        text: result?.message || "Üyeler eklenemedi.",
                        confirmButtonColor: "#012F51"
                    });
                    return;
                }

                bootstrap.Modal.getInstance(document.getElementById(cfg.selectors.grubaUyeEkleModal))?.hide();

                Swal.fire({
                    icon: "success",
                    title: "Başarılı",
                    text: result?.message || "Üyeler eklendi.",
                    timer: 1700,
                    confirmButtonColor: "#012F51"
                });

                await loadGrupUyeleri(grupId);

                const firstTc = tcList[0];
                if (firstTc) {
                    $(S("tcInput")).val(firstTc);
                    $(S("personelSelect")).val("");
                    cfg.hooks.updateButtons();
                }

            } catch (e) {
                console.error("Üye ekleme (bulk) hata:", e);
                Swal.fire({
                    icon: "error",
                    title: "Hata",
                    text: e?.message || "Üye ekleme sırasında hata oluştu.",
                    confirmButtonColor: "#012F51"
                });
            } finally {
                $(S("grubaUyeEkleStatus")).hide();
                $(this).prop("disabled", false);
            }
        });

        // ✅ REMOVE modal açılınca (resolved id ile)
        $("#" + cfg.selectors.gruptanUyeCikarModal)
            .off("show.bs.modal.receteRemove")
            .on("show.bs.modal.receteRemove", function () {

                const grupId = $(S("grupSelect")).val();
                const grupAdi = $(S("grupSelect") + " option:selected").text();

                if (!grupId) {
                    setTimeout(() => {
                        bootstrap.Modal.getInstance(document.getElementById(cfg.selectors.gruptanUyeCikarModal))?.hide();
                    }, 0);

                    Swal.fire({
                        icon: "warning",
                        title: "Uyarı",
                        text: "Önce bir grup seçmelisiniz.",
                        confirmButtonColor: "#012F51"
                    });
                    return;
                }

                $(S("seciliGrupAdiRemoveInput")).val(grupAdi || "");
                $(S("seciliGrupRemoveValidation")).text("");
                $(S("uyeRemoveSelectModalValidation")).text("");
                $(S("gruptanUyeCikarStatus")).hide();

                fillRemoveModalOptions();
                bindRemoveModalButtonsOnce();

                try { $(S("uyeRemoveSearchInput")).val(""); } catch (e) { }
                setTimeout(() => {
                    updateRemoveSelectedCount();
                    filterRemoveCheckboxList("");
                }, 0);
            });

        // ✅ bulk REMOVE (confirm btn resolved)
        $(S("confirmGruptanUyeCikarBtn"))
            .off("click.grubaUyeCikar")
            .on("click.grubaUyeCikar", async function () {

                const grupId = $(S("grupSelect")).val();

                const selected = $(S("uyeRemoveSelectModal")).val() || [];
                const tcListRaw = (Array.isArray(selected) ? selected : [selected])
                    .map(x => (x || "").toString().trim())
                    .filter(x => x.length === 11);

                if (!grupId) {
                    $(S("seciliGrupRemoveValidation")).text("Grup seçimi bulunamadı.");
                    return;
                }
                $(S("seciliGrupRemoveValidation")).text("");

                if (!tcListRaw.length) {
                    $(S("uyeRemoveSelectModalValidation")).text("En az 1 üye seçmelisiniz.");
                    return;
                }
                $(S("uyeRemoveSelectModalValidation")).text("");

                $(this).prop("disabled", true);
                $(S("gruptanUyeCikarStatus")).show();

                try {
                    const result = await removeMembersFromGrup(grupId, tcListRaw);

                    if (!result?.success) {
                        Swal.fire({
                            icon: "error",
                            title: "Hata",
                            text: result?.message || "Üyeler çıkarılamadı.",
                            confirmButtonColor: "#012F51"
                        });
                        return;
                    }

                    bootstrap.Modal.getInstance(document.getElementById(cfg.selectors.gruptanUyeCikarModal))?.hide();

                    Swal.fire({
                        icon: "success",
                        title: "Başarılı",
                        text: result?.message || "Üyeler çıkarıldı.",
                        timer: 1700,
                        confirmButtonColor: "#012F51"
                    });

                    await loadGrupUyeleri(grupId);

                    removeUyeSet = new Set();

                } catch (e) {
                    console.error("Üye çıkarma (bulk) hata:", e);
                    Swal.fire({
                        icon: "error",
                        title: "Hata",
                        text: e?.message || "Üye çıkarma sırasında hata oluştu.",
                        confirmButtonColor: "#012F51"
                    });
                } finally {
                    $(S("gruptanUyeCikarStatus")).hide();
                    $(this).prop("disabled", false);
                }
            });

        // delegates
        bindSearchDelegatesOnce();
    }

    // ======================================================
    // ✅ INIT UI
    // ======================================================
    async function initReceteGruplariUi() {
        setGroupAreaEnabled(false);
        resetGroupSelections();

        await Promise.all([
            loadDoktorPatients(500),
            loadGruplar(null)
        ]);

        bindReceteGruplariEvents();
    }

    // ======================================================
    // ✅ PUBLIC API (mevcut init)
    // ======================================================
    async function init(userConfig) {
        if (inited) return;
        inited = true;

        cfg = $.extend(true, {}, DEFAULTS, userConfig || {});

        // ✅ REMOVE tarafını otomatik view id’lerine uydur
        resolveRemoveSelectorsOnce();

        await initReceteGruplariUi();
    }

    // ======================================================
    // ✅ REVIEW RECEPT DESTEĞİ (MEVCUTLARI BOZMADAN)
    // - ✅ Bar görünürlüğü BACKEND FLAG ile olacak (JS membership async yok)
    // - ✅ Modal açılınca grupları getir, seçili grubun üyelerini göster
    // - ✅ Üyeler listesi ve label'lar: "Ad Soyad (TC)" olacak
    // - ✅ Review sayfasında da myPatients çağrılıp doktorHastaMap doldurulur (diğer view'lerle aynı mantık)
    // - ✅ Core cfg yoksa loadDoktorPatients ÇAĞRILMAZ (önceki hata fix) ama Review kendi endpoint'i ile doldurur
    // ======================================================

    const REVIEW_DEFAULTS = {
        endpoints: {
            myGroups: DEFAULTS.endpoints.myGroups,
            members: DEFAULTS.endpoints.members,
            createGroup: DEFAULTS.endpoints.createGroup,
            addMembers: DEFAULTS.endpoints.addMembers,

            // ✅ EKLENDİ: diğer view'lerdeki gibi myPatients
            myPatients: DEFAULTS.endpoints.myPatients

            // ✅ membership kaldırıldı
        },
        selectors: {
            // token opsiyonel (form içine koyarsan daha stabil)
            antiForgeryForm: null, // "#afForm"

            // tc kaynağı
            tcHidden: null,         // "#manuelTc" gibi
            hastaTcText: null,      // "#hastaTcText" gibi

            // isim kaynakları
            hastaAdiText: null,     // "#hastaAdiText"
            hastaSoyadiText: null,  // "#hastaSoyadiText"

            // öneri bar (backend flag ile görünür/gizli gelir)
            oneriBar: null,               // "#rgReviewOneriBar"
            dontAskAgainCheckbox: null,   // "#rgReviewDontAskAgain"
            dismissOneriBtn: null,        // "#rgReviewDismissBtn"
            openModalBtn: null,           // "#rgReviewOpenModalBtn"

            // modal
            modalId: null,                // "rgReviewModal" (ID string)
            modalHastaName: null,         // "#rgReviewHastaName"
            modalHastaTc: null,           // "#rgReviewHastaTc"
            groupSelect: null,            // "#rgReviewGroupSelect"
            membersList: null,            // "#rgReviewMembersList"
            memberCount: null,            // "#rgReviewMemberCount"
            addBtn: null,                 // "#rgReviewAddBtn"

            // yeni grup
            newGroupName: null,           // "#rgReviewNewGroupName"
            createAndAddBtn: null         // "#rgReviewCreateAndAddBtn"
        },
        storage: {
            dontAskPrefix: "rgDontAsk_"
        }
    };

    let reviewCfg = null;
    let reviewBound = false;
    let reviewMyGroupsCache = []; // [{GrupId,GrupAdi,...}]
    let reviewModalInstance = null;
    let reviewModalEventsBound = false;

    function reviewHasEl(sel) {
        try { return !!sel && $(sel).length > 0; } catch { return false; }
    }

    function reviewToken() {
        const formSel = reviewCfg?.selectors?.antiForgeryForm;
        if (formSel && reviewHasEl(formSel)) {
            const v = $(`${formSel} input[name="__RequestVerificationToken"]`).val();
            if (v) return v;
        }
        return antiforgeryToken();
    }

    function reviewGetTc() {
        const s = reviewCfg.selectors;
        let tc = "";

        if (s.tcHidden && reviewHasEl(s.tcHidden)) {
            tc = ($(s.tcHidden).val() || "").toString().trim();
        }
        if ((!tc || tc.length !== 11) && s.hastaTcText && reviewHasEl(s.hastaTcText)) {
            tc = ($(s.hastaTcText).text() || "").toString().trim();
        }

        return tc;
    }

    function reviewGetHastaAdSoyad() {
        const s = reviewCfg.selectors;
        const ad = (s.hastaAdiText && reviewHasEl(s.hastaAdiText)) ? ($(s.hastaAdiText).text() || "").toString().trim() : "";
        const soy = (s.hastaSoyadiText && reviewHasEl(s.hastaSoyadiText)) ? ($(s.hastaSoyadiText).text() || "").toString().trim() : "";
        return `${ad} ${soy}`.trim();
    }

    function reviewStorageKey(tc) {
        return `${reviewCfg.storage.dontAskPrefix}${(tc || "").trim()}`;
    }

    function reviewShouldDontAsk(tc) {
        try {
            const k = reviewStorageKey(tc);
            return localStorage.getItem(k) === "1";
        } catch (e) {
            return false;
        }
    }

    function reviewSetDontAsk(tc, val) {
        try {
            const k = reviewStorageKey(tc);
            if (val) localStorage.setItem(k, "1");
            else localStorage.removeItem(k);
        } catch (e) { }
    }

    function reviewShowOneriBar() {
        const s = reviewCfg.selectors;
        if (s.oneriBar && reviewHasEl(s.oneriBar)) $(s.oneriBar).removeClass("d-none").show();
    }

    function reviewHideOneriBar() {
        const s = reviewCfg.selectors;
        if (s.oneriBar && reviewHasEl(s.oneriBar)) $(s.oneriBar).addClass("d-none").hide();
    }

    /**
     * ✅ Backdrop/grilik temizliği
     * - Flicker olmasın diye SADECE modal tamamen kapandıktan sonra çalıştırıyoruz.
     * - Başka modal açıksa dokunmuyoruz.
     */
    function reviewForceCleanupBackdrop() {
        try {
            if (document.querySelectorAll(".modal.show").length > 0) return;

            document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());

            document.body.classList.remove("modal-open");
            document.body.style.removeProperty("padding-right");
            document.body.style.removeProperty("overflow");
            document.body.style.removeProperty("margin-right");
        } catch (e) { }
    }

    // ✅ Review sayfasında label üret (önce member obj, sonra map, sonra tc)
    function reviewMakeLabel(tc, memberObj) {
        const cleanTc = (tc || "").toString().trim();

        const nameFromMember =
            (memberObj?.HastaAdSoyad || memberObj?.hastaAdSoyad ||
                memberObj?.AdSoyad || memberObj?.adSoyad ||
                memberObj?.Name || memberObj?.name ||
                memberObj?.HastaAdiSoyadi || memberObj?.hastaAdiSoyadi || "").toString().trim();

        if (nameFromMember && cleanTc.length === 11) return `${nameFromMember} (${cleanTc})`;

        // doktorHastaMap yoksa patlamasın
        try {
            const map = (typeof doktorHastaMap !== "undefined") ? doktorHastaMap : null;
            const mapText = map && typeof map.get === "function" ? map.get(cleanTc) : null;
            if (mapText) return mapText;
        } catch (e) { }

        return cleanTc || "—";
    }

    // ✅ EKLENDİ: Review view kendi endpoint'i ile doktorHastaMap doldurur
    async function reviewLoadDoktorPatients(take = 500) {
        try {
            const ep = reviewCfg?.endpoints?.myPatients;
            if (!ep) return;

            const res = await fetch(`${ep}?take=${encodeURIComponent(take)}`, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });
            const json = await res.json();

            if (!json?.success) {
                console.warn("Review MyPatients başarısız:", json);
                doktorHastaCache = [];
                doktorHastaMap = new Map();
                return;
            }

            const list = Array.isArray(json.data) ? json.data : [];
            const normalized = list
                .map(normalizePatientItem)
                .filter(x => x.tc && x.tc.length === 11);

            doktorHastaCache = normalized;
            doktorHastaMap = new Map();
            normalized.forEach(x => doktorHastaMap.set(x.tc, x.text));

        } catch (e) {
            console.warn("reviewLoadDoktorPatients hata:", e);
            doktorHastaCache = [];
            doktorHastaMap = new Map();
        }
    }

    async function reviewFetchMyGroups() {
        try {
            const res = await fetch(reviewCfg.endpoints.myGroups, { method: "GET", headers: { "Accept": "application/json" } });
            const json = await res.json();
            if (!json?.success) return [];
            return Array.isArray(json.data) ? json.data : [];
        } catch (e) {
            console.warn("MyGroups hata:", e);
            return [];
        }
    }

    async function reviewFetchGroupMembers(grupId) {
        try {
            const res = await fetch(`${reviewCfg.endpoints.members}?grupId=${encodeURIComponent(grupId)}`, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });
            const json = await res.json();
            if (!json?.success) return [];
            return Array.isArray(json.data) ? json.data : [];
        } catch (e) {
            console.warn("Members hata:", e);
            return [];
        }
    }

    async function reviewCreateGroup(grupAdi) {
        const body = new URLSearchParams();
        body.set("grupAdi", (grupAdi || "").toString().trim());

        const res = await fetch(reviewCfg.endpoints.createGroup, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "RequestVerificationToken": reviewToken()
            },
            body: body.toString()
        });

        return await res.json();
    }

    async function reviewAddMembers(grupId, tcList) {
        const body = new URLSearchParams();
        body.set("grupId", String(grupId));

        (tcList || []).forEach(tc => {
            const v = (tc || "").toString().trim();
            if (v) body.append("tcKimlikNos", v);
        });

        const res = await fetch(reviewCfg.endpoints.addMembers, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "RequestVerificationToken": reviewToken()
            },
            body: body.toString()
        });

        return await res.json();
    }

    function reviewEnsureModal() {
        const s = reviewCfg.selectors;
        if (!s.modalId) return null;

        const el = document.getElementById(s.modalId);
        if (!el || !window.bootstrap || !bootstrap.Modal) return null;

        // ✅ mevcut instance varsa onu kullan (çift instance/backdrop önler)
        if (!reviewModalInstance) {
            reviewModalInstance = bootstrap.Modal.getOrCreateInstance(el, {
                backdrop: "static",
                keyboard: false
            });
        }

        // ✅ cleanup event'i sadece 1 kere bağla (flicker yok)
        if (!reviewModalEventsBound) {
            reviewModalEventsBound = true;

            $(el)
                .off("hidden.bs.modal.reviewCleanup")
                .on("hidden.bs.modal.reviewCleanup", function () {
                    reviewForceCleanupBackdrop();
                });
        }

        return reviewModalInstance;
    }

    function reviewRenderMembersList(members) {
        const s = reviewCfg.selectors;
        if (!s.membersList || !reviewHasEl(s.membersList)) return;

        const arr = Array.isArray(members) ? members : [];
        const aktif = arr.filter(x => (x.IsAktif ?? x.isAktif) !== false);

        if (s.memberCount && reviewHasEl(s.memberCount)) {
            $(s.memberCount).text(String(aktif.length));
        }

        if (!aktif.length) {
            $(s.membersList).html(`<div class="text-muted small py-2">(Bu grupta üye yok)</div>`);
            return;
        }

        const items = aktif.map(m => {
            const tc = (m.TcKimlikNo || m.tcKimlikNo || "").toString().trim();
            const label = reviewMakeLabel(tc, m);
            return `<div class="list-group-item py-2">${label}</div>`;
        });

        $(s.membersList).html(`<div class="list-group">${items.join("")}</div>`);
    }

    async function reviewFillGroupsSelect(selectGrupIdAfter = null) {
        const s = reviewCfg.selectors;
        if (!s.groupSelect || !reviewHasEl(s.groupSelect)) return;

        reviewMyGroupsCache = await reviewFetchMyGroups();

        const $sel = $(s.groupSelect);
        const ph = ($sel.find("option:first").text() || "— Grup seç —").trim();

        const parts = [`<option value="">${ph}</option>`];

        reviewMyGroupsCache.forEach(g => {
            const id = (g.GrupId ?? g.grupId);
            const name = (g.GrupAdi ?? g.grupAdi);
            const uyeSayisi = (g.UyeSayisi ?? g.uyeSayisi ?? 0);
            const label = uyeSayisi > 0 ? `${name} (${uyeSayisi})` : `${name}`;
            parts.push(`<option value="${id}">${label}</option>`);
        });

        $sel.html(parts.join(""));

        if (selectGrupIdAfter) {
            $sel.val(String(selectGrupIdAfter));
        } else {
            const first = reviewMyGroupsCache[0];
            const firstId = first ? (first.GrupId ?? first.grupId) : "";
            if (firstId) $sel.val(String(firstId));
        }

        $sel.trigger("change");
    }

    async function reviewOpenModal() {
        const s = reviewCfg.selectors;
        const tc = reviewGetTc();

        if (!tc || tc.length !== 11) {
            if (window.Swal) {
                Swal.fire({ icon: "warning", title: "Uyarı", text: "Geçerli bir TC bulunamadı.", confirmButtonColor: "#012F51" });
            }
            return;
        }

        // ✅ map boşsa (ve init'te dolmadıysa) burada da doldur (bozmadan ek güvence)
        try {
            const mapOk = (typeof doktorHastaMap !== "undefined" && doktorHastaMap && typeof doktorHastaMap.size === "number");
            if (!mapOk || doktorHastaMap.size === 0) {
                await reviewLoadDoktorPatients(500);
            }
        } catch (e) { }

        // modal alanlarını doldur
        if (s.modalHastaTc && reviewHasEl(s.modalHastaTc)) $(s.modalHastaTc).text(tc);
        if (s.modalHastaName && reviewHasEl(s.modalHastaName)) $(s.modalHastaName).text(reviewGetHastaAdSoyad() || "—");

        // groups doldur
        await reviewFillGroupsSelect(null);

        const mi = reviewEnsureModal();
        if (mi) mi.show();
    }

    async function reviewOnGroupChanged() {
        const s = reviewCfg.selectors;
        if (!s.groupSelect || !reviewHasEl(s.groupSelect)) return;

        const grupId = ($(s.groupSelect).val() || "").toString().trim();
        if (!grupId) {
            reviewRenderMembersList([]);
            if (s.addBtn && reviewHasEl(s.addBtn)) $(s.addBtn).prop("disabled", true);
            return;
        }

        const members = await reviewFetchGroupMembers(grupId);
        reviewRenderMembersList(members);

        // hasta bu grupta mı?
        const tc = reviewGetTc();
        const aktifTcSet = new Set(
            (members || [])
                .filter(x => (x.IsAktif ?? x.isAktif) !== false)
                .map(x => (x.TcKimlikNo || x.tcKimlikNo || "").toString().trim())
                .filter(x => x.length === 11)
        );

        const already = tc && aktifTcSet.has(tc);
        if (s.addBtn && reviewHasEl(s.addBtn)) {
            $(s.addBtn).prop("disabled", !tc || tc.length !== 11 || already);
        }
    }

    async function reviewAddToSelectedGroup() {
        const s = reviewCfg.selectors;
        const tc = reviewGetTc();

        const grupId = (s.groupSelect && reviewHasEl(s.groupSelect)) ? ($(s.groupSelect).val() || "").toString().trim() : "";
        if (!grupId) {
            if (window.Swal) Swal.fire({ icon: "warning", title: "Uyarı", text: "Lütfen bir grup seçin.", confirmButtonColor: "#012F51" });
            return;
        }
        if (!tc || tc.length !== 11) {
            if (window.Swal) Swal.fire({ icon: "warning", title: "Uyarı", text: "Geçerli TC bulunamadı.", confirmButtonColor: "#012F51" });
            return;
        }

        if (s.addBtn && reviewHasEl(s.addBtn)) $(s.addBtn).prop("disabled", true);

        try {
            const result = await reviewAddMembers(grupId, [tc]);

            if (!result?.success) {
                if (window.Swal) {
                    Swal.fire({ icon: "error", title: "Hata", text: result?.message || "Gruba eklenemedi.", confirmButtonColor: "#012F51" });
                }
                return;
            }

            if (window.Swal) {
                Swal.fire({ icon: "success", title: "Başarılı", text: result?.message || "Kişi gruba eklendi.", timer: 1500, showConfirmButton: false });
            }

            // modal içini güncelle
            await reviewOnGroupChanged();

            // ✅ UX: barı kapat (backend flag sadece ilk görünürlük)
            reviewHideOneriBar();

            // modalı kapat
            if (reviewModalInstance) reviewModalInstance.hide();

            // ❌ burada cleanup YOK (flicker sebebi buydu). Cleanup hidden event'inde çalışıyor.

        } catch (e) {
            console.error("review add hata:", e);
            if (window.Swal) Swal.fire({ icon: "error", title: "Hata", text: e?.message || "İşlem sırasında hata oluştu.", confirmButtonColor: "#012F51" });
        } finally {
            await reviewOnGroupChanged();
        }
    }

    async function reviewCreateGroupAndAdd() {
        const s = reviewCfg.selectors;
        const tc = reviewGetTc();
        const name = (s.newGroupName && reviewHasEl(s.newGroupName)) ? ($(s.newGroupName).val() || "").toString().trim() : "";

        if (!name) {
            if (window.Swal) Swal.fire({ icon: "warning", title: "Uyarı", text: "Grup adı zorunlu.", confirmButtonColor: "#012F51" });
            return;
        }
        if (!tc || tc.length !== 11) {
            if (window.Swal) Swal.fire({ icon: "warning", title: "Uyarı", text: "Geçerli TC bulunamadı.", confirmButtonColor: "#012F51" });
            return;
        }

        if (s.createAndAddBtn && reviewHasEl(s.createAndAddBtn)) $(s.createAndAddBtn).prop("disabled", true);

        try {
            const createRes = await reviewCreateGroup(name);
            if (!createRes?.success) {
                if (window.Swal) Swal.fire({ icon: "error", title: "Hata", text: createRes?.message || "Grup oluşturulamadı.", confirmButtonColor: "#012F51" });
                return;
            }

            const newId = createRes?.data?.grupId || createRes?.data?.GrupId;
            if (!newId) {
                if (window.Swal) Swal.fire({ icon: "error", title: "Hata", text: "Grup ID alınamadı.", confirmButtonColor: "#012F51" });
                return;
            }

            const addRes = await reviewAddMembers(newId, [tc]);
            if (!addRes?.success) {
                if (window.Swal) Swal.fire({ icon: "error", title: "Hata", text: addRes?.message || "Kişi gruba eklenemedi.", confirmButtonColor: "#012F51" });
                return;
            }

            if (window.Swal) {
                Swal.fire({ icon: "success", title: "Başarılı", text: addRes?.message || "Grup oluşturuldu ve kişi eklendi.", timer: 1600, showConfirmButton: false });
            }

            // UI: select’i yeni gruba çek + bar kapat
            if (s.newGroupName && reviewHasEl(s.newGroupName)) $(s.newGroupName).val("");
            await reviewFillGroupsSelect(newId);

            reviewHideOneriBar();
            if (reviewModalInstance) reviewModalInstance.hide();

            // ❌ burada cleanup YOK (flicker sebebi). Cleanup hidden event'inde çalışıyor.

        } catch (e) {
            console.error("review create+add hata:", e);
            if (window.Swal) Swal.fire({ icon: "error", title: "Hata", text: e?.message || "İşlem sırasında hata oluştu.", confirmButtonColor: "#012F51" });
        } finally {
            if (s.createAndAddBtn && reviewHasEl(s.createAndAddBtn)) $(s.createAndAddBtn).prop("disabled", false);
        }
    }

    function bindReviewEventsOnce() {
        if (reviewBound) return;
        reviewBound = true;

        const s = reviewCfg.selectors;

        // ✅ Çift tetiklenme/backdrop engeli:
        // HTML’de data-bs-toggle/target varsa, bootstrap data-api de devreye girip 2 kere modal açabiliyor.
        if (s.openModalBtn && reviewHasEl(s.openModalBtn)) {
            try {
                $(s.openModalBtn).removeAttr("data-bs-toggle").removeAttr("data-bs-target");
            } catch (e) { }
        }

        // bar: kapat + dont ask
        if (s.dismissOneriBtn && reviewHasEl(s.dismissOneriBtn)) {
            $(document).off("click.reviewDismiss", s.dismissOneriBtn).on("click.reviewDismiss", s.dismissOneriBtn, function () {
                const tc = reviewGetTc();
                const dontAsk = (s.dontAskAgainCheckbox && reviewHasEl(s.dontAskAgainCheckbox)) ? $(s.dontAskAgainCheckbox).is(":checked") : false;

                if (tc && tc.length === 11 && dontAsk) reviewSetDontAsk(tc, true);

                reviewHideOneriBar();
            });
        }

        // bar: modal aç
        if (s.openModalBtn && reviewHasEl(s.openModalBtn)) {
            $(document).off("click.reviewOpenModal", s.openModalBtn).on("click.reviewOpenModal", s.openModalBtn, function (e) {
                e.preventDefault();
                reviewOpenModal();
            });
        }

        // modal: grup değişince üyeleri çek
        if (s.groupSelect && reviewHasEl(s.groupSelect)) {
            $(document).off("change.reviewGroup", s.groupSelect).on("change.reviewGroup", s.groupSelect, function () {
                reviewOnGroupChanged();
            });
        }

        // modal: ekle
        if (s.addBtn && reviewHasEl(s.addBtn)) {
            $(document).off("click.reviewAdd", s.addBtn).on("click.reviewAdd", s.addBtn, function (e) {
                e.preventDefault();
                reviewAddToSelectedGroup();
            });
        }

        // modal: oluştur + ekle
        if (s.createAndAddBtn && reviewHasEl(s.createAndAddBtn)) {
            $(document).off("click.reviewCreateAdd", s.createAndAddBtn).on("click.reviewCreateAdd", s.createAndAddBtn, function (e) {
                e.preventDefault();
                reviewCreateGroupAndAdd();
            });
        }
    }

    async function initReviewRecept(userReviewConfig) {
        reviewCfg = $.extend(true, {}, REVIEW_DEFAULTS, userReviewConfig || {});
        bindReviewEventsOnce();

        // ✅ Modal instance + hidden event bağlansın (modal açılmasa bile hazır olsun)
        // (Zorunlu değil ama stabil)
        try { reviewEnsureModal(); } catch (e) { }

        // ✅ "Bir daha sorma" set edilmişse backend bar'ı true bile verse burada gizleyebiliriz
        // (membership async yok; sadece local karar)
        try {
            const tc = reviewGetTc();
            if (tc && tc.length === 11 && reviewShouldDontAsk(tc)) {
                reviewHideOneriBar();
            }
        } catch (e) { }

        // ✅ İsim map'ini yükle (diğer view'lerdeki gibi)
        // Önce core init yapılmışsa loadDoktorPatients kullan (cfg'li),
        // değilse review kendi endpoint'i ile map'i doldurur (bozmadan fallback).
        try {
            const mapOk = (typeof doktorHastaMap !== "undefined" && doktorHastaMap && typeof doktorHastaMap.size === "number");
            if (!mapOk || doktorHastaMap.size === 0) {

                const coreCfgOk = (typeof cfg !== "undefined" && cfg && cfg.endpoints && cfg.endpoints.myPatients);
                if (coreCfgOk && typeof loadDoktorPatients === "function") {
                    await loadDoktorPatients(500);
                } else {
                    await reviewLoadDoktorPatients(500);
                }
            }
        } catch (e) {
            console.warn("Review: patients yükleme atlandı:", e);
        }

        // ✅ Bar görünürlüğüne dokunma:
        // backend flag ne verdiyse o. (membership async yok)
    }

    // ======================================================
    // ✅ EXPORT (reviewRefreshMembership kaldırıldı)
    // ======================================================
    window.receteGruplariClient = {
        init,
        reloadGroups: loadGruplar,
        reloadMembers: loadGrupUyeleri,

        // ✅ ReviewRecept API
        initReviewRecept
    };

})(window, window.jQuery);
