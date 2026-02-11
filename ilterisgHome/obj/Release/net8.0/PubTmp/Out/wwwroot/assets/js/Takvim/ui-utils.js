// import Swal from 'sweetalert2'; // Bu satırı kaldır

// Modal'ları başlat
export function initializeModals() {
    const modals = {
        eventTypeSelectionModal: new bootstrap.Modal(document.getElementById("event-type-selection-modal"), { keyboard: false }),
        eventModal: new bootstrap.Modal(document.getElementById("event-modal"), { keyboard: true }),
        personalEventModal: new bootstrap.Modal(document.getElementById("personal-event-modal"), { keyboard: true }),
        viewEventModal: new bootstrap.Modal(document.getElementById("view-event-modal"), { keyboard: true }),
        firmSelectionModal: new bootstrap.Modal(document.getElementById("firmSelectionModal"), { keyboard: true }),
        exportReportModal: new bootstrap.Modal(document.getElementById("export-report-modal"), { keyboard: true }),
        kapatModal: new bootstrap.Modal(document.getElementById("kapat-onay-modal"), { keyboard: true }),
        dokumanYukleModal: new bootstrap.Modal(document.getElementById("dokumanYukleModal"), { keyboard: true })
    };

    // Modal açılma ve kapanma olaylarını logla
    Object.keys(modals).forEach(modalKey => {
        const modal = modals[modalKey];
        if (modal && modal._element) {
            modal._element.addEventListener('shown.bs.modal', () => {
                console.log(`[MODAL OPEN] ${modalKey} opened at ${new Date().toISOString()} with element ID: ${modal._element.id}`);
            });
            modal._element.addEventListener('hidden.bs.modal', () => {
                console.log(`[MODAL CLOSE] ${modalKey} closed at ${new Date().toISOString()} with element ID: ${modal._element.id}`);
            });
        } else {
            console.warn(`[MODAL INIT] Modal ${modalKey} could not be initialized: element not found.`);
        }
    });

    return modals;
}

// Modal olay dinleyicilerini kur
export function setupModalListeners(modals, calendar) {
    document.querySelectorAll('.modal').forEach(modalEl => {
        modalEl.addEventListener('shown.bs.modal', function () {
            // Tooltip'leri gizle
            document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(tooltip => {
                const bsTooltip = bootstrap.Tooltip.getInstance(tooltip);
                if (bsTooltip) {
                    bsTooltip.hide();
                }
            });
            if (modalEl.id === 'event-modal') {
                const saveBtn = document.getElementById("btn-save-event");
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = window.translations.Save;
                }
            } else if (modalEl.id === 'personal-event-modal') {
                const saveBtn = document.getElementById("btn-save-personal-event");
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = window.translations.Save;
                }
            } else if (modalEl.id === 'dokumanYukleModal') {
                const form = document.getElementById("dokumanYukleForm");
                const currentRefId = document.getElementById("refId")?.value || '';
                form.reset();
                const inputs = {
                    refId: document.getElementById("refId"),
                    refTableName: document.getElementById("refTableName"),
                    dokumanTuru: document.getElementById("dokumanTuru"),
                    altKategori: document.getElementById("altKategori"),
                    aciklama: document.getElementById("aciklama"),
                    dosya: document.getElementById("dosya")
                };
                if (inputs.refId) inputs.refId.value = currentRefId;
                if (inputs.refTableName) inputs.refTableName.value = currentRefId ? inputs.refTableName.value : '';
                if (inputs.dokumanTuru) inputs.dokumanTuru.value = currentRefId ? inputs.dokumanTuru.value : '';
                if (inputs.altKategori) inputs.altKategori.value = '';
                if (inputs.aciklama) inputs.aciklama.value = '';
                if (inputs.dosya) inputs.dosya.value = '';
                console.log(`[MODAL DOKUMAN] DokumanYukleModal açıldı, refId sıfırlama sonrası: ${inputs.refId?.value || 'boş'}`);
            }
        });


        modalEl.addEventListener('hidden.bs.modal', function () {
            // Geçici etkinlikleri kaldır
            calendar.getEvents().forEach(event => {
                if (event.extendedProps.isTemp) {
                    event.remove();
                }
            });

            if (modalEl.id === 'event-modal') {
                const eventForm = document.getElementById("form-event");
                if (eventForm) {
                    eventForm.reset();
                    const inputs = [
                        "event-title", "event-category", "event-firma-id",
                        "event-egitim-turu", "event-tehlike-sinifi", "event-sure", "event-tarihi"
                    ].map(id => document.getElementById(id));
                    inputs.forEach(input => {
                        if (input) input.value = '';
                    });
                    eventForm.classList.remove("was-validated", "view-event");
                    const existingDetails = eventForm.querySelector('.event-details');
                    if (existingDetails) existingDetails.remove();
                }
            } else if (modalEl.id === 'personal-event-modal') {
                const personalEventForm = document.getElementById("form-personal-event");
                if (personalEventForm) {
                    personalEventForm.reset();
                    const inputs = [
                        "personal-event-title", "personal-event-start", "personal-event-end",
                        "personal-event-description", "personal-event-firma", "personal-event-personeller"
                    ].map(id => document.getElementById(id));
                    inputs.forEach(input => {
                        if (input) input.value = '';
                    });
                    personalEventForm.classList.remove("was-validated", "view-event");
                    const existingDetails = personalEventForm.querySelector('.event-details');
                    if (existingDetails) existingDetails.remove();
                }
            } else if (modalEl.id === 'dokumanYukleModal') {
                const inputs = ["refId", "refTableName", "dokumanTuru"].map(id => document.getElementById(id));
                inputs.forEach(input => {
                    if (input) input.value = '';
                });
            }
        });
    });
}

// Hata mesajı göster
export function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'Hata!',
        text: message,
        confirmButtonText: 'Tamam',
        timer: 5000,
        timerProgressBar: true
    });
}

// Modal formunu sıfırla
export function resetModalForm(modal, form, inputs) {
    if (!form) {
        console.warn("[MODAL RESET] Form elementi bulunamadı.");
        return;
    }
    form.reset();
    inputs.forEach(input => {
        if (input) {
            input.value = '';
            input.classList.remove('is-invalid', 'is-valid');
        }
    });
    form.classList.remove("was-validated", "view-event");
    const existingDetails = form.querySelector('.event-details');
    if (existingDetails) existingDetails.remove();
}

// API isteği yap
export async function apiCall(url, method = 'GET', body = null) {
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };

    // Anti-forgery token
    const tokenElement = document.querySelector('input[name="__RequestVerificationToken"]');
    if (method !== 'GET' && !tokenElement) {
        console.error("[API CALL] Anti-forgery token bulunamadı.");
        showError("Güvenlik token'ı eksik. Lütfen sayfayı yenileyin veya tekrar oturum açın.");
        throw new Error("Anti-forgery token bulunamadı.");
    }
    if (tokenElement && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
        headers['RequestVerificationToken'] = tokenElement.value;
    }

    const options = {
        method,
        headers,
        credentials: 'same-origin', // Cookie'leri gönder
        body: body ? JSON.stringify(body) : null
    };

    console.log(`[API CALL] İstek gönderiliyor: ${url}, Method: ${method}, Headers:`, headers, body ? `Body: ${JSON.stringify(body)}` : '');

    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'spinner-overlay';
    loadingSpinner.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Yükleniyor...</span></div>';
    loadingSpinner.style.display = 'none';
    document.body.appendChild(loadingSpinner);

    try {
        loadingSpinner.style.display = 'flex';
        const response = await fetch(url, options);
        let responseData;

        // Yanıtın içeriğini kontrol et
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            const text = await response.text();
            console.error(`[API CALL] JSON olmayan yanıt alındı: ${text}`);
            throw new Error(`Sunucudan geçersiz yanıt alındı: ${text}`);
        }

        if (!response.ok) {
            console.error(`[API CALL] Hata yanıtı: ${response.status} ${response.statusText}`, responseData);
            let errorMessage = responseData.message || `İstek başarısız: ${response.statusText}`;
            switch (response.status) {
                case 401:
                    errorMessage = "Oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapın.";
                    break;
                case 403:
                    errorMessage = "Bu işlemi gerçekleştirmek için yetkiniz yok.";
                    break;
                case 400:
                    errorMessage = responseData.message || "Geçersiz istek.";
                    break;
                default:
                    errorMessage = responseData.message || `Sunucu hatası: ${response.status}`;
            }
            throw new Error(errorMessage);
        }

        console.log("[API CALL] Yanıt alındı:", responseData);
        return responseData;
    } catch (err) {
        console.error("[API CALL] Hata:", err.message);
        showError(err.message);
        throw err;
    } finally {
        loadingSpinner.remove();
    }
}

// Doküman yükleme modalını aç
export function openYukleModal(refTableName, refId, dokumanTuru, altKategori = '') {
    console.log("[MODAL DOKUMAN] openYukleModal çağrıldı: refId:", refId, "dokumanTuru:", dokumanTuru, "refTableName:", refTableName);
    const inputs = {
        refTableName: document.getElementById('refTableName'),
        refId: document.getElementById('refId'),
        dokumanTuru: document.getElementById('dokumanTuru'),
        altKategori: document.getElementById('altKategori'),
        aciklama: document.getElementById('aciklama'),
        dosya: document.getElementById('dosya')
    };

    if (!inputs.refTableName || !inputs.refId || !inputs.dokumanTuru) {
        console.error("[MODAL DOKUMAN] Gerekli input elementleri bulunamadı.");
        showError('Doküman yükleme formu eksik.');
        return;
    }

    inputs.refTableName.value = refTableName;
    inputs.refId.value = refId.toString();
    inputs.dokumanTuru.value = dokumanTuru; // Doğru dokumanTuru değerini koru
    inputs.altKategori.value = altKategori;
    inputs.aciklama.value = altKategori ? JSON.stringify({ altKategori: altKategori }) : '';
    inputs.dosya.value = '';

    console.log("[MODAL DOKUMAN] Form değerleri ayarlandı:", {
        refTableName: inputs.refTableName.value,
        refId: inputs.refId.value,
        dokumanTuru: inputs.dokumanTuru.value,
        altKategori: inputs.altKategori.value,
        aciklama: inputs.aciklama.value
    });

    const modal = new bootstrap.Modal(document.getElementById('dokumanYukleModal'), { keyboard: true });
    modal.show();
}