import { showError, resetModalForm, apiCall, openYukleModal } from './ui-utils.js';
import { isDateInPast } from './calendar-utils.js';

// SignalR bağlantısını kur
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/notificationHub")
    .withAutomaticReconnect()
    .build();

// Takvim örneği
let calendar;
let selectedEvent = null;
let selectedFirmaId = null;
let isSubmitting = false;
let tempDate = null;
let isDragAction = false;
let draggedFirmaId = null;
// Etkinlik ID'sini global olarak saklamak için
let tempEventId = null;
let tempEventType = null;

// Yeni etkinlik ekle butonuna tıklama
export function handleNewEvent(eventTypeSelectionModal) {
    return () => {
        console.log("New event button clicked.");
        selectedFirmaId = null;
        window.selectedFirmaId = null; // Firma seçimini sıfırla
        tempDate = new Date().toISOString().split("T")[0];
        isDragAction = false;
        eventTypeSelectionModal.show();
    };
}

// Yeni sınav oluştur butonuna tıklama
export function handleNewSinav() {
    return () => {
        console.log("New sinav button clicked.");
        Swal.fire({
            title: window.translations.CreateExam,
            text: window.translations.RedirectingToExamCreation,
            icon: 'info',
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: true,
            confirmButtonText: window.translations.GoNow
        }).then(() => {
            const startDate = tempDate || new Date().toISOString().split("T")[0];
            console.log("[handleNewSinav] Redirecting to:", `/EgitimGruplari/CreateSinav?startDate=${startDate}`);
            window.location.href = `/EgitimGruplari/CreateSinav?startDate=${startDate}`;
        });
    };
}

// Etkinlik türü seçimi için olay dinleyicileri
export function handleEventTypeSelection(modals, userRoles, currentUserFirmaId, calendar) {
    document.getElementById('select-egitim').addEventListener('click', () => {
        modals.eventTypeSelectionModal.hide();
        if (userRoles.includes('OSGB')) {
            if (isDragAction && window.selectedFirmaId) {
                // Sürükle-bırak durumunda firmSelectionModal'ı atla
                newEgitim(tempDate || new Date().toISOString().split("T")[0], userRoles, modals, calendar);
            } else {
                modals.firmSelectionModal.show();
                modals.firmSelectionModal._element.dataset.eventType = 'Egitim'; // Etkinlik türünü sakla
            }
        } else {
            showError('Eğitim oluşturma yetkiniz yok.');
        }
    });

    document.getElementById('select-etkinlik').addEventListener('click', () => {
        modals.eventTypeSelectionModal.hide();
        newPersonalEtkinlik(tempDate || new Date().toISOString().split("T")[0], 'Etkinlik', modals, currentUserFirmaId, userRoles, calendar);
    });

    document.getElementById('select-toplanti').addEventListener('click', () => {
        modals.eventTypeSelectionModal.hide();
        if (userRoles.includes('OSGB')) {
            if (isDragAction && window.selectedFirmaId) {
                // Sürükle-bırak durumunda firmSelectionModal'ı atla
                newPersonalEtkinlik(tempDate || new Date().toISOString().split("T")[0], 'Toplanti', modals, currentUserFirmaId, userRoles, calendar);
            } else {
                modals.firmSelectionModal.show();
                modals.firmSelectionModal._element.dataset.eventType = 'Toplanti'; // Etkinlik türünü sakla
            }
        } else {
            showError('Toplantı oluşturma yetkiniz yok.');
        }
    });

    document.getElementById('select-ziyaret').addEventListener('click', () => {
        modals.eventTypeSelectionModal.hide();
        if (userRoles.includes('OSGB')) {
            if (isDragAction && window.selectedFirmaId) {
                // Sürükle-bırak durumunda firmSelectionModal'ı atla
                newPersonalEtkinlik(tempDate || new Date().toISOString().split("T")[0], 'Ziyaret', modals, currentUserFirmaId, userRoles, calendar);
            } else {
                modals.firmSelectionModal.show();
                modals.firmSelectionModal._element.dataset.eventType = 'Ziyaret'; // Etkinlik türünü sakla
            }
        } else {
            showError('Ziyaret oluşturma yetkiniz yok.');
        }
    });

    document.getElementById('select-diger').addEventListener('click', () => {
        modals.eventTypeSelectionModal.hide();
        if (userRoles.includes('OSGB')) {
            if (isDragAction && window.selectedFirmaId) {
                // Sürükle-bırak durumunda firmSelectionModal'ı atla
                newPersonalEtkinlik(tempDate || new Date().toISOString().split("T")[0], 'Diger', modals, currentUserFirmaId, userRoles, calendar);
            } else {
                modals.firmSelectionModal.show();
                modals.firmSelectionModal._element.dataset.eventType = 'Diger'; // Etkinlik türünü sakla
            }
        } else {
            showError('Diğer etkinlik oluşturma yetkiniz yok.');
        }
    });

    // "Evet" butonuna tıklandığında doküman yükleme modalını aç
    document.getElementById('kapat-onay-evet').addEventListener('click', () => {
        modals.kapatOnayModal.hide();
        if (!selectedEvent && !tempEventId) {
            console.error("[EVENT HANDLER] selectedEvent ve tempEventId null, döküman yükleme modalı açılamıyor.");
            showError('Seçili etkinlik bulunamadı. Lütfen tekrar deneyin.');
            return;
        }

        // selectedEvent varsa kullan, yoksa tempEventId ve tempEventType kullan
        const dokumanTuru = selectedEvent
            ? (selectedEvent.extendedProps.etkinlikTuru === 'Toplanti' ? 'ToplantiNotu' :
                selectedEvent.extendedProps.etkinlikTuru === 'Ziyaret' ? 'Ziyaret' :
                    selectedEvent.extendedProps.etkinlikTuru === 'Diger' ? 'DigerEtkinlik' : 'Etkinlik')
            : tempEventType;
        const cleanedId = selectedEvent
            ? (typeof selectedEvent.id === 'string' && selectedEvent.id.startsWith('etkinlik-')
                ? selectedEvent.id.replace('etkinlik-', '')
                : selectedEvent.id)
            : tempEventId;
        const refId = parseInt(cleanedId);
        console.log("[EVENT HANDLER] refId (kapat-onay-evet):", refId);
        console.log("[EVENT HANDLER] dokumanTuru (kapat-onay-evet):", dokumanTuru);

        if (isNaN(refId) || !dokumanTuru) {
            console.error("[EVENT HANDLER] Geçersiz etkinlik ID veya doküman türü:", { refId, dokumanTuru });
            showError('Geçersiz etkinlik ID veya doküman türü.');
            return;
        }

        try {
            openYukleModal('Etkinlikler', refId, dokumanTuru);
            console.log("[EVENT HANDLER] openYukleModal çağrıldı: refId:", refId, "dokumanTuru:", dokumanTuru);
        } catch (err) {
            console.error("[EVENT HANDLER] openYukleModal hatası:", err);
            showError('Doküman yükleme modalı açılamadı: ' + err.message);
        }
    });

    // "Hayır" butonuna tıklandığında doküman yüklemeden etkinliği kapat
    document.getElementById('kapat-onay-hayir').addEventListener('click', async () => {
        modals.kapatOnayModal.hide();
        try {
            const cleanedId = typeof selectedEvent.id === 'string' && selectedEvent.id.startsWith('etkinlik-')
                ? selectedEvent.id.replace('etkinlik-', '')
                : selectedEvent.id;
            const refId = parseInt(cleanedId);
            console.log("[EVENT HANDLER] refId (kapat-onay-hayir):", refId);
            if (isNaN(refId)) {
                showError(window.translations.InvalidEventId);
                return;
            }
            const kapatResponse = await apiCall(`/api/Calendar/KapatEtkinlik?id=${refId}`, 'POST');
            if (kapatResponse.success) {
                selectedEvent.setProp('classNames', 'bg-primary');
                selectedEvent.setExtendedProp('isClosed', true);
                calendar.refetchEvents();
                Swal.fire(window.translations.Success, window.translations.EventClosedSuccessfully, 'success');
            } else {
                throw new Error(kapatResponse.message || window.translations.EventCloseFailed);
            }
        } catch (err) {
            showError(`${window.translations.EventCloseFailed} ${err.message}`);
        }
    });

    // Doküman yükleme formu submit edildiğinde
    document.getElementById('dokumanYukleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        console.log("[EVENT HANDLER] formData.get('refId') raw value:", formData.get('refId'));
        const refId = parseInt(formData.get('refId'));
        console.log("[EVENT HANDLER] refId (dokumanYukleForm submit):", refId);
        if (isNaN(refId)) {
            showError(window.translations.InvalidEventId);
            return;
        }
        const refTableName = formData.get('refTableName');
        const dokumanTuru = formData.get('dokumanTuru');
        const altKategori = formData.get('altKategori');
        if (altKategori) {
            formData.set('aciklama', JSON.stringify({ altKategori: altKategori }));
        }
        try {
            const response = await fetch('/Dokuman/DokumanYukle', {
                method: 'POST',
                body: formData,
                headers: {
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]').value
                }
            });
            const result = await response.json();
            if (result.success) {
                const kapatResponse = await apiCall(`/api/Calendar/KapatEtkinlik?id=${refId}`, 'POST');
                if (kapatResponse.success) {
                    selectedEvent.setProp('classNames', 'bg-primary');
                    selectedEvent.setExtendedProp('isClosed', true);
                    const dokumanYukleModalElement = document.getElementById('dokumanYukleModal');
                    const dokumanYukleModal = bootstrap.Modal.getInstance(dokumanYukleModalElement);
                    if (dokumanYukleModal) {
                        dokumanYukleModal.hide();
                    }
                    calendar.refetchEvents();
                    Swal.fire(window.translations.Success, window.translations.EventClosedSuccessfully, 'success');
                } else {
                    throw new Error(kapatResponse.message || window.translations.EventCloseFailed);
                }
            } else {
                throw new Error(result.message || window.translations.DocumentUploadFailed);
            }
        } catch (err) {
            showError(`${window.translations.DocumentUploadOrEventCloseFailed} ${err.message}`);
        }
    });
}

// Firma listesini yükle
export async function loadOSGBFirms(modals, userRoles) {
    if (!userRoles.includes('OSGB')) return;

    try {
        const data = await apiCall('/api/Calendar/getOSGBFirms');
        if (Array.isArray(data)) {
            const firmaSelect = document.getElementById('selectedFirmaId');
            const draggableEl = document.getElementById("firma-listesi");
            if (!draggableEl) {
                showError(window.translations.FirmaListElementNotFound);
                return;
            }
            if (data.length === 0) {
                showError(window.translations.NoFirmsYet);
            }
            firmaSelect.innerHTML = `<option value="">${window.translations.SelectCompany}</option>`;
            draggableEl.innerHTML = '';
            data.forEach(firma => {
                const firmaDiv = document.createElement("div");
                firmaDiv.className = "external-event fc-event bg-primary";
                firmaDiv.setAttribute("data-class", "bg-primary");
                const firmaId = firma.id !== undefined ? firma.id : (firma.Id !== undefined ? firma.Id : (firma.FirmaId !== undefined ? firma.FirmaId : "unknown"));
                const firmaName = firma.name !== undefined ? firma.name : (firma.Name !== undefined ? firma.Name : (firma.FirmaAdi !== undefined ? firma.FirmaAdi : window.translations.UnknownCompany));
                firmaDiv.setAttribute("data-firma-id", firmaId);
                firmaDiv.style.display = "block";
                firmaDiv.style.padding = "5px";
                firmaDiv.style.marginBottom = "5px";
                firmaDiv.style.backgroundColor = "#007bff";
                firmaDiv.style.color = "white";
                firmaDiv.innerHTML = `<i class="mdi mdi-checkbox-blank-circle font-size-11 me-2"></i>${firmaName}`;
                draggableEl.appendChild(firmaDiv);

                const option = document.createElement("option");
                option.value = firmaId;
                option.text = firmaName;
                firmaSelect.appendChild(option);
            });

            new FullCalendar.Draggable(draggableEl, {
                itemSelector: ".external-event",
                eventData: (el, ev) => {
                    const firmaId = el.getAttribute("data-firma-id");
                    if (ev && ev.dataTransfer) {
                        ev.dataTransfer.setDragImage(new Image(), 0, 0);
                    }
                    return {
                        title: el.innerText.trim(),
                        className: el.getAttribute("data-class") || "bg-primary",
                        firmaId: firmaId || "unknown",
                        create: true,
                        extendedProps: {
                            firmaId: firmaId
                        }
                    };
                }
            });

            const eventFirmaSelect = document.getElementById('event-firma-id');
            const personalFirmaSelect = document.getElementById('personal-event-firma');
            eventFirmaSelect.innerHTML = '<option value="">Seçin...</option>';
            personalFirmaSelect.innerHTML = '<option value="">Seçin...</option>';
            data.forEach(firma => {
                const option = document.createElement('option');
                option.value = firma.id;
                option.text = firma.name;
                eventFirmaSelect.appendChild(option);
                const option2 = document.createElement('option');
                option2.value = firma.id;
                option2.text = firma.name;
                personalFirmaSelect.appendChild(option2);
            });
            if (selectedFirmaId) {
                eventFirmaSelect.value = selectedFirmaId;
            }
        } else {
            throw new Error('Firmalar listesi Array değil.');
        }
    } catch (err) {
        showError('Firmalar yüklenemedi: ' + err.message);
    }
}

// Eğitim türlerini yükle
export async function loadEgitimTurleri(userRoles, modals) {
    if (!userRoles.includes('OSGB')) return;

    try {
        const data = await apiCall('/api/Calendar/GetEgitimTurleri');
        const select = document.getElementById('event-egitim-turu');
        select.innerHTML = '<option value="">Seçin...</option>';
        if (data.success && Array.isArray(data.data)) {
            data.data.forEach(tur => {
                const option = document.createElement('option');
                option.value = tur.egitimTuruId || '';
                option.text = tur.ad || `Eğitim Türü ${tur.egitimTuruId || 'Bilinmeyen'}`;
                select.appendChild(option);
            });
        } else {
            select.innerHTML += '<option value="1">Temel İş Güvenliği</option><option value="2">İleri İş Güvenliği</option>';
            showError('Eğitim türleri veritabanından alınamadı. Varsayılan türler eklendi.');
        }
        modals.eventModal._element.addEventListener('shown.bs.modal', () => {
            select.style.display = "block";
        });
    } catch (err) {
        const select = document.getElementById('event-egitim-turu');
        select.innerHTML += '<option value="1">Temel İş Güvenliği</option><option value="2">İleri İş Güvenliği</option>';
        showError('Eğitim türleri yüklenemedi. Varsayılan türler eklendi: ' + err.message);
    }
}

// Firma listesini yükle (eski loadFirms fonksiyonu)
function loadFirms() {
    fetch('/api/Calendar/getOSGBFirms')
        .then(response => response.json())
        .then(data => {
            const firmaListesi = document.getElementById('firma-listesi');
            firmaListesi.innerHTML = '';

            data.forEach(firma => {
                const div = document.createElement('div');
                div.className = 'external-event fc-event';
                div.innerText = firma.Name;
                div.setAttribute('data-firma-id', firma.Id);
                div.draggable = true;
                firmaListesi.appendChild(div);
            });

            document.querySelectorAll('.external-event').forEach(firma => {
                firma.addEventListener('dragstart', function (e) {
                    draggedFirmaId = this.getAttribute('data-firma-id');
                    e.dataTransfer.setData('text/plain', draggedFirmaId);
                });
            });
        })
        .catch(err => console.error('Firma listesi yüklenemedi:', err));
}

// Personel listesini yükle
async function loadPersoneller(firmaId, selectedUsers = []) {
    if (!firmaId) {
        const personelSelect = document.getElementById('personal-event-personeller');
        personelSelect.innerHTML = '';
        return;
    }

    try {
        const data = await apiCall(`/api/Calendar/GetFirmPersoneller?firmaId=${firmaId}`);
        if (data.success && Array.isArray(data.data)) {
            const personelSelect = document.getElementById('personal-event-personeller');
            personelSelect.innerHTML = '';
            data.data.forEach(personel => {
                const option = document.createElement('option');
                option.value = personel.kullaniciId;
                option.text = personel.adSoyad + (personel.tcKimlikNo ? ` (${personel.tcKimlikNo})` : '');
                if (selectedUsers.some(user => user.KullaniciId === personel.kullaniciId)) {
                    option.selected = true;
                }
                personelSelect.appendChild(option);
            });

            const personelList = document.getElementById('personel-list');
            personelList.innerHTML = '';
            data.data.forEach(personel => {
                const listItem = document.createElement('div');
                listItem.className = 'list-group-item';
                const isSelected = selectedUsers.some(user => user.KullaniciId === personel.kullaniciId);
                listItem.innerHTML = `
                    <input type="checkbox" class="form-check-input" value="${personel.kullaniciId}" ${isSelected ? 'checked' : ''}>
                    <span>${personel.adSoyad}${personel.tcKimlikNo ? ` (${personel.tcKimlikNo})` : ''}</span>
                `;
                const checkbox = listItem.querySelector('input');
                checkbox.addEventListener('change', () => {
                    const option = Array.from(personelSelect.options).find(opt => parseInt(opt.value) === personel.kullaniciId);
                    option.selected = checkbox.checked;
                    updateSelectedPersonnel();
                });
                personelList.appendChild(listItem);
            });

            updateSelectedPersonnel();
        } else {
            showError('Personel bulunamadı: ' + (data.message || 'Bilinmeyen hata'));
        }
    } catch (err) {
        showError('Personel listesi yüklenemedi: ' + err.message);
    }
}

// Seçilen personelleri güncelle (UI için)
function updateSelectedPersonnel() {
    const selectedPersonnelList = document.getElementById('selected-personnel-list');
    const personelSelect = document.getElementById('personal-event-personeller');
    const selectedPersonnelContainer = document.getElementById('selected-personnel');
    selectedPersonnelList.innerHTML = '';

    const selectedOptions = Array.from(personelSelect.selectedOptions);
    if (selectedOptions.length > 0) {
        selectedPersonnelContainer.style.display = 'block';
        selectedOptions.forEach(option => {
            const badge = document.createElement('span');
            badge.className = 'badge bg-primary';
            badge.innerHTML = `${option.text} <i class="mdi mdi-close"></i>`;
            badge.dataset.value = option.value;
            badge.addEventListener('click', () => {
                option.selected = false;
                updateSelectedPersonnel();
                const checkbox = document.querySelector(`#personel-list input[value="${option.value}"]`);
                if (checkbox) checkbox.checked = false;
            });
            selectedPersonnelList.appendChild(badge);
        });
    } else {
        selectedPersonnelContainer.style.display = 'none';
    }
}

export async function handleEventClick(info, userRoles, modals, isPersonel, calendar, userId) {
    try {
        // Tüm tooltip'leri gizle
        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(tooltip => {
            const bsTooltip = bootstrap.Tooltip.getInstance(tooltip);
            if (bsTooltip) {
                bsTooltip.hide();
            }
        });

        // Seçilen etkinliği sakla
        selectedEvent = info.event;
        console.log("[EVENT HANDLER] selectedEvent:", selectedEvent);
        console.log("[EVENT HANDLER] selectedEvent.id (raw):", selectedEvent?.id);
        console.log("[EVENT HANDLER] selectedEvent.start (raw):", selectedEvent?.start);
        console.log("[EVENT HANDLER] selectedEvent.end (raw):", selectedEvent?.end);
        console.log("[EVENT HANDLER] selectedEvent.extendedProps:", selectedEvent.extendedProps);
        console.log("[EVENT HANDLER] Mevcut Kullanıcı ID (Kullanicilar.KullaniciId):", userId);

        // Etkinlik ID ve türünü sakla
        tempEventId = typeof selectedEvent.id === 'string' && selectedEvent.id.startsWith('etkinlik-')
            ? parseInt(selectedEvent.id.replace('etkinlik-', ''))
            : parseInt(selectedEvent.id);
        tempEventType = selectedEvent.extendedProps.etkinlikTuru || 'Etkinlik';
        console.log("[EVENT HANDLER] tempEventId ve tempEventType saklandı:", { tempEventId, tempEventType });

        // Modal açılmadan önce accordion'ı sıfırla
        const dokumanCollapse = document.getElementById('dokumanCollapse');
        if (dokumanCollapse) {
            dokumanCollapse.classList.remove('show');
            const accordionButton = document.querySelector('#dokumanCollapse')?.previousElementSibling?.querySelector('.accordion-button');
            if (accordionButton) {
                accordionButton.classList.add('collapsed');
                accordionButton.setAttribute('aria-expanded', 'false');
                console.log("[EVENT HANDLER] Accordion sıfırlandı ve renk sıfırlandı (modal açılmadan önce).");
            }
        }

        // Döküman sayısı ve listesini sıfırla
        const dokumanSayisiText = document.getElementById('dokumanSayisiText');
        const dokumanListesi = document.getElementById('dokumanListesi');
        if (dokumanSayisiText) dokumanSayisiText.innerHTML = 'Yüklenen Dokümanlar';
        if (dokumanListesi) dokumanListesi.innerHTML = '<tr><td colspan="3" class="text-center">Doküman yükleniyor...</td></tr>';

        // sinavElements'ı fonksiyon başında tanımla
        const sinavElements = [
            'view-modal-title', 'view-event-title', 'view-event-start', 'view-event-end',
            'view-event-type', 'view-event-description', 'view-oturum-durumu', 'view-event-firma',
            'view-event-grup-adi', 'view-event-etkinlik-turu', 'view-event-atanmis-kullanicilar',
            'view-event-durum', 'view-event-sure', 'view-event-tehlike-sinifi', 'view-event-egitim-turu'
        ];

        // katilimcilarTable ve viewEventModal'ı null olarak başlat
        let katilimcilarTable = null;
        const viewEventModal = modals.viewEventModal?._element;

        if (!viewEventModal) {
            console.error("[EVENT HANDLER] viewEventModal DOM elementi bulunamadı!");
            showError('Etkinlik görüntüleme modalı bulunamadı.');
            return;
        }

        // Kapat onay evet durumu için bayrak
        let isKapatOnayEvet = false;

        if (selectedEvent.extendedProps.type === 'egitim') {
            // Eğitimle ilgili mevcut kod (değiştirilmedi)
            console.log("[EVENT HANDLER] Eğitim etkinliği işleniyor. EgitimId:", selectedEvent.id);
            if (userRoles.includes('OSGB')) {
                const editBtn = document.getElementById("edit-event-btn");
                const saveBtn = document.getElementById("btn-save-event");
                const deleteBtn = document.getElementById("btn-delete-event");

                if (editBtn && saveBtn && deleteBtn) {
                    editBtn.removeAttribute("hidden");
                    saveBtn.setAttribute("hidden", "true");
                    deleteBtn.removeAttribute("hidden");
                    editBtn.setAttribute("data-id", "edit-event");
                    editBtn.innerHTML = "Düzenle";
                    const formEvent = document.getElementById("form-event");
                    if (formEvent) {
                        formEvent.classList.remove("readonly-modal");
                    }
                }

                if (modals.eventModal) {
                    modals.eventModal.show();
                    resetModalForm(modals.eventModal, document.getElementById("form-event"), [
                        document.getElementById("event-title"),
                        document.getElementById("event-category"),
                        document.getElementById("event-firma-id"),
                        document.getElementById("event-egitim-turu"),
                        document.getElementById("event-tehlike-sinifi"),
                        document.getElementById("event-sure")
                    ]);
                    const formEvent = document.getElementById("form-event");
                    if (formEvent) {
                        formEvent.dataset.date = selectedEvent.start.toISOString().split('T')[0];
                    }
                    const titleInput = document.getElementById("event-title");
                    const categoryInput = document.getElementById("event-category");
                    const firmaInput = document.getElementById("event-firma-id");
                    const egitimTuruInput = document.getElementById("event-egitim-turu");
                    const tehlikeSinifiInput = document.getElementById("event-tehlike-sinifi");
                    const sureInput = document.getElementById("event-sure");
                    const tarihInput = document.getElementById("event-tarihi");

                    if (titleInput) titleInput.value = selectedEvent.extendedProps.egitimAdi || "Belirtilmedi";
                    if (categoryInput) categoryInput.value = selectedEvent.classNames[0] || "";
                    if (firmaInput) firmaInput.value = selectedEvent.extendedProps.firmaId || "";
                    if (egitimTuruInput) egitimTuruInput.value = selectedEvent.extendedProps.egitimTuruId || "";
                    if (tehlikeSinifiInput) tehlikeSinifiInput.value = selectedEvent.extendedProps.tehlikeSinifi || "";
                    if (sureInput) sureInput.value = selectedEvent.extendedProps.sure || "";
                    if (tarihInput) tarihInput.value = selectedEvent.start.toISOString().split('T')[0];

                    eventClicked();
                } else {
                    showError('Eğitim modalı bulunamadı.');
                }
            } else {
                console.log("[EVENT HANDLER] Kullanıcı OSGB değil, eğitim detayları gösteriliyor.");
                const viewModalTitle = document.getElementById('view-modal-title');
                const viewEventTitle = document.getElementById('view-event-title');
                const viewEventStart = document.getElementById('view-event-start');
                const viewEventEnd = document.getElementById('view-event-end');
                const viewEventType = document.getElementById('view-event-type');
                const viewEventDescription = document.getElementById('view-event-description');
                const viewEventSure = document.getElementById('view-event-sure');
                const viewEventTehlikeSinifi = document.getElementById('view-event-tehlike-sinifi');
                const viewEventEgitimTuru = document.getElementById('view-event-egitim-turu');
                const viewEventFirma = document.getElementById('view-event-firma');
                const viewEventEtkinlikTuru = document.getElementById('view-event-etkinlik-turu');
                const viewEventAtanmisKullanicilar = document.getElementById('view-event-atanmis-kullanicilar');
                const viewEventDurum = document.getElementById('view-event-durum');
                const viewEventOturumDurumu = document.getElementById('view-oturum-durumu');
                const viewEventGrupAdi = document.getElementById('view-event-grup-adi');

                if (viewModalTitle) viewModalTitle.innerHTML = 'Eğitim Detayları';
                if (viewEventTitle) viewEventTitle.innerHTML = selectedEvent.title || 'Belirtilmedi';
                if (viewEventStart) viewEventStart.innerHTML = selectedEvent.start.toLocaleDateString('tr-TR', { dateStyle: 'short' });
                if (viewEventEnd) {
                    const endDate = selectedEvent.end || selectedEvent.start; // end null ise start kullan
                    viewEventEnd.innerHTML = endDate && !isNaN(new Date(endDate).getTime())
                        ? new Date(endDate).toLocaleDateString('tr-TR', { dateStyle: 'short' })
                        : 'Bitiş tarihi belirtilmemiş';
                    console.log("[EVENT HANDLER] viewEventEnd güncellendi (Eğitim):", viewEventEnd.innerHTML);
                }
                if (viewEventType) viewEventType.innerHTML = 'Eğitim';
                if (viewEventDescription) viewEventDescription.innerHTML = selectedEvent.extendedProps.description || 'Yok';
                if (viewEventSure) viewEventSure.innerHTML = selectedEvent.extendedProps.sure || 'Yok';
                if (viewEventTehlikeSinifi) viewEventTehlikeSinifi.innerHTML = selectedEvent.extendedProps.tehlikeSinifi || 'Yok';
                if (viewEventEgitimTuru) viewEventEgitimTuru.innerHTML = selectedEvent.extendedProps.egitimTuruAdi || 'Yok';
                if (viewEventFirma) viewEventFirma.innerHTML = selectedEvent.extendedProps.firmaAdi || 'Yok';
                if (viewEventEtkinlikTuru) viewEventEtkinlikTuru.innerHTML = '';
                if (viewEventAtanmisKullanicilar) viewEventAtanmisKullanicilar.innerHTML = '';
                if (viewEventDurum) viewEventDurum.innerHTML = '';
                if (viewEventOturumDurumu) viewEventOturumDurumu.innerHTML = '';
                if (viewEventGrupAdi) viewEventGrupAdi.innerHTML = '';

                const egitimOnlyElements = document.querySelectorAll('.egitim-only');
                egitimOnlyElements.forEach(el => el.style.display = 'block');

                const etkinlikOnlyElements = document.querySelectorAll('.etkinlik-only');
                etkinlikOnlyElements.forEach(el => el.style.display = 'none');

                const sinavOnlyElements = document.querySelectorAll('.sinav-only');
                sinavOnlyElements.forEach(el => el.style.display = 'none');

                const btnEgitimAl = document.getElementById('btn-egitim-al');
                if (btnEgitimAl) {
                    btnEgitimAl.setAttribute('hidden', 'true');
                    console.log("[EVENT HANDLER] Eğitim Al butonu kontrolü: userRoles:", userRoles);
                    if (userRoles.includes('Personel')) {
                        console.log("[EVENT HANDLER] Eğitim Al butonu gösteriliyor. Kullanıcı Personel rolüne sahip.");
                        btnEgitimAl.removeAttribute('hidden');
                        btnEgitimAl.setAttribute("data-egitim-id", selectedEvent.id);
                    } else if (userRoles.includes('İşveren')) {
                        console.log("[EVENT HANDLER] Eğitim Al butonu gizleniyor. Kullanıcı İşveren rolüne sahip.");
                    } else {
                        console.log("[EVENT HANDLER] Eğitim Al butonu gizleniyor. Kullanıcı ne Personel ne de İşveren rolüne sahip.");
                    }
                }

                if (modals.viewEventModal) {
                    modals.viewEventModal.show();
                } else {
                    showError('Etkinlik görüntüleme modalı bulunamadı.');
                }
            }
        }
        if (selectedEvent.extendedProps.etkinlikTuru === 'Sinav') {
            // Güvenli etkinlik ID ayrıştırma
            let etkinlikId = selectedEvent.extendedProps.refEtkinlikId; // Önce extendedProps'tan al
            if (!etkinlikId || isNaN(etkinlikId)) {
                const idString = typeof selectedEvent.id === 'string' ? selectedEvent.id : '';
                etkinlikId = parseInt(idString.replace(/^sinav-|^etkinlik-/, '')) || null; // sinav- veya etkinlik- ön ekini kaldır
                console.log("[EVENT HANDLER] refEtkinlikId bulunamadı, idString'den ayrıştırılıyor:", idString, "Sonuç etkinlikId:", etkinlikId);
            }
            console.log("[EVENT HANDLER] Sınav etkinliği için GetSinavOturumDetaylari çağrılıyor. Etkinlik ID:", etkinlikId);

            if (!etkinlikId || isNaN(etkinlikId)) {
                console.error("[EVENT HANDLER] Geçersiz etkinlik ID:", etkinlikId);
                showError('Geçersiz etkinlik ID.');
                return;
            }

            // Modal içeriğini sıfırla
            console.log("[EVENT HANDLER] Modal içeriği sıfırlanıyor.");
            sinavElements.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '';
            });
            katilimcilarTable = document.getElementById('view-katilimcilar');
            if (katilimcilarTable) {
                katilimcilarTable.innerHTML = '';
                console.log("[EVENT HANDLER] katilimcilarTable sıfırlandı.");
            }
            viewEventModal.querySelectorAll('.sinav-only, .egitim-only, .etkinlik-only').forEach(el => {
                el.style.display = 'none';
            });
            ['view-sinav-baslat', 'view-sinav-bitir', 'view-rapor-detay', 'view-sinava-katil', 'view-sinav-sonuc', 'btn-delete-etkinlik'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.setAttribute('hidden', 'true');
                    btn.removeAttribute('data-oturum-id');
                    btn.removeAttribute('data-etkinlik-id');
                    btn.removeAttribute('data-listener-added');
                }
            });

            // Sınav detaylarını çek
            try {
                const data = await apiCall(`/api/Calendar/GetSinavOturumDetaylari?etkinlikId=${etkinlikId}`, 'GET');
                console.log("[EVENT HANDLER] API’den çekilen sınav detayları:", JSON.stringify(data));

                if (data?.success && Array.isArray(data.data) && data.data.length > 0) {
                    const detay = data.data[0];

                    console.log("[EVENT HANDLER] Sınav Detayları - Grup Adı:", detay.grupAdi);
                    console.log("[EVENT HANDLER] Sınav Detayları - Başlangıç Tarihi:", detay.baslamaTarihi);
                    console.log("[EVENT HANDLER] Sınav Detayları - Bitiş Tarihi:", detay.bitisTarihi);
                    console.log("[EVENT HANDLER] Sınav Detayları - Personel Durumları:", JSON.stringify(detay.personelDurumlari));

                    const viewModalTitle = document.getElementById('view-modal-title');
                    const viewEventTitle = document.getElementById('view-event-title');
                    const viewEventStart = document.getElementById('view-event-start');
                    const viewEventEnd = document.getElementById('view-event-end');
                    const viewEventType = document.getElementById('view-event-type');
                    const viewEventDescription = document.getElementById('view-event-description');
                    const viewEventOturumDurumu = document.getElementById('view-oturum-durumu');
                    const viewEventFirma = document.getElementById('view-event-firma');
                    const viewEventGrupAdi = document.getElementById('view-event-grup-adi');
                    const viewEventAtanmisKullanicilar = document.getElementById('view-event-atanmis-kullanicilar');
                    const viewEventDurum = document.getElementById('view-event-durum');

                    if (viewModalTitle) viewModalTitle.innerHTML = window.translations.CalendarExamDetails;
                    if (viewEventTitle) viewEventTitle.innerHTML = detay.sinavAdi || window.translations.Unspecified;

                    const formatDate = (dateStr) => {
                        if (!dateStr) return window.translations.Unspecified;
                        const date = new Date(dateStr);
                        return isNaN(date.getTime()) ? window.translations.InvalidDate :
                            date.toLocaleDateString(navigator.language, { dateStyle: 'short' });
                    };

                    if (viewEventStart) viewEventStart.innerHTML = formatDate(detay.baslamaTarihi);
                    if (viewEventEnd) viewEventEnd.innerHTML = formatDate(detay.bitisTarihi);
                    if (viewEventType) viewEventType.innerHTML = window.translations.Exam;
                    if (viewEventDescription) viewEventDescription.innerHTML = detay.egitimAdi || window.translations.Exam;
                    if (viewEventOturumDurumu) {
                        viewEventOturumDurumu.innerHTML = detay.oturumDurumu || window.translations.Unknown;
                        viewEventOturumDurumu.className = `badge ${detay.oturumDurumu === window.translations.Completed ? 'bg-success' :
                            detay.oturumDurumu === window.translations.Started || detay.oturumDurumu === window.translations.InProgress ? 'bg-warning' :
                                detay.oturumDurumu === window.translations.NotStarted ? 'bg-primary' : 'bg-info'}`;
                    }
                    if (viewEventFirma) viewEventFirma.innerHTML = detay.firmaAdi || window.translations.Unspecified;
                    if (viewEventGrupAdi) viewEventGrupAdi.innerHTML = detay.grupAdi || window.translations.Unspecified;
                    if (viewEventAtanmisKullanicilar) {
                        const kullanicilar = Array.isArray(detay.personelDurumlari) && detay.personelDurumlari.length > 0
                            ? detay.personelDurumlari.map(p => p.adSoyad || window.translations.UnknownUser).join(', ')
                            : window.translations.NoUserSpecified;
                        viewEventAtanmisKullanicilar.innerHTML = kullanicilar;
                        console.log("[EVENT HANDLER] viewEventAtanmisKullanicilar güncellendi:", kullanicilar);
                    }
                    if (viewEventDurum) viewEventDurum.innerHTML = ''; // Durum alanını tabloya taşıdık

                    // Katılımcılar tablosunu güncelle
                    if (katilimcilarTable) {
                        console.log("[EVENT HANDLER] katilimcilarTable güncelleniyor. personelDurumlari:", JSON.stringify(detay.personelDurumlari));
                        katilimcilarTable.innerHTML = ''; // Tabloyu sıfırla
                        if (Array.isArray(detay.personelDurumlari) && detay.personelDurumlari.length > 0) {
                            detay.personelDurumlari.forEach((p, index) => {
                                console.log(`[EVENT HANDLER] Katılımcı ${index + 1}:`, {
                                    adSoyad: p.adSoyad,
                                    durum: p.durum,
                                    puan: p.puan,
                                    basarili: p.basarili,
                                    denemeSayisi: p.denemeSayisi,
                                    testTarihi: p.testTarihi,
                                    tcDogrulandiMi: p.tcDogrulandiMi
                                });
                                const adSoyad = p.adSoyad || window.translations.Unspecified;
                                const durum = p.durum || window.translations.Unknown;
                                const badgeClass = durum === window.translations.Completed ? 'bg-success' :
                                    durum === window.translations.NotParticipated ? 'bg-danger' :
                                        durum === window.translations.InProgress ? 'bg-warning' : 'bg-info';
                                const puan = p.puan !== null && p.puan !== undefined ? p.puan : '-';
                                const basarili = p.basarili !== null && p.basarili !== undefined ? (p.basarili ? window.translations.Yes : window.translations.No) : '-';
                                const denemeSayisi = p.denemeSayisi !== null && p.denemeSayisi !== undefined ? p.denemeSayisi : '-';
                                const testTarihi = p.testTarihi ? formatDate(p.testTarihi) : '-';
                                katilimcilarTable.innerHTML += `
                        <tr>
                            <td>${adSoyad}</td>
                            <td><span class="badge ${badgeClass}">${durum}</span></td>
                            <td>${puan}</td>
                            <td>${basarili}</td>
                            <td>${denemeSayisi}</td>
                            <td>${testTarihi}</td>
                        </tr>`;
                            });
                            console.log("[EVENT HANDLER] katilimcilarTable güncellendi. HTML içeriği:", katilimcilarTable.innerHTML);
                        } else {
                            katilimcilarTable.innerHTML = `<tr><td colspan="6" class="text-center">${window.translations.NoParticipantsFound}</td></tr>`;
                            console.log("[EVENT HANDLER] Katılımcı bulunamadı, varsayılan mesaj ayarlandı.");
                        }
                    } else {
                        console.error("[EVENT HANDLER] katilimcilarTable DOM elementi bulunamadı!");
                        showError(window.translations.ParticipantsTableNotFound);
                    }
                    document.querySelectorAll('.egitim-only, .etkinlik-only').forEach(el => el.style.display = 'none');
                    document.querySelectorAll('.sinav-only').forEach(el => {
                        el.style.display = 'block';
                        console.log("[EVENT HANDLER] sinav-only elementi görünür yapıldı:", el);
                    });
                    const btnEgitimAl = document.getElementById('btn-egitim-al');
                    const btnKapatEtkinlik = document.getElementById('btn-kapat-etkinlik');
                    if (btnEgitimAl) btnEgitimAl.setAttribute('hidden', 'true');
                    if (btnKapatEtkinlik) btnKapatEtkinlik.setAttribute('hidden', 'true');
                    const osgbButtons = [
                        document.getElementById('view-sinav-baslat'),
                        document.getElementById('view-sinav-bitir'),
                        document.getElementById('view-rapor-detay')
                    ];
                    osgbButtons.forEach(btn => {
                        if (btn) {
                            btn.setAttribute('hidden', 'true');
                            btn.setAttribute('data-etkinlik-id', etkinlikId);
                        }
                    });
                    if (detay.isOSGBorAdmin) {
                        if (detay.oturumDurumu === window.translations.NotStarted) {
                            const baslatBtn = document.getElementById('view-sinav-baslat');
                            if (baslatBtn) {
                                baslatBtn.removeAttribute('hidden');
                            }
                        } else if (detay.oturumDurumu === window.translations.Started || detay.oturumDurumu === window.translations.InProgress) {
                            const bitirBtn = document.getElementById('view-sinav-bitir');
                            if (bitirBtn) {
                                bitirBtn.removeAttribute('hidden');
                            }
                        }
                        const raporBtn = document.getElementById('view-rapor-detay');
                        if (raporBtn) {
                            raporBtn.removeAttribute('hidden');
                        }
                    }

                    const personelButtons = [
                        document.getElementById('view-sinava-katil'),
                        document.getElementById('view-sinav-sonuc')
                    ];
                    personelButtons.forEach(btn => btn && btn.setAttribute('hidden', 'true'));
                    if (isPersonel && !detay.isOSGBorAdmin) {
                        const katilimci = detay.personelDurumlari.find(p => p.kullaniciId === parseInt(userId));
                        if (katilimci) {
                            const oturumResponse = await apiCall(`/api/Egitimlerim/GetOturumIdByEtkinlikAndKullanici?etkinlikId=${etkinlikId}&kullaniciId=${katilimci.kullaniciId}`, 'GET');
                            if (oturumResponse.success && oturumResponse.data?.oturumId) {
                                const oturumId = oturumResponse.data.oturumId;
                                if (detay.oturumDurumu === window.translations.Started || detay.oturumDurumu === window.translations.InProgress) {
                                    const katilBtn = document.getElementById('view-sinava-katil');
                                    if (katilBtn) {
                                        katilBtn.removeAttribute('hidden');
                                        katilBtn.setAttribute('data-oturum-id', oturumId);
                                    }
                                } else if (detay.oturumDurumu === window.translations.Completed) {
                                    const sonucBtn = document.getElementById('view-sinav-sonuc');
                                    if (sonucBtn) {
                                        sonucBtn.removeAttribute('hidden');
                                        sonucBtn.setAttribute('data-oturum-id', oturumId);
                                    }
                                }
                            }
                        }
                    }

                    const addButtonListener = (button, handler, eventName) => {
                        if (button && !button.hasAttribute('data-listener-added')) {
                            button.setAttribute('data-listener-added', 'true');
                            button.addEventListener('click', handler);
                            console.log(`[EVENT HANDLER] ${eventName} butonuna listener eklendi.`);
                        }
                    };

                    addButtonListener(document.getElementById('view-sinav-baslat'), async () => {
                        const etkinlikIdFromButton = parseInt(document.getElementById('view-sinav-baslat').getAttribute('data-etkinlik-id'));
                        console.log("[EVENT HANDLER] Sınav başlatma butonuna tıklandı, etkinlikId:", etkinlikIdFromButton);
                        document.getElementById('view-sinav-baslat').disabled = true;
                        try {
                            if (!userId) {
                                throw new Error(window.translations.UserIdNotFound);
                            }
                            const result = await Swal.fire({
                                title: window.translations.CalendarExamStartTitle,
                                text: window.translations.CalendarExamStartConfirm,
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonText: window.translations.CalendarExamStartYes,
                                cancelButtonText: window.translations.Cancel
                            });
                            if (!result.isConfirmed) {
                                document.getElementById('view-sinav-baslat').disabled = false;
                                return;
                            }
                            const response = await apiCall('/api/EgitimGruplari/BaslatSinavEtkinligi', 'POST', {
                                EtkinlikId: etkinlikIdFromButton,
                                UserId: userId
                            });
                            console.log("[EVENT HANDLER] BaslatSinavEtkinligi API yanıtı:", response);
                            if (response.success) {
                                Swal.fire(window.translations.Success, response.message || window.translations.CalendarExamInvitationsSent, 'success');
                                modals.viewEventModal.hide();
                                calendar.refetchEvents();
                            } else {
                                throw new Error(response.message || window.translations.CalendarExamStartFailed);
                            }
                        } catch (err) {
                            console.error("[EVENT HANDLER] Sınav başlatma hatası:", err);
                            Swal.fire(window.translations.Error, err.message === window.translations.CalendarExamAlreadyStarted ?
                                window.translations.CalendarExamAlreadyStartedMessage :
                                `${window.translations.CalendarExamStartFailedMessage} ${err.message}`, 'error');
                        } finally {
                            document.getElementById('view-sinav-baslat').disabled = false;
                        }
                    }, 'view-sinav-baslat');

                    addButtonListener(document.getElementById('view-sinav-bitir'), async () => {
                        const etkinlikIdFromButton = parseInt(document.getElementById('view-sinav-bitir').getAttribute('data-etkinlik-id'));
                        console.log("[EVENT HANDLER] Sınav bitirme butonuna tıklandı, etkinlikId:", etkinlikIdFromButton);
                        document.getElementById('view-sinav-bitir').disabled = true;
                        try {
                            if (!userId) {
                                throw new Error(window.translations.UserIdNotFound);
                            }
                            const result = await Swal.fire({
                                title: window.translations.CalendarExamCloseTitle,
                                text: window.translations.CalendarExamCloseConfirm,
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonText: window.translations.CalendarExamCloseYes,
                                cancelButtonText: window.translations.Cancel
                            });
                            if (!result.isConfirmed) {
                                document.getElementById('view-sinav-bitir').disabled = false;
                                return;
                            }
                            const response = await apiCall('/api/EgitimGruplari/KapatSinavEtkinligi', 'POST', {
                                EtkinlikId: etkinlikIdFromButton,
                                UserId: userId
                            });
                            console.log("[EVENT HANDLER] KapatSinavEtkinligi API yanıtı:", response);
                            if (response.success) {
                                Swal.fire(window.translations.Success, response.message || window.translations.CalendarExamSessionsClosed, 'success');
                                modals.viewEventModal.hide();
                                calendar.refetchEvents();
                            } else {
                                throw new Error(response.message || window.translations.CalendarExamCloseFailed);
                            }
                        } catch (err) {
                            console.error("[EVENT HANDLER] Sınav bitirme hatası:", err);
                            Swal.fire(window.translations.Error, `${window.translations.CalendarExamCloseFailedMessage} ${err.message}`, 'error');
                        } finally {
                            document.getElementById('view-sinav-bitir').disabled = false;
                        }
                    }, 'view-sinav-bitir');

                    addButtonListener(document.getElementById('view-rapor-detay'), () => {
                        const etkinlikId = document.getElementById('view-rapor-detay').getAttribute('data-etkinlik-id');
                        console.log("[EVENT HANDLER] Oturum detayları görüntüleniyor, etkinlikId:", etkinlikId);
                        try {
                            // API'den oturumId ve grupId'yi al
                            apiCall(`/api/Calendar/GetSinavOturumDetaylari?etkinlikId=${etkinlikId}`, 'GET').then(data => {
                                if (data?.success && Array.isArray(data.data) && data.data.length > 0) {
                                    const grupId = data.data[0].grupId; // API'den gelen grupId
                                    const oturumId = data.data[0].personelDurumlari[0]?.oturumId; // İlk oturumun ID'si
                                    console.log("[EVENT HANDLER] Grup ID alındı:", grupId, "Oturum ID alındı:", oturumId);
                                    if (!grupId || isNaN(grupId)) {
                                        throw new Error('Grup ID geçersiz veya bulunamadı. Lütfen sınavın grup ayarlarını kontrol edin.');
                                    }
                                    if (!oturumId || isNaN(oturumId)) {
                                        throw new Error('Oturum ID geçersiz veya bulunamadı. Lütfen sınav oturumlarını kontrol edin.');
                                    }
                                    modals.viewEventModal.hide();
                                    window.location.href = `/Egitimlerim/OturumDetay?oturumId=${oturumId}&returnViewType=liste&grupId=${grupId}`;
                                } else {
                                    throw new Error(data?.message || 'Sınav detayları alınamadı. Lütfen tekrar deneyin.');
                                }
                            }).catch(err => {
                                console.error("[EVENT HANDLER] Oturum detayları alınırken hata:", err);
                                Swal.fire('Hata!', `Oturum detayları görüntülenemedi: ${err.message}`, 'error');
                            });
                        } catch (err) {
                            console.error("[EVENT HANDLER] Oturum detayları yönlendirme hatası:", err);
                            Swal.fire('Hata!', `Oturum detayları görüntülenemedi: ${err.message}`, 'error');
                        }
                    }, 'view-rapor-detay');

                    addButtonListener(document.getElementById('view-sinava-katil'), async () => {
                        const oturumId = document.getElementById('view-sinava-katil').getAttribute('data-oturum-id');
                        console.log("[EVENT HANDLER] Sınava katılım, oturumId:", oturumId);
                        document.getElementById('view-sinava-katil').disabled = true;
                        try {
                            const response = await apiCall(`/api/Egitimlerim/SinavaKatil?oturumId=${oturumId}`, 'POST');
                            if (response.success) {
                                Swal.fire('Başarılı!', response.message || 'Sınava katılım sağlandı.', 'success');
                                modals.viewEventModal.hide();
                                window.location.href = `/Egitimlerim/Sinav/${oturumId}`;
                            } else {
                                throw new Error(response.message || 'Sınava katılım sağlanamadı.');
                            }
                        } catch (err) {
                            Swal.fire('Hata!', `Sınava katılım sağlanamadı: ${err.message}`, 'error');
                        } finally {
                            document.getElementById('view-sinava-katil').disabled = false;
                        }
                    }, 'view-sinava-katil');

                    addButtonListener(document.getElementById('view-sinav-sonuc'), async () => {
                        const oturumId = document.getElementById('view-sinav-sonuc').getAttribute('data-oturum-id');
                        console.log("[EVENT HANDLER] Sınav sonucu görüntüleniyor, oturumId:", oturumId);
                        document.getElementById('view-sinav-sonuc').disabled = true;
                        try {
                            const response = await apiCall(`/api/Egitimlerim/SinavSonuc?oturumId=${oturumId}`, 'GET');
                            if (response.success) {
                                Swal.fire('Başarılı!', 'Sınav sonucu yükleniyor.', 'success');
                                modals.viewEventModal.hide();
                                window.location.href = `/Egitimlerim/Sonuc/${oturumId}`;
                            } else {
                                throw new Error(response.message || 'Sınav sonucu görüntülenemedi.');
                            }
                        } catch (err) {
                            Swal.fire('Hata!', `Sınav sonucu görüntülenemedi: ${err.message}`, 'error');
                        } finally {
                            document.getElementById('view-sinav-sonuc').disabled = false;
                        }
                    }, 'view-sinav-sonuc');

                    // Modal aç
                    if (modals.viewEventModal) {
                        modals.viewEventModal.show();
                    } else {
                        showError('Sınav görüntüleme modalı bulunamadı.');
                    }
                } else {
                    Swal.fire('Hata!', 'Sınav detayları alınamadı: ' + (data?.message || 'Veriler bulunamadı.'), 'error');
                }
            } catch (err) {
                console.error("[EVENT HANDLER] Sınav detayları alınırken hata:", err);
                Swal.fire('Hata!', `Sınav detayları alınamadı: ${err.message}`, 'error');
            }
        } else {
            // Diğer etkinlik türleri için mevcut kod (değiştirilmedi)
            let etkinlikId = parseInt(typeof selectedEvent.id === 'string' ? selectedEvent.id.replace('etkinlik-', '') : selectedEvent.id);
            console.log("[EVENT HANDLER] Diğer etkinlik türü işleniyor (Etkinlik, Toplantı, Ziyaret, Diğer). EtkinlikTuru:", selectedEvent.extendedProps.etkinlikTuru);

            if (!etkinlikId || isNaN(etkinlikId)) {
                showError('Geçersiz etkinlik ID.');
                return;
            }

            // Etkinlik detaylarını güncelle
            const viewModalTitle = document.getElementById('view-modal-title');
            const viewEventTitle = document.getElementById('view-event-title');
            const viewEventStart = document.getElementById('view-event-start');
            const viewEventEnd = document.getElementById('view-event-end');
            const viewEventType = document.getElementById('view-event-type');
            const viewEventDescription = document.getElementById('view-event-description');
            const viewEventSure = document.getElementById('view-event-sure');
            const viewEventTehlikeSinifi = document.getElementById('view-event-tehlike-sinifi');
            const viewEventEgitimTuru = document.getElementById('view-event-egitim-turu');
            const viewEventFirma = document.getElementById('view-event-firma');
            const viewEventEtkinlikTuru = document.getElementById('view-event-etkinlik-turu');
            const viewEventDurum = document.getElementById('view-event-durum');
            const viewEventOturumDurumu = document.getElementById('view-oturum-durumu');
            const viewEventGrupAdi = document.getElementById('view-event-grup-adi');

            if (viewModalTitle) viewModalTitle.innerHTML = window.translations.EventDetails;
            if (viewEventTitle) viewEventTitle.innerHTML = selectedEvent.title || window.translations.Unspecified;
            if (viewEventStart) viewEventStart.innerHTML = selectedEvent.start.toLocaleDateString(navigator.language, { dateStyle: 'short' });
            if (viewEventEnd) {
                const endDate = selectedEvent.end || selectedEvent.start; // end null ise start kullan
                viewEventEnd.innerHTML = endDate && !isNaN(new Date(endDate).getTime())
                    ? new Date(endDate).toLocaleDateString(navigator.language, { dateStyle: 'short' })
                    : window.translations.NoEndDateSpecified;
                console.log("[EVENT HANDLER] viewEventEnd güncellendi (Etkinlik):", viewEventEnd.innerHTML);
            }
            if (viewEventType) viewEventType.innerHTML = window.translations[selectedEvent.extendedProps.etkinlikTuru] || window.translations.Event;
            if (viewEventDescription) viewEventDescription.innerHTML = selectedEvent.extendedProps.description || window.translations.Unspecified;
            if (viewEventSure) viewEventSure.innerHTML = '';
            if (viewEventTehlikeSinifi) viewEventTehlikeSinifi.innerHTML = '';
            if (viewEventEgitimTuru) viewEventEgitimTuru.innerHTML = '';
            if (viewEventFirma) viewEventFirma.innerHTML = selectedEvent.extendedProps.firmaAdi || window.translations.Unspecified;
            if (viewEventEtkinlikTuru) viewEventEtkinlikTuru.innerHTML = window.translations[selectedEvent.extendedProps.etkinlikTuru] || window.translations.Event;
            if (viewEventDurum) viewEventDurum.innerHTML = selectedEvent.extendedProps.isClosed ? window.translations.Closed : window.translations.Open;
            if (viewEventOturumDurumu) viewEventOturumDurumu.innerHTML = '';
            if (viewEventGrupAdi) viewEventGrupAdi.innerHTML = '';

            // Atanmış kullanıcıları çek
            try {
                const data = await apiCall(`/api/Calendar/GetAtanmisKullanicilar?etkinlikId=${etkinlikId}`, 'GET');
                console.log("[EVENT HANDLER] API’den çekilen Atanmış Kullanıcılar:", JSON.stringify(data));
                const atanmisKullanicilarElement = document.getElementById('view-event-atanmis-kullanicilar');
                if (!atanmisKullanicilarElement) {
                    console.error("[EVENT HANDLER] DOM’da 'view-event-atanmis-kullanicilar' elementi bulunamadı!");
                } else {
                    atanmisKullanicilarElement.innerHTML = data?.success && Array.isArray(data.data) && data.data.length > 0
                        ? data.data.map(k => k.adSoyad || window.translations.UnknownUser).join(', ')
                        : window.translations.NoUserSpecified;
                    console.log("[EVENT HANDLER] DOM güncellendi. Atanmış Kullanıcılar:", atanmisKullanicilarElement.innerHTML);
                }
            } catch (err) {
                console.error("[EVENT HANDLER] Atanmış kullanıcılar alınırken hata:", err);
                const atanmisKullanicilarElement = document.getElementById('view-event-atanmis-kullanicilar');
                if (atanmisKullanicilarElement) {
                    atanmisKullanicilarElement.innerHTML = window.translations.NoUserSpecified;
                }
            }

            // Görünürlük ayarları
            document.querySelectorAll('.egitim-only, .sinav-only').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.etkinlik-only').forEach(el => {
                console.log("[EVENT HANDLER] Etkinlik-only elementi görünürlüğü ayarlanıyor:", el);
                el.style.display = 'block';
            });

            const btnEgitimAl = document.getElementById('btn-egitim-al');
            const btnKapatEtkinlik = document.getElementById('btn-kapat-etkinlik');
            const btnDeleteEtkinlik = document.getElementById('btn-delete-etkinlik');

            if (btnEgitimAl) btnEgitimAl.setAttribute('hidden', 'true');
            if (btnKapatEtkinlik) {
                btnKapatEtkinlik.setAttribute('hidden', 'true');
                // EtkinlikTuru.Etkinlik (0) için kapatma butonunu gizle
                if (selectedEvent.extendedProps.etkinlikTuru !== "Etkinlik" && // Etkinlik türü "Etkinlik" değilse
                    !selectedEvent.extendedProps.isClosed && // Etkinlik açık olmalı
                    ((isPersonel && !userRoles.includes('OSGB') && !userRoles.includes('İşveren')) || // Personel için
                        (selectedEvent.extendedProps.kullaniciId === parseInt(userId)))) { // Veya etkinlik oluşturucusu için
                    console.log("[EVENT HANDLER] Etkinlik Kapat butonu gösteriliyor. EtkinlikTuru:", selectedEvent.extendedProps.etkinlikTuru);
                    btnKapatEtkinlik.removeAttribute('hidden');
                } else {
                    console.log("[EVENT HANDLER] Etkinlik Kapat butonu gizleniyor. EtkinlikTuru:", selectedEvent.extendedProps.etkinlikTuru);
                }
            }

            // Silme butonunun görünürlüğünü kontrol et
            if (btnDeleteEtkinlik) {
                btnDeleteEtkinlik.setAttribute('hidden', 'true');
                btnDeleteEtkinlik.removeAttribute('data-listener-added');
                if (!selectedEvent.extendedProps.isClosed && selectedEvent.extendedProps.etkinlikTuru !== window.translations.Sinav) {
                    try {
                        const creatorResponse = await apiCall(`/api/Calendar/GetEtkinlikCreator?etkinlikId=${etkinlikId}`, 'GET');
                        console.log("[EVENT HANDLER] Etkinlik oluşturucusu alındı:", creatorResponse);
                        console.log("[EVENT HANDLER] Oluşturucu Kullanıcı ID:", creatorResponse?.data?.kullaniciId);
                        console.log("[EVENT HANDLER] Mevcut Kullanıcı ID:", userId);
                        if (creatorResponse.success && creatorResponse.data && parseInt(creatorResponse.data.kullaniciId) === parseInt(userId)) {
                            console.log("[EVENT HANDLER] Silme butonu gösteriliyor. Kullanıcı etkinliği oluşturmuş.");
                            btnDeleteEtkinlik.removeAttribute('hidden');
                            btnDeleteEtkinlik.setAttribute('data-etkinlik-id', etkinlikId);
                            // Silme butonuna olay dinleyicisi ekle
                            btnDeleteEtkinlik.addEventListener('click', async () => {
                                if (selectedEvent) {
                                    const confirmMessage = `${window.translations.ConfirmDeleteEvent} "${selectedEvent.title}" ${window.translations.ConfirmDeleteEventMessage}`;
                                    Swal.fire({
                                        title: window.translations.Confirm,
                                        text: confirmMessage,
                                        icon: 'warning',
                                        showCancelButton: true,
                                        confirmButtonColor: '#3085d6',
                                        cancelButtonColor: '#d33',
                                        confirmButtonText: window.translations.Yes,
                                        cancelButtonText: window.translations.No
                                    }).then(async (result) => {
                                        if (result.isConfirmed) {
                                            try {
                                                const eventId = parseInt(selectedEvent.id.replace('etkinlik-', ''));
                                                console.log("[EVENT HANDLER] Etkinlik silme isteği gönderiliyor. EtkinlikId:", eventId);
                                                const response = await apiCall(`/api/Calendar/DeleteEtkinlik?id=${eventId}`, 'POST');
                                                if (response.success) {
                                                    selectedEvent.remove();
                                                    modals.viewEventModal.hide();
                                                    selectedEvent = null;
                                                    tempEventId = null;
                                                    tempEventType = null;
                                                    calendar.refetchEvents();
                                                    Swal.fire(window.translations.Success, window.translations.EventDeletedSuccessfully, 'success');
                                                    console.log("[EVENT HANDLER] Etkinlik başarıyla silindi ve takvim yenilendi. EtkinlikId:", eventId);
                                                } else {
                                                    throw new Error(response.message || window.translations.ErrorDeletingEvent);
                                                }
                                            } catch (err) {
                                                console.error("[EVENT HANDLER] Etkinlik silme hatası:", err);
                                                showError(`${window.translations.ErrorDeletingEvent} ${err.message}`);
                                            }
                                        }
                                    });
                                } else {
                                    showError(window.translations.NoEventSelected);
                                }
                            }, { once: true }); // Tek kullanımlık dinleyici
                            btnDeleteEtkinlik.setAttribute('data-listener-added', 'true');
                            console.log("[EVENT HANDLER] btn-delete-etkinlik için dinleyici eklendi.");
                        } else {
                            console.log("[EVENT HANDLER] Silme butonu gizleniyor. Kullanıcı etkinliği oluşturmamış.");
                        }
                    } catch (err) {
                        console.error("[EVENT HANDLER] Etkinlik oluşturucusu alınırken hata:", err);
                        showError(`${window.translations.ErrorFetchingCreator} ${err.message}`);
                    }
                } else {
                    console.log("[EVENT HANDLER] Silme butonu gizleniyor. Etkinlik kapalı veya sınav türü.");
                }
            }

            // Dökümanları yükle (etkinlik kapalıysa)
            if (selectedEvent.extendedProps.isClosed) {
                console.log("[EVENT HANDLER] Etkinlik kapalı, dökümanlar yükleniyor. EtkinlikId:", etkinlikId);
                try {
                    const data = await apiCall(`/api/Calendar/GetDokumanlarByEtkinlikId?etkinlikId=${etkinlikId}`, 'GET');
                    console.log("[EVENT HANDLER] API’den çekilen Dökümanlar:", JSON.stringify(data));
                    if (dokumanSayisiText && dokumanListesi) {
                        if (data?.success && Array.isArray(data.data) && data.data.length > 0) {
                            const dokumanSayisi = data.data.length;
                            const dokumanTurleri = [...new Set(data.data.map(d => window.translations[d.dokumanTuru] || d.dokumanTuru))].join(", ");
                            dokumanSayisiText.innerHTML = `${dokumanSayisi} ${window.translations.UploadedDocuments} (${dokumanTurleri})`;

                            let tableContent = '';
                            data.data.forEach(dokuman => {
                                const dosyaTuru = dokuman.dosyaAdi?.split('.').pop()?.toLowerCase() || '';
                                const isGoruntulenebilir = ['jpg', 'jpeg', 'png'].includes(dosyaTuru);
                                const goruntuleButton = isGoruntulenebilir
                                    ? `<button class="btn btn-sm btn-primary waves-effect waves-light me-1 goruntule-btn" data-url="${dokuman.url}" title="${window.translations.View}"><i class="fas fa-eye"></i></button>`
                                    : '';
                                tableContent += `
                        <tr>
                            <td>${dokuman.dosyaAdi || window.translations.Unspecified}</td>
                            <td>${window.translations[dokuman.dokumanTuru] || window.translations.Unknown}</td>
                            <td>
                                ${goruntuleButton}
                                <a href="/Dokuman/Indir?path=${encodeURIComponent(dokuman.url)}" class="btn btn-sm btn-info waves-effect waves-light" title="${window.translations.Download}"><i class="fas fa-download"></i></a>
                            </td>
                        </tr>`;
                            });
                            dokumanListesi.innerHTML = tableContent;

                            document.querySelectorAll('.goruntule-btn').forEach(btn => {
                                btn.addEventListener('click', async function () {
                                    const encryptedUrl = this.getAttribute('data-url');
                                    console.log("[EVENT HANDLER] Görüntüleme butonuna tıklandı, Şifrelenmiş URL:", encryptedUrl);
                                    try {
                                        const response = await fetch(`/Dokuman/Indir?path=${encodeURIComponent(encryptedUrl)}`, {
                                            method: 'GET'
                                        });
                                        if (!response.ok) {
                                            throw new Error(`${window.translations.DocumentFetchFailed} ${response.status} ${response.statusText}`);
                                        }
                                        const contentType = response.headers.get('content-type') || 'application/octet-stream';
                                        const blob = await response.blob();
                                        const blobUrl = URL.createObjectURL(new Blob([blob], { type: contentType }));
                                        const imgElement = document.getElementById('image-preview-content');
                                        if (imgElement) {
                                            imgElement.src = blobUrl;
                                            imgElement.onload = () => {
                                                URL.revokeObjectURL(blobUrl);
                                            };
                                            imgElement.onerror = () => {
                                                URL.revokeObjectURL(blobUrl);
                                                Swal.fire(window.translations.Error, window.translations.DocumentNotImageOrFailed, 'error');
                                            };
                                            const imagePreviewModal = new bootstrap.Modal(document.getElementById('image-preview-modal'));
                                            imagePreviewModal.show();
                                        }
                                    } catch (err) {
                                        console.error("[EVENT HANDLER] Döküman alınırken hata:", err);
                                        showError(`${window.translations.DocumentDisplayFailed} ${err.message}`);
                                    }
                                });
                            });
                        } else {
                            dokumanSayisiText.innerHTML = window.translations.NoUploadedDocuments;
                            dokumanListesi.innerHTML = `<tr><td colspan="3" class="text-center">${window.translations.NoDocumentsFound}</td></tr>`;
                        }
                    }
                } catch (err) {
                    console.error("[EVENT HANDLER] Dökümanlar alınırken hata oluştu:", err);
                    if (dokumanSayisiText) dokumanSayisiText.innerHTML = window.translations.DocumentsFailedToLoad;
                    if (dokumanListesi) dokumanListesi.innerHTML = `<tr><td colspan="3" class="text-center">${window.translations.DocumentsFailedToLoadTable}</td></tr>`;
                }
            } else {
                // Etkinlik açıkken de döküman listesini sıfırla
                if (dokumanSayisiText) dokumanSayisiText.innerHTML = window.translations.NoUploadedDocuments;
                if (dokumanListesi) dokumanListesi.innerHTML = `<tr><td colspan="3" class="text-center">${window.translations.NoDocumentsFound}</td></tr>`;
            }

            if (modals.viewEventModal) {
                modals.viewEventModal.show();
                modals.viewEventModal._element.addEventListener('shown.bs.modal', () => {
                    const dokumanCollapse = document.getElementById('dokumanCollapse');
                    if (dokumanCollapse) {
                        dokumanCollapse.classList.remove('show');
                        const accordionButton = document.querySelector('#dokumanCollapse')?.previousElementSibling?.querySelector('.accordion-button');
                        if (accordionButton) {
                            accordionButton.classList.add('collapsed');
                            accordionButton.setAttribute('aria-expanded', 'false');
                            console.log("[EVENT HANDLER] Accordion sıfırlandı ve renk sıfırlandı (modal açıldığında).");
                        }
                    }
                    const btnKapatEtkinlik = document.getElementById('btn-kapat-etkinlik');
                    if (btnKapatEtkinlik && selectedEvent.extendedProps.etkinlikTuru !== 'Etkinlik') {
                        btnKapatEtkinlik.addEventListener('click', () => {
                            console.log('[EVENT HANDLER] btn-kapat-etkinlik clicked, açma kapat-onay-modal.');
                            try {
                                isKapatOnayEvet = true; // Kapat onay için bayrak ayarla
                                modals.viewEventModal.hide();
                                if (!modals.kapatOnayModal) {
                                    console.error('[EVENT HANDLER] modals.kapatOnayModal is undefined, checking DOM.');
                                    const modalElement = document.getElementById('kapat-onay-modal');
                                    if (!modalElement) {
                                        throw new Error(window.translations.CloseConfirmationModalNotFound);
                                    }
                                    modals.kapatOnayModal = new bootstrap.Modal(modalElement);
                                }
                                modals.kapatOnayModal.show();
                                console.log('[EVENT HANDLER] kapat-onay-modal opened successfully.');
                            } catch (err) {
                                console.error('[EVENT HANDLER] Failed to open kapat-onay-modal:', err.message);
                                showError(`${window.translations.CloseConfirmationModalFailed} ${err.message}`);
                                isKapatOnayEvet = false; // Hata durumunda bayrağı sıfırla
                            }
                        }, { once: true });
                    } else if (btnKapatEtkinlik) {
                        console.log('[EVENT HANDLER] btn-kapat-etkinlik bulunamadı veya EtkinlikTuru.Etkinlik, olay dinleyicisi eklenmedi.');
                    }
                }, { once: true });
                modals.viewEventModal._element.addEventListener('hidden.bs.modal', () => {
                    const dokumanCollapse = document.getElementById('dokumanCollapse');
                    if (dokumanCollapse) {
                        dokumanCollapse.classList.remove('show');
                        const accordionButton = document.querySelector('#dokumanCollapse')?.previousElementSibling?.querySelector('.accordion-button');
                        if (accordionButton) {
                            accordionButton.classList.add('collapsed');
                            accordionButton.setAttribute('aria-expanded', 'false');
                            console.log("[EVENT HANDLER] Accordion sıfırlandı ve renk sıfırlandı (modal kapandığında).");
                        }
                    }
                    console.log("[EVENT HANDLER] viewEventModal kapandı, sınav verileri sıfırlanıyor.");
                    sinavElements.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.innerHTML = '';
                    });
                    if (katilimcilarTable) katilimcilarTable.innerHTML = '';
                    viewEventModal.querySelectorAll('.sinav-only, .egitim-only, .etkinlik-only').forEach(el => {
                        el.style.display = 'none';
                    });
                    ['view-sinav-baslat', 'view-sinav-bitir', 'view-rapor-detay', 'view-sinava-katil', 'view-sinav-sonuc', 'btn-delete-etkinlik'].forEach(id => {
                        const btn = document.getElementById(id);
                        if (btn) {
                            btn.setAttribute('hidden', 'true');
                            btn.removeAttribute('data-listener-added');
                        }
                    });
                    // selectedEvent sıfırlamasını sadece isKapatOnayEvet false ise yap
                    if (!isKapatOnayEvet) {
                        console.log("[EVENT HANDLER] selectedEvent sıralanıyor, isKapatOnayEvet:", isKapatOnayEvet);
                        selectedEvent = null;
                        tempEventId = null;
                        tempEventType = null;
                    } else {
                        console.log("[EVENT HANDLER] selectedEvent sıralanmadı, isKapatOnayEvet:", isKapatOnayEvet);
                    }
                }, { once: true });
            } else {
                showError(window.translations.EventViewModalNotFound);
            }
        }
    } catch (err) {
        console.error("[EVENT HANDLER] handleEventClick genel hata:", err);
        Swal.fire('Hata!', `Etkinlik işlenirken hata oluştu: ${err.message}`, 'error');
    }
}

export function handleDateClick(info, modals) {
    console.log("[EVENT HANDLER] Date clicked:", info.dateStr);
    if (isDateInPast(info.dateStr)) {
        showError('Geçmiş tarihlere etkinlik veya eğitim oluşturulamaz.');
        return;
    }

    selectedFirmaId = null;
    window.selectedFirmaId = null;
    tempDate = info.dateStr;
    isDragAction = false;
    modals.eventTypeSelectionModal.show();
}

export function handleEventDragStart(info, userRoles) {
    console.log("[EVENT HANDLER] Drag started:", info.el.innerText);
    if (!userRoles.includes('OSGB') && info.event?.extendedProps.type === 'egitim') {
        info.revert();
        showError('Eğitim etkinliklerini taşıma yetkiniz yok.');
        return false;
    }
}

export function handleEventReceive(info, userRoles, modals, calendar) {
    console.log("[EVENT HANDLER] Event received:", info.draggedEl.innerText);
    if (!userRoles.includes('OSGB')) {
        info.revert();
        showError('Eğitim oluşturma yetkiniz yok.');
        return;
    }

    if (isDateInPast(info.event.start)) {
        info.revert();
        showError('Geçmiş tarihlere eğitim oluşturulamaz.');
        return;
    }

    // Firma ID'sini sürüklenen elementten al
    selectedFirmaId = parseInt(info.draggedEl.dataset.firmaId);
    window.selectedFirmaId = selectedFirmaId;
    tempDate = info.event.startStr;
    isDragAction = true;

    // Sürükle-bırak durumunda firmSelectionModal'ı atla
    if (!selectedFirmaId || isNaN(selectedFirmaId)) {
        info.revert();
        showError('Geçersiz firma ID.');
        return;
    }

    // eventTypeSelectionModal'ı aç
    modals.eventTypeSelectionModal.show();
    info.event.remove();
}

export function handleEventDrop(info, modals, calendar) {
    console.log("[EVENT HANDLER] Event dropped:", info.event.title);
    console.log("[EVENT HANDLER] selectedEvent.extendedProps:", info.event.extendedProps);

    if (isDateInPast(info.event.start)) {
        info.revert();
        showError('Etkinlik geçmiş tarihlere taşınamaz.');
        return;
    }

    const confirmMessage = `Ertelemek istediğinizden emin misiniz? Etkinlik "${info.event.title}" ${info.event.start.toLocaleDateString()} tarihine taşınacak.`;
    Swal.fire({
        title: 'Onay',
        text: confirmMessage,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Evet',
        cancelButtonText: 'Hayır'
    }).then((result) => {
        if (result.isConfirmed) {
            selectedEvent = info.event;
            selectedEvent.setStart(info.event.start);

            if (info.event.extendedProps.type === 'egitim') {
                const durationInHours = selectedEvent.extendedProps.sure || 1;
                const newEnd = new Date(info.event.start);
                newEnd.setHours(newEnd.getHours() + durationInHours);
                selectedEvent.setEnd(newEnd);

                const firmaId = parseInt(selectedEvent.extendedProps.firmaId);
                console.log("[EVENT HANDLER] firmaId (parseInt sonrası):", firmaId);
                console.log("[EVENT HANDLER] typeof firmaId (parseInt sonrası):", typeof firmaId);

                if (isNaN(firmaId)) {
                    console.error("[EVENT HANDLER] firmaId bir int’e çevrilemedi:", selectedEvent.extendedProps.firmaId);
                    info.revert();
                    showError('Firma ID geçersiz. Eğitim taşınamadı.');
                    return;
                }

                const egitimData = {
                    EgitimId: parseInt(info.event.id),
                    Ad: info.event.title.split(' - ')[1]?.split(' (')[0] || info.event.title,
                    EgitimTarihi: info.event.start.toISOString(),
                    Sure: selectedEvent.extendedProps.sure || 1,
                    TehlikeSinifi: selectedEvent.extendedProps.tehlikeSinifi || "AzTehlikeli",
                    EgitimTuruId: selectedEvent.extendedProps.egitimTuruId || null,
                    RefFirmaId: firmaId
                };

                console.log("[EVENT HANDLER] handleEventDrop - Gönderilecek eğitim verisi:", egitimData);
                console.log("[EVENT HANDLER] typeof egitimData.RefFirmaId:", typeof egitimData.RefFirmaId);

                saveEgitimToServer(egitimData, "Edit", calendar).then(() => {
                    calendar.refetchEvents();
                    Swal.fire('Başarılı!', 'Eğitim etkinliği güncellendi.', 'success');
                }).catch(err => {
                    info.revert();
                    showError('Eğitim etkinliği güncellenemedi: ' + err.message);
                });
            } else {
                const newEnd = info.event.end ? new Date(info.event.end) : null;
                selectedEvent.setEnd(newEnd);
                const eventId = parseInt(info.event.id.replace('etkinlik-', ''));

                if (!info.event.extendedProps.etkinlikTuru) {
                    info.revert();
                    showError('Etkinlik türü bilgisi eksik. Etkinlik taşınamaz.');
                    return;
                }
                if (['Toplanti', 'Ziyaret', 'Diger'].includes(info.event.extendedProps.etkinlikTuru) && !info.event.extendedProps.firmaId) {
                    info.revert();
                    showError('Firma bilgisi eksik. Etkinlik taşınamaz.');
                    return;
                }

                const atanmisKullaniciIds = (info.event.extendedProps.atanmisKullanicilar || [])
                    .filter(k => k && k.KullaniciId && !isNaN(parseInt(k.KullaniciId)))
                    .map(k => parseInt(k.KullaniciId));

                const etkinlikData = {
                    EtkinlikId: eventId,
                    Ad: info.event.title || "Belirtilmedi",
                    BaslangicTarihi: info.event.start.toISOString(),
                    BitisTarihi: newEnd ? newEnd.toISOString() : null,
                    Aciklama: info.event.extendedProps.description || "",
                    EtkinlikTuru: info.event.extendedProps.etkinlikTuru,
                    RefFirmaId: parseInt(info.event.extendedProps.firmaId) || null,
                    AtananKullaniciIds: atanmisKullaniciIds.length > 0 ? atanmisKullaniciIds : []
                };

                console.log("[EVENT HANDLER] handleEventDrop - Gönderilecek etkinlik verisi:", etkinlikData);
                console.log("[EVENT HANDLER] typeof etkinlikData.RefFirmaId:", typeof etkinlikData.RefFirmaId);

                saveEtkinlikToServer(etkinlikData, "Edit", calendar).then(() => {
                    calendar.refetchEvents();
                    Swal.fire('Başarılı!', 'Etkinlik güncellendi.', 'success');
                }).catch(err => {
                    info.revert();
                    showError('Etkinlik güncellenemedi: ' + err.message);
                });
            }
        } else {
            info.revert();
        }
    });
}

// event-handlers.js

// event-handlers.js
export function handleExportReport(modals, currentUserFirmaId) {
    console.log("[EXPORT] handleExportReport çağrıldı. Modals:", modals, "currentUserFirmaId:", currentUserFirmaId);
    const exportModalInstance = modals?.exportReportModal;
    if (!exportModalInstance || !exportModalInstance._element) {
        console.error("[EXPORT] modals.exportReportModal bulunamadı veya element yok.");
        return;
    }
    const modalEl = exportModalInstance._element;
    // Modal her açıldığında personel listesini doldur
    modalEl.addEventListener('shown.bs.modal', async () => {
        console.log("[EXPORT] export-report-modal -> shown.bs.modal tetiklendi.");
        const personelSelect = modalEl.querySelector('#report-personel-id');
        const monthYearInput = modalEl.querySelector('#report-month-year');
        const userFirmaId = currentUserFirmaId ?? window.currentUserFirmaId;
        console.log("[EXPORT] Personel select ve userFirmaId:", { personelSelect, userFirmaId });
        // Ay/Yıl inputuna default olarak bu ayı koy (dolu değilse)
        if (monthYearInput && !monthYearInput.value) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            monthYearInput.value = `${year}-${month}`;
        }
        if (!personelSelect) {
            console.error("[EXPORT] #report-personel-id select'i bulunamadı.");
            return;
        }
        if (!userFirmaId) {
            console.warn("[EXPORT] userFirmaId yok, personel listesi çekilemedi.");
            return;
        }
        // Eski seçenekleri temizle (sadece "Tümü" bırak)
        personelSelect.innerHTML = `<option value="">${window.translations.AllPersonnel || 'Tümü'}</option>`;
        try {
            console.log("[EXPORT] Firma personelleri yükleniyor. firmaId:", userFirmaId);
            const response = await apiCall(`/api/Calendar/GetFirmPersoneller?firmaId=${userFirmaId}`, 'GET');
            if (!response || !response.success || !Array.isArray(response.data)) {
                console.error("[EXPORT] Personel listesi beklenen formatta değil:", response);
                showError(window.translations.ErrorFetchingPersonnelList || 'Personel listesi alınırken hata oluştu.');
                return;
            }
            // Personelleri gizli select'e ekle
            response.data.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.kullaniciId || p.id; // Backend'e göre uyarla
                opt.textContent = p.adSoyad || `${p.adi || ''} ${p.soyadi || ''}`.trim();
                personelSelect.appendChild(opt);
            });
            console.log("[EXPORT] Personel listesi dolduruldu. Toplam:", response.data.length);
            // Checkbox listesini initialize et
            initializeReportPersonnelList();
            // Butonları dinamik ekle (eğer yoksa)
            addReportPersonnelButtons();
        } catch (err) {
            console.error("[EXPORT] Personel listesi alınırken hata:", err);
            showError(window.translations.ErrorFetchingPersonnelList || 'Personel listesi alınırken hata oluştu.');
        }
    });
    // Export butonu click handler
    const confirmBtn = document.getElementById('confirm-export-report');
    if (!confirmBtn) {
        console.error("[EXPORT] #confirm-export-report butonu bulunamadı.");
        return;
    }
    // Aynı handler'ın iki kez eklenmesini engelle
    if (confirmBtn.dataset.exportHandlerAttached === 'true') {
        console.log("[EXPORT] confirm-export-report için handler zaten ekli, tekrar eklenmedi.");
        return;
    }
    confirmBtn.dataset.exportHandlerAttached = 'true';
    confirmBtn.addEventListener('click', async () => {
        console.log("[EXPORT] confirm-export-report tıklandı.");
        const form = document.getElementById('export-report-form');
        const monthYearInput = document.getElementById('report-month-year');
        const formatSelect = document.getElementById('report-format');
        const personelSelect = document.getElementById('report-personel-id');
        if (!form) {
            console.error("[EXPORT] #export-report-form bulunamadı.");
            return;
        }
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            console.warn("[EXPORT] Form geçerli değil.");
            return;
        }
        const monthYear = monthYearInput?.value;
        const format = formatSelect?.value;
        if (!monthYear) {
            showError(window.translations.InvalidDate || 'Geçersiz tarih.');
            return;
        }
        // Ay/Yıl → Başlangıç/Bitiş tarihlerini hesapla
        const [yearStr, monthStr] = monthYear.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        const startDate = `${year}-${monthStr.padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthStr.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        // Seçili personeller (boşsa "tümü")
        const selectedPersonelIds = Array
            .from(personelSelect?.selectedOptions || [])
            .map(o => o.value)
            .filter(v => v); // Boş değerleri filtrele ("" = tümü)
        console.log("[EXPORT] Rapor parametreleri:", {
            monthYear,
            startDate,
            endDate,
            format,
            selectedPersonelIds
        });
        try {
            let url = `/api/Calendar/ExportEvents?start=${startDate}&end=${endDate}&format=${format}`;
            if (selectedPersonelIds.length > 0) {
                url += `&personelIds=${encodeURIComponent(selectedPersonelIds.join(','))}`;
            }
            const a = document.createElement('a');
            a.href = url;
            a.download = format === 'pdf'
                ? window.translations.EventReportPDF || 'Etkinlik_Raporu.pdf'
                : window.translations.EventReportExcel || 'Etkinlik_Raporu.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            Swal.fire(
                window.translations.Success,
                window.translations.ReportDownloadedSuccessfully,
                'success'
            );
            exportModalInstance.hide();
            console.log("[EXPORT] Rapor indirildi ve modal kapatıldı.");
        } catch (err) {
            console.error("[EXPORT] Rapor indirme hatası:", err);
            showError(`${window.translations.ReportDownloadFailed} ${err.message}`);
        }
    });
    console.log("[EXPORT] handleExportReport başarıyla initialize edildi.");
}

// Yeni: Checkbox listesini initialize et (etkinlik modalındaki gibi)
function initializeReportPersonnelList() {
    console.log("[EXPORT] initializeReportPersonnelList called.");
    const personelSelect = document.getElementById('report-personel-id');
    const personelList = document.getElementById('report-personel-list');
    if (!personelList) return;
    personelList.innerHTML = '';
    Array.from(personelSelect.options).forEach(option => {
        if (!option.value || option.value === '') return; // "Tümü"nü atla
        const listItem = document.createElement('div');
        listItem.className = 'list-group-item';
        listItem.innerHTML = `
            <input type="checkbox" class="form-check-input" value="${option.value}" ${option.selected ? 'checked' : ''}>
            <span>${option.text}</span>
        `;
        const checkbox = listItem.querySelector('input');
        checkbox.addEventListener('change', () => {
            option.selected = checkbox.checked;
            updateReportSelectedPersonnel();
        });
        personelList.appendChild(listItem);
    });
    updateReportSelectedPersonnel();
}

// Yeni: Seçili personelleri güncelle (badge'ler)
function updateReportSelectedPersonnel() {
    const selectedList = document.getElementById('report-selected-personnel-list');
    const select = document.getElementById('report-personel-id');
    const container = document.getElementById('report-selected-personnel');
    if (!selectedList || !container) return;
    selectedList.innerHTML = '';
    const selectedOptions = Array.from(select.selectedOptions).filter(o => o.value); // Boşları atla
    if (selectedOptions.length > 0) {
        container.style.display = 'block';
        selectedOptions.forEach(option => {
            const badge = document.createElement('span');
            badge.className = 'badge bg-primary';
            badge.innerHTML = `${option.text} <i class="mdi mdi-close"></i>`;
            badge.dataset.value = option.value;
            badge.addEventListener('click', () => {
                option.selected = false;
                updateReportSelectedPersonnel();
                const checkbox = document.querySelector(`#report-personel-list input[value="${option.value}"]`);
                if (checkbox) checkbox.checked = false;
            });
            selectedList.appendChild(badge);
        });
    } else {
        container.style.display = 'none';
    }
}

// Yeni: Butonları dinamik ekle
function addReportPersonnelButtons() {
    const personelMb3 = document.querySelector('#export-report-modal .mb-3'); // İkinci mb-3 (personel için)
    const label = personelMb3?.querySelector('.form-label');
    if (label && !document.getElementById('report-personel-buttons-div')) {
        const buttonsDiv = document.createElement('div');
        buttonsDiv.id = 'report-personel-buttons-div';
        buttonsDiv.className = 'mb-2';
        const selectAllText = window.translations.SelectAll || 'Hepsini Seç';
        const deselectAllText = window.translations.DeselectAll || 'Hepsini Temizle';
        buttonsDiv.innerHTML = `
            <button type="button" class="btn btn-sm btn-outline-primary me-2" id="report-select-all" title="${selectAllText}">
                <i class="mdi mdi-check-all me-1"></i> ${selectAllText}
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary" id="report-deselect-all" title="${deselectAllText}">
                <i class="mdi mdi-close-all me-1"></i> ${deselectAllText}
            </button>
        `;
        label.insertAdjacentElement('afterend', buttonsDiv);
        console.log("[EXPORT] Personel butonları dinamik eklendi.");
        // Listener'ları ekle
        document.getElementById('report-select-all').addEventListener('click', selectAllReportPersonnel);
        document.getElementById('report-deselect-all').addEventListener('click', deselectAllReportPersonnel);
        console.log("[EXPORT] Personel buton listener'ları eklendi.");
    }
}

// Yeni: Hepsini Seç
function selectAllReportPersonnel() {
    const checkboxes = document.querySelectorAll('#report-personel-list input[type="checkbox"]');
    const select = document.getElementById('report-personel-id');
    checkboxes.forEach(checkbox => checkbox.checked = true);
    Array.from(select.options).forEach(option => {
        if (option.value && option.value !== '') {
            option.selected = true;
        }
    });
    updateReportSelectedPersonnel();
    Swal.fire({
        icon: 'success',
        title: window.translations.Success || 'Başarılı',
        text: window.translations.AllPersonnelSelected || 'Tüm personel seçildi!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
    });
}

// Yeni: Hepsini Temizle
function deselectAllReportPersonnel() {
    const checkboxes = document.querySelectorAll('#report-personel-list input[type="checkbox"]');
    const select = document.getElementById('report-personel-id');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    Array.from(select.options).forEach(option => {
        if (option.value && option.value !== '') {
            option.selected = false;
        }
    });
    updateReportSelectedPersonnel();
    Swal.fire({
        icon: 'info',
        title: window.translations.Success || 'Bilgi',
        text: window.translations.AllSelectionsCleared || 'Tüm seçimler temizlendi!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
    });
}




export function populateUpcomingEvents(events) {
    const activityFeed = document.getElementById("activity-feed");
    if (!activityFeed) return;
    activityFeed.innerHTML = '';
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setUTCDate(today.getUTCDate() + 7);
    const upcomingEvents = events
        .filter(event => {
            const eventStart = new Date(event.start);
            return eventStart >= today && eventStart <= endDate;
        })
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    if (upcomingEvents.length === 0) {
        activityFeed.innerHTML = `<li class="text-muted">${window.translations.NoUpcomingEvents}</li>`;
        return;
    }
    upcomingEvents.forEach(event => {
        const eventStart = new Date(event.start);
        // Tarih ve saat formatını çeviri key'lerinden al
        const dateFormatter = new Intl.DateTimeFormat(window.translations.CurrentLanguage || 'tr-TR', {
            day: 'numeric',
            month: window.translations.DateFormat === 'short' ? 'short' : 'long',
            year: 'numeric'
        });
        const timeFormatter = new Intl.DateTimeFormat(window.translations.CurrentLanguage || 'tr-TR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const startDate = dateFormatter.format(eventStart);
        const startTime = timeFormatter.format(eventStart);
        const activityItem = `
            <li class="activity-item mb-2">
                <div class="d-flex">
                    <div class="flex-shrink-0 me-2">
                        <i class="mdi mdi-checkbox-blank-circle font-size-11 text-primary"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${event.title}</h6>
                        <p class="text-muted mb-0">${startDate} ${startTime}</p>
                    </div>
                </div>
            </li>`;
        activityFeed.insertAdjacentHTML('beforeend', activityItem);
    });
}
export function setupEventListeners(modals, userRoles, calendar, currentUserFirmaId) {
    document.getElementById('confirmFirmaSelection').addEventListener('click', () => {
        selectedFirmaId = parseInt(document.getElementById('selectedFirmaId').value) || null;
        window.selectedFirmaId = selectedFirmaId;
        if (selectedFirmaId) {
            const selectedEventType = modals.firmSelectionModal._element.dataset.eventType;
            modals.firmSelectionModal.hide();
            if (selectedEventType === 'Egitim') {
                newEgitim(tempDate || new Date().toISOString().split("T")[0], userRoles, modals, calendar);
            } else if (selectedEventType) {
                newPersonalEtkinlik(tempDate || new Date().toISOString().split("T")[0], selectedEventType, modals, currentUserFirmaId, userRoles, calendar);
            }
            modals.firmSelectionModal._element.dataset.eventType = null;
        } else {
            showError(window.translations.PleaseSelectCompany);
            const eventModal = bootstrap.Modal.getInstance(document.getElementById('event-modal'));
            const personalEventModal = bootstrap.Modal.getInstance(document.getElementById('personal-event-modal'));
            if (eventModal) {
                resetModalForm(eventModal, document.getElementById("form-event"), [
                    document.getElementById("event-title"),
                    document.getElementById("event-category"),
                    document.getElementById("event-firma-id"),
                    document.getElementById("event-egitim-turu"),
                    document.getElementById("event-tehlike-sinifi"),
                    document.getElementById("event-sure")
                ]);
                eventTyped();
            }
            if (personalEventModal) {
                resetModalForm(personalEventModal, document.getElementById("form-personal-event"), [
                    document.getElementById("personal-event-title"),
                    document.getElementById("personal-event-start"),
                    document.getElementById("personal-event-end"),
                    document.getElementById("personal-event-description"),
                    document.getElementById("personal-event-turu"),
                    document.getElementById("personal-event-firma"),
                    document.getElementById("personal-event-personeller")
                ]);
                personalEventTyped();
            }
        }
    });
    document.getElementById("btn-confirm-event").addEventListener("click", () => {
        if (selectedEvent) {
            apiCall(`/api/Calendar/ConfirmEgitim?id=${selectedEvent.id}`, 'POST')
                .then(data => {
                    if (data.success) {
                        modals.eventModal.hide();
                        calendar.refetchEvents();
                        selectedEvent = null;
                        Swal.fire(window.translations.Success, window.translations.TrainingConfirmed, 'success');
                    } else {
                        throw new Error(data.message || window.translations.ErrorConfirmingTraining);
                    }
                })
                .catch(err => {
                    showError(`${window.translations.ErrorConfirmingTraining} ${err.message}`);
                });
        }
    });
    document.getElementById("btn-delete-event").addEventListener("click", () => {
        if (selectedEvent) {
            const confirmMessage = `${window.translations.ConfirmDeleteTraining} "${selectedEvent.title}" ${window.translations.ConfirmDeleteTrainingMessage}`;
            Swal.fire({
                title: window.translations.Confirm,
                text: confirmMessage,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: window.translations.Yes,
                cancelButtonText: window.translations.No
            }).then((result) => {
                if (result.isConfirmed) {
                    apiCall(`/api/Calendar/DeleteEgitim?id=${selectedEvent.id}`, 'POST')
                        .then(data => {
                            if (data.success) {
                                selectedEvent.remove();
                                modals.eventModal.hide();
                                selectedEvent = null;
                                Swal.fire(window.translations.Success, window.translations.TrainingDeleted, 'success');
                            } else {
                                throw new Error(data.message || window.translations.ErrorDeletingTraining);
                            }
                        })
                        .catch(err => {
                            showError(`${window.translations.ErrorDeletingTraining} ${err.message}`);
                        });
                }
            });
        } else {
            showError(window.translations.NoEventSelected);
        }
    });
    document.getElementById("edit-event-btn").addEventListener("click", function () {
        editEvent(this);
    });
    document.getElementById("btn-delete-personal-event").addEventListener("click", () => {
        if (selectedEvent) {
            const confirmMessage = `${window.translations.ConfirmDeleteEvent} "${selectedEvent.title}" ${window.translations.ConfirmDeleteEventMessage}`;
            Swal.fire({
                title: window.translations.Confirm,
                text: confirmMessage,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: window.translations.Yes,
                cancelButtonText: window.translations.No
            }).then((result) => {
                if (result.isConfirmed) {
                    const eventId = parseInt(selectedEvent.id.replace('etkinlik-', ''));
                    apiCall(`/api/Calendar/DeleteEtkinlik?id=${eventId}`, 'POST')
                        .then(data => {
                            if (data.success) {
                                selectedEvent.remove();
                                modals.personalEventModal.hide();
                                selectedEvent = null;
                                Swal.fire(window.translations.Success, window.translations.EventDeletedSuccessfully, 'success');
                            } else {
                                throw new Error(data.message || window.translations.ErrorDeletingEvent);
                            }
                        })
                        .catch(err => {
                            showError(`${window.translations.ErrorDeletingEvent} ${err.message}`);
                        });
                }
            });
        } else {
            showError(window.translations.NoEventSelected);
        }
    });
    document.getElementById("edit-personal-event-btn").addEventListener("click", function () {
        editPersonalEvent(this);
    });
    document.getElementById("btn-egitim-al").addEventListener("click", function () {
        const egitimId = this.getAttribute("data-egitim-id");
        apiCall(`/Egitimlerim/GetKatilimId?egitimId=${egitimId}`, 'GET')
            .then(data => {
                if (data.success && data.katilimId) {
                    modals.viewEventModal.hide();
                    window.location.href = `/Egitimlerim/Detay/${data.katilimId}`;
                } else {
                    showError(data.message || window.translations.TrainingRecordNotFound);
                }
            })
            .catch(err => {
                showError(`${window.translations.ErrorFetchingTrainingRecord} ${err.message}`);
            });
    });
    // Etkinlik silme butonu için olay dinleyici
    document.getElementById("btn-delete-etkinlik").addEventListener("click", () => {
        if (selectedEvent) {
            const confirmMessage = `${window.translations.ConfirmDeleteEvent} "${selectedEvent.title}" ${window.translations.ConfirmDeleteEventMessage}`;
            Swal.fire({
                title: window.translations.Confirm,
                text: confirmMessage,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: window.translations.Yes,
                cancelButtonText: window.translations.No
            }).then((result) => {
                if (result.isConfirmed) {
                    const eventId = parseInt(selectedEvent.id.replace('etkinlik-', ''));
                    apiCall(`/api/Calendar/DeleteEtkinlik?id=${eventId}`, 'POST')
                        .then(data => {
                            if (data.success) {
                                selectedEvent.remove();
                                modals.viewEventModal.hide();
                                selectedEvent = null;
                                Swal.fire(window.translations.Success, window.translations.EventDeletedSuccessfully, 'success');
                            } else {
                                throw new Error(data.message || window.translations.ErrorDeletingEvent);
                            }
                        })
                        .catch(err => {
                            showError(`${window.translations.ErrorDeletingEvent} ${err.message}`);
                        });
                }
            });
        } else {
            showError(window.translations.NoEventSelected);
        }
    });
    document.getElementById("form-event").addEventListener("submit", (e) => {
        e.preventDefault();
        if (!document.getElementById("form-event").checkValidity()) {
            document.getElementById("form-event").classList.add("was-validated");
            showError(window.translations.PleaseFillAllRequiredFields);
            eventTyped();
            return;
        }
        if (isSubmitting) return;
        const egitimData = {
            EgitimId: selectedEvent ? parseInt(selectedEvent.id) : null,
            Ad: document.getElementById("event-title").value || window.translations.Unspecified,
            EgitimTarihi: document.getElementById('event-tarihi').value ? new Date(document.getElementById('event-tarihi').value).toISOString() : document.getElementById("form-event").dataset.date,
            Sure: parseInt(document.getElementById("event-sure").value) || 1,
            TehlikeSinifi: document.getElementById("event-tehlike-sinifi").value || "AzTehlikeli",
            EgitimTuruId: document.getElementById("event-egitim-turu").value ? parseInt(document.getElementById("event-egitim-turu").value) : null,
            RefFirmaId: window.selectedFirmaId || (document.getElementById("event-firma-id").value ? parseInt(document.getElementById("event-firma-id").value) : null)
        };
        const baslangicTarihi = new Date(egitimData.EgitimTarihi);
        if (isDateInPast(baslangicTarihi)) {
            showError(window.translations.CannotCreateTrainingInPast);
            eventTyped();
            return;
        }
        const confirmMessage = selectedEvent
            ? `${window.translations.ConfirmUpdateTraining} "${document.getElementById("event-title").value}" ${window.translations.ConfirmUpdateTrainingMessage}`
            : `${window.translations.ConfirmCreateTraining} "${document.getElementById("event-title").value}" ${window.translations.ConfirmCreateTrainingMessage}`;
        Swal.fire({
            title: window.translations.Confirm,
            text: confirmMessage,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: window.translations.Yes,
            cancelButtonText: window.translations.No
        }).then((result) => {
            if (result.isConfirmed) {
                saveEgitimToServer(egitimData, selectedEvent ? "Edit" : "Create", calendar)
                    .then(() => {
                        modals.eventModal.hide();
                        calendar.refetchEvents();
                        if (!selectedEvent && document.getElementById("form-event").dataset.event) {
                            const tempEvent = JSON.parse(document.getElementById("form-event").dataset.event);
                            calendar.getEventById(tempEvent.id)?.remove();
                        }
                        calendar.getEvents().forEach(event => {
                            if (event.extendedProps.isTemp) event.remove();
                        });
                        Swal.fire(window.translations.Success, selectedEvent ? window.translations.TrainingUpdated : window.translations.TrainingCreated, 'success');
                        window.selectedFirmaId = null;
                    })
                    .catch(err => {
                        showError(`${window.translations.ErrorSavingTraining} ${err.message}`);
                    });
            }
        });
    });
    document.getElementById("form-personal-event").addEventListener("submit", (e) => {
        e.preventDefault();
        if (!document.getElementById("form-personal-event").checkValidity()) {
            document.getElementById("form-personal-event").classList.add("was-validated");
            showError(window.translations.PleaseFillAllRequiredFields);
            personalEventTyped();
            return;
        }
        if (isSubmitting) return;
        const personelSelect = document.getElementById('personal-event-personeller');
        const atanmisKullaniciIds = Array.from(personelSelect.selectedOptions).map(option => parseInt(option.value));
        const etkinlikData = {
            EtkinlikId: selectedEvent ? parseInt(selectedEvent.id.replace('etkinlik-', '')) : null,
            Ad: document.getElementById("personal-event-title").value || window.translations.Unspecified,
            BaslangicTarihi: document.getElementById("personal-event-start").value ? new Date(document.getElementById("personal-event-start").value).toISOString() : new Date().toISOString(),
            BitisTarihi: document.getElementById("personal-event-end").value ? new Date(document.getElementById("personal-event-end").value).toISOString() : null,
            Aciklama: document.getElementById("personal-event-description").value || "",
            EtkinlikTuru: document.getElementById("personal-event-turu").value,
            AtananKullaniciIds: atanmisKullaniciIds.length > 0 ? atanmisKullaniciIds : [],
            RefFirmaId: window.selectedFirmaId || (['Toplanti', 'Ziyaret', 'Diger'].includes(document.getElementById("personal-event-turu").value) ? parseInt(document.getElementById("personal-event-firma").value) || null : null)
        };
        const baslangicTarihi = new Date(etkinlikData.BaslangicTarihi);
        if (isDateInPast(baslangicTarihi)) {
            showError(window.translations.CannotCreateEventInPast);
            personalEventTyped();
            return;
        }
        const confirmMessage = selectedEvent
            ? `${window.translations.ConfirmUpdateEvent} "${document.getElementById("personal-event-title").value}" ${window.translations.ConfirmUpdateEventMessage}`
            : `${window.translations.ConfirmCreateEvent} "${document.getElementById("personal-event-title").value}" ${window.translations.ConfirmCreateEventMessage}`;
        Swal.fire({
            title: window.translations.Confirm,
            text: confirmMessage,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: window.translations.Yes,
            cancelButtonText: window.translations.No
        }).then((result) => {
            if (result.isConfirmed) {
                saveEtkinlikToServer(etkinlikData, selectedEvent ? "Edit" : "Create", calendar)
                    .then(() => {
                        modals.personalEventModal.hide();
                        calendar.refetchEvents();
                        if (!selectedEvent && document.getElementById("form-personal-event").dataset.event) {
                            const tempEvent = JSON.parse(document.getElementById("form-personal-event").dataset.event);
                            calendar.getEventById(tempEvent.id)?.remove();
                        }
                        calendar.getEvents().forEach(event => {
                            if (event.extendedProps.isTemp) event.remove();
                        });
                        Swal.fire(window.translations.Success, selectedEvent ? window.translations.EventUpdated : window.translations.EventCreated, 'success');
                        window.selectedFirmaId = null;
                    })
                    .catch(err => {
                        showError(`${window.translations.ErrorSavingEvent} ${err.message}`);
                    });
            }
        });
    });
}

function newEgitim(dateStr, userRoles, modals, calendar) {
    if (!userRoles.includes('OSGB')) {
        showError(window.translations.NoTrainingCreationPermission);
        return;
    }
    selectedEvent = null;
    document.getElementById("form-event").dataset.date = dateStr;
    document.getElementById("form-event").dataset.event = JSON.stringify({ id: null, title: window.translations.NewTraining });
    const firmaInput = document.getElementById("event-firma-id");
    firmaInput.value = window.selectedFirmaId || "";

    const existingFirmaDisplay = firmaInput.parentElement.nextElementSibling;
    if (existingFirmaDisplay && existingFirmaDisplay.classList.contains('form-group')) {
        existingFirmaDisplay.remove();
    }

    if (window.selectedFirmaId) {
        firmaInput.setAttribute('disabled', 'true');
        firmaInput.parentElement.style.display = 'none';
        firmaInput.setAttribute('readonly', 'true');
        const firmaAdi = document.querySelector(`#selectedFirmaId option[value="${window.selectedFirmaId}"]`)?.text || window.translations.UnknownCompany;
        const firmaDisplay = document.createElement('div');
        firmaDisplay.className = 'form-group mb-3';
        firmaDisplay.innerHTML = `
            <label>${window.translations.Company}</label>
            <input type="text" class="form-control" value="${firmaAdi}" readonly>
            <input type="hidden" name="event-firma-id" value="${window.selectedFirmaId}">
        `;
        firmaInput.parentElement.insertAdjacentElement('afterend', firmaDisplay);
    } else {
        firmaInput.removeAttribute('disabled');
        firmaInput.parentElement.style.display = 'block';
        firmaInput.removeAttribute('readonly');
    }
    loadOSGBFirms(modals, userRoles);
    openEgitimModal(dateStr, window.selectedFirmaId, null, modals, calendar);
}

async function newPersonalEtkinlik(dateStr, etkinlikTuru, modals, currentUserFirmaId, userRoles, calendar) {
    console.log("[EVENT HANDLER] newPersonalEtkinlik called with dateStr:", dateStr, "etkinlikTuru:", etkinlikTuru);
    const modal = modals.personalEventModal;
    const form = document.getElementById("form-personal-event");
    const firmaSelection = document.getElementById("firma-selection");
    const personelSelection = document.getElementById("personel-selection");
    // Formu sıfırla
    resetModalForm(modal, form, [
        document.getElementById("personal-event-title"),
        document.getElementById("personal-event-start"),
        document.getElementById("personal-event-end"),
        document.getElementById("personal-event-description"),
        document.getElementById("personal-event-turu"),
        document.getElementById("personal-event-firma"),
        document.getElementById("personal-event-personeller")
    ]);
    // Form alanlarını doldur
    document.getElementById("personal-event-start").value = dateStr ? dateStr.split('T')[0] : "";
    document.getElementById("personal-event-turu").value = etkinlikTuru;
    document.getElementById("personal-modal-title").innerText = `${window.translations[etkinlikTuru] || window.translations.Event} ${window.translations.Create}`;
    // Firma ve personel seçim alanlarını kontrol et
    if (etkinlikTuru === "Etkinlik") {
        if (firmaSelection) firmaSelection.style.display = 'none';
        else console.warn("[EVENT HANDLER] 'firma-selection' elemanı bulunamadı.");
        if (personelSelection) personelSelection.style.display = 'none';
        else console.warn("[EVENT HANDLER] 'personel-selection' elemanı bulunamadı.");
    } else {
        if (firmaSelection) firmaSelection.style.display = 'block';
        else console.warn("[EVENT HANDLER] 'firma-selection' elemanı bulunamadı.");
        if (personelSelection) personelSelection.style.display = 'block';
        else console.warn("[EVENT HANDLER] 'personel-selection' elemanı bulunamadı.");
    }
    // Firma seçimi yapılmışsa alanı gizle
    const firmaInput = document.getElementById("personal-event-firma");
    const existingFirmaDisplay = firmaInput.parentElement.nextElementSibling;
    if (existingFirmaDisplay && existingFirmaDisplay.classList.contains('form-group')) {
        existingFirmaDisplay.remove();
    }
    if (window.selectedFirmaId) {
        firmaInput.value = window.selectedFirmaId;
        firmaInput.setAttribute('disabled', 'true');
        firmaInput.parentElement.style.display = 'none';
        firmaInput.setAttribute('readonly', 'true');
        const firmaAdi = document.querySelector(`#selectedFirmaId option[value="${window.selectedFirmaId}"]`)?.text || window.translations.UnknownCompany;
        const firmaDisplay = document.createElement('div');
        firmaDisplay.className = 'form-group mb-3';
        firmaDisplay.innerHTML = `
            <label>${window.translations.Company}</label>
            <input type="text" class="form-control" value="${firmaAdi}" readonly>
            <input type="hidden" name="personal-event-firma" value="${window.selectedFirmaId}">
        `;
        firmaInput.parentElement.insertAdjacentElement('afterend', firmaDisplay);
    } else {
        firmaInput.removeAttribute('disabled');
        firmaInput.parentElement.style.display = 'block';
        firmaInput.removeAttribute('readonly');
    }
    // Personel listesini yükle
    console.log("[EVENT HANDLER] Current user firmaId ile personeller yükleniyor:", currentUserFirmaId);
    try {
        const data = await apiCall(`/api/Calendar/GetFirmPersoneller?firmaId=${currentUserFirmaId}`, 'GET');
        if (data.success && data.data) {
            const personelSelect = document.getElementById("personal-event-personeller");
            personelSelect.innerHTML = `<option value="">${window.translations.SelectPersonnel}</option>`;
            data.data.forEach(personel => {
                const option = document.createElement("option");
                option.value = personel.kullaniciId;
                option.text = personel.adSoyad + (personel.tcKimlikNo ? ` (${personel.tcKimlikNo})` : '');
                personelSelect.appendChild(option);
            });
            initializePersonnelList();
            // YENİ: Dinamik buton ekle ve listener kur
            const personelMb3 = document.getElementById("personel-selection").querySelector('.mb-3');
            const label = personelMb3.querySelector('.form-label');
            if (label && !document.getElementById('personel-buttons-div')) {
                const buttonsDiv = document.createElement('div');
                buttonsDiv.id = 'personel-buttons-div';
                buttonsDiv.className = 'mb-2';
                buttonsDiv.style.marginBottom = '0.5rem';
                const selectAllText = window.translations.SelectAll || 'Hepsini Seç';
                const deselectAllText = window.translations.DeselectAll || 'Hepsini Temizle';
                buttonsDiv.innerHTML = `
                    <button type="button" class="btn btn-sm btn-outline-primary me-2" id="select-all-personnel" title="${selectAllText}">
                        <i class="mdi mdi-check-all me-1"></i> ${selectAllText}
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="deselect-all-personnel" title="${deselectAllText}">
                        <i class="mdi mdi-close-all me-1"></i> ${deselectAllText}
                    </button>
                `;
                label.insertAdjacentElement('afterend', buttonsDiv);
                console.log("[EVENT HANDLER] Personel butonları dinamik eklendi.");
            }
            // Listener ekle
            const selectAllBtn = document.getElementById('select-all-personnel');
            const deselectAllBtn = document.getElementById('deselect-all-personnel');
            if (selectAllBtn) selectAllBtn.addEventListener('click', selectAllPersonnel);
            if (deselectAllBtn) deselectAllBtn.addEventListener('click', deselectAllPersonnel);
            console.log("[EVENT HANDLER] Personel buton listener'ları eklendi.");
        } else {
            console.error("[EVENT HANDLER] Personeller yüklenemedi:", data.message);
            showError(`${window.translations.ErrorFetchingPersonnelList} ${data.message || window.translations.UnknownError}`);
        }
    } catch (err) {
        console.error("[EVENT HANDLER] Personeller yüklenirken hata:", err);
        showError(`${window.translations.ErrorLoadingPersonnelList} ${err.message}`);
    }
    modal.show();
    personalEventTyped();
}

// YENİ: Hepsini Seç fonksiyonu
function selectAllPersonnel() {
    const checkboxes = document.querySelectorAll('#personel-list input[type="checkbox"]');
    const personelSelect = document.getElementById('personal-event-personeller');
    checkboxes.forEach(checkbox => checkbox.checked = true);
    Array.from(personelSelect.options).forEach(option => {
        if (option.value && option.value !== '') {
            option.selected = true;
        }
    });
    updateSelectedPersonnel();
    Swal.fire({
        icon: 'success',
        title: window.translations['Success'] || 'Başarılı',
        text: window.translations['AllPersonnelSelected'] || 'Tüm personel seçildi!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
    });
}

// YENİ: Hepsini Temizle fonksiyonu
function deselectAllPersonnel() {
    const checkboxes = document.querySelectorAll('#personel-list input[type="checkbox"]');
    const personelSelect = document.getElementById('personal-event-personeller');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    Array.from(personelSelect.options).forEach(option => {
        if (option.value && option.value !== '') {
            option.selected = false;
        }
    });
    updateSelectedPersonnel();
    Swal.fire({
        icon: 'info',
        title: window.translations['Success'] || 'Bilgi',
        text: window.translations['AllSelectionsCleared'] || 'Tüm seçimler temizlendi!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
    });
}

async function saveEgitimToServer(egitimData, action = "Create", calendar) {
    if (isSubmitting) return Promise.reject(new Error("Çift kayıt önlendi."));
    isSubmitting = true;

    const saveBtn = document.getElementById("btn-save-event");
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...';
    saveBtn.disabled = true;

    let egitimTarihi = egitimData.EgitimTarihi;
    if (egitimTarihi && egitimTarihi.length <= 10) {
        egitimTarihi = new Date(egitimTarihi + "T00:00:00.000Z").toISOString();
    } else if (!egitimTarihi) {
        throw new Error("Eğitim tarihi belirtilmedi.");
    }

    let refFirmaId = egitimData.RefFirmaId;
    if (typeof refFirmaId === 'object' || isNaN(refFirmaId)) {
        refFirmaId = parseInt(refFirmaId) || window.selectedFirmaId || null;
    }

    egitimData = {
        ...egitimData,
        Ad: egitimData.Ad || "Belirtilmedi",
        EgitimTarihi: egitimTarihi,
        Sure: egitimData.Sure || 1,
        TehlikeSinifi: egitimData.TehlikeSinifi || "AzTehlikeli",
        EgitimTuruId: egitimData.EgitimTuruId || null,
        RefFirmaId: refFirmaId
    };

    if (action === "Create") {
        egitimData.EgitimId = null;
    }

    const validTehlikeSinifiValues = ["AzTehlikeli", "Tehlikeli", "CokTehlikeli"];
    if (!validTehlikeSinifiValues.includes(egitimData.TehlikeSinifi)) {
        egitimData.TehlikeSinifi = "AzTehlikeli";
    }

    if (!egitimData.RefFirmaId || egitimData.RefFirmaId <= 0) {
        showError('Firma ID\'si belirtilmedi veya geçersiz.');
        isSubmitting = false;
        saveBtn.innerHTML = action === "Create" ? "Kaydetme" : "Güncelle";
        saveBtn.disabled = false;
        return Promise.reject(new Error("Firma ID'si belirtilmedi."));
    }

    try {
        console.log("[EVENT HANDLER] saveEgitimToServer - Gönderilen veri:", egitimData);
        const data = await apiCall('/api/Calendar/SaveEgitim', 'POST', egitimData);
        if (data.success && data.egitimId) {
            let tempEvent = document.getElementById("form-event").dataset.event ? JSON.parse(document.getElementById("form-event").dataset.event) : null;
            if (tempEvent) {
                let oldEvent = calendar.getEventById(tempEvent.id);
                if (oldEvent) {
                    oldEvent.setProp('id', data.egitimId);
                }
            }
            calendar.refetchEvents();
            Swal.fire('Başarılı!', action === "Create" ? 'Eğitim oluşturuldu.' : 'Eğitim güncellendi.', 'success').then(() => {
                const eventModal = bootstrap.Modal.getInstance(document.getElementById('event-modal'));
                if (eventModal) {
                    eventModal.hide();
                }
                resetModalForm(eventModal, document.getElementById("form-event"), [
                    document.getElementById("event-title"),
                    document.getElementById("event-category"),
                    document.getElementById("event-firma-id"),
                    document.getElementById("event-egitim-turu"),
                    document.getElementById("event-tehlike-sinifi"),
                    document.getElementById("event-sure")
                ]);
                window.isDragAction = false;
            });
            return data;
        } else {
            throw new Error(data.message || `${action} failed`);
        }
    } catch (err) {
        console.error("[EVENT HANDLER] saveEgitimToServer - Hata:", err);
        showError('Eğitim kaydedilemedi: ' + err.message);
        throw err;
    } finally {
        isSubmitting = false;
        saveBtn.disabled = false;
        saveBtn.innerHTML = "Kaydet";
    }
}

async function saveEtkinlikToServer(data, action = "Create", calendar) {
    console.log("[EVENT HANDLER] saveEtkinlikToServer - Gönderilen veri:", data);

    // Başlangıç ve bitiş tarihi doğrulaması
    const baslangicTarihi = new Date(data.BaslangicTarihi);
    const bitisTarihi = data.BitisTarihi ? new Date(data.BitisTarihi) : null;
    if (bitisTarihi && bitisTarihi < baslangicTarihi) {
        showError('Bitiş tarihi, başlangıç tarihinden önce olamaz.');
        return Promise.reject(new Error("Bitiş tarihi, başlangıç tarihinden önce olamaz."));
    }

    if (data.EtkinlikTuru !== 'Etkinlik' && !data.RefFirmaId && !window.isDragAction) {
        showError('Firma seçimi zorunludur.');
        return Promise.reject(new Error("Firma seçimi zorunlu."));
    }

    if (isSubmitting) return Promise.reject(new Error("Çift kayıt önlendi."));
    isSubmitting = true;

    try {
        const response = await apiCall('/api/Calendar/SaveEtkinlik', 'POST', data);
        if (response.success) {
            // Etkinliği takvime ekle veya güncelle
            const eventId = response.data?.etkinlikId || data.EtkinlikId;
            if (eventId) {
                const existingEvent = calendar.getEventById(`etkinlik-${eventId}`);
                if (existingEvent) {
                    existingEvent.setProp('title', data.Ad);
                    existingEvent.setStart(data.BaslangicTarihi);
                    existingEvent.setEnd(data.BitisTarihi || data.BaslangicTarihi);
                    existingEvent.setExtendedProp('description', data.Aciklama);
                    existingEvent.setExtendedProp('etkinlikTuru', data.EtkinlikTuru);
                    existingEvent.setExtendedProp('firmaId', data.RefFirmaId);
                    existingEvent.setExtendedProp('atanmisKullaniciIds', data.AtananKullaniciIds);
                    existingEvent.setExtendedProp('isClosed', data.isClosed || false);
                } else {
                    calendar.addEvent({
                        id: `etkinlik-${eventId}`,
                        title: data.Ad,
                        start: data.BaslangicTarihi,
                        end: data.BitisTarihi || data.BaslangicTarihi,
                        className: data.className || 'bg-info',
                        extendedProps: {
                            type: 'etkinlik',
                            etkinlikTuru: data.EtkinlikTuru,
                            description: data.Aciklama,
                            firmaId: data.RefFirmaId,
                            atanmisKullaniciIds: data.AtananKullaniciIds,
                            isClosed: data.isClosed || false
                        }
                    });
                }
            }

            Swal.fire('Başarılı!', action === "Create" ? 'Etkinlik oluşturuldu.' : 'Etkinlik güncellendi.', 'success').then(() => {
                const eventModal = bootstrap.Modal.getInstance(document.getElementById('event-modal'));
                const personalEventModal = bootstrap.Modal.getInstance(document.getElementById('personal-event-modal'));
                if (eventModal) {
                    eventModal.hide();
                }
                if (personalEventModal) {
                    personalEventModal.hide();
                }
                resetModalForm(eventModal, document.getElementById("form-event"), [
                    document.getElementById("event-title"),
                    document.getElementById("event-category"),
                    document.getElementById("event-firma-id"),
                    document.getElementById("event-egitim-turu"),
                    document.getElementById("event-tehlike-sinifi"),
                    document.getElementById("event-sure")
                ]);
                resetModalForm(personalEventModal, document.getElementById("form-personal-event"), [
                    document.getElementById("personal-event-title"),
                    document.getElementById("personal-event-start"),
                    document.getElementById("personal-event-end"),
                    document.getElementById("personal-event-description"),
                    document.getElementById("personal-event-turu"),
                    document.getElementById("personal-event-firma"),
                    document.getElementById("personal-event-personeller")
                ]);
                window.isDragAction = false;
                calendar.refetchEvents();
            });
            return response;
        } else {
            throw new Error(response.message || 'Etkinlik kaydedilemedi.');
        }
    } catch (err) {
        console.error("[EVENT HANDLER] saveEtkinlikToServer - Hata:", err);
        showError('Etkinlik kaydedilemedi: ' + err.message);
        throw err;
    } finally {
        isSubmitting = false;
    }
}

function openEgitimModal(dateStr, firmaId, event, modals, calendar) {
    console.log("[EVENT HANDLER] openEgitimModal called with firmaId:", firmaId, "dateStr:", dateStr, "event:", event);
    if (!selectedEvent) {
        document.getElementById("edit-event-btn").setAttribute("hidden", true);
        document.getElementById("btn-delete-event").setAttribute("hidden", true);
        document.getElementById("btn-save-event").removeAttribute("hidden");
        document.getElementById("btn-save-event").innerHTML = window.translations.Save;
        document.getElementById("btn-save-event").disabled = false;
        document.getElementById("btn-confirm-event").setAttribute("hidden", true);
    }


    document.getElementById("form-event").reset();
    document.getElementById("event-title").value = "";
    document.getElementById('event-tarihi').value = dateStr ? dateStr.split('T')[0] : "";
    document.getElementById("event-egitim-turu").value = "";
    document.getElementById("event-tehlike-sinifi").value = "";
    document.getElementById("event-sure").value = "";
    document.getElementById("event-firma-id").value = "";
    document.getElementById("event-category").value = "";
    modals.eventModal.show();
    document.getElementById("modal-title").innerHTML = "Yeni Eğitim Oluştur";
    document.getElementById("form-event").classList.remove("was-validated");
    document.getElementById("form-event").dataset.date = dateStr;
    document.getElementById("form-event").dataset.event = JSON.stringify({ id: null, title: event?.title || "Yeni Eğitim" });
    const existingDetails = document.getElementById("form-event").querySelector('.event-details');
    if (existingDetails) existingDetails.remove();
    const firmaInput = document.getElementById("event-firma-id");
    firmaInput.value = firmaId || "";
    selectedFirmaId = firmaId;
    console.log("[EVENT HANDLER] event-firma-id set to:", document.getElementById("event-firma-id").value);

    modals.eventModal._element.addEventListener('shown.bs.modal', function () {
        modals.eventModal._element.removeAttribute('aria-hidden');
        console.log("[EVENT HANDLER] Modal açıldı, aria-hidden kaldırıldı.");
    }, { once: true });
    modals.eventModal._element.addEventListener('hidden.bs.modal', function () {
        modals.eventModal._element.removeAttribute('aria-hidden');
        console.log("[EVENT HANDLER] Modal kapandı, aria-hidden kaldırıldı.");
        calendar.getEvents().forEach(event => {
            if (event.extendedProps.isTemp) {
                event.remove();
            }
        });
    }, { once: true });
    eventTyped();
}

function eventClicked() {
    console.log("[EVENT HANDLER] eventClicked called.");
    const eventForm = document.getElementById("form-event");
    eventForm.classList.add("view-event");
    document.getElementById("event-title").classList.replace("d-block", "d-none");
    document.getElementById("event-category").classList.replace("d-block", "d-none");
    document.getElementById("event-egitim-turu").classList.replace("d-block", "d-none");
    document.getElementById("event-tehlike-sinifi").classList.replace("d-block", "d-none");
    document.getElementById("event-sure").classList.replace("d-block", "d-none");
    document.getElementById("event-tarihi").classList.replace("d-block", "d-none");
    document.getElementById("event-firma-id").classList.replace("d-block", "d-none");
    document.getElementById("btn-save-event").setAttribute("hidden", true);
    document.getElementById("event-title").setAttribute("readonly", true);
    document.getElementById("event-category").setAttribute("disabled", true);
    document.getElementById("event-egitim-turu").setAttribute("disabled", true);
    document.getElementById("event-tehlike-sinifi").setAttribute("disabled", true);
    document.getElementById("event-sure").setAttribute("readonly", true);
    document.getElementById("event-tarihi").setAttribute("readonly", true);
    document.getElementById("event-firma-id").setAttribute("disabled", true);
    const existingDetails = eventForm.querySelector('.event-details');
    if (existingDetails) existingDetails.remove();
    const firmaName = selectedEvent.extendedProps.firmaAdi || window.translations.UnknownCompany;
    const egitimName = selectedEvent.extendedProps.egitimAdi || window.translations.Unspecified;
    const egitimTuru = selectedEvent.extendedProps.egitimTuruAdi || window.translations.UnknownType;
    const startDate = new Date(selectedEvent.start).toLocaleString(navigator.language, { dateStyle: 'short', timeStyle: 'short' });
    const sure = selectedEvent.extendedProps.sure || 0;
    const tehlikeSinifi = selectedEvent.extendedProps.tehlikeSinifi || window.translations.Unknown;
    const details = `
        <div class="event-details">
            <p><strong>${window.translations.TrainingName}:</strong> ${egitimName}</p>
            <p><strong>${window.translations.Company}:</strong> ${firmaName}</p>
            <p><strong>${window.translations.StartDate}:</strong> ${startDate}</p>
            <p><strong>${window.translations.Duration}:</strong> ${sure} ${window.translations.Hours}</p>
            <p><strong>${window.translations.HazardClass}:</strong> ${tehlikeSinifi}</p>
            <p><strong>${window.translations.TrainingType}:</strong> ${egitimTuru}</p>
        </div>`;
    eventForm.insertAdjacentHTML('afterbegin', details);
}

function eventTyped() {
    console.log("[EVENT HANDLER] eventTyped called.");
    const eventForm = document.getElementById("form-event");
    eventForm.classList.remove("view-event");
    document.getElementById("event-title").classList.replace("d-none", "d-block");
    document.getElementById("event-category").classList.replace("d-none", "d-block");
    document.getElementById("event-egitim-turu").classList.replace("d-none", "d-block");
    document.getElementById("event-tehlike-sinifi").classList.replace("d-none", "d-block");
    document.getElementById("event-sure").classList.replace("d-none", "d-block");
    document.getElementById("event-tarihi").classList.replace("d-none", "d-block");
    document.getElementById("event-firma-id").classList.replace("d-none", "d-block");
    document.getElementById("btn-save-event").removeAttribute("hidden");
    document.getElementById("btn-save-event").innerHTML = window.translations.Save;
    document.getElementById("event-title").removeAttribute("readonly");
    document.getElementById("event-category").removeAttribute("disabled");
    document.getElementById("event-egitim-turu").removeAttribute("disabled");
    document.getElementById("event-tehlike-sinifi").removeAttribute("disabled");
    document.getElementById("event-sure").removeAttribute("readonly");
    document.getElementById("event-tarihi").removeAttribute("readonly");
    document.getElementById("event-firma-id").removeAttribute("disabled");
    const existingDetails = eventForm.querySelector('.event-details');
    if (existingDetails) existingDetails.remove();
}

function editEvent(btn) {
    console.log("[EVENT HANDLER] editEvent called.");
    const id = btn.getAttribute("data-id");
    if (id === "edit-event") {
        btn.innerHTML = window.translations.Cancel;
        document.getElementById("btn-save-event").innerHTML = window.translations.Update;
        btn.removeAttribute("hidden");
        eventTyped();
    } else {
        btn.innerHTML = window.translations.Edit;
        eventClicked();
    }
}

function personalEventClicked() {
    console.log("[EVENT HANDLER] personalEventClicked called.");
    const personalEventForm = document.getElementById("form-personal-event");
    personalEventForm.classList.add("view-event");
    document.getElementById("personal-event-title").classList.replace("d-block", "d-none");
    document.getElementById("personal-event-start").classList.replace("d-block", "d-none");
    document.getElementById("personal-event-end").classList.replace("d-block", "d-none");
    document.getElementById("personal-event-description").classList.replace("d-block", "d-none");
    document.getElementById("personal-event-firma").classList.replace("d-block", "d-none");
    document.getElementById("personal-event-personeller").classList.replace("d-block", "d-none");
    document.getElementById("btn-save-personal-event").setAttribute("hidden", true);
    document.getElementById("personal-event-title").setAttribute("readonly", true);
    document.getElementById("personal-event-start").setAttribute("readonly", true);
    document.getElementById("personal-event-end").setAttribute("readonly", true);
    document.getElementById("personal-event-description").setAttribute("readonly", true);
    document.getElementById("personal-event-firma").setAttribute("disabled", true);
    document.getElementById("personal-event-personeller").setAttribute("disabled", true);
    const existingDetails = personalEventForm.querySelector('.event-details');
    if (existingDetails) existingDetails.remove();
    const startDate = new Date(selectedEvent.start).toLocaleString(navigator.language, { dateStyle: 'short', timeStyle: 'short' });
    const endDate = selectedEvent.end ? new Date(selectedEvent.end).toLocaleString(navigator.language, { dateStyle: 'short', timeStyle: 'short' }) : window.translations.Unspecified;
    const description = selectedEvent.extendedProps.aciklama || window.translations.NoDescription;
    const etkinlikTuru = window.translations[selectedEvent.extendedProps.etkinlikTuru] || window.translations.Event;
    const firmaAdi = selectedEvent.extendedProps.firmaAdi || window.translations.None;
    const atanmisKullanicilar = selectedEvent.extendedProps.atanmisKullanicilar?.map(k => k.AdSoyad).join(', ') || window.translations.None;
    const details = `
        <div class="event-details">
            <p><strong>${window.translations.EventName}:</strong> ${selectedEvent.title}</p>
            <p><strong>${window.translations.EventType}:</strong> ${etkinlikTuru}</p>
            <p><strong>${window.translations.Company}:</strong> ${firmaAdi}</p>
            <p><strong>${window.translations.AssignedPersonnel}:</strong> ${atanmisKullanicilar}</p>
            <p><strong>${window.translations.StartDate}:</strong> ${startDate}</p>
            <p><strong>${window.translations.EndDate}:</strong> ${endDate}</p>
            <p><strong>${window.translations.Description}:</strong> ${description}</p>
        </div>`;
    personalEventForm.insertAdjacentHTML('afterbegin', details);
}

function personalEventTyped() {
    console.log("[EVENT HANDLER] personalEventTyped called.");
    const personalEventForm = document.getElementById("form-personal-event");
    personalEventForm.classList.remove("view-event");
    document.getElementById("personal-event-title").classList.replace("d-none", "d-block");
    document.getElementById("personal-event-start").classList.replace("d-none", "d-block");
    document.getElementById("personal-event-end").classList.replace("d-none", "d-block");
    document.getElementById("personal-event-description").classList.replace("d-none", "d-block");
    document.getElementById("personal-event-firma").classList.replace("d-none", "d-block");
    document.getElementById("personal-event-personeller").classList.replace("d-none", "d-block");
    document.getElementById("btn-save-personal-event").removeAttribute("hidden");
    document.getElementById("btn-save-personal-event").innerHTML = window.translations.Save;
    document.getElementById("personal-event-title").removeAttribute("readonly");
    document.getElementById("personal-event-start").removeAttribute("readonly");
    document.getElementById("personal-event-end").removeAttribute("readonly");
    document.getElementById("personal-event-description").removeAttribute("readonly");
    document.getElementById("personal-event-firma").removeAttribute("disabled");
    document.getElementById("personal-event-personeller").removeAttribute("disabled");
    const existingDetails = personalEventForm.querySelector('.event-details');
    if (existingDetails) existingDetails.remove();
}

function editPersonalEvent(btn) {
    console.log("[EVENT HANDLER] editPersonalEvent called.");
    const id = btn.getAttribute("data-id");
    if (id === "edit-personal-event") {
        btn.innerHTML = window.translations.Cancel;
        document.getElementById("btn-save-personal-event").innerHTML = window.translations.Update;
        btn.removeAttribute("hidden");
        personalEventTyped();
    } else {
        btn.innerHTML = window.translations.Edit;
        personalEventClicked();
    }
}

function initializePersonnelList() {
    console.log("[EVENT HANDLER] initializePersonnelList called.");
    const personelSelect = document.getElementById('personal-event-personeller');
    const personelList = document.getElementById('personel-list');
    personelList.innerHTML = '';
    Array.from(personelSelect.options).forEach(option => {
        if (!option.value) return;
        const listItem = document.createElement('div');
        listItem.className = 'list-group-item';
        listItem.innerHTML = `
            <input type="checkbox" class="form-check-input" value="${option.value}" ${option.selected ? 'checked' : ''}>
            <span>${option.text}</span>
        `;
        const checkbox = listItem.querySelector('input');
        checkbox.addEventListener('change', () => {
            option.selected = checkbox.checked;
            updateSelectedPersonnel();
        });
        personelList.appendChild(listItem);
    });
    updateSelectedPersonnel();
}

// SignalR bağlantısını başlat
// SignalR bağlantısını başlat
// SignalR bağlantısını başlat
connection.start()
    .then(() => {
        console.log("[EVENT HANDLER] SignalR bağlantısı kuruldu.");

        // ReceiveEventUpdate olay dinleyicisi
        connection.on("ReceiveEventUpdate", function (eventData) {
            console.log("[EVENT HANDLER] Takvim güncellemesi alındı: eventData:", JSON.stringify(eventData));
            if (!calendar) {
                console.warn("[EVENT HANDLER] Takvim örneği bulunamadı!");
                return;
            }

            // Mevcut etkinliği bul ve güncelle
            let existingEvent = calendar.getEventById(eventData.id);
            if (existingEvent) {
                existingEvent.setProp("title", eventData.title || "Bilinmeyen Etkinlik");
                existingEvent.setStart(eventData.start);
                existingEvent.setEnd(eventData.end || eventData.start);
                existingEvent.setProp("classNames", eventData.className || "bg-info");
                existingEvent.setExtendedProp("etkinlikTuru", eventData.etkinlikTuru || "Etkinlik");
                existingEvent.setExtendedProp("type", eventData.type || "etkinlik");
                existingEvent.setExtendedProp("isClosed", eventData.isClosed || false);
                existingEvent.setExtendedProp("firmaId", eventData.firmaId || null);
                existingEvent.setExtendedProp("firmaAdi", eventData.firmaAdi || "Belirtilmedi");
                existingEvent.setExtendedProp("description", eventData.description || "");
                existingEvent.setExtendedProp("atanmisKullanicilar", eventData.atanmisKullanicilar || []);
                existingEvent.setExtendedProp("refEtkinlikId", eventData.refEtkinlikId || parseInt(eventData.id.replace(/^etkinlik-|^sinav-/, '')));
                console.log("[EVENT HANDLER] Mevcut etkinlik güncellendi: ID:", eventData.id, "End:", eventData.end || eventData.start);
            } else {
                // Yeni etkinlik ekle
                calendar.addEvent({
                    id: eventData.id,
                    title: eventData.title || "Bilinmeyen Etkinlik",
                    start: eventData.start,
                    end: eventData.end || eventData.start,
                    className: eventData.className || "bg-info",
                    extendedProps: {
                        type: eventData.type || "etkinlik",
                        etkinlikTuru: eventData.etkinlikTuru || "Etkinlik",
                        isClosed: eventData.isClosed || false,
                        firmaId: eventData.firmaId || null,
                        firmaAdi: eventData.firmaAdi || "Belirtilmedi",
                        description: eventData.description || "",
                        atanmisKullanicilar: eventData.atanmisKullanicilar || [],
                        refEtkinlikId: eventData.refEtkinlikId || parseInt(eventData.id.replace(/^etkinlik-|^sinav-/, ''))
                    }
                });
                console.log("[EVENT HANDLER] Yeni etkinlik eklendi: ID:", eventData.id, "End:", eventData.end || eventData.start);
            }

            // Modal açıksa, sınav detaylarını yenile
            const viewEventModal = bootstrap.Modal.getInstance(document.getElementById('viewEventModal'));
            if (viewEventModal && viewEventModal._isShown && eventData.id.startsWith('etkinlik-')) {
                const etkinlikId = parseInt(eventData.id.replace('etkinlik-', ''));
                console.log("[EVENT HANDLER] Modal açık, sınav detayları yenileniyor. EtkinlikId:", etkinlikId);
                apiCall(`/api/Calendar/GetSinavOturumDetaylari?etkinlikId=${etkinlikId}`, 'GET').then(data => {
                    if (data?.success && Array.isArray(data.data) && data.data.length > 0) {
                        const detay = data.data[0];
                        console.log("[EVENT HANDLER] Yeni sınav detayları:", detay);
                        // Modal içeriğini güncelle
                        const viewModalTitle = document.getElementById('view-modal-title');
                        const viewEventTitle = document.getElementById('view-event-title');
                        const viewEventStart = document.getElementById('view-event-start');
                        const viewEventEnd = document.getElementById('view-event-end');
                        const viewEventType = document.getElementById('view-event-type');
                        const viewEventDescription = document.getElementById('view-event-description');
                        const viewEventOturumDurumu = document.getElementById('view-oturum-durumu');
                        const viewEventFirma = document.getElementById('view-event-firma');
                        const viewEventGrupAdi = document.getElementById('view-event-grup-adi');
                        const viewEventAtanmisKullanicilar = document.getElementById('view-event-atanmis-kullanicilar');
                        const katilimcilarTable = document.getElementById('view-katilimcilar');
                        if (viewModalTitle) viewModalTitle.innerHTML = window.translations.ExamDetails;
                        if (viewEventTitle) viewEventTitle.innerHTML = detay.sinavAdi || window.translations.Unspecified;
                        const formatDate = (dateStr) => {
                            if (!dateStr) return window.translations.Unspecified;
                            const date = new Date(dateStr);
                            return isNaN(date.getTime()) ? window.translations.InvalidDate :
                                date.toLocaleDateString(navigator.language, { dateStyle: 'short' });
                        };
                        if (viewEventStart) viewEventStart.innerHTML = formatDate(detay.baslamaTarihi);
                        if (viewEventEnd) viewEventEnd.innerHTML = formatDate(detay.bitisTarihi);
                        if (viewEventType) viewEventType.innerHTML = window.translations.Exam;
                        if (viewEventDescription) viewEventDescription.innerHTML = detay.egitimAdi || window.translations.Exam;
                        if (viewEventOturumDurumu) {
                            viewEventOturumDurumu.innerHTML = detay.oturumDurumu || window.translations.Unknown;
                            viewEventOturumDurumu.className = `badge ${detay.oturumDurumu === window.translations.Completed ? 'bg-success' :
                                detay.oturumDurumu === window.translations.Started || detay.oturumDurumu === window.translations.InProgress ? 'bg-warning' :
                                    detay.oturumDurumu === window.translations.NotStarted ? 'bg-primary' : 'bg-info'}`;
                        }
                        if (viewEventFirma) viewEventFirma.innerHTML = detay.firmaAdi || window.translations.Unspecified;
                        if (viewEventGrupAdi) viewEventGrupAdi.innerHTML = detay.grupAdi || window.translations.Unspecified;
                        if (viewEventAtanmisKullanicilar) {
                            const kullanicilar = Array.isArray(detay.personelDurumlari) && detay.personelDurumlari.length > 0
                                ? detay.personelDurumlari.map(p => p.AdSoyad || window.translations.UnknownUser).join(', ')
                                : window.translations.NoUserSpecified;
                            viewEventAtanmisKullanicilar.innerHTML = kullanicilar;
                        }
                        // Katılımcılar tablosunu güncelle
                        if (katilimcilarTable) {
                            katilimcilarTable.innerHTML = '';
                            if (Array.isArray(detay.personelDurumlari) && detay.personelDurumlari.length > 0) {
                                detay.personelDurumlari.forEach(p => {
                                    console.log(`[EVENT HANDLER] Katılımcı:`, {
                                        adSoyad: p.AdSoyad,
                                        durum: p.Durum,
                                        puan: p.Puan,
                                        basarili: p.Basarili,
                                        denemeSayisi: p.DenemeSayisi,
                                        testTarihi: p.TestTarihi,
                                        tcDogrulandiMi: p.TcDogrulandiMi
                                    });
                                    const adSoyad = p.AdSoyad || window.translations.Unspecified;
                                    const durum = p.Durum || window.translations.Unknown;
                                    const badgeClass = durum === window.translations.Completed ? 'bg-success' :
                                        durum === window.translations.NotParticipated ? 'bg-danger' :
                                            durum === window.translations.InProgress ? 'bg-warning' : 'bg-info';
                                    const puan = p.Puan !== null && p.Puan !== undefined ? p.Puan : '-';
                                    const basarili = p.Basarili !== null && p.Basarili !== undefined ? (p.Basarili ? window.translations.Yes : window.translations.No) : '-';
                                    const denemeSayisi = p.DenemeSayisi !== null && p.DenemeSayisi !== undefined ? p.DenemeSayisi : '-';
                                    const testTarihi = p.TestTarihi ? formatDate(p.TestTarihi) : '-';
                                    katilimcilarTable.innerHTML += `
                            <tr>
                                <td>${adSoyad}</td>
                                <td><span class="badge ${badgeClass}">${durum}</span></td>
                                <td>${puan}</td>
                                <td>${basarili}</td>
                                <td>${denemeSayisi}</td>
                                <td>${testTarihi}</td>
                            </tr>`;
                                });
                            } else {
                                katilimcilarTable.innerHTML = `<tr><td colspan="6" class="text-center">${window.translations.NoParticipantsFound}</td></tr>`;
                            }
                        }
                        // Buton görünürlüklerini güncelle
                        const baslatBtn = document.getElementById('view-sinav-baslat');
                        const bitirBtn = document.getElementById('view-sinav-bitir');
                        const raporBtn = document.getElementById('view-rapor-detay');
                        const katilBtn = document.getElementById('view-sinava-katil');
                        const sonucBtn = document.getElementById('view-sinav-sonuc');
                        [baslatBtn, bitirBtn, raporBtn, katilBtn, sonucBtn].forEach(btn => {
                            if (btn) {
                                btn.setAttribute('hidden', 'true');
                                btn.removeAttribute('data-listener-added');
                            }
                        });
                        if (detay.isOSGBorAdmin) {
                            if (detay.oturumDurumu === window.translations.NotStarted) {
                                if (baslatBtn) {
                                    baslatBtn.removeAttribute('hidden');
                                    baslatBtn.setAttribute('data-etkinlik-id', etkinlikId);
                                }
                            } else if (detay.oturumDurumu === window.translations.Started || detay.oturumDurumu === window.translations.InProgress) {
                                if (bitirBtn) {
                                    bitirBtn.removeAttribute('hidden');
                                    bitirBtn.setAttribute('data-etkinlik-id', etkinlikId);
                                }
                            }
                            if (raporBtn) {
                                raporBtn.removeAttribute('hidden');
                                raporBtn.setAttribute('data-etkinlik-id', etkinlikId);
                            }
                        }
                        if (detay.isPersonel && !detay.isOSGBorAdmin) {
                            const userId = window.currentUserId || document.querySelector('meta[name="user-id"]')?.content;
                            const katilimci = detay.personelDurumlari.find(p => p.KullaniciId === parseInt(userId));
                            if (katilimci) {
                                apiCall(`/api/Egitimlerim/GetOturumIdByEtkinlikAndKullanici?etkinlikId=${etkinlikId}&kullaniciId=${katilimci.KullaniciId}`, 'GET').then(oturumResponse => {
                                    if (oturumResponse.success && oturumResponse.data?.oturumId) {
                                        const oturumId = oturumResponse.data.oturumId;
                                        if (detay.oturumDurumu === window.translations.Started || detay.oturumDurumu === window.translations.InProgress) {
                                            if (katilBtn) {
                                                katilBtn.removeAttribute('hidden');
                                                katilBtn.setAttribute('data-oturum-id', oturumId);
                                            }
                                        } else if (detay.oturumDurumu === window.translations.Completed) {
                                            if (sonucBtn) {
                                                sonucBtn.removeAttribute('hidden');
                                                sonucBtn.setAttribute('data-oturum-id', oturumId);
                                            }
                                        }
                                    }
                                }).catch(err => {
                                    console.error("[EVENT HANDLER] Oturum ID alınırken hata:", err);
                                });
                            }
                        }
                    } else {
                        Swal.fire(window.translations.Error, `${window.translations.ErrorFetchingExamDetails} ${data?.message || window.translations.DataNotFound}`, 'error');
                    }
                }).catch(err => {
                    console.error("[EVENT HANDLER] Sınav detayları yenileme hatası:", err);
                    Swal.fire(window.translations.Error, `${window.translations.ErrorFetchingExamDetails} ${err.message}`, 'error');
                });
            }
        });

        // DeleteEvent olay dinleyicisi
        connection.on("DeleteEvent", function (eventId) {
            console.log("[EVENT HANDLER] Etkinlik silindi: ID:", eventId);
            calendar.refetchEvents();
        });
    })
    .catch(err => {
        console.error("[EVENT HANDLER] SignalR bağlantı hatası:", err.toString());
    });