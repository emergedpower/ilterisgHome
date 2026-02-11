// wwwroot/js/ek2GruplariClient.js
(function (window, $) {
    "use strict";

    const DEFAULTS = {
        endpoints: {
            myGroups: "/Ek2Gruplari/My",
            createGroup: "/Ek2Gruplari/Create",
            members: "/Ek2Gruplari/Members",

            addMember: "/Ek2Gruplari/AddMember",
            lookupPerson: "/Ek2Gruplari/LookupPersonByTc",

            addMembers: "/Ek2Gruplari/AddMembers",
            removeMembers: "/Ek2Gruplari/RemoveMembers",
            deleteGroup: "/Ek2Gruplari/DeleteGroup",

            // ✅ EK2 oluştur (TC ile) - eski (tekil GET) (geri uyumluluk)
            ek2CreateByTc: "/Iyh/Ek2OlusturByTc",

            // ✅ EK2 toplu oluştur (JSON POST) - yeni akış
            ek2CreateByTcBulk: "/Iyh/Ek2OlusturByTcBulk",

            // ✅ EK2 Grup Detay
            detail: "/Ek2Gruplari/Detail",
            setDetail: "/Ek2Gruplari/SetDetail",

            // ✅ Üye açıklama set et (sen ekledin)
            setMembersNote: "/Ek2Gruplari/SetMembersNote"
        },
        selectors: {
            grupSelect: "#ek2GrupSelect",
            btnGrupEkle: "#btnEk2GrupEkle",
            btnGrupSil: "#btnEk2GrupSil",
            btnUyeEkle: "#btnEk2UyeEkle",
            btnUyelerGoster: "#btnEk2UyelerGoster",
            btnUyeCikar: "#btnEk2UyeCikar",

            uyeListesi: "#ek2UyeListesi",
            uyeCount: "#ek2UyeCount",

            grupEkleModal: "ek2GrupEkleModal",
            grupAdiInput: "#ek2GrupAdiInput",
            confirmGrupEkleBtn: "#ek2ConfirmGrupEkleBtn",
            grupAdiValidation: "#ek2GrupAdiValidation",

            uyeEkleModal: "ek2UyeEkleModal",
            uyeTcInput: "#ek2UyeTcInput",
            kisiBulunduHidden: "#ek2UyeKisiBulundu",
            kisiReadonlyBadge: "#ek2KisiReadonlyBadge",
            tcLookupStatus: "#ek2TcLookupStatus",
            uyeAdi: "#ek2UyeAdi",
            uyeSoyadi: "#ek2UyeSoyadi",
            uyeCinsiyet: "#ek2UyeCinsiyet",
            uyeDogumTarihi: "#ek2UyeDogumTarihi",
            confirmUyeEkleBtn: "#ek2ConfirmUyeEkleBtn",

            antiForgeryForm: "#ek2AfForm",

            // ✅ (opsiyonel) Grup Detay Modal selectorları (view’de kullanırsan)
            grupDetayModal: "ek2GrupDetayModal",
            grupDetayGrupAdiInput: "#ek2DetayGrupAdi",
            grupDetaySgkSicilNo: "#ek2DetaySgkSicilNo",
            grupDetayFirmaAdresi: "#ek2DetayFirmaAdresi",
            grupDetayTelefonFaks: "#ek2DetayTelefonFaks",
            grupDetayEPosta: "#ek2DetayEPosta",
            grupDetayKaydetBtn: "#ek2DetayKaydetBtn",

            // ✅ Yeni: Tab + Açıklama butonu (view’e eklenecek)
            memberTabs: "#ek2MemberTabs",
            btnAciklama: "#btnEk2Aciklama"
        },
        hooks: {
            toastSuccess: (msg) => window.Swal
                ? Swal.fire({ icon: "success", title: "Başarılı", text: msg, timer: 1500, showConfirmButton: false })
                : alert(msg),
            toastError: (msg) => window.Swal
                ? Swal.fire({ icon: "error", title: "Hata", text: msg })
                : alert(msg),
            confirm: async (title, text) => {
                if (window.Swal) {
                    const r = await Swal.fire({
                        icon: "warning",
                        title: title || "Emin misiniz?",
                        text: text || "",
                        showCancelButton: true,
                        confirmButtonText: "Evet",
                        cancelButtonText: "Vazgeç"
                    });
                    return !!r.isConfirmed;
                }
                return confirm((title ? (title + "\n") : "") + (text || ""));
            }
        }
    };

    let cfg = null;
    let inited = false;

    let selectedFirmaId = null;
    let grupCache = [];
    let seciliGrupUyeSet = new Set();

    // ✅ Çoklu seçim
    let selectedMemberTcs = new Set();

    // uye modal state
    let lastLookupTc = null;
    let lookupTimer = null;

    // ✅ flicker fix state
    let lookupSeq = 0;
    let activeLookupAbort = null;
    let pendingStatusTimer = null;
    let prevTcLen = 0;

    // ✅ Yeni: Tab state + cache
    let memberTab = "active";     // "active" | "inactive"
    let lastMembersAll = [];      // includeInactive=true ile gelen tüm liste

    function S(key) { return cfg.selectors[key]; }

    function token() {
        const $t = $(`${cfg.selectors.antiForgeryForm} input[name="__RequestVerificationToken"]`);
        if ($t.length) return $t.val();
        return $('input[name="__RequestVerificationToken"]').first().val();
    }

    function setEnabled(sel, enabled) {
        try { $(sel).prop("disabled", !enabled); } catch { }
    }

    function normalizeGroupId(g) {
        return g?.ek2GrupId ?? g?.Ek2GrupId ?? g?.grupId ?? g?.GrupId ?? g?.id ?? g?.Id;
    }

    function normalizeGroupName(g) {
        return g?.grupAdi ?? g?.GrupAdi ?? g?.name ?? g?.Name;
    }

    function getSelectedGroupId() {
        return ($(S("grupSelect")).val() || "").toString().trim();
    }

    function sanitizeTc(val) {
        return (val || "").replace(/\D/g, "").slice(0, 11);
    }

    function normalizeGenderCode(val) {
        const v = (val ?? "").toString().trim().toLowerCase();
        if (!v) return "";
        if (v === "e" || v === "erkek" || v === "male" || v === "m") return "E";
        if (v === "k" || v === "kadın" || v === "kadin" || v === "female" || v === "f") return "K";
        return "";
    }

    function setReadonlyFields(isReadonly) {
        try { $(S("kisiReadonlyBadge")).toggle(!!isReadonly); } catch { }
        $(S("uyeAdi")).prop("readonly", !!isReadonly);
        $(S("uyeSoyadi")).prop("readonly", !!isReadonly);
        $(S("uyeDogumTarihi")).prop("readonly", !!isReadonly);
        $(S("uyeCinsiyet")).prop("disabled", !!isReadonly);
    }

    function clearPendingStatusTimer() {
        if (pendingStatusTimer) clearTimeout(pendingStatusTimer);
        pendingStatusTimer = null;
    }

    function setStatus(msg) {
        const $el = $(S("tcLookupStatus"));
        if ($el.length) $el.text(msg || "");
    }

    function cancelActiveLookup() {
        try { activeLookupAbort?.abort(); } catch { }
        activeLookupAbort = null;
        clearPendingStatusTimer();
    }

    function clearMemberForm({ keepStatus = false } = {}) {
        cancelActiveLookup();
        lookupSeq++;

        $(S("kisiBulunduHidden")).val("0");
        $(S("uyeAdi")).val("");
        $(S("uyeSoyadi")).val("");
        $(S("uyeCinsiyet")).val("");
        $(S("uyeDogumTarihi")).val("");
        if (!keepStatus) setStatus("");

        setReadonlyFields(true);
        lastLookupTc = null;
        $(S("confirmUyeEkleBtn")).prop("disabled", true);
    }

    // ✅ Yeni: date format helper (Sonlandırma Tarihi)
    function formatTRDate(val) {
        if (!val) return "";
        try {
            const d = new Date(val);
            if (isNaN(d.getTime())) return "";
            return d.toLocaleString("tr-TR");
        } catch { return ""; }
    }

    // ✅ Yeni: tab filtresi
    function filterMembersByTab(list) {
        const arr = Array.isArray(list) ? list : [];
        if (memberTab === "inactive") return arr.filter(x => (x.isAktif ?? x.IsAktif) === false);
        return arr.filter(x => (x.isAktif ?? x.IsAktif) !== false);
    }

    // ✅ Yeni: açıklama butonu state
    function updateNoteButtonState() {
        const $btn = $(S("btnAciklama"));
        if (!$btn.length) return;

        const gid = getSelectedGroupId();
        const can = !!gid && memberTab !== "inactive" && selectedMemberTcs.size > 0;
        $btn.prop("disabled", !can);
    }

    // ---------------------------
    // ✅ Detay/Set için güvenli JSON okuma (login html / 400 vs yakalar)
    // ---------------------------
    async function readJsonSafe(res) {
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        const text = await res.text();

        if (!ct.includes("application/json")) {
            return {
                success: false,
                message: `JSON değil (${res.status}). Content-Type: ${ct || "-"}${text ? ` | İlk 200: ${text.slice(0, 200)}` : ""}`
            };
        }

        try { return JSON.parse(text); }
        catch {
            return { success: false, message: `JSON parse edilemedi (${res.status}).`, raw: text.slice(0, 200) };
        }
    }

    // ---------------------------
    // ✅ EK2 Grup Detay API
    // ---------------------------

    async function getGroupDetail(grupId) {
        if (!grupId) return { success: false, message: "grupId yok" };

        try {
            const res = await fetch(`${cfg.endpoints.detail}?grupId=${encodeURIComponent(grupId)}`, {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "same-origin"
            });

            const json = await readJsonSafe(res);
            if (!res.ok) return json || { success: false, message: `HTTP ${res.status}` };
            return json || { success: false, message: "İşlem başarısız." };
        } catch (e) {
            return { success: false, message: "Detay alınamadı." };
        }
    }

    // payload: { grupAdi?, sgkSicilNo?, firmaAdresi?, telefonFaks?, ePosta? }
    // - sadece gönderdiğin alanlar update olur (partial update)
    // - alanı null yapmak için "" gönderebilirsin
    async function setGroupDetail(grupId, payload) {
        if (!grupId) return { success: false, message: "grupId yok" };

        const t = token();
        if (!t) return { success: false, message: "Anti-forgery token bulunamadı." };

        payload = payload || {};

        const body = new URLSearchParams();
        body.set("grupId", String(grupId));

        // ✅ grup adı güncelleme desteği
        if (Object.prototype.hasOwnProperty.call(payload, "grupAdi")) {
            const name = (payload.grupAdi ?? "").toString().trim();
            // ✅ boşsa hiç gönderme (rename gibi algılanmasın)
            if (name.length > 0) body.set("grupAdi", name);
        }

        if (Object.prototype.hasOwnProperty.call(payload, "sgkSicilNo"))
            body.set("sgkSicilNo", payload.sgkSicilNo ?? "");

        if (Object.prototype.hasOwnProperty.call(payload, "firmaAdresi"))
            body.set("firmaAdresi", payload.firmaAdresi ?? "");

        if (Object.prototype.hasOwnProperty.call(payload, "telefonFaks"))
            body.set("telefonFaks", payload.telefonFaks ?? "");

        if (Object.prototype.hasOwnProperty.call(payload, "ePosta"))
            body.set("ePosta", payload.ePosta ?? "");

        try {
            const res = await fetch(cfg.endpoints.setDetail, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Accept": "application/json",
                    "RequestVerificationToken": t
                },
                credentials: "same-origin",
                body: body.toString()
            });

            const json = await readJsonSafe(res);

            if (!res.ok) {
                try { console.warn("SetDetail HTTP fail:", res.status, json); } catch { }
                return json || { success: false, message: `HTTP ${res.status}` };
            }

            return json || { success: false, message: "İşlem başarısız." };
        } catch (e) {
            return { success: false, message: "Kaydetme isteği gönderilemedi." };
        }
    }

    // ---------------------------
    // ✅ Üye seçim eventleri
    // ---------------------------

    function emitSelectionChanged() {
        const items = [];
        try {
            const $list = $(S("uyeListesi"));
            selectedMemberTcs.forEach(tc => {
                const $el = $list.find(`.ek2-member-item[data-tc="${tc}"]`);
                const text = ($el.data("text") || tc || "").toString();
                items.push({ tc, text });
            });
        } catch { }

        try {
            $(document).trigger("ek2:memberSelectionChanged", {
                tcs: Array.from(selectedMemberTcs),
                items: items
            });
        } catch { }
    }

    function clearMemberSelection() {
        selectedMemberTcs = new Set();
        try { $(S("uyeListesi")).find(".ek2-member-item").removeClass("active"); } catch { }
        emitSelectionChanged();
        updateRemoveButtonState();
        updateNoteButtonState();
    }

    function updateRemoveButtonState() {
        const gid = getSelectedGroupId();
        // ✅ Ayrılanlar tabında çıkarma kapalı
        const canRemove = !!gid && memberTab !== "inactive" && selectedMemberTcs.size > 0;
        if ($(S("btnUyeCikar")).length) setEnabled(S("btnUyeCikar"), canRemove);
    }

    // ---------------------------
    // ✅ Üye liste render (çoklu seçim)
    // ---------------------------

    function renderMembers(list) {
        const $list = $(S("uyeListesi"));
        const $count = $(S("uyeCount"));

        if (!$list.length) return;

        const arr = Array.isArray(list) ? list : [];

        // ✅ Tab'a göre sayıyı göster
        if ($count.length) $count.text(arr.length);

        // seçim sıfırla
        selectedMemberTcs = new Set();
        emitSelectionChanged();
        updateRemoveButtonState();
        updateNoteButtonState();

        if (arr.length === 0) {
            $list.html(`
                <div class="text-muted small py-2 text-center">
                    ${memberTab === "inactive" ? "Ayrılan üye yok." : "Bu grupta aktif üye yok."}
                </div>
            `);
            return;
        }

        const isInactiveTab = (memberTab === "inactive");

        const html = arr.map(m => {
            const tc = (m.tcKimlikNo ?? m.TcKimlikNo ?? "").toString().trim();
            const kisiAdi = (m.kisiAdi ?? m.KisiAdi ?? "").toString().trim();
            const title = kisiAdi ? kisiAdi : `TC: ${tc}`;
            const aktif = (m.isAktif ?? m.IsAktif) !== false;

            const son = m.sonlandirmaTarihi ?? m.SonlandirmaTarihi;
            const sonTxt = (!aktif && son) ? formatTRDate(son) : "";

            const note = (m.aciklama ?? m.Aciklama ?? "").toString().trim();

            // ✅ Ayrılanlar tabında seçilemesin
            const disabledClick = isInactiveTab || !aktif;

            const badgeClass = aktif ? "bg-success" : "bg-danger";
            const badgeText = aktif ? "Aktif" : "Çıktı";

            return `
                <div class="list-group-item ek2-member-item d-flex justify-content-between align-items-center ${aktif ? "" : "opacity-50"} ${disabledClick ? "ek2-member-item-disabled" : ""}"
                     data-tc="${tc}" data-text="${title}">
                    <div class="d-flex flex-column">
                        <span class="fw-semibold">${title}</span>
                        ${kisiAdi ? `<small class="text-muted">TC: ${tc}</small>` : ``}
                        ${(!aktif && sonTxt) ? `<small class="text-muted">Çıkış: ${sonTxt}</small>` : ``}
                        ${(note) ? `<small class="text-muted">Açıklama: ${$('<div/>').text(note).html()}</small>` : ``}
                    </div>
                    <span class="badge ${badgeClass}">${badgeText}</span>
                </div>
            `;
        }).join("");

        $list.html(html);

        $list.off("click.ek2member").on("click.ek2member", ".ek2-member-item", function () {
            // ✅ Ayrılanlar tabında seçim yok
            if (memberTab === "inactive") return;

            // ✅ pasif satır seçilemesin
            if ($(this).hasClass("opacity-50") || $(this).hasClass("ek2-member-item-disabled")) return;

            const tc = ($(this).data("tc") || "").toString().trim();
            if (!tc || tc.length !== 11) return;

            if (selectedMemberTcs.has(tc)) {
                selectedMemberTcs.delete(tc);
                $(this).removeClass("active");
            } else {
                selectedMemberTcs.add(tc);
                $(this).addClass("active");
            }

            emitSelectionChanged();
            updateRemoveButtonState();
            updateNoteButtonState();
        });
    }

    // ---------------------------
    // ✅ API calls
    // ---------------------------

    async function loadGroups(selectAfter = null) {
        try {
            const res = await fetch(cfg.endpoints.myGroups, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });

            const json = await res.json();

            if (!json?.success) {
                grupCache = [];
                $(S("grupSelect")).html(`<option value="">— Grup yok —</option>`);
                setEnabled(S("btnGrupEkle"), true);
                setEnabled(S("btnGrupSil"), false);
                setEnabled(S("btnUyeEkle"), false);
                setEnabled(S("btnUyelerGoster"), false);
                setEnabled(S("btnUyeCikar"), false);

                renderMembers([]);
                const $count = $(S("uyeCount"));
                if ($count.length) $count.text("0");
                return;
            }

            grupCache = Array.isArray(json.data) ? json.data : [];

            const $sel = $(S("grupSelect"));
            const ph = ($sel.find("option:first").text() || "— Grup Seç —").trim();
            const parts = [`<option value="">${ph}</option>`];

            grupCache.forEach(g => {
                const id = normalizeGroupId(g);
                const name = normalizeGroupName(g);
                const uyeSayisi = g?.uyeSayisi ?? g?.UyeSayisi ?? 0;
                if (!id) return;
                parts.push(`<option value="${id}">${uyeSayisi ? `${name} (${uyeSayisi})` : name}</option>`);
            });

            $sel.html(parts.join(""));
            setEnabled(S("btnGrupEkle"), true);

            if (selectAfter) $sel.val(String(selectAfter)).trigger("change");

        } catch (e) {
            cfg.hooks.toastError("Gruplar yüklenemedi.");
        }
    }

    async function loadMembers(grupId) {
        seciliGrupUyeSet = new Set();
        clearMemberSelection();

        const hasGroup = !!grupId;

        setEnabled(S("btnGrupSil"), hasGroup);
        setEnabled(S("btnUyeEkle"), hasGroup);
        setEnabled(S("btnUyelerGoster"), hasGroup);
        setEnabled(S("btnUyeCikar"), false);

        if (!hasGroup) {
            lastMembersAll = [];
            renderMembers([]);
            const $count = $(S("uyeCount"));
            if ($count.length) $count.text("0");
            return;
        }

        let activeList = [];

        try {
            // ✅ Artık her zaman pasifler de gelsin
            const res = await fetch(`${cfg.endpoints.members}?grupId=${encodeURIComponent(grupId)}&includeInactive=true`, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });

            const json = await res.json();

            if (!json?.success) {
                lastMembersAll = [];
                renderMembers([]);
                const $count = $(S("uyeCount"));
                if ($count.length) $count.text("0");

                requestAnimationFrame(() => {
                    $(document).trigger("ek2:membersRendered", { grupId: String(grupId) });
                });
                return;
            }

            const list = Array.isArray(json.data) ? json.data : [];
            lastMembersAll = list;

            activeList = list.filter(x => (x.isAktif ?? x.IsAktif) !== false);

            activeList
                .map(x => (x.tcKimlikNo ?? x.TcKimlikNo ?? "").toString().trim())
                .filter(tc => tc.length === 11)
                .forEach(tc => seciliGrupUyeSet.add(tc));

            // ✅ Tab filtresi ile render
            renderMembers(filterMembersByTab(list));

            requestAnimationFrame(() => {
                $(document).trigger("ek2:membersRendered", { grupId: String(grupId) });
            });

        } catch (e) {
            cfg.hooks.toastError("Grup üyeleri yüklenemedi.");
            lastMembersAll = [];
            renderMembers([]);

            const $count = $(S("uyeCount"));
            if ($count.length) $count.text("0");

            requestAnimationFrame(() => {
                $(document).trigger("ek2:membersRendered", { grupId: String(grupId) });
            });
        }
    }

    async function createGroup(grupAdi) {
        const body = new URLSearchParams();
        body.set("grupAdi", grupAdi);
        if (selectedFirmaId) body.set("refFirmaId", String(selectedFirmaId));

        const res = await fetch(cfg.endpoints.createGroup, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "RequestVerificationToken": token()
            },
            body: body.toString()
        });
        return await res.json();
    }

    async function deleteGroup(grupId) {
        const body = new URLSearchParams();
        body.set("grupId", String(grupId));

        const res = await fetch(cfg.endpoints.deleteGroup, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "RequestVerificationToken": token()
            },
            body: body.toString()
        });
        return await res.json();
    }

    async function removeMembersFromGroup(grupId, tcList) {
        const body = new URLSearchParams();
        body.set("grupId", String(grupId));
        (tcList || []).forEach(tc => body.append("tcKimlikNos", String(tc)));

        const res = await fetch(cfg.endpoints.removeMembers, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "RequestVerificationToken": token(),
                "Accept": "application/json"
            },
            body: body.toString()
        });

        return await res.json();
    }

    async function createEk2ByTcBulk(firmaId, tcList) {
        const payload = {
            firmaId: firmaId || null,
            tcKimlikNos: Array.isArray(tcList) ? tcList : []
        };

        const res = await fetch(cfg.endpoints.ek2CreateByTcBulk, {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=UTF-8",
                "Accept": "application/json",
                "RequestVerificationToken": token()
            },
            body: JSON.stringify(payload)
        });

        let json = null;
        try { json = await res.json(); } catch { }

        if (!res.ok) return json || { success: false, error: "İşlem başarısız." };
        return json || { success: false, error: "İşlem başarısız." };
    }
    // ✅ Açıklama kaydet (SetMembersNote) - TEKİL
    async function setMembersNote(grupId, tcList, aciklama) {
        const arr = Array.isArray(tcList) ? tcList : [];
        const tcOne = (arr[0] || "").toString().trim();   // ✅ sadece 1 tane

        const body = new URLSearchParams();
        body.set("grupId", String(grupId));
        body.set("tcKimlikNo", tcOne);                    // ✅ action’ın beklediği isim
        body.set("aciklama", (aciklama ?? "").toString());

        const res = await fetch(cfg.endpoints.setMembersNote, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "RequestVerificationToken": token(),
                "Accept": "application/json"
            },
            body: body.toString()
        });

        return await res.json();
    }


    // ✅ Yeni: Açıklama modal aç/kaydet
    async function openNoteModalForSelected() {
        const gid = getSelectedGroupId();
        if (!gid) { cfg.hooks.toastError("Önce grup seçin."); return; }

        if (memberTab === "inactive") {
            cfg.hooks.toastError("Ayrılanlar sekmesinde açıklama düzenlenmez.");
            return;
        }

        const tcs = Array.from(selectedMemberTcs);
        if (!tcs.length) { cfg.hooks.toastError("Önce üye seçin."); return; }

        // seçili üyelerin ortak açıklamasını bul (hepsi aynıysa)
        let common = "";
        try {
            const rows = lastMembersAll.filter(x => tcs.includes(((x.tcKimlikNo ?? x.TcKimlikNo) || "").toString().trim()));
            const notes = rows.map(x => ((x.aciklama ?? x.Aciklama) || "").toString().trim());
            const uniq = Array.from(new Set(notes));
            common = (uniq.length === 1) ? (uniq[0] || "") : "";
        } catch { common = ""; }

        let noteValue = common || "";

        if (window.Swal) {
            const r = await Swal.fire({
                title: "Açıklama",
                input: "textarea",
                inputValue: noteValue,
                inputPlaceholder: "En fazla 250 karakter...",
                showCancelButton: true,
                confirmButtonText: "Kaydet",
                cancelButtonText: "Vazgeç",
                inputAttributes: { maxlength: 250 }
            });
            if (!r.isConfirmed) return;
            noteValue = (r.value || "").toString();
        } else {
            noteValue = prompt("Açıklama (250 karakter):", noteValue || "") ?? "";
        }

        try {
            const r = await setMembersNote(gid, tcs, noteValue);
            if (!r?.success) {
                cfg.hooks.toastError(r?.message || "Açıklama kaydedilemedi.");
                return;
            }
            cfg.hooks.toastSuccess(r?.message || "Açıklama kaydedildi.");
            await loadMembers(gid);
        } catch (e) {
            cfg.hooks.toastError("İşlem başarısız.");
        }
    }

    // ---------------------------
    // ✅ TC lookup (flicker azaltıldı)
    // ---------------------------

    async function lookupByTc(tc11) {
        if (!tc11 || tc11.length !== 11) return;

        const alreadyInGroup = seciliGrupUyeSet.has(tc11);

        cancelActiveLookup();
        activeLookupAbort = new AbortController();
        const mySeq = ++lookupSeq;

        clearPendingStatusTimer();
        pendingStatusTimer = setTimeout(() => {
            if (mySeq === lookupSeq) setStatus("Sorgulanıyor...");
        }, 150);

        try {
            const res = await fetch(`${cfg.endpoints.lookupPerson}?tcKimlikNo=${encodeURIComponent(tc11)}`, {
                method: "GET",
                headers: { "Accept": "application/json" },
                signal: activeLookupAbort.signal
            });
            const json = await res.json();

            if (mySeq !== lookupSeq) return;

            clearPendingStatusTimer();

            if (!json?.success) {
                $(S("kisiBulunduHidden")).val("0");
                setReadonlyFields(false);

                if (alreadyInGroup) {
                    setStatus("Bu kişi zaten grupta.");
                    $(S("confirmUyeEkleBtn")).prop("disabled", true);
                } else {
                    setStatus(json?.message || "Kayıt bulunamadı, bilgileri girin.");
                    $(S("confirmUyeEkleBtn")).prop("disabled", false);
                }
                return;
            }

            const d = json.data || {};
            if (d.exists) {
                $(S("kisiBulunduHidden")).val("1");
                $(S("uyeAdi")).val(d.adi || "");
                $(S("uyeSoyadi")).val(d.soyadi || "");
                $(S("uyeCinsiyet")).val(normalizeGenderCode(d.cinsiyeti) || "");
                $(S("uyeDogumTarihi")).val(d.dogumTarihi || "");
                setReadonlyFields(true);

                if (alreadyInGroup) {
                    setStatus("Bu kişi zaten grupta.");
                    $(S("confirmUyeEkleBtn")).prop("disabled", true);
                } else {
                    setStatus("Kişi bulundu.");
                    $(S("confirmUyeEkleBtn")).prop("disabled", false);
                }
            } else {
                $(S("kisiBulunduHidden")).val("0");
                setReadonlyFields(false);

                if (alreadyInGroup) {
                    setStatus("Bu kişi zaten grupta.");
                    $(S("confirmUyeEkleBtn")).prop("disabled", true);
                } else {
                    setStatus("Kayıt bulunamadı, bilgileri girin.");
                    $(S("confirmUyeEkleBtn")).prop("disabled", false);
                }
            }
        } catch (e) {
            if (e?.name === "AbortError") return;
            if (mySeq !== lookupSeq) return;

            clearPendingStatusTimer();
            $(S("kisiBulunduHidden")).val("0");
            setReadonlyFields(false);

            if (alreadyInGroup) {
                setStatus("Bu kişi zaten grupta.");
                $(S("confirmUyeEkleBtn")).prop("disabled", true);
            } else {
                setStatus("Sorgu başarısız, bilgileri girin.");
                $(S("confirmUyeEkleBtn")).prop("disabled", false);
            }
        }
    }

    async function addMemberToGroup(grupId, tc11, formData) {
        const body = new URLSearchParams();
        body.set("grupId", String(grupId));
        body.set("tcKimlikNo", tc11);

        if (formData) {
            if (formData.adi) body.set("adi", formData.adi);
            if (formData.soyadi) body.set("soyadi", formData.soyadi);
            if (formData.cinsiyeti) body.set("cinsiyeti", formData.cinsiyeti);
            if (formData.dogumTarihi) body.set("dogumTarihi", formData.dogumTarihi);
        }

        const res = await fetch(cfg.endpoints.addMember, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "RequestVerificationToken": token()
            },
            body: body.toString()
        });

        return await res.json();
    }

    // ---------------------------
    // ✅ Modal & UI bind
    // ---------------------------

    function bindMemberModalEvents() {
        const modalEl = document.getElementById(cfg.selectors.uyeEkleModal);
        if (modalEl) {
            modalEl.addEventListener("show.bs.modal", function () {
                prevTcLen = 0;
                clearMemberForm();
                $(S("uyeTcInput")).val("").focus();
            });

            modalEl.addEventListener("hidden.bs.modal", function () {
                cancelActiveLookup();
                lookupSeq++;
                clearPendingStatusTimer();
            });
        }

        $(S("uyeTcInput")).off("input.ek2").on("input.ek2", function () {
            const clean = sanitizeTc($(this).val());
            $(this).val(clean);

            clearTimeout(lookupTimer);
            cancelActiveLookup();
            lookupSeq++;

            if (clean.length !== 11) {
                if (prevTcLen === 11) {
                    clearMemberForm({ keepStatus: false });
                }
                prevTcLen = clean.length;
                $(S("confirmUyeEkleBtn")).prop("disabled", true);
                if (clean.length === 0) setStatus("");
                return;
            }

            prevTcLen = clean.length;

            if (lastLookupTc === clean) return;
            lastLookupTc = clean;

            $(S("confirmUyeEkleBtn")).prop("disabled", true);
            lookupTimer = setTimeout(() => lookupByTc(clean), 250);
        });

        $(S("confirmUyeEkleBtn")).off("click.ek2").on("click.ek2", async function () {
            const grupId = getSelectedGroupId();
            if (!grupId) { cfg.hooks.toastError("Önce grup seçin."); return; }

            const tc11 = sanitizeTc($(S("uyeTcInput")).val());
            if (tc11.length !== 11) { cfg.hooks.toastError("TC 11 haneli olmalı."); return; }

            if (seciliGrupUyeSet.has(tc11)) {
                cfg.hooks.toastError("Bu kişi zaten grupta.");
                $(this).prop("disabled", true);
                return;
            }

            const kisiVar = $(S("kisiBulunduHidden")).val() === "1";

            const payload = {
                adi: ($(S("uyeAdi")).val() || "").toString().trim(),
                soyadi: ($(S("uyeSoyadi")).val() || "").toString().trim(),
                cinsiyeti: normalizeGenderCode($(S("uyeCinsiyet")).val()),
                dogumTarihi: ($(S("uyeDogumTarihi")).val() || "").toString().trim()
            };

            if (!kisiVar) {
                if (!payload.adi || !payload.soyadi || !payload.cinsiyeti || !payload.dogumTarihi) {
                    cfg.hooks.toastError("Kişi yok. Ad, Soyad, Cinsiyet, Doğum Tarihi zorunlu.");
                    return;
                }
            }

            $(this).prop("disabled", true);

            try {
                const r = await addMemberToGroup(grupId, tc11, payload);
                if (!r?.success) {
                    cfg.hooks.toastError(r?.message || "Üye eklenemedi.");
                    $(this).prop("disabled", false);
                    return;
                }

                cfg.hooks.toastSuccess(r?.message || "Üye eklendi.");

                try { bootstrap.Modal.getInstance(document.getElementById(cfg.selectors.uyeEkleModal))?.hide(); } catch { }
                await loadMembers(grupId);
            } catch (e) {
                cfg.hooks.toastError("İşlem başarısız.");
                $(this).prop("disabled", false);
            }
        });
    }

    // ---------------------------
    // ✅ EK2 sonuç popup (Firma satırı YOK)
    // ---------------------------

    async function showEk2ResultPopup(results) {
        const arr = Array.isArray(results) ? results : [];
        const ok = arr.filter(x => x && x.success).length;
        const fail = arr.filter(x => x && x.success === false).length;
        const total = ok + fail;

        const failItems = arr
            .filter(x => x && x.success === false)
            .map(x => ({
                tc: (x.tcKimlikNo || "").toString(),
                error: (x.error || x.message || "Hata").toString()
            }));

        if (total === 1 && ok === 1) {
            if (window.Swal) {
                await Swal.fire({
                    icon: "success",
                    title: "Başarılı",
                    text: "EK-2 başarıyla oluşturuldu.",
                    confirmButtonText: "Tamam"
                });
            } else {
                alert("EK-2 başarıyla oluşturuldu.");
            }
            return;
        }

        if (total === 1 && fail === 1) {
            const err = failItems[0]?.error || "EK-2 oluşturulamadı.";
            if (window.Swal) {
                await Swal.fire({
                    icon: "error",
                    title: "Oluşturulamadı",
                    text: err,
                    confirmButtonText: "Tamam"
                });
            } else {
                alert(`Oluşturulamadı\n${err}`);
            }
            return;
        }

        let headline = "";
        if (ok > 0 && fail === 0) headline = `Seçilen ${total} kişi için EK-2 başarıyla oluşturuldu.`;
        else if (ok > 0 && fail > 0) headline = `Bazı EK-2 talepleri oluşturuldu, bazıları oluşturulamadı.`;
        else headline = `EK-2 talepleri oluşturulamadı.`;

        const statBox = (label, value) => `
        <div style="
            width:100%;
            max-width:320px;
            border:1px solid rgba(0,0,0,.08);
            border-radius:12px;
            padding:10px 12px;
            display:flex;
            justify-content:center;
            align-items:center;
            gap:8px;
            font-size:15px;
        ">
            <span style="opacity:.85">${label}</span>
            <b style="font-size:16px">${value}</b>
        </div>
    `;

        let html = `
      <div style="text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px;">
        <div style="font-size:14px; opacity:.9;">${headline}</div>

        <div style="display:flex; flex-direction:column; align-items:center; gap:8px; width:100%; margin-top:6px;">
          ${ok > 0 ? statBox("Başarılı", ok) : ""}
          ${fail > 0 ? statBox("Başarısız", fail) : ""}
        </div>
    `;

        if (failItems.length) {
            html += `
        <div style="width:100%; max-width:420px; margin-top:10px; text-align:left;">
          <div style="font-weight:600; margin-bottom:6px;">Hatalar</div>
          <div style="max-height:220px; overflow:auto; border:1px solid rgba(0,0,0,.08); border-radius:12px; padding:10px 12px;">
            <ul style="padding-left:18px; margin:0;">
              ${failItems.map(x => `<li style="margin:4px 0;"><b>${x.tc}</b>: ${x.error}</li>`).join("")}
            </ul>
          </div>
        </div>
        `;
        }

        html += `</div>`;

        if (window.Swal) {
            await Swal.fire({
                icon: (fail === 0 && ok > 0) ? "success" : (ok > 0 ? "warning" : "error"),
                title: "EK-2 Oluşturma Sonucu",
                html: html,
                confirmButtonText: "Tamam",
                width: 520
            });
        } else {
            let msg = `EK-2 Oluşturma Sonucu\n${headline}\n`;
            if (ok > 0) msg += `Başarılı: ${ok}\n`;
            if (fail > 0) msg += `Başarısız: ${fail}\n`;
            if (failItems.length) msg += `\nHatalar:\n` + failItems.map(x => `${x.tc}: ${x.error}`).join("\n");
            alert(msg);
        }
    }

    async function createEk2ByTcs(tcList, firmaId) {
        const tcs = Array.isArray(tcList) ? tcList.filter(x => (x || "").toString().trim().length === 11) : [];
        if (!tcs.length) { cfg.hooks.toastError("Önce gruptan kişi seçin."); return; }

        try {
            const r = await createEk2ByTcBulk(firmaId || null, tcs);

            if (!r?.success) {
                cfg.hooks.toastError(r?.error || r?.message || "EK-2 oluşturulamadı.");
                return;
            }

            const results = Array.isArray(r.results) ? r.results : [];
            await showEk2ResultPopup(results);

        } catch (e) {
            cfg.hooks.toastError("İşlem başarısız.");
        }
    }

    // ✅ Yeni: tab değiştirme (view de çağırabilir / kendi click’imiz de var)
    function setMemberTab(tab) {
        memberTab = (tab === "inactive") ? "inactive" : "active";
        clearMemberSelection();

        // list cache varsa direkt render
        const filtered = filterMembersByTab(lastMembersAll);
        renderMembers(filtered);

        updateRemoveButtonState();
        updateNoteButtonState();
    }

    function bindEvents() {
        $(S("grupSelect")).off("change.ek2").on("change.ek2", async function () {
            const gid = ($(this).val() || "").toString().trim();
            await loadMembers(gid);
        });

        $(S("btnUyelerGoster")).off("click.ek2").on("click.ek2", async function () {
            const gid = getSelectedGroupId();
            if (gid) await loadMembers(gid);
        });

        $(S("confirmGrupEkleBtn")).off("click.ek2").on("click.ek2", async function () {
            const name = ($(S("grupAdiInput")).val() || "").toString().trim();
            if (!name) { $(S("grupAdiValidation")).text("Grup adı zorunlu."); return; }
            $(S("grupAdiValidation")).text("");

            const r = await createGroup(name);
            if (!r?.success) { cfg.hooks.toastError(r?.message || "Grup oluşturulamadı."); return; }

            try { bootstrap.Modal.getInstance(document.getElementById(cfg.selectors.grupEkleModal))?.hide(); } catch { }
            cfg.hooks.toastSuccess(r?.message || "Grup oluşturuldu.");

            const newId = r?.data?.ek2GrupId || r?.data?.Ek2GrupId || r?.data?.grupId || r?.data?.GrupId || r?.data?.id || r?.data?.Id;
            await loadGroups(newId);
            await loadMembers(newId);
        });

        $(S("btnGrupSil")).off("click.ek2").on("click.ek2", async function () {
            const gid = getSelectedGroupId();
            if (!gid) return;

            const ok = await cfg.hooks.confirm("Grup silinsin mi?", "Grup pasif edilecek.");
            if (!ok) return;

            const r = await deleteGroup(gid);
            if (!r?.success) { cfg.hooks.toastError(r?.message || "Grup silinemedi."); return; }

            cfg.hooks.toastSuccess(r?.message || "Grup başarıyla silindi.");
            await loadGroups(null);
            await loadMembers(null);
        });

        $(S("btnUyeCikar")).off("click.ek2").on("click.ek2", async function () {
            const gid = getSelectedGroupId();
            if (!gid) { cfg.hooks.toastError("Önce grup seçin."); return; }

            // ✅ Ayrılanlar tabında çıkarma kapalı
            if (memberTab === "inactive") {
                cfg.hooks.toastError("Ayrılanlar sekmesinde üye çıkarılamaz.");
                updateRemoveButtonState();
                return;
            }

            const tcs = Array.from(selectedMemberTcs);
            if (!tcs.length) { cfg.hooks.toastError("Çıkarmak için üye seçin."); return; }

            const ok = await cfg.hooks.confirm("Seçilen üyeler gruptan çıkarılsın mı?", `${tcs.length} kişi`);
            if (!ok) return;

            $(this).prop("disabled", true);

            try {
                const r = await removeMembersFromGroup(gid, tcs);
                if (!r?.success) {
                    cfg.hooks.toastError(r?.message || "Üyeler çıkarılamadı.");
                    updateRemoveButtonState();
                    return;
                }

                cfg.hooks.toastSuccess(r?.message || "Üyeler çıkarıldı.");
                await loadMembers(gid);
            } catch (e) {
                cfg.hooks.toastError("İşlem başarısız.");
                updateRemoveButtonState();
            }
        });

        // ✅ Yeni: tab click (view’e eklediğin #ek2MemberTabs ile)
        $(document).off("click.ek2tabs").on("click.ek2tabs", `${S("memberTabs")} .nav-link`, async function () {
            try {
                $(`${S("memberTabs")} .nav-link`).removeClass("active");
                $(this).addClass("active");
            } catch { }

            const tab = ($(this).data("ek2-tab") || "active").toString();
            setMemberTab(tab);

            // grup seçiliyse fetch yapmadan cache’den render ettik.
            // İstersen yine de taze çekmek için aşağıyı açabilirsin:
            // const gid = getSelectedGroupId();
            // if (gid) await loadMembers(gid);
        });

        // ✅ Yeni: açıklama butonu
        $(document).off("click.ek2note").on("click.ek2note", S("btnAciklama"), async function () {
            await openNoteModalForSelected();
        });
    }

    // ---------------------------
    // ✅ Public API
    // ---------------------------

    async function init(userConfig) {
        if (inited) return;
        inited = true;

        cfg = $.extend(true, {}, DEFAULTS, userConfig || {});
        bindEvents();
        bindMemberModalEvents();

        setEnabled(S("grupSelect"), true);
        setEnabled(S("btnGrupEkle"), true);

        setEnabled(S("btnGrupSil"), false);
        setEnabled(S("btnUyeEkle"), false);
        setEnabled(S("btnUyelerGoster"), false);
        setEnabled(S("btnUyeCikar"), false);

        renderMembers([]);
        updateNoteButtonState();
    }

    async function setFirma(firmaId) {
        selectedFirmaId = firmaId || null;
    }

    function getSelectedMemberTcs() {
        return Array.from(selectedMemberTcs);
    }

    window.ek2GruplariClient = {
        init,
        setFirma,

        refreshGroups: () => loadGroups(null),
        reloadGroups: () => loadGroups(null),
        reloadMembers: (gid) => loadMembers(gid),

        clearMemberSelection,
        getSelectedMemberTcs,

        // ✅ View burayı çağırıyor (firma opsiyonel)
        createEk2ByTcs,

        // ✅ EK2 Grup Detay
        getGroupDetail,
        setGroupDetail,

        // ✅ Yeni API (view isterse çağırır)
        setMemberTab,
        openNoteModalForSelected
    };

})(window, window.jQuery);
