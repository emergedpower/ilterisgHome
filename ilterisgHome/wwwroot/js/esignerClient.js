// esignerClient.js - E-İmza Ajan Entegrasyonu (localhost:5000) - GÜNCELLENMİŞ: Tüm flow'lar Promise döner (Liste Sorgu eklendi)
// esignerClient.js - E-İmza Ajan Entegrasyonu (localhost:5000) - GÜNCELLENMİŞ: Tüm flow'lar Promise döner (Liste Sorgu eklendi)
// ✅ EKLENDİ: NES (subject) + serial cache (fingerprint YOK)
// ✅ EKLENDİ: Sayfa açılışında await edilebilir init (cihaz var mı / aynı mı kontrolü)
// ✅ BOZULMADI: Mevcut key'ler ve mevcut flow'lar korunur

const AGENT_URL = 'http://localhost:5000'; // Config'ten dinamik al (appsettings veya env)
const WEB_API_URL = '/Muayene'; // Web app endpoint'leri (relative path)

// ✅ SADECE localStorage kullan
const _eimzaStorage = window.localStorage;

// ✅ Mevcut anahtarlar BOZULMADI (deviceTc YOK)
function setEimzaCache(pin, slotIndex, signedXml) {
    const nowIso = new Date().toISOString();

    _eimzaStorage.setItem("EImzaSession", signedXml);
    _eimzaStorage.setItem("EImzaSlotIndex", String(slotIndex));
    _eimzaStorage.setItem("EImzaLastUse", nowIso);

    _eimzaStorage.setItem("eImzaPin", String(pin));
    _eimzaStorage.setItem("eImzaSignatureId", String(slotIndex));
    _eimzaStorage.setItem("eImzaSignedData", signedXml);
}

function getEimzaCache() {
    const signedXml =
        _eimzaStorage.getItem("EImzaSession") ||
        _eimzaStorage.getItem("eImzaSignedData");

    const slotIndexStr =
        _eimzaStorage.getItem("EImzaSlotIndex") ||
        _eimzaStorage.getItem("eImzaSignatureId");

    const pin = _eimzaStorage.getItem("eImzaPin");

    if (!signedXml || !slotIndexStr || !pin) return null;

    return {
        signedXml,
        slotIndex: parseInt(slotIndexStr, 10),
        pin,
        lastUse: _eimzaStorage.getItem("EImzaLastUse"),
    };
}

// ✅ EK: NES cache key'leri (mevcutları bozmaz)
const EIMZA_DEVICE_SUBJECT_KEY = "EImzaDeviceSubject";
const EIMZA_DEVICE_SERIAL_KEY = "EImzaDeviceSerial";

// ✅ EK: cihaz cache yaz/oku
function setEimzaDeviceCache(slotIndex, subject, serial) {
    if (slotIndex !== null && slotIndex !== undefined) {
        _eimzaStorage.setItem("EImzaSlotIndex", String(slotIndex)); // zaten vardı, uyumlu
        _eimzaStorage.setItem("eImzaSignatureId", String(slotIndex)); // zaten vardı, uyumlu
    }
    if (subject !== null && subject !== undefined) _eimzaStorage.setItem(EIMZA_DEVICE_SUBJECT_KEY, String(subject));
    if (serial !== null && serial !== undefined) _eimzaStorage.setItem(EIMZA_DEVICE_SERIAL_KEY, String(serial));
}

function getEimzaDeviceCache() {
    const slotIndexStr =
        _eimzaStorage.getItem("EImzaSlotIndex") ||
        _eimzaStorage.getItem("eImzaSignatureId");

    if (!slotIndexStr) return null;

    return {
        slotIndex: parseInt(slotIndexStr, 10),
        subject: _eimzaStorage.getItem(EIMZA_DEVICE_SUBJECT_KEY),
        serial: _eimzaStorage.getItem(EIMZA_DEVICE_SERIAL_KEY),
    };
}

function clearEimzaCache() {
    [
        "EImzaSession",
        "EImzaSlotIndex",
        "EImzaLastUse",
        "eImzaPin",
        "eImzaSignatureId",
        "eImzaSignedData",
        // ✅ EK: NES cache temizliği
        EIMZA_DEVICE_SUBJECT_KEY,
        EIMZA_DEVICE_SERIAL_KEY,
    ].forEach((k) => _eimzaStorage.removeItem(k));
}

function normalize(str) {
    return (str || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
}

// Global state (reçete için – yeni işlemler için local kullan)
let currentUnsignedXml = '';
let currentProtokolNo = '';
let currentRedirectUrl = '';

// 🔹 Helper: Fetch ile hata handling (ajan/web için ortak – !ok parse et)
async function fetchWithErrorHandling(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        const raw = await response.text(); // ham body
        let cleanError = `${options.isAgent ? 'esigner-ILTER' : 'Web API'} hatası: ${response.status}`;

        // JSON parse etmeyi dene
        try {
            const j = JSON.parse(raw);

            // ASP.NET ProblemDetails: { detail, title, ... }
            if (j?.detail) {
                cleanError += ` - ${j.detail}`;
            }
            // Sizin standart JSON: { success:false, error:"..." }
            else if (j?.error) {
                cleanError += ` - ${j.error}`;
            }
            // Bazı endpointler: { message:"..." }
            else if (j?.message) {
                cleanError += ` - ${j.message}`;
            }
            // ProblemDetails title
            else if (j?.title) {
                cleanError += ` - ${j.title}`;
            }
            // ModelState tarzı: { errors: { Field: ["msg1","msg2"] } }
            else if (j?.errors && typeof j.errors === 'object') {
                const msgs = [];
                for (const key of Object.keys(j.errors)) {
                    const arr = Array.isArray(j.errors[key]) ? j.errors[key] : [j.errors[key]];
                    arr.forEach(m => msgs.push(m));
                }
                if (msgs.length) cleanError += ` - ${msgs.join(' | ')}`;
                else cleanError += ` - İstek başarısız.`;
            }
            // Hiçbiri yoksa: ham’ı basma, kısa bir fallback ver
            else {
                cleanError += ` - İstek başarısız.`;
            }
        } catch {
            // JSON değilse ham text’i kısalt
            const trimmed = (raw || '').toString().trim();
            cleanError += ` - ${trimmed.substring(0, 150)}${trimmed.length > 150 ? '...' : ''}`;
        }

        throw new Error(cleanError);
    }

    // OK ise JSON dön (boş body olursa null dön)
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
}

// ✅ EK: Seçili cihaz bilgilerini (devices listesinden) al
function getDeviceInfoFromList(devices, index) {
    if (!Array.isArray(devices)) return { subject: '', serial: '' };
    const d = devices[index] || {};
    return {
        subject: d.subject || '',
        serial: d.serial || '',
    };
}

// ✅ EK: Sayfa başında çağıracağın init (await edilebilir)
// - loadSignatureDevices'ı tetikler
// - cihaz yoksa cache temizler
// - cache subject/serial ile takılı subject/serial uyumsuzsa cache temizler
async function initEimzaBootstrap(selectId, validationId, buttonId, subjectDisplayId = 'subjectDisplay') {
    // Burada view'ı gizleyip göstermek istersen sen yönet (bootLoader vs)
    const result = await loadSignatureDevices(selectId, validationId, buttonId, subjectDisplayId);

    // loadSignatureDevices zaten UI'yı güncelliyor.
    // result üzerinden opsiyonel aksiyon alabilirsin.
    return result;
}

// 🔹 Ajan Health Check & Cihaz Yükle (sayfa yüklenirken bir kez)
// ✅ GÜNCEL: Device TC toplama/validation KALDIRILDI. Artık TC doğrulaması backend'de SignedXml içinden yapılacak.
// ✅ EKLENDİ: Promise döner (await edilebilir) + cache cihaz kontrolü (cihaz yoksa sil, NES/serial uyuşmazsa sil)
function loadSignatureDevices(selectId, validationId, buttonId, subjectDisplayId = 'subjectDisplay') {
    showLoading(selectId, true); // Spinner başlat

    return fetchWithErrorHandling(`${AGENT_URL}/health`, { isAgent: true })
        .then(health => {
            console.log('Ajan healthy:', health);
            return fetchWithErrorHandling(`${AGENT_URL}/devices`, { isAgent: true });
        })
        .then(async (data) => {
            console.log('Received devices data:', data);

            let options = '<option value="">-- Cihaz seçin --</option>';
            let firstDeviceIndex = -1;

            if (Array.isArray(data) && data.length > 0) {

                // ✅ Cache ile takılı kart aynı mı kontrolü:
                // - Önce cache'den slot + subject/serial oku
                // - Slot geçersizse 0'a çek
                // - Cache subject/serial varsa ve takılı cihazla uyuşmuyorsa cache temizle
                const cachedDev = getEimzaDeviceCache();
                let preferredIndex = (cachedDev?.slotIndex ?? 0);

                if (Number.isNaN(preferredIndex) || preferredIndex < 0 || preferredIndex >= data.length) {
                    preferredIndex = 0;
                }

                const plugged = getDeviceInfoFromList(data, preferredIndex);
                const cacheSubject = cachedDev?.subject || '';
                const cacheSerial = cachedDev?.serial || '';

                const subjectMismatch = cacheSubject && plugged.subject && normalize(cacheSubject) !== normalize(plugged.subject);
                const serialMismatch = cacheSerial && plugged.serial && normalize(cacheSerial) !== normalize(plugged.serial);

                if (subjectMismatch || serialMismatch) {
                    clearEimzaCache();
                    preferredIndex = 0; // temizledik, 0'a düş
                }

                data.forEach((device, index) => {
                    let displayText = device.label || device.name || 'Unknown Device';
                    const serial = device.serial || '';
                    const subject = device.subject || 'Bilinmeyen';

                    // Duplikasyon önle
                    const hasSerial = serial && displayText.includes(serial);
                    const hasSubject = subject && displayText.includes(subject);

                    if (!hasSerial && serial) displayText += ` (${serial})`;
                    if (!hasSubject && subject) displayText += ` - ${subject}`;

                    // ✅ data-tc KALDIRILDI (istersen debug için data-subject bırakabilirsin)
                    options += `<option value="${index}" data-subject="${subject}">${displayText}</option>`;

                    if (firstDeviceIndex === -1) firstDeviceIndex = index;
                });

                // Button enable (metne dokunma)
                $(`#${buttonId}`).prop("disabled", false);

                // Auto-select: cache geçerliyse onu, değilse ilk cihaz
                const selectedIndex = (firstDeviceIndex !== -1) ? (preferredIndex ?? firstDeviceIndex) : firstDeviceIndex;

                $(`#${selectId}`).html(options).val(selectedIndex).trigger('change');

                // ✅ EK: devices response içindeki subject/serial'ı cache'e yaz
                const selectedInfo = getDeviceInfoFromList(data, selectedIndex);
                setEimzaDeviceCache(selectedIndex, selectedInfo.subject || 'Bilinmeyen', selectedInfo.serial || '');

                // ✅ Subject otomatik göster (slot=0 bug fix'i getDeviceSubject içinde)
                if (selectedIndex !== -1) {
                    try { await getDeviceSubject(selectedIndex, subjectDisplayId); } catch { }
                }

                // ✅ EK: kullanıcı dropdown değiştirince cache + subject güncelle
                $(`#${selectId}`).off('change.eimza').on('change.eimza', async function () {
                    const idx = parseInt(this.value, 10);
                    if (Number.isNaN(idx) || idx < 0 || idx >= data.length) return;

                    const info = getDeviceInfoFromList(data, idx);
                    setEimzaDeviceCache(idx, info.subject || 'Bilinmeyen', info.serial || '');

                    try { await getDeviceSubject(idx, subjectDisplayId); } catch { }
                });

                showLoading(selectId, false);

                $(`#${validationId}`).text("")
                    .removeClass("text-danger text-warning")
                    .addClass("text-success")
                    .text("esigner-ILTER hazır – cihazlar yüklendi.");

                return { ok: true, hasDevice: true, selectedIndex };
            } else {
                // ✅ Cihaz bulunamadı -> cache temizle
                clearEimzaCache();

                options = '<option value="">Kart takılı değil</option>';
                $(`#${buttonId}`).prop("disabled", true).text("Cihaz Yok");
                $(`#${selectId}`).html(options);

                showLoading(selectId, false);

                $(`#${validationId}`).text("")
                    .removeClass("text-danger text-success")
                    .addClass("text-warning")
                    .text("Kart takılı değil – cihaz bağlayın.");

                return { ok: true, hasDevice: false };
            }
        })
        .catch(err => {
            console.error('Ajan hatası:', err);

            if (err.message.includes('Failed to fetch') || err.message.includes('ERR_CONNECTION_REFUSED')) {
                Swal.fire({
                    icon: 'warning',
                    title: 'E-İmza Bağlantı Hatası!',
                    text: 'esigner-ILTER uygulaması çalışmıyor. Lütfen exe\'yi başlatın ve sayfayı yenileyin.',
                    confirmButtonColor: '#012F51'
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Ajan Hatası!',
                    text: err.message,
                    confirmButtonColor: '#012F51'
                });
            }

            $(`#${selectId}`).html('<option value="">Bağlantı hatası</option>');
            $(`#${validationId}`).text("esigner-ILTER çalışmıyor! PC'nize indirip çalıştırın.")
                .removeClass("text-success text-warning")
                .addClass("text-danger");
            $(`#${buttonId}`).prop("disabled", true).text("Ajan Yok");
            showLoading(selectId, false);

            return { ok: false, error: err };
        });
}

// 🔹 Subject Al (seçilen cihaz için CN göster – aynı)
// ✅ EK: slot=0 bug fix + subject'i cache'e yaz (serial'ı ezmez)
function getDeviceSubject(deviceIndex, displayId) {
    // ❌ eski: if (!deviceIndex || deviceIndex < 0) return;
    // ✅ yeni: 0 da geçerli olmalı
    if (deviceIndex === null || deviceIndex === undefined || deviceIndex < 0) return Promise.resolve(null);

    return fetchWithErrorHandling(`${AGENT_URL}/get-subject?slotIndex=${deviceIndex}`, { isAgent: true })
        .then(data => {
            const subject = data.subject || 'Bilinmeyen';
            $(`#${displayId}`).text(`NES: ${subject}`).removeClass("text-danger").addClass("text-info");
            console.log('Subject:', subject);

            // ✅ subject cache'e yaz (serial mevcutsa koru)
            const prev = getEimzaDeviceCache();
            setEimzaDeviceCache(deviceIndex, subject, prev?.serial);

            return subject;
        })
        .catch(err => {
            console.error('Subject hatası:', err);
            $(`#${displayId}`).text("NES alınamadı").addClass("text-danger");
            // Opsiyonel: Swal göster
            if (!err.message.includes('Failed to fetch')) {
                Swal.fire({
                    icon: 'error',
                    title: 'NES Hatası!',
                    text: err.message,
                    confirmButtonColor: '#012F51'
                });
            }
            return null;
        });
}

/*
✅ KULLANIM (View'de en başta):
$(async function(){
   // opsiyonel: sayfayı init bitene kadar gizle/göster
   // $("#pageContent").hide();
   await initEimzaBootstrap("deviceSelect","deviceValidation","signBtn","subjectDisplay");
   // $("#pageContent").show();
});
*/

// 🔹 XML İmzala (unsignedXml, pin, slotIndex ile ajan'a POST – Promise ile döner, callback yok – daha güvenli ve zincirlenebilir)
// 🔹 XML İmzala (unsignedXml, pin, slotIndex ile ajan'a POST – Promise ile döner, callback yok – daha güvenli ve zincirlenebilir)
async function signXmlWithAgent(unsignedXml, pin, slotIndex) {
    const payload = {
        xmlContent: unsignedXml,
        pin: pin,
        slotIndex: slotIndex || 0,
        useRawXml: false,
        licenseType: "Free",
        forceFreshLogin: true // Her seferinde PIN doğrula (güvenlik)
    };
    try {
        const response = await fetch(`${AGENT_URL}/sign-xml`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            let errorDetail = await response.text(); // Ham body al
            let cleanError = `esigner-ILTER hatası: ${response.status}`; // Varsayılan
            // JSON parse dene (ProblemDetails için)
            try {
                const errorJson = JSON.parse(errorDetail);
                if (errorJson.detail) {
                    // Direkt app'ten gelen detail'ı ekle – JSON çöpü yok, sade
                    cleanError += ` - ${errorJson.detail}`;
                } else {
                    // JSON ama detail yok, ham kullan
                    cleanError += ` - ${errorDetail}`;
                }
            } catch (parseErr) {
                // JSON değil, direkt ham body kullan (kısalt)
                cleanError += ` - ${errorDetail.substring(0, 150)}...`; // Uzun text'i kısalt (150'ye çıkardım, PIN kilidi için)
            }
            throw new Error(cleanError); // Temiz hata throw et
        }
        const result = await response.json();
        if (result.status !== "İmzalama başarılı" || !result.signedXml) {
            throw new Error(result.error || 'İmzalama başarısız');
        }
        console.log('Signed XML length:', result.signedXml.length);
        showLoading('signAndSendButton', false); // Global spinner dur (opsiyonel)
        return result.signedXml; // Promise resolve: signedXml döner
    } catch (err) {
        console.error('Sign hatası:', err);
        // ✅ YENİ: Spesifik bağlantı hatası için kullanıcı dostu uyarı
        if (err.message.includes('Failed to fetch') || err.message.includes('ERR_CONNECTION_REFUSED')) {
            Swal.fire({
                icon: 'warning',
                title: 'E-İmza Bağlantı Hatası!',
                text: 'esigner-ILTER uygulaması çalışmıyor. Lütfen exe\'yi başlatın ve sayfayı yenileyin.',
                confirmButtonColor: '#012F51'
            });
        }
        showLoading('signAndSendButton', false);
        throw err; // Promise reject: Hata fırlat
    }
}
// 🔹 Signed XML'i Web App'e Gönder (Genel – operationType ile, SubmitSignedXml'e POST – Promise döner)
async function submitSignedOperation(signedXml, operationType, extraParams = {}, redirectUrl = null, showSwalOnSuccess = true) {
    // Extra params'ı payload'a ekle (EreceteNo, TaniKodu vb.)
    const payload = {
        SignedXml: signedXml,
        OperationType: operationType,
        ...extraParams // EreceteNo: "123", TaniKodu: "A00" vb. (request'e set)
    };
    try {
        // fetchWithErrorHandling kullan (web için isAgent=false)
        const result = await fetchWithErrorHandling(`${WEB_API_URL}/SubmitSignedXml`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            },
            body: JSON.stringify(payload),
            isAgent: false // Web API için
        });
        if (result.success) {
            console.log(`${operationType} success:`, result);
            if (showSwalOnSuccess) {
                Swal.fire({
                    icon: 'success',
                    title: 'Başarılı!',
                    text: result.message || `${operationType} işlemi tamamlandı.`,
                    confirmButtonColor: '#012F51'
                }).then(() => {
                    // Redirect'i SADECE explicit olarak handle et – reload yok
                    if (result.redirectUrl || redirectUrl) {
                        window.location.href = result.redirectUrl || redirectUrl;
                    } else {
                        // Custom refresh – RELOAD YOK, manuel UI güncelle (örn: accordion refresh)
                        // location.reload(); // Bu satırı KALDIR – yerine custom fonksiyon çağır
                        // Örn: if (typeof refreshUI === 'function') refreshUI(); // View'den handle
                    }
                });
            }
            return result; // Promise resolve: result döner (UI handle için direkt dön)
        } else {
            // Error: Caller'a bırak (swal yok) – mesaj result.message'ta
            console.warn(`${operationType} backend hatası:`, result.message);
            return result; // {success: false, message: ...}
        }
    } catch (err) {
        console.error('Submit hatası:', err);
        // GÜNCEL: No swal, caller'a bırak – mesaj err.message'ta
        return {
            success: false,
            message: err.message || 'Gönderim başarısız.',
            data: null
        };
    }
}
// 🔹 Reçete-spesifik submit (koru, ama genel olanı kullan – OperationType: 'ReceteGiris')
async function submitSignedToMedula(signedXml, protokolNo, redirectUrl, receteId, tesisKodu) {
    // Bu, reçete için özel – genel olanı kullan (submitSignedOperation)
    const extraParams = {
        ReceteId: receteId,
        ProtokolNo: protokolNo,
        TesisKodu: tesisKodu
    };
    return submitSignedOperation(signedXml, 'ReceteGiris', extraParams, redirectUrl, false); // showSwalOnSuccess=false (gonder modal handle eder)
}
// 🔹 Reçete İmzalama Flow (BAŞARI yalnıza sonucKodu === "0000" iken)
// GÜNCEL: !isOk bloğunda throw kaldırıldı – return error objesi (double swal önleme)
// 🔹 Reçete İmzalama Flow (BAŞARI yalnıza sonucKodu === "0000" iken)
// GÜNCEL: Medula OK sonrası DB kişi bilgisi refresh hook eklendi (opsiyonel)
// GÜNCEL: !isOk bloğunda throw kaldırıldı – return error objesi (double swal önleme)
async function startSigningFlow(unsignedXml, protokolNo, receteId, pin, signatureId, tesisKodu, redirectUrl) {
    try {
        // (opsiyonel) cihaz CN bilgisini göster
        getDeviceSubject(signatureId, 'subjectDisplay');

        // 1) Ajan ile imzala
        const signedXml = await signXmlWithAgent(unsignedXml, pin, signatureId);

        // 2) Medula'ya gönder
        const result = await submitSignedToMedula(
            signedXml,
            protokolNo,
            redirectUrl || '/Muayene/Index',
            receteId,
            tesisKodu
        );

        // ---- BAŞARI KONTROLÜ (sadece 0000) ----
        const sonucKodu =
            result?.data?.sonucKodu ??
            result?.data?.SonucKodu ?? null;

        const isOk = result?.success === true && sonucKodu === "0000";

        if (isOk) {
            const ereceteNo =
                result?.ereceteNo ??
                result?.data?.ereceteDVO?.ereceteNo ?? "";

            $('#pinValidation').text("Başarılı!")
                .removeClass("text-danger").addClass("text-success");

            const ereceteHtml = `
                <div class="alert alert-success">
                    <h5><i class="fas fa-check-circle me-2"></i> Reçeteniz başarıyla imzalanmıştır!</h5>
                    <hr>
                    <h6><strong>E-Reçete No:</strong> <span class="badge bg-primary fs-6">${ereceteNo || 'N/A'}</span></h6>
                </div>`;

            $("#ereceteContent").html(ereceteHtml);
            $("#signatureCard").hide();
            $("#ereceteDisplay").show();

            // butonu tamamlandı yap
            $("#signAndSendButton").prop("disabled", true)
                .html('<i class="fas fa-check me-2"></i> Tamamlandı');

            // ✅ YENİ: Medula OK sonrası DB'den kişi bilgisi çek (View'de tanımlıysa)
            // Not: bu fonksiyon view tarafında window.refreshKisiFromDbWithRetry olarak expose edilmeli.
            try {
                if (typeof window.refreshKisiFromDbWithRetry === 'function') {
                    await window.refreshKisiFromDbWithRetry(protokolNo, receteId);
                }
            } catch (refreshErr) {
                console.warn('Kisi bilgisi refresh başarısız (kritik değil):', refreshErr);
            }

            return result;
        }

        // ❌ BAŞARISIZ: imza alanını saklama; butonu geri aç + hata göster (tek swal, no throw)
        const mesaj =
            result?.message ||
            result?.data?.sonucMesaji ||
            result?.data?.SonucMesaji ||
            'Medula işlemi başarısız.';

        if ($('#pinValidation').length) { // Element varsa güncelle (gonder modal'da yok)
            $('#pinValidation').text(mesaj)
                .removeClass("text-success").addClass("text-danger");
        }

        if ($("#signAndSendButton").length) { // Element varsa güncelle
            $("#signAndSendButton").prop("disabled", false)
                .html('<i class="fas fa-signature me-2"></i> İmzala ve Medula\'ya Gönder');
        }

        await Swal.fire({
            icon: 'error',
            title: 'İşlem Başarısız!',
            text: mesaj,
            confirmButtonColor: '#012F51'
        });

        // GÜNCEL: No throw – caller'a bırak (gonder için status update)
        return { success: false, message: mesaj, data: result?.data };

    } catch (err) {
        console.error('Signing flow hatası:', err);
        const errMsg = err.message || 'İmzalama akışında hata';

        if ($('#pinValidation').length) {
            $('#pinValidation').text(errMsg)
                .removeClass("text-success").addClass("text-danger");
        }

        if ($("#signAndSendButton").length) {
            $("#signAndSendButton").prop("disabled", false)
                .html('<i class="fas fa-signature me-2"></i> İmzala ve Medula\'ya Gönder');
        }

        // GÜNCEL: Connection için warning, diğerleri error (tek swal)
        if (errMsg.includes('Failed to fetch') || errMsg.includes('ERR_CONNECTION_REFUSED')) {
            await Swal.fire({
                icon: 'warning',
                title: 'E-İmza Bağlantı Hatası!',
                text: 'esigner-ILTER uygulaması çalışmıyor. Lütfen exe\'yi başlatın ve sayfayı yenileyin.',
                confirmButtonColor: '#012F51'
            });
        } else {
            await Swal.fire({
                icon: 'error',
                title: 'İmzalama Hatası!',
                text: errMsg,
                confirmButtonColor: '#012F51'
            });
        }

        // GÜNCEL: No throw – caller'a bırak
        return { success: false, message: errMsg };
    }
}
// 🔹 Tanı Ekle Flow (Promise döner – güncellendi: callback yok, promise chain)
async function startTaniEkleFlow(ereceteNo, taniKodu, taniAdi, pin, slotIndex, hastaTc = '', receteId = '') {
    try {
        // fetchWithErrorHandling kullan (unsigned XML al)
        const result = await fetchWithErrorHandling(`${WEB_API_URL}/SignTaniEkle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            },
            body: JSON.stringify({
                EreceteNo: ereceteNo,
                TaniKodu: taniKodu,
                TaniAdi: taniAdi,
                SlotIndex: slotIndex,
                HastaTc: hastaTc, // DB için
                ReceteId: receteId
            }),
            isAgent: false
        });
        if (!result.success) throw new Error(result.error || 'Unsigned XML alınamadı');
        const signedXml = await signXmlWithAgent(result.unsignedXml, pin, slotIndex); // Promise ile imzala
        const extraParams = {
            EreceteNo: ereceteNo,
            TaniKodu: taniKodu,
            TaniAdi: taniAdi,
            HastaTc: hastaTc,
            ReceteId: receteId
        };
        const submitResult = await submitSignedOperation(signedXml, 'TaniEkle', extraParams, null); // redirectUrl=null – RELOAD YOK
        // Success: View yenile (custom, reload yok)
        Swal.fire({
            icon: 'success',
            title: 'Tanı Eklendi!',
            text: 'Yeni teşhis başarıyla eklendi.',
            confirmButtonColor: '#012F51'
        });
        // Custom refresh: Örn: location.reload(); KALDIR – yerine UI update fonksiyonu çağır
        return submitResult; // Chain için döner
    } catch (err) {
        console.error('Tanı ekleme hatası:', err);
        Swal.fire({
            icon: 'error',
            title: 'Tanı Ekleme Hatası!',
            text: err.message,
            confirmButtonColor: '#012F51'
        });
        throw err; // Chain için fırlat
    }
}
// 🔹 Açıklama Ekle Flow (Promise döner – güncellendi: callback yok, promise chain)
async function startAciklamaEkleFlow(ereceteNo, aciklama, pin, slotIndex, receteId = '') {
    try {
        // fetchWithErrorHandling kullan
        const result = await fetchWithErrorHandling(`${WEB_API_URL}/SignAciklamaEkle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            },
            body: JSON.stringify({
                EreceteNo: ereceteNo,
                Aciklama: aciklama,
                SlotIndex: slotIndex,
                ReceteId: receteId
            }),
            isAgent: false
        });
        if (!result.success) throw new Error(result.error || 'Unsigned XML alınamadı');
        const signedXml = await signXmlWithAgent(result.unsignedXml, pin, slotIndex); // Promise ile imzala
        const extraParams = {
            EreceteNo: ereceteNo,
            Aciklama: aciklama,
            ReceteId: receteId
        };
        const submitResult = await submitSignedOperation(signedXml, 'AciklamaEkle', extraParams, null); // redirectUrl=null – RELOAD YOK
        Swal.fire({
            icon: 'success',
            title: 'Açıklama Eklendi!',
            text: 'Açıklama başarıyla eklendi.',
            confirmButtonColor: '#012F51'
        });
        return submitResult; // Chain için döner
    } catch (err) {
        console.error('Açıklama ekleme hatası:', err);
        Swal.fire({
            icon: 'error',
            title: 'Açıklama Ekleme Hatası!',
            text: err.message,
            confirmButtonColor: '#012F51'
        });
        throw err; // Chain için fırlat
    }
}
// 🔹 İlaç Açıklama Ekle Flow (Promise döner – güncellendi: callback yok, promise chain)
async function startIlacAciklamaEkleFlow(ereceteNo, barkod, aciklama, pin, slotIndex, receteId = '') {
    try {
        // fetchWithErrorHandling kullan
        const result = await fetchWithErrorHandling(`${WEB_API_URL}/SignIlacAciklamaEkle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            },
            body: JSON.stringify({
                EreceteNo: ereceteNo,
                Barkod: barkod,
                Aciklama: aciklama,
                SlotIndex: slotIndex,
                ReceteId: receteId
            }),
            isAgent: false
        });
        if (!result.success) throw new Error(result.error || 'Unsigned XML alınamadı');
        const signedXml = await signXmlWithAgent(result.unsignedXml, pin, slotIndex); // Promise ile imzala
        const extraParams = {
            EreceteNo: ereceteNo,
            Barkod: barkod,
            Aciklama: aciklama,
            ReceteId: receteId
        };
        const submitResult = await submitSignedOperation(signedXml, 'IlacAciklamaEkle', extraParams, null); // redirectUrl=null – RELOAD YOK
        Swal.fire({
            icon: 'success',
            title: 'İlaç Açıklama Eklendi!',
            text: 'İlaç açıklaması başarıyla eklendi.',
            confirmButtonColor: '#012F51'
        });
        return submitResult; // Chain için döner
    } catch (err) {
        console.error('İlaç açıklama ekleme hatası:', err);
        Swal.fire({
            icon: 'error',
            title: 'İlaç Açıklama Ekleme Hatası!',
            text: err.message,
            confirmButtonColor: '#012F51'
        });
        throw err; // Chain için fırlat
    }
}
// 🔹 E-Reçete Sil Flow (Promise döner – güncellendi: callback yok, promise chain)
async function startEreceteSilFlow(ereceteNo, pin, slotIndex, receteId = '') {
    try {
        // fetchWithErrorHandling kullan
        const result = await fetchWithErrorHandling(`${WEB_API_URL}/SignEreceteSil`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            },
            body: JSON.stringify({
                EreceteNo: ereceteNo,
                SlotIndex: slotIndex,
                ReceteId: receteId
            }),
            isAgent: false
        });
        if (!result.success) throw new Error(result.error || 'Unsigned XML alınamadı');
        const signedXml = await signXmlWithAgent(result.unsignedXml, pin, slotIndex); // Promise ile imzala
        const extraParams = {
            EreceteNo: ereceteNo,
            ReceteId: receteId
        };
        const submitResult = await submitSignedOperation(signedXml, 'EreceteSil', extraParams, null); // redirectUrl=null – RELOAD YOK
        Swal.fire({
            icon: 'success',
            title: 'E-Reçete Silindi!',
            text: 'E-Reçete başarıyla silindi.',
            confirmButtonColor: '#012F51'
        });
        return submitResult; // Chain için döner
    } catch (err) {
        console.error('E-Reçete silme hatası:', err);
        Swal.fire({
            icon: 'error',
            title: 'E-Reçete Silme Hatası!',
            text: err.message,
            confirmButtonColor: '#012F51'
        });
        throw err; // Chain için fırlat
    }
}
// ✅ GÜNCELLENMIŞ: startImzaliEreceteSorguFlow (callback parametreleri eklendi)
// ✅ GÜNCELLENMIŞ: startImzaliEreceteSorguFlow (case-sensitive property fix: ereceteDVO → lowercase 'e')
async function startImzaliEreceteSorguFlow(ereceteNo, tc, pin, slotIndex, successCallback = null, errorCallback = null) {
    try {
        // fetchWithErrorHandling kullan
        const result = await fetchWithErrorHandling(`${WEB_API_URL}/SignImzaliEreceteSorgu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            },
            body: JSON.stringify({
                EreceteNo: ereceteNo,
                Tc: tc,
                SlotIndex: slotIndex
            }),
            isAgent: false
        });
        if (!result.success) throw new Error(result.error || 'Unsigned XML alınamadı');
        const signedXml = await signXmlWithAgent(result.unsignedXml, pin, slotIndex);
        const extraParams = { EreceteNo: ereceteNo, Tc: tc };
        const submitResult = await submitSignedOperation(signedXml, 'ImzaliEreceteSorgu', extraParams, null, false); // showSwalOnSuccess=false
        // ✅ Success: Callback varsa onu çağır (full submitResult ile – html dahil), yoksa global fallback
        // GÜNCEL: JSON'da "ereceteDVO" (lowercase 'e') – case-sensitive kontrol
        if (submitResult.success && submitResult.data && submitResult.data.ereceteDVO) { // ← lowercase 'e' fix
            console.log('✅ Sorgu sonucu (full payload):', submitResult); // ✅ Debug: Tam payload logla (data + html)
            console.log('ereceteDVO exists:', !!submitResult.data.ereceteDVO); // ✅ Ek debug: Property var mı?
            console.log('html length:', submitResult.html ? submitResult.html.length : 'N/A'); // ✅ Ek debug: HTML var mı?
            if (successCallback) {
                successCallback(submitResult); // ← Full submitResult geçir (data.html yerine submitResult.html için)
            } else {
                // Global fallback (ReceteSorgu uyumlu)
                const accordionBody = $('#receteDetay'); // Varsayılan selector
                accordionBody.html(submitResult.html || 'Detay yüklendi.');
            }
        } else {
            // ❌ Error: Backend başarısız (sonucKodu != 0000 vb.)
            // GÜNCEL: Detaylı debug log ekle (neden else'e düştüğünü gör)
            console.error('Sorgu success koşulu başarısız:', {
                hasSuccess: !!submitResult?.success,
                hasData: !!submitResult?.data,
                hasEreceteDVO: !!submitResult?.data?.ereceteDVO, // lowercase check
                dataKeys: submitResult?.data ? Object.keys(submitResult.data) : 'no data',
                fullSubmitResult: submitResult // Tam obje (expand et console'da)
            });
            const msg = submitResult?.message || submitResult?.data?.sonucMesaji || 'Sorgu başarısız.';
            if (errorCallback) {
                errorCallback(msg);
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'İmzalı Sorgu Hatası!',
                    text: msg,
                    confirmButtonColor: '#012F51'
                });
            }
        }
        return submitResult;
    } catch (err) {
        console.error('İmzalı sorgu hatası:', err);
        const msg = err.message;
        if (errorCallback) {
            errorCallback(msg); // View-specific hata handle
        } else {
            Swal.fire({
                icon: 'error',
                title: 'İmzalı Sorgu Hatası!',
                text: msg,
                confirmButtonColor: '#012F51'
            });
        }
        throw err;
    }
}
// ✅ GÜNCELLENMIŞ: startImzaliEreceteListeSorguFlow (callback logic zaten var, ama açıklama eklendi)
async function startImzaliEreceteListeSorguFlow(tc, pin, slotIndex, successCallback = null, errorCallback = null) {
    try {
        // fetchWithErrorHandling kullan
        const result = await fetchWithErrorHandling(`${WEB_API_URL}/SignImzaliEreceteListeSorgu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            },
            body: JSON.stringify({
                Tc: tc,
                SlotIndex: slotIndex
            }),
            isAgent: false
        });
        if (!result.success) throw new Error(result.error || 'Unsigned XML alınamadı');
        const signedXml = await signXmlWithAgent(result.unsignedXml, pin, slotIndex);
        const extraParams = { Tc: tc };
        const submitResult = await submitSignedOperation(signedXml, 'ImzaliEreceteListeSorgu', extraParams, null, false); // showSwalOnSuccess=false
        if (submitResult.success && submitResult.data) {
            const data = submitResult.data;
            if (data.sonucKodu === "0000") {
                if (data.ereceteListesi && data.ereceteListesi.length > 0) {
                    // ✅ SUCCESS: Mapping + callback
                    const mappedResults = data.ereceteListesi.map(r => ({
                        receteId: r.ereceteNo || '',
                        receteTarihi: r.receteTarihi || '',
                        hastaAdSoyad: `${r.kisiDVO ? `${r.kisiDVO.adi || ''} ${r.kisiDVO.soyadi || ''}`.trim() : `Hasta (TC: ${tc})`}`,
                        doktorAdi: r.doktorAdi || '',
                        doktorSoyadi: r.doktorSoyadi || '',
                        hastaTc: tc,
                        ilacSayisi: r.ereceteIlacListesi?.length || 0,
                        teshisSayisi: r.ereceteTaniListesi?.length || 0,
                        ereceteNo: r.ereceteNo || '',
                        Source: 'medula'
                    }));
                    console.log('✅ Liste sorgu sonucu:', mappedResults.length + ' reçete bulundu');
                    if (successCallback) {
                        // ✅ Callback: View-specific render
                        successCallback(mappedResults, data); // mappedResults + raw data
                    } else {
                        // Global fallback (ReceteSorgu uyumlu)
                        window.allResults = mappedResults;
                        if (typeof window.renderAccordion === 'function') window.renderAccordion();
                        if ($('#sonucContainer').length) $('#sonucContainer').show();
                        if (typeof window.updateSonucBilgi === 'function') window.updateSonucBilgi();
                    }
                } else {
                    // ❌ Boş liste (0000 ama liste yok)
                    const msg = 'Medula\'da reçete bulunamadı.';
                    if (errorCallback) errorCallback(msg, 'info');
                    else Swal.fire({ icon: 'info', title: 'Bilgi', text: msg, confirmButtonColor: '#012F51' });
                }
            } else {
                // ❌ Error (9107 vb.)
                const msg = data.sonucMesaji || 'Sorgu başarısız (şifre veya bağlantı hatası kontrol edin).';
                if (errorCallback) errorCallback(msg, 'error');
                else Swal.fire({ icon: 'error', title: 'İmzalı Liste Sorgu Hatası!', text: msg, confirmButtonColor: '#012F51' });
            }
        } else {
            // ❌ Genel error
            const msg = submitResult?.message || 'Sorgu başarısız.';
            if (errorCallback) errorCallback(msg, 'error');
            else Swal.fire({ icon: 'error', title: 'İmzalı Liste Sorgu Hatası!', text: msg, confirmButtonColor: '#012F51' });
        }
        return submitResult;
    } catch (err) {
        console.error('İmzalı liste sorgu hatası:', err);
        const msg = err.message;
        if (errorCallback) errorCallback(msg, 'error');
        else Swal.fire({ icon: 'error', title: 'İmzalı Liste Sorgu Hatası!', text: msg, confirmButtonColor: '#012F51' });
        throw err;
    }
}

// 🔹 İmzalılı E-Rapor Liste Sorgu Flow (mevcut EreceteListeSorgu pattern'le – Promise döner)
async function startImzaliEraporListeSorguFlow(tc, pin, slotIndex, successCallback = null, errorCallback = null) {
    try {
        // 1. Unsigned XML al (SignImzaliEraporListeSorgu endpoint'inden)
        const result = await fetchWithErrorHandling(`${WEB_API_URL}/SignImzaliEraporListeSorgu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            },
            body: JSON.stringify({
                Tc: tc,
                SlotIndex: slotIndex
            }),
            isAgent: false
        });
        if (!result.success) throw new Error(result.error || 'Unsigned XML alınamadı');

        // 2. Ajan ile imzala
        const signedXml = await signXmlWithAgent(result.unsignedXml, pin, slotIndex);

        // 3. SubmitSignedXml'e gönder (case: "ImzaliEraporListeSorgu")
        const extraParams = { Tc: tc };
        const submitResult = await submitSignedOperation(signedXml, 'ImzaliEraporListeSorgu', extraParams, null, false); // showSwalOnSuccess=false (view handle eder)

        // 4. Success kontrolü + Mapping + Callback
        if (submitResult.success && submitResult.data?.SonucKodu === "0000") { // Case-sensitive: SonucKodu
            const data = submitResult.data;
            if (data.EraporListesi && data.EraporListesi.length > 0) {
                // Mapping: Rapor listesini accordion için hazırla (FormattedRecete gibi)
                const mappedResults = data.EraporListesi.map(r => ({
                    raporTakipNo: r.raporTakipNo || '',
                    raporTarihi: r.raporTarihi || '',
                    hastaAdSoyad: `${data.KisiDVO ? `${data.KisiDVO.adi || ''} ${data.KisiDVO.soyadi || ''}`.trim() : `Hasta (TC: ${tc})`}`,
                    doktorAdi: r.doktorAdi || '',
                    doktorSoyadi: r.doktorSoyadi || '',
                    hastaTc: tc,
                    etkinMaddeSayisi: r.eraporEtkinMaddeListesi?.length || 0, // Yeni: Etkin madde
                    teshisSayisi: r.eraporTeshisListesi?.length || 0,
                    Source: 'medula'
                }));
                console.log('✅ Rapor liste sonucu:', mappedResults.length + ' rapor bulundu');
                if (successCallback) {
                    successCallback(mappedResults, data); // View-specific render (accordion)
                } else {
                    // Global fallback (EraporListeSorgu view uyumlu)
                    window.allResults = mappedResults;
                    if (typeof window.renderEraporAccordion === 'function') window.renderEraporAccordion(); // View'de tanımlayın
                    $('#sonucContainer').removeClass('d-none');
                    if (typeof window.updateSonucBilgi === 'function') window.updateSonucBilgi('Sorgu tamamlandı.');
                }
            } else {
                // Boş liste (0000 ama liste yok)
                const msg = 'Medula\'da rapor bulunamadı.';
                if (errorCallback) errorCallback(msg, 'info');
                else Swal.fire({ icon: 'info', title: 'Bilgi', text: msg, confirmButtonColor: '#012F51' });
            }
        } else {
            // Error (9107 vb.)
            const msg = submitResult?.data?.SonucMesaji || submitResult?.message || 'Liste sorgu başarısız.';
            if (errorCallback) errorCallback(msg, 'error');
            else Swal.fire({ icon: 'error', title: 'İmzalı Rapor Liste Sorgu Hatası!', text: msg, confirmButtonColor: '#012F51' });
        }
        return submitResult;
    } catch (err) {
        console.error('İmzalı rapor liste sorgu hatası:', err);
        const msg = err.message;
        if (errorCallback) errorCallback(msg, 'error');
        else Swal.fire({ icon: 'error', title: 'İmzalı Rapor Liste Sorgu Hatası!', text: msg, confirmButtonColor: '#012F51' });
        throw err;
    }
}

// 🔹 İmzalılı E-Rapor Detay Sorgu Flow (mevcut EreceteSorgu pattern'le – Promise döner)
async function startImzaliEraporSorgulaFlow(raporTakipNo, pin, slotIndex, successCallback = null, errorCallback = null) {
    try {
        // 1. Unsigned XML al (SignImzaliEraporSorgula endpoint'inden)
        const result = await fetchWithErrorHandling(`${WEB_API_URL}/SignImzaliEraporSorgula`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            },
            body: JSON.stringify({
                RaporTakipNo: raporTakipNo,
                SlotIndex: slotIndex
            }),
            isAgent: false
        });
        if (!result.success) throw new Error(result.error || 'Unsigned XML alınamadı');

        // 2. Ajan ile imzala
        const signedXml = await signXmlWithAgent(result.unsignedXml, pin, slotIndex);

        // 3. SubmitSignedXml'e gönder (case: "ImzaliEraporSorgula")
        const extraParams = { RaporTakipNo: raporTakipNo };
        const submitResult = await submitSignedOperation(signedXml, 'ImzaliEraporSorgula', extraParams, null, false); // showSwalOnSuccess=false (view handle eder)

        // 4. Success kontrolü + Callback (partial render için)
        if (submitResult.success && submitResult.data?.SonucKodu === "0000") { // Case-sensitive
            const data = submitResult.data;
            console.log('✅ Rapor detay sonucu:', data.EraporDVO);
            if (successCallback) {
                successCallback(data.EraporDVO, submitResult.html || ''); // Raw DVO + rendered HTML
            } else {
                // Global fallback (EraporSorgula view uyumlu)
                $('#eraporDetayContainer').html(submitResult.html || 'Detay yüklendi.'); // Partial yükle
            }
        } else {
            // Error
            const msg = submitResult?.data?.SonucMesaji || submitResult?.message || 'Detay sorgu başarısız.';
            if (errorCallback) errorCallback(msg);
            else Swal.fire({ icon: 'error', title: 'İmzalı Rapor Detay Sorgu Hatası!', text: msg, confirmButtonColor: '#012F51' });
        }
        return submitResult;
    } catch (err) {
        console.error('İmzalı rapor detay sorgu hatası:', err);
        const msg = err.message;
        if (errorCallback) errorCallback(msg);
        else Swal.fire({ icon: 'error', title: 'İmzalı Rapor Detay Sorgu Hatası!', text: msg, confirmButtonColor: '#012F51' });
        throw err;
    }
}

// 🔹 Batch Edit Flow (Güncellenmiş: Medula case'de otomatik sorgu flow tetikle – mimari JS-odaklı)
// 🔹 Batch Edit Flow (Güncellenmiş: Medula case'de otomatik sorgu flow tetikle – mimari JS-odaklı)
async function startBatchEditFlow(receteId, pin, slotIndex, editData, successCallback = null, errorCallback = null) {
    try {
        // 1. Backend hazırlık (ReceteDuzenle çağır – prepareSuccess bekle)
        const prepareResult = await fetchWithErrorHandling(`${WEB_API_URL}/ReceteDuzenle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            },
            body: JSON.stringify({
                ReceteId: receteId,
                Pin: pin,
                SlotIndex: slotIndex,
                EditData: editData
            }),
            isAgent: false
        });
        if (!prepareResult.prepareSuccess) {
            const msg = prepareResult.message || prepareResult.errors?.[0] || 'Hazırlık başarısız.';
            if (errorCallback) errorCallback(msg, 'error');
            else Swal.fire({ icon: 'error', title: 'Düzenleme Hazırlık Hatası!', text: msg, confirmButtonColor: '#012F51' });
            throw new Error(msg);
        }
        console.log(`Batch hazırlık: ${prepareResult.operationCount} işlem hazırlandı.`);
        const unsignedOperations = prepareResult.unsignedOperations || [];
        const updatedRecete = prepareResult.updatedRecete || {};
        if (unsignedOperations.length === 0) {
            const msg = 'Düzenlenecek işlem yok.';
            if (errorCallback) errorCallback(msg, 'info');
            else Swal.fire({ icon: 'info', title: 'Bilgi', text: msg, confirmButtonColor: '#012F51' });
            return prepareResult;
        }
        // **YENİ: Medula case kontrolü – updatedRecete boşsa otomatik sorgu flow tetikle (mimari: JS flow odaklı)**
        let finalUpdatedRecete = updatedRecete;
        if (updatedRecete.Source === 'medula' && !updatedRecete.hastaAdSoyad) { // Boşsa sorgula
            console.log('Medula case – Otomatik hasta sorgu flow tetikleniyor...');
            const sorguResult = await startImzaliEreceteSorguFlow(receteId, '', pin, slotIndex, // Tc boş – receteNo ile sorgula
                (sorguData) => {
                    // Success: Gerçek veriyi updatedRecete'ye merge et (FIX: SADECE lowercase kullan – case-sensitive mismatch giderildi)
                    console.log('✅ Sorgu success callback tetiklendi (lowercase fix):', sorguData.data); // Debug: Tam data logla
                    if (sorguData.data?.ereceteDVO) { // ← SADECE lowercase 'e' kontrol et (uppercase kaldırıldı)
                        const kisiDVO = sorguData.data.ereceteDVO?.kisiDVO || {}; // ← SADECE lowercase (KisiDVO kaldırıldı)
                        finalUpdatedRecete = {
                            ...updatedRecete,
                            hastaTc: kisiDVO.tcKimlikNo || '', // ← lowercase (TcKimlikNo kaldırıldı)
                            hastaAdSoyad: `${kisiDVO.adi || ''} ${kisiDVO.soyadi || ''}`.trim() || 'Hasta Bilgisi Yüklenemedi', // ← lowercase (Adi/Soyadi kaldırıldı)
                            receteTarihi: sorguData.data.ereceteDVO?.receteTarihi || new Date().toLocaleDateString('tr-TR') // ← JS Date() (C# DateTime.Now fix)
                        };
                        console.log('✅ Sorgu merge başarılı (lowercase):', finalUpdatedRecete); // Debug: Merge sonucu
                        // Accordion güncelle (successCallback ile)
                        if (typeof updateAccordionFromRecete === 'function') updateAccordionFromRecete(finalUpdatedRecete);
                    } else {
                        console.warn('❌ Sorgu data.ereceteDVO yok (mismatch devam ediyor?) – fallback kullan:', sorguData.data); // Debug: Neden merge başarısız?
                    }
                },
                (sorguErr) => {
                    console.warn('Hasta sorgu başarısız – Accordion boş bırak:', sorguErr);
                    // Boş accordion: JS'de handle (aşağıdaki helper)
                    if (typeof updateAccordionFromRecete === 'function') updateAccordionFromRecete({ ...updatedRecete, hastaAdSoyad: 'Hasta Bilgisi Erişilemedi' });
                }
            );
        } else {
            // System case: Direkt kullan
            console.log('System case – updatedRecete dolu, accordion güncelle.');
            if (typeof updateAccordionFromRecete === 'function') updateAccordionFromRecete(updatedRecete);
        }
        // 2. Loop: İmzala + submit (aynı)
        const results = [];
        let loadingMsg = Swal.fire({
            title: 'İşlemler İşleniyor...',
            text: 'Lütfen bekleyin.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });
        showLoading('batchEditButton', true);
        for (const op of unsignedOperations) {
            try {
                const signedXml = await signXmlWithAgent(op.unsignedXml, pin, slotIndex);
                const submitResult = await submitSignedOperation(signedXml, op.type, op.operationParams, null, false);
                results.push({ type: op.type, success: submitResult.success, message: submitResult.message, data: submitResult.data });
            } catch (opErr) {
                results.push({ type: op.type, success: false, message: opErr.message });
            }
        }
        loadingMsg.close();
        showLoading('batchEditButton', false);
        // 3. Toplu sonuç (aynı – dinamik Swal)
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const total = results.length;
        const successCount = successful.length;
        let swalConfig = { confirmButtonColor: '#012F51' };
        if (successCount === total) {
            swalConfig.icon = 'success';
            swalConfig.title = 'Başarılı!';
            swalConfig.text = successful.map(r => r.message || `${r.type} tamamlandı.`).join('\n');
            if (successCallback) successCallback(results, finalUpdatedRecete);
        } else if (successCount > 0) {
            swalConfig.icon = 'warning';
            swalConfig.title = 'Kısmi Başarı!';
            swalConfig.text = `${successCount}/${total} başarılı.\nBaşarılı: ${successful.map(r => r.type).join(', ')}\nBaşarısız: ${failed.map(r => r.type).join(', ')}`;
            swalConfig.footer = failed.map(r => r.message).join('\n');
        } else {
            swalConfig.icon = 'error';
            swalConfig.title = 'Başarısız!';
            swalConfig.text = 'Hiçbir işlem tamamlanamadı.';
            swalConfig.footer = failed.map(r => `${r.type}: ${r.message}`).join('\n');
            if (errorCallback) errorCallback(swalsConfig.text, 'error');
        }
        Swal.fire(swalsConfig);
        return { prepareResult, batchResults: results, finalUpdatedRecete };
    } catch (err) {
        console.error('Batch flow hatası:', err);
        Swal.close();
        showLoading('batchEditButton', false);
        const msg = err.message;
        if (errorCallback) errorCallback(msg, 'error');
        Swal.fire({ icon: 'error', title: 'Batch Hatası!', text: msg, confirmButtonColor: '#012F51' });
        throw err;
    }
}

// **YENİ Helper: Accordion güncelle (boş updatedRecete handle et)**
function updateAccordionFromRecete(receteData) {
    const accordion = $('#receteDetay');  // Selector'ı uyarla
    if (!receteData.hastaAdSoyad) {
        accordion.html('<div class="alert alert-warning">Hasta bilgisi yüklenemedi – Düzenleme devam ediyor.</div>');  // Boş bırak/uyarı
        return;
    }
    // Doldur: Hasta adı, Tc vb.
    accordion.html(`
        <div class="card">
            <div class="card-body">
                <h6>Hasta: ${receteData.hastaAdSoyad} (TC: ${receteData.hastaTc})</h6>
                <p>Tarih: ${receteData.receteTarihi} | İlaç: ${receteData.ilacSayisi} | Teşhis: ${receteData.teshisSayisi}</p>
            </div>
        </div>
    `);
    accordion.show();  // Göster
}

// 🔹 Loading Helper (aynı)
function showLoading(elementId, show) {
    const el = $(`#${elementId}`);
    if (show) {
        el.prop('disabled', true).append('<span class="spinner-border spinner-border-sm ms-2"></span>');
    } else {
        el.prop('disabled', false).find('.spinner-border').remove();
    }
}