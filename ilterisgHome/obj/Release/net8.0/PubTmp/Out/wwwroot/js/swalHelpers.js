// swalHelpers.js
// SweetAlert2 için ortak popup + İşyeri Hekimi seçim kontrolü (GetSelectedHekimBilgileriStatus)

(function (w) {
    // -----------------------
    // Utils
    // -----------------------
    function escapeHtml(s) {
        return (s ?? "").toString()
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function normalize(s) {
        return (s ?? "").toString().trim();
    }

    function getAntiForgeryToken() {
        const el = document.querySelector('input[name="__RequestVerificationToken"]');
        return el ? el.value : null;
    }

    async function fetchJsonWithAntiForgery(url, options = {}) {
        const token = getAntiForgeryToken();

        const headers = new Headers(options.headers || {});
        if (!headers.has("Content-Type") && options.method && options.method.toUpperCase() !== "GET") {
            headers.set("Content-Type", "application/json");
        }
        if (token && !headers.has("RequestVerificationToken")) {
            headers.set("RequestVerificationToken", token);
        }

        const res = await fetch(url, { ...options, headers });

        if (res.status === 401) {
            return { ok: false, errors: [{ key: "auth", message: "Yetkisiz erişim." }], status: 401 };
        }
        if (res.status === 403) {
            return { ok: false, errors: [{ key: "auth", message: "Erişim engellendi (403)." }], status: 403 };
        }

        const text = await res.text();
        if (!res.ok) {
            try {
                const j = JSON.parse(text);
                return { ok: false, ...j, status: res.status };
            } catch {
                return { ok: false, errors: [{ key: "http", message: `İstek başarısız: ${res.status}` }], raw: text, status: res.status };
            }
        }

        if (!text) return null;
        try { return JSON.parse(text); } catch { return text; }
    }

    function statBox(label, value, tone) {
        const toneMap = {
            success: "rgba(25,135,84,.15)",
            warning: "rgba(255,193,7,.18)",
            danger: "rgba(220,53,69,.15)",
            info: "rgba(13,110,253,.12)",
        };
        const bg = toneMap[tone] || "rgba(0,0,0,.05)";

        return `
      <div style="
        width:100%;
        max-width:360px;
        border:1px solid rgba(0,0,0,.08);
        border-radius:14px;
        padding:10px 12px;
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        font-size:14px;
        background:${bg};
      ">
        <span style="opacity:.9">${escapeHtml(label)}</span>
        <b style="font-size:16px">${escapeHtml(value)}</b>
      </div>
    `;
    }

    // -----------------------
    // 1) Genel Sonuç Popup'ı (EK2 tarzı)
    // -----------------------
    async function showResultPopup(results, opts = {}) {
        const arr = Array.isArray(results) ? results : [];
        const okCount = arr.filter(x => x && x.success === true).length;
        const failCount = arr.filter(x => x && x.success === false).length;
        const total = okCount + failCount;

        const title = opts.title || "İşlem Sonucu";
        const okLabel = opts.okLabel || "Başarılı";
        const failLabel = opts.failLabel || "Başarısız";
        const width = opts.width || 560;
        const confirmButtonText = opts.confirmButtonText || "Tamam";
        const showWhenSingleSuccess = opts.showWhenSingleSuccess === true;

        const getFailText = typeof opts.getFailText === "function"
            ? opts.getFailText
            : (x) => (x?.error || x?.message || "Hata");

        const getItemKey = typeof opts.getItemKey === "function"
            ? opts.getItemKey
            : (x) => (x?.tc || x?.type || x?.title || "Kayıt");

        const failItems = arr
            .filter(x => x && x.success === false)
            .map(x => ({
                key: getItemKey(x),
                error: getFailText(x)
            }));

        if (total === 1 && okCount === 1 && !showWhenSingleSuccess) {
            if (w.Swal) {
                await Swal.fire({
                    icon: "success",
                    title: "Başarılı",
                    text: opts.singleSuccessText || "İşlem başarıyla tamamlandı.",
                    confirmButtonText
                });
            } else {
                alert(opts.singleSuccessText || "İşlem başarıyla tamamlandı.");
            }
            return;
        }

        // ✅ FIX: Tek hata durumunda "Oluşturulamadı" yerine opts.title'ı da kullan
        if (total === 1 && failCount === 1) {
            const err = failItems[0]?.error || "İşlem başarısız.";

            const singleTitle =
                (opts.singleFailTitle && opts.singleFailTitle.toString().trim()) ||
                (opts.title && opts.title.toString().trim()) ||
                "Oluşturulamadı";

            if (w.Swal) {
                await Swal.fire({
                    icon: "error",
                    title: singleTitle,
                    text: err.toString(),
                    confirmButtonText
                });
            } else {
                alert(`${singleTitle}\n${err}`);
            }
            return;
        }

        let headline = opts.headline;
        if (!headline) {
            if (okCount > 0 && failCount === 0) headline = `Seçilen ${total} kayıt için işlem başarıyla tamamlandı.`;
            else if (okCount > 0 && failCount > 0) headline = `Bazı işlemler tamamlandı, bazıları tamamlanamadı.`;
            else headline = `İşlemler tamamlanamadı.`;
        }

        let html = `
      <div style="text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px;">
        <div style="font-size:14px; opacity:.92;">${escapeHtml(headline)}</div>

        <div style="display:flex; flex-direction:column; align-items:center; gap:8px; width:100%; margin-top:6px;">
          ${okCount > 0 ? statBox(okLabel, okCount, "success") : ""}
          ${failCount > 0 ? statBox(failLabel, failCount, failCount > 0 && okCount > 0 ? "warning" : "danger") : ""}
        </div>
    `;

        if (failItems.length) {
            const listHtml = failItems
                .map(x => `<li style="margin:6px 0; line-height:1.25;">
          <b>${escapeHtml(x.key)}</b>: <span style="opacity:.95">${escapeHtml(x.error)}</span>
        </li>`).join("");

            const copyText = failItems.map(x => `${x.key}: ${x.error}`).join("\n");

            html += `
        <div style="width:100%; max-width:460px; margin-top:12px; text-align:left;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;">
            <div style="font-weight:700;">Hatalar</div>
            <button type="button" id="swalCopyErrorsBtn"
              style="
                border:1px solid rgba(0,0,0,.12);
                background:#fff;
                border-radius:10px;
                padding:6px 10px;
                font-size:12px;
                cursor:pointer;
              ">
              Kopyala
            </button>
          </div>

          <div style="max-height:240px; overflow:auto; border:1px solid rgba(0,0,0,.08); border-radius:14px; padding:10px 12px; background:rgba(0,0,0,.02);">
            <ul style="padding-left:18px; margin:0;">
              ${listHtml}
            </ul>
          </div>

          <textarea id="swalErrorsHiddenArea" style="position:absolute; left:-9999px; top:-9999px;">${escapeHtml(copyText)}</textarea>
        </div>
      `;
        }

        html += `</div>`;

        const icon = (failCount === 0 && okCount > 0) ? "success" : (okCount > 0 ? "warning" : "error");

        if (w.Swal) {
            await Swal.fire({
                icon,
                title,
                html,
                confirmButtonText,
                width,
                didOpen: () => {
                    const btn = document.getElementById("swalCopyErrorsBtn");
                    if (btn) {
                        btn.addEventListener("click", async () => {
                            const ta = document.getElementById("swalErrorsHiddenArea");
                            const txt = (ta?.value || "").toString();
                            try {
                                await navigator.clipboard.writeText(txt);
                                btn.textContent = "Kopyalandı ✓";
                                setTimeout(() => (btn.textContent = "Kopyala"), 1200);
                            } catch {
                                ta?.select?.();
                                document.execCommand?.("copy");
                                btn.textContent = "Kopyalandı ✓";
                                setTimeout(() => (btn.textContent = "Kopyala"), 1200);
                            }
                        });
                    }
                }
            });
        } else {
            let msg = `${title}\n${headline}\n`;
            if (okCount > 0) msg += `${okLabel}: ${okCount}\n`;
            if (failCount > 0) msg += `${failLabel}: ${failCount}\n`;
            if (failItems.length) msg += `\nHatalar:\n` + failItems.map(x => `${x.key}: ${x.error}`).join("\n");
            alert(msg);
        }
    }

    // -----------------------
    // 2) İşyeri Hekimi Seçim Durumu - Endpoint çağır + Swal
    // -----------------------
    function mapErrorKeyToLabel(key) {
        const m = {
            tesisKodu: "Tesis Kodu",
            bransKodu: "Branş Kodu",
            medulaSifresi: "Medula Şifresi",
            auth: "Yetki",
            http: "Bağlantı",
        };
        return m[key] || key;
    }

    // ✅ backend bazen "tesisKodu: ..." gibi tek string gönderirse de düzgün parçala
    function parseDashOrLines(msg) {
        const t = normalize(msg);
        if (!t) return [];

        // Satır satırsa:
        const byLine = t.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        if (byLine.length > 1) return byLine;

        // "- a - b - c" gibi birleşikse:
        const parts = t.replace(/\s+/g, " ").split(" - ").map(x => x.trim()).filter(Boolean);
        if (parts.length > 1) return parts.map(x => x.replace(/^-+\s*/, "").trim());

        // tek mesaj
        return [t.replace(/^-+\s*/, "").trim()];
    }

    function buildHekimStatusHtml(status) {
        const ok = !!status?.ok;
        const values = status?.values || {};

        // 1) errors array varsa onu kullan
        let errors = Array.isArray(status?.errors) ? status.errors : [];

        // 2) yoksa message/raw stringten üret
        if (!errors.length) {
            const msg = status?.message || status?.error || status?.raw || "";
            const items = parseDashOrLines(msg);
            errors = items.map((t, i) => ({ key: `err_${i + 1}`, message: t }));
        }

        // Mevcut seçimler: mask vs
        const vTesis = normalize(values.tesisKodu) || "—";
        const vBrans = (values.bransKodu ?? "—").toString();
        const vSifre = normalize(values.medulaSifresi) || "—";

        const missingCount = errors.length;

        const valueRow = (label, val, tone) => `
      <div style="
        width:100%;
        max-width:460px;
        border:1px solid rgba(0,0,0,.08);
        border-radius:14px;
        padding:10px 12px;
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        font-size:14px;
        background:${tone};
      ">
        <span style="opacity:.9">${escapeHtml(label)}</span>
        <b style="font-size:14px">${escapeHtml(val)}</b>
      </div>
    `;

        // ✅ Madde madde “Düzeltilmesi Gerekenler”
        // İSTEK: "tesisKodu: ..." birleşik değil -> ayrı ayrı
        const list = errors.map(e => {
            const label = mapErrorKeyToLabel(e.key);
            const msg = normalize(e.message);

            // Eğer backend message zaten "tesisKodu: ..." gibi başladıysa baştaki "tesisKodu:" kısmını temizle
            // ama sadece key eşleşiyorsa
            let cleaned = msg;
            if (e.key && typeof e.key === "string") {
                const re = new RegExp(`^\\s*${e.key}\\s*:\\s*`, "i");
                cleaned = cleaned.replace(re, "").trim();
            }

            // Tek satır: "Tesis Kodu: ...."
            const line = `<b>${escapeHtml(label)}</b>: <span style="opacity:.95">${escapeHtml(cleaned)}</span>`;

            return `
        <li style="margin:8px 0; line-height:1.35;">
          ${line}
        </li>
      `;
        }).join("");

        // Başlık: key gibi değil adam akıllı
        const headline = ok
            ? "Hekim bilgileri hazır."
            : "Hekim bilgileri eksik. Devam etmeden önce tamamlamanız gerekiyor.";

        let html = `
      <div style="text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px;">
        <div style="font-size:14px; opacity:.92;">
          ${escapeHtml(headline)}
        </div>

        <div style="display:flex; flex-direction:column; align-items:center; gap:8px; width:100%; margin-top:6px;">
          ${ok ? statBox("Durum", "Hazır", "success") : statBox("Eksik Alan", missingCount, "warning")}
        </div>

        <div style="width:100%; max-width:460px; margin-top:10px; text-align:left;">
          <div style="font-weight:700; margin-bottom:6px;">Mevcut Seçimler</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${valueRow("Tesis Kodu", vTesis, "rgba(13,110,253,.08)")}
            ${valueRow("Branş Kodu", vBrans, "rgba(13,110,253,.08)")}
            ${valueRow("Medula Şifresi", vSifre, "rgba(13,110,253,.08)")}
          </div>
        </div>
    `;

        if (!ok && errors.length) {
            html += `
        <div style="width:100%; max-width:460px; margin-top:12px; text-align:left;">
          <div style="font-weight:700; margin-bottom:6px;">Düzeltilmesi Gerekenler</div>
          <div style="border:1px solid rgba(0,0,0,.08); border-radius:14px; padding:10px 12px; background:rgba(0,0,0,.02);">
            <ul style="padding-left:18px; margin:0;">
              ${list}
            </ul>
          </div>
        </div>
      `;
        }

        html += `</div>`;
        return html;
    }

    /**
     * Endpoint çağırır, eksikse Swal gösterir.
     * İSTEKLER:
     * - Tek buton olsun (Devam Et/Cancel yok)
     * - Buton: "Hekim Bilgileri Alanına Git"
     * - Tıklanınca: Dashboard/Profile'ye yönlendir
     * - Bu sayfada kal butonu KALKSIN
     */
    async function checkHekimBilgileriStatusAndWarn(opts = {}) {
        const url = opts.url || "/Muayene/GetSelectedHekimBilgileriStatus";
        const redirectOnFix = opts.redirectOnFix !== false; // default true

        const status = await fetchJsonWithAntiForgery(url, { method: "GET" });

        if (!w.Swal) return { ok: !!status?.ok, data: status };

        if (status?.ok) {
            if (opts.showOnOk) {
                await Swal.fire({
                    icon: "success",
                    title: opts.okTitle || "Hazır",
                    text: opts.okText || "Hekim seçimleri hazır.",
                    confirmButtonText: "Tamam",
                    confirmButtonColor: "#012F51"
                });
            }
            return { ok: true, data: status };
        }

        const html = buildHekimStatusHtml(status);

        // ✅ İSTEK: Hekim Bilgileri alanına git → Dashboard/Profile
        // (backend redirectUrl'u artık umursamıyoruz)
        const redirectUrl = opts.redirectUrlOverride || "/Dashboard/Profile";

        const result = await Swal.fire({
            icon: "warning",
            title: opts.title || "Hekim Bilgileri Eksik",
            html,
            width: 620,

            // ✅ Tek buton:
            showCancelButton: false,
            showDenyButton: false,

            confirmButtonText: opts.fixButtonText || "Hekim Bilgileri Alanına Git",
            confirmButtonColor: "#012F51"
        });

        if (result.isConfirmed && redirectOnFix) {
            window.location.href = redirectUrl;
        }

        return { ok: false, data: status, action: "fix" };
    }

    async function requireHekimBilgileriOrBlock(opts = {}) {
        const r = await checkHekimBilgileriStatusAndWarn(opts);
        return !!r.ok;
    }

    // =========================================================
    // ✅ RECETE LIMIT HELPERS (YENİ)
    // =========================================================

    function getReceteLimitSnapshot() {
        // ReceteLimitViewComponent Default.cshtml script'i bunu set edecek:
        // window.__receteLimit = { ...camelCase... }
        return w.__receteLimit || null;
    }

    function getReceteLimitBlockReason(s) {
        // reason: "noMembership" | "expiredMembership" | "exceeded"
        if (!s) return null;
        if (s.isExempt === true) return null;

        // limit aşılmadıysa blok yok
        if (s.isExceeded !== true) return null;

        // undefined/null gelirse false kabul et (daha güvenli)
        const hasAny = (s.hasAnyMembershipRecord === true);
        const hasActive = (s.hasActiveMembership === true);

        // demo bitti ama hiç üyelik yok
        if (!hasAny) return "noMembership";

        // geçmişte üyelik var ama şu an aktif değil
        if (!hasActive) return "expiredMembership";

        // aktif üyelik var ama limit dolmuş (extra dahil)
        return "exceeded";
    }

    async function showReceteLimitBlockedPopup(reason, opts = {}) {
        const m = {
            noMembership: {
                title: "Demo Limit Doldu",
                text: "Demo kullanım hakkınız doldu. Reçete oluşturmaya devam etmek için üyelik alabilir, Ekstra özelliklere erişime devam edebilirsiniz.",
                icon: "warning"
            },
            expiredMembership: {
                title: "Üyelik Süreniz Doldu",
                text: "Üyeliğinizin süresi dolmuş görünüyor. Reçete oluşturmaya devam etmek için üyeliğinizi yenileyebilir,. Ekstra özelliklere erişime devam edebilirsiniz.",
                icon: "warning"
            },
            exceeded: {
                title: "Reçete Limitiniz Doldu",
                text: "Reçete limitiniz doldu. Özellikleri kullanabilmek için üyeliğinizi yükseltebilir veya ek paket satın alabilirsiniz.",
                icon: "warning"
            }
        };

        const baseCfg = m[reason] || m.exceeded;

        // ✅ override destekle
        const cfg = {
            icon: normalize(opts.icon) || baseCfg.icon,
            title: normalize(opts.title) || baseCfg.title,
            text: normalize(opts.text) || baseCfg.text
        };

        const confirmButtonText = normalize(opts.confirmText) || "Tamam";
        const confirmButtonColor = normalize(opts.color) || "#012F51";

        if (w.Swal) {
            await Swal.fire({
                icon: cfg.icon,
                title: cfg.title,
                text: cfg.text,
                confirmButtonText,
                confirmButtonColor
            });
        } else {
            alert(cfg.title + "\n" + cfg.text);
        }
    }


    function canUseReceteFeatures() {
        const s = getReceteLimitSnapshot();
        if (!s) return true;                 // snapshot yoksa bloklama
        if (s.isExempt === true) return true; // muafsa serbest
        return (s.isExceeded !== true);       // sadece true ise blokla
    }

    async function requireReceteLimitOrWarn(opts = {}) {
        // true => devam edebilir, false => bloklandı + popup gösterildi
        const s = getReceteLimitSnapshot();
        if (!s) return true;
        if (s.isExempt === true) return true;
        if (s.isExceeded !== true) return true;

        const reason = getReceteLimitBlockReason(s) || "exceeded";
        await showReceteLimitBlockedPopup(reason, opts);
        return false;
    }



    // -----------------------
    // global exports
    // -----------------------
    w.showResultPopup = showResultPopup;
    w.fetchJsonWithAntiForgery = fetchJsonWithAntiForgery;

    w.checkHekimBilgileriStatusAndWarn = checkHekimBilgileriStatusAndWarn;
    w.requireHekimBilgileriOrBlock = requireHekimBilgileriOrBlock;

    // -----------------------
    // global exports (mevcut export’lara ek)
    // -----------------------
    w.getReceteLimitSnapshot = getReceteLimitSnapshot;
    w.canUseReceteFeatures = canUseReceteFeatures;
    w.getReceteLimitBlockReason = getReceteLimitBlockReason;
    w.showReceteLimitBlockedPopup = showReceteLimitBlockedPopup;
    w.requireReceteLimitOrWarn = requireReceteLimitOrWarn;


})(window);
