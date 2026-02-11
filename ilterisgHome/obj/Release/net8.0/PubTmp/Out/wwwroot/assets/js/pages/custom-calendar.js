document.addEventListener("DOMContentLoaded", function () {
    console.log("Custom calendar initialization starting...");

    // Modal ve DOM elemanlarını tanımla
    const eventTypeSelectionModal = new bootstrap.Modal(document.getElementById("event-type-selection-modal"), { keyboard: false });
    const eventModal = new bootstrap.Modal(document.getElementById("event-modal"), { keyboard: false });
    const personalEventModal = new bootstrap.Modal(document.getElementById("personal-event-modal"), { keyboard: false });
    const viewEventModal = new bootstrap.Modal(document.getElementById("view-event-modal"), { keyboard: false });
    const firmSelectionModal = new bootstrap.Modal(document.getElementById("firmSelectionModal"), { keyboard: false });
    const modalTitle = document.getElementById("modal-title");
    const personalModalTitle = document.getElementById("personal-modal-title");
    const eventForm = document.getElementById("form-event");
    const personalEventForm = document.getElementById("form-personal-event");
    const eventTitle = document.getElementById("event-title");
    const eventCategory = document.getElementById("event-category");
    const eventFirmaId = document.getElementById("event-firma-id");
    const eventEgitimTuru = document.getElementById("event-egitim-turu");
    const eventTehlikeSinifi = document.getElementById("event-tehlike-sinifi");
    const eventSure = document.getElementById("event-sure");
    const personalEventTitle = document.getElementById("personal-event-title");
    const personalEventStart = document.getElementById("personal-event-start");
    const personalEventEnd = document.getElementById("personal-event-end");
    const personalEventDescription = document.getElementById("personal-event-description");
    const personalEventTuru = document.getElementById("personal-event-turu");
    const personalEventFirma = document.getElementById("personal-event-firma");
    const personalEventPersoneller = document.getElementById("personal-event-personeller");
    const btnNewEvent = document.getElementById("btn-new-event");
    let selectedEvent = null;
    let selectedFirmaId = null;
    let isSubmitting = false;
    let tempDate = null; // dateClick için tarih saklama
    let isDragAction = false; // Drag işlemi mi kontrolü

    // Kullanıcı rollerini ve firma ID’sini al
    let userRoles = [];
    let currentUserFirmaId = null; // Current user’ın firma ID’si

    function getUserRolesAndFirmaId() {
        return new Promise((resolve, reject) => {
            fetch('/api/Calendar/GetUserRoles', {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        userRoles = data.roles || [];
                        console.log("User roles fetched:", userRoles);
                        // Varsayım: GetUserRoles endpoint’i firmaId’yi de döndürüyor
                        // Eğer firmaId dönmüyorsa, yeni bir endpoint’e ihtiyaç var
                        currentUserFirmaId = data.firmaId || 1; // Varsayılan olarak 1, yoksa yeni endpoint eklenecek
                        console.log("Current user firmaId:", currentUserFirmaId);
                        resolve({ userRoles, currentUserFirmaId });
                    } else {
                        console.error("Failed to fetch user roles:", data.message);
                        reject(new Error(data.message));
                    }
                })
                .catch(err => {
                    console.error("Error fetching user roles:", err);
                    reject(err);
                });
        });
    }

    // Geçmiş tarih kontrolü için yardımcı fonksiyon
    function isDateInPast(dateStr) {
        const selectedDate = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Bugünü saat 00:00:00 olarak ayarla
        return selectedDate < today;
    }

    // Roller ve firma ID’si yüklenmeden önce fonksiyonları beklet
    getUserRolesAndFirmaId().then(() => {
        // Yeni Etkinlik Ekle butonuna rol kontrolü ve modal açma
        if (btnNewEvent) {
            btnNewEvent.addEventListener('click', function () {
                console.log("New event button clicked.");
                selectedFirmaId = null; // Firma seçimini sıfırla
                tempDate = new Date().toISOString().split("T")[0]; // Varsayılan tarih
                isDragAction = false; // Drag işlemi değil
                eventTypeSelectionModal.show(); // Her zaman event-type-selection-modal aç
            });
        }

        // Etkinlik türü seçim modalından seçim işlemleri
        document.getElementById('select-egitim').addEventListener('click', function () {
            eventTypeSelectionModal.hide();
            if (userRoles.includes('OSGB')) {
                if (isDragAction && selectedFirmaId) {
                    // Drag işlemi sırasında firma zaten seçildi, tekrar seçtirme
                    newEgitim(tempDate || new Date().toISOString().split("T")[0]);
                } else {
                    // Drag işlemi değilse, firma seçimi modalını aç
                    firmSelectionModal.show();
                }
            } else {
                Swal.fire('Yetki Hatası!', 'Eğitim oluşturma yetkiniz yok.', 'error');
            }
        });

        document.getElementById('select-etkinlik').addEventListener('click', function () {
            eventTypeSelectionModal.hide();
            newPersonalEtkinlik(tempDate || new Date().toISOString().split("T")[0], 'Etkinlik');
        });

        document.getElementById('select-toplanti').addEventListener('click', function () {
            eventTypeSelectionModal.hide();
            newPersonalEtkinlik(tempDate || new Date().toISOString().split("T")[0], 'Toplanti');
        });

        document.getElementById('select-ziyaret').addEventListener('click', function () {
            eventTypeSelectionModal.hide();
            newPersonalEtkinlik(tempDate || new Date().toISOString().split("T")[0], 'Ziyaret');
        });

        document.getElementById('select-diger').addEventListener('click', function () {
            eventTypeSelectionModal.hide();
            newPersonalEtkinlik(tempDate || new Date().toISOString().split("T")[0], 'Diger');
        });

        // Elemanların varlığını kontrol et
        console.log("Checking DOM elements...");
        if (!modalTitle || !eventForm || !eventTitle || !eventCategory || !eventFirmaId || !eventEgitimTuru || !eventTehlikeSinifi || !eventSure ||
            !personalModalTitle || !personalEventForm || !personalEventTitle || !personalEventStart || !personalEventEnd || !personalEventDescription ||
            !personalEventTuru || !personalEventFirma || !personalEventPersoneller) {
            console.error("Required elements not found!", {
                modalTitle: !!modalTitle,
                eventForm: !!eventForm,
                eventTitle: !!eventTitle,
                eventCategory: !!eventCategory,
                eventFirmaId: !!eventFirmaId,
                eventEgitimTuru: !!eventEgitimTuru,
                eventTehlikeSinifi: !!eventTehlikeSinifi,
                eventSure: !!eventSure,
                personalModalTitle: !!personalModalTitle,
                personalEventForm: !!personalEventForm,
                personalEventTitle: !!personalEventTitle,
                personalEventStart: !!personalEventStart,
                personalEventEnd: !!personalEventEnd,
                personalEventDescription: !!personalEventDescription,
                personalEventTuru: !!personalEventTuru,
                personalEventFirma: !!personalEventFirma,
                personalEventPersoneller: !!personalEventPersoneller
            });
            Swal.fire('Hata!', 'Gerekli HTML elemanları bulunamadı.', 'error');
            return;
        }
        console.log("All DOM elements found successfully.");

        // Şeffaf görüntü oluştur (ghost'u gizlemek için)
        const blankImage = new Image();
        blankImage.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

        // Takvim alanına girme durumunu izle
        let isOverCalendar = false;
        document.addEventListener('dragover', function (e) {
            const calendarEl = document.getElementById("calendar");
            const calendarRect = calendarEl.getBoundingClientRect();
            if (e.clientX >= calendarRect.left && e.clientX <= calendarRect.right &&
                e.clientY >= calendarRect.top && e.clientY <= calendarRect.bottom) {
                isOverCalendar = true;
            } else {
                isOverCalendar = false;
            }
            console.log("Drag over calendar:", isOverCalendar);
        });

        document.addEventListener('dragend', function (e) {
            if (isOverCalendar && (calendar.view.type === 'timeGridWeek' || calendar.view.type === 'timeGridDay' || calendar.view.type === 'dayGridMonth')) {
                e.dataTransfer.setDragImage(blankImage, 0, 0); // Tüm görünümlerde takvim alanına girince ghost'u gizle
                console.log("Ghost disabled when over calendar in:", calendar.view.type);
            }
        });

        // FullCalendar'ı başlat
        const calendarEl = document.getElementById("calendar");
        if (!calendarEl) {
            console.error("calendar element not found!");
            return;
        }
        console.log("Calendar element found: #calendar");

        const calendar = new FullCalendar.Calendar(calendarEl, {
            timeZone: "UTC",
            editable: true,
            droppable: true,
            selectable: true,
            navLinks: true,
            initialView: getInitialView(),
            themeSystem: "bootstrap",
            headerToolbar: {
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth"
            },
            windowResize: function () {
                console.log("Window resized, changing view...");
                calendar.changeView(getInitialView());
                console.log("View changed to:", calendar.view.type);
            },
            businessHours: {
                daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
                startTime: '00:00',
                endTime: '23:59'
            },
            slotMinTime: '00:00:00',
            slotMaxTime: '24:00:00',
            scrollTime: '06:00:00',
            allDaySlot: true,
            eventAllow: function (dropLocation, draggedEvent) {
                console.log("Event drop location:", dropLocation.start, dropLocation.end, "View:", calendar.view.type);
                return true;
            },
            eventDragStart: function (info) {
                console.log("Drag started:", info.event.title, "View:", calendar.view.type);
                if (!userRoles.includes('OSGB') && info.event.extendedProps.type === 'egitim') {
                    info.revert();
                    Swal.fire('Yetki Hatası!', 'Eğitim etkinliklerini taşıma yetkiniz yok.', 'error');
                    return false;
                }
            },
            events: function (fetchInfo, successCallback, failureCallback) {
                console.log("Fetching events for calendar...");
                fetch('/api/Calendar/GetEgitimlerForCalendar')
                    .then(response => {
                        if (!response.ok) throw new Error('Network response was not ok ' + response.statusText);
                        return response.json();
                    })
                    .then(data => {
                        console.log("Events fetched successfully:", data);
                        const events = data.map(event => {
                            let description = '';
                            let startTime = new Date(event.start).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                            if (event.type === 'egitim') {
                                const firmaName = event.firmaAdi || 'Bilinmeyen Firma';
                                const egitimName = event.title || 'Belirtilmedi';
                                const egitimTuru = event.egitimTuruAdi || 'Bilinmeyen Tür';
                                const tehlikeSinifi = event.tehlikeSinifi || 'Bilinmeyen';
                                description = formatEgitimBilgisi(firmaName, egitimName, egitimTuru, tehlikeSinifi, startTime);
                            } else {
                                description = `🕒 ${startTime}<br>📝 ${event.title}`;
                                if (event.etkinlikTuru && ['Toplanti', 'Ziyaret', 'Diger'].includes(event.etkinlikTuru)) {
                                    description += `<br>👥 Atanmış Personeller: ${event.atanmisKullanicilar?.map(k => k.AdSoyad).join(', ') || 'Yok'}`;
                                }
                            }

                            return {
                                id: event.id,
                                title: event.title,
                                start: event.start,
                                end: event.end,
                                className: event.className,
                                allDay: event.allDay,
                                extendedProps: {
                                    description: description,
                                    sure: event.sure || 0,
                                    tehlikeSinifi: event.tehlikeSinifi,
                                    egitimTuruId: event.egitimTuruId || null,
                                    egitimTuruAdi: event.egitimTuruAdi || 'Bilinmeyen Tür',
                                    firmaId: event.firmaId || null,
                                    firmaAdi: event.firmaAdi || 'Bilinmeyen Firma',
                                    egitimAdi: event.type === 'egitim' ? (event.title.split(' - ')[1]?.split(' (')[0] || event.title) : event.title,
                                    type: event.type,
                                    etkinlikTuru: event.etkinlikTuru,
                                    atanmisKullanicilar: event.atanmisKullanicilar
                                }
                            };
                        });
                        console.log("Processed events for calendar:", events);

                        // Yaklaşan etkinlikleri Aktiviteler listesine ekle
                        populateUpcomingEvents(events);

                        successCallback(events);
                    })
                    .catch(err => {
                        console.error("Error fetching events:", err);
                        failureCallback(err);
                        Swal.fire('Hata!', 'Takvim verileri yüklenemedi: ' + err.message, 'error');
                    });
            },
            eventDidMount: function (info) {
                const description = info.event.extendedProps.description;
                if (description) {
                    new bootstrap.Tooltip(info.el, {
                        title: description,
                        placement: 'top',
                        trigger: 'hover',
                        html: true,
                        container: 'body'
                    });
                }
            },
            eventReceive: function (info) {
                console.log("Event received:", info.event.title, "Dropped at:", info.event.start, "View:", calendar.view.type);
                if (!userRoles.includes('OSGB')) {
                    info.revert();
                    Swal.fire('Yetki Hatası!', 'Eğitim oluşturma yetkiniz yok.', 'error');
                    return;
                }

                // Geçmiş tarih kontrolü
                if (isDateInPast(info.event.start)) {
                    info.revert();
                    Swal.fire('Hata!', 'Geçmiş tarihlere eğitim oluşturulamaz.', 'error');
                    return;
                }

                // Firma ID’sini sakla ve event-type-selection-modal aç
                selectedFirmaId = info.event.extendedProps.firmaId;
                tempDate = info.event.startStr;
                isDragAction = true; // Drag işlemi olduğunu belirt
                eventTypeSelectionModal.show();

                // Geçici etkinliği kaldır
                info.event.remove();
            },
            eventDrop: function (info) {
                console.log("Event dropped:", info.event.title, "Start:", info.event.start, "Old Start:", info.oldEvent.start);
                if (!userRoles.includes('OSGB') && info.event.extendedProps.type === 'egitim') {
                    info.revert();
                    Swal.fire('Yetki Hatası!', 'Eğitim etkinliklerini taşıma yetkiniz yok.', 'error');
                    return;
                }

                // Geçmiş tarih kontrolü
                if (isDateInPast(info.event.start)) {
                    info.revert();
                    Swal.fire('Hata!', 'Etkinlik geçmiş tarihlere taşınamaz.', 'error');
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
                            // Eğitim etkinliği için işlem
                            const durationInHours = selectedEvent.extendedProps.sure || 1;
                            const newEnd = new Date(info.event.start);
                            newEnd.setHours(newEnd.getHours() + durationInHours);
                            selectedEvent.setEnd(newEnd);
                            eventForm.dataset.date = info.event.start.toISOString().split('T')[0];
                            saveEgitimToServer({
                                EgitimId: parseInt(info.event.id),
                                Ad: info.event.title.split(' - ')[1]?.split(' (')[0] || info.event.title,
                                EgitimTarihi: info.event.start.toISOString(),
                                Sure: selectedEvent.extendedProps.sure || 1,
                                TehlikeSinifi: selectedEvent.extendedProps.tehlikeSinifi || "AzTehlikeli",
                                EgitimTuruId: selectedEvent.extendedProps.egitimTuruId || null,
                                RefFirmaId: selectedEvent.extendedProps.firmaId,
                                AllDay: true
                            }, "Edit").then(() => {
                                calendar.refetchEvents();
                                Swal.fire('Başarılı!', 'Eğitim etkinliği güncellendi.', 'success');
                            }).catch(err => {
                                console.error("Eğitim güncellenemedi:", err.message);
                                info.revert();
                                Swal.fire('Hata!', 'Eğitim etkinliği güncellenemedi: ' + err.message, 'error');
                            });
                        } else {
                            // Kişisel etkinlik için işlem
                            const newEnd = info.event.end ? new Date(info.event.end) : null;
                            selectedEvent.setEnd(newEnd);
                            personalEventForm.dataset.date = info.event.start.toISOString().split('T')[0];
                            saveEtkinlikToServer({
                                EtkinlikId: parseInt(info.event.id.replace('etkinlik-', '')),
                                Ad: info.event.title,
                                BaslangicTarihi: info.event.start.toISOString(),
                                BitisTarihi: info.event.end ? info.event.end.toISOString() : null,
                                Aciklama: info.event.extendedProps.description || "",
                                EtkinlikTuru: info.event.extendedProps.etkinlikTuru,
                                RefFirmaId: info.event.extendedProps.firmaId,
                                AtananKullaniciIds: info.event.extendedProps.atanmisKullanicilar?.map(k => k.KullaniciId) || [],
                                AllDay: true
                            }, "Edit").then(() => {
                                calendar.refetchEvents();
                                Swal.fire('Başarılı!', 'Etkinlik güncellendi.', 'success');
                            }).catch(err => {
                                console.error("Etkinlik güncellenemedi:", err.message);
                                info.revert();
                                Swal.fire('Hata!', 'Etkinlik güncellenemedi: ' + err.message, 'error');
                            });
                        }
                    } else {
                        info.revert();
                    }
                });
            },
            eventClick: function (info) {
                console.log("Event clicked:", info.event);
                selectedEvent = info.event;

                if (info.event.extendedProps.type === 'egitim') {
                    if (userRoles.includes('OSGB')) {
                        // OSGB rolü için mevcut modalı aç
                        const editBtn = document.getElementById("edit-event-btn");
                        const saveBtn = document.getElementById("btn-save-event");
                        const deleteBtn = document.getElementById("btn-delete-event");
                        const confirmBtn = document.getElementById("btn-confirm-event");

                        if (!editBtn || !saveBtn || !deleteBtn || !confirmBtn) {
                            console.error("One or more buttons not found! Check DOM or modal structure:", {
                                editBtn: !!editBtn,
                                saveBtn: !!saveBtn,
                                deleteBtn: !!deleteBtn,
                                confirmBtn: !!confirmBtn
                            });
                            return;
                        }

                        // Tüm butonları varsayılan olarak gizle
                        editBtn.removeAttribute("hidden");
                        saveBtn.setAttribute("hidden", true);
                        deleteBtn.removeAttribute("hidden");
                        confirmBtn.removeAttribute("hidden");
                        editBtn.setAttribute("data-id", "edit-event");
                        editBtn.innerHTML = "Düzenle";
                        eventForm.classList.remove("readonly-modal");

                        eventModal.show();
                        eventForm.reset();
                        const existingDetails = eventForm.querySelector('.event-details');
                        if (existingDetails) existingDetails.remove();
                        eventForm.dataset.date = selectedEvent.start.toISOString().split('T')[0];
                        eventTitle.value = selectedEvent.extendedProps.egitimAdi || "Belirtilmedi";
                        eventCategory.value = selectedEvent.classNames[0] || "";
                        eventFirmaId.value = selectedEvent.extendedProps.firmaId || "";
                        eventEgitimTuru.value = selectedEvent.extendedProps.egitimTuruId || "";
                        eventTehlikeSinifi.value = selectedEvent.extendedProps.tehlikeSinifi || "";
                        eventSure.value = selectedEvent.extendedProps.sure || "";
                        document.getElementById("event-tarihi").value = selectedEvent.start.toISOString().split('T')[0];
                        eventClicked();
                    } else {
                        // OSGB dışındaki roller için görüntüleme modalını aç
                        document.getElementById('view-modal-title').innerHTML = 'Eğitim Detayları';
                        document.getElementById('view-event-title').innerHTML = selectedEvent.title;
                        document.getElementById('view-event-start').innerHTML = selectedEvent.start.toISOString().split('T')[0];
                        document.getElementById('view-event-end').innerHTML = selectedEvent.end ? selectedEvent.end.toISOString().split('T')[0] : 'Yok';
                        document.getElementById('view-event-type').innerHTML = 'Eğitim';
                        document.getElementById('view-event-description').innerHTML = selectedEvent.extendedProps.description || 'Yok';
                        document.getElementById('view-event-sure').innerHTML = selectedEvent.extendedProps.sure || 'Yok';
                        document.getElementById('view-event-tehlike-sinifi').innerHTML = selectedEvent.extendedProps.tehlikeSinifi || 'Yok';
                        document.getElementById('view-event-egitim-turu').innerHTML = selectedEvent.extendedProps.egitimTuruAdi || 'Yok';
                        document.getElementById('view-event-firma').innerHTML = selectedEvent.extendedProps.firmaAdi || 'Yok';
                        document.getElementById('view-event-etkinlik-turu').innerHTML = '';
                        document.getElementById('view-event-atanmis-kullanicilar').innerHTML = '';

                        document.querySelectorAll('.egitim-only').forEach(el => el.style.display = 'block');
                        document.querySelectorAll('.etkinlik-only').forEach(el => el.style.display = 'none');
                        document.getElementById('btn-egitim-al').removeAttribute('hidden');

                        // "Eğitim Al" butonuna eğitim ID'sini ekle
                        const egitimAlBtn = document.getElementById("btn-egitim-al");
                        egitimAlBtn.setAttribute("data-egitim-id", selectedEvent.id);

                        viewEventModal.show();
                    }
                } else {
                    // Kişisel etkinlik için kişisel etkinlik modalını aç
                    const editBtn = document.getElementById("edit-personal-event-btn");
                    const saveBtn = document.getElementById("btn-save-personal-event");
                    const deleteBtn = document.getElementById("btn-delete-personal-event");

                    editBtn.removeAttribute("hidden");
                    saveBtn.setAttribute("hidden", true);
                    deleteBtn.removeAttribute("hidden");
                    editBtn.setAttribute("data-id", "edit-personal-event");
                    editBtn.innerHTML = "Düzenle";
                    personalEventForm.classList.remove("readonly-modal");

                    personalEventModal.show();
                    personalEventForm.reset();
                    const existingDetails = personalEventForm.querySelector('.event-details');
                    if (existingDetails) existingDetails.remove();
                    personalEventForm.dataset.date = selectedEvent.start.toISOString().split('T')[0];
                    personalEventTitle.value = selectedEvent.title || "Belirtilmedi";
                    personalEventStart.value = selectedEvent.start.toISOString().split('T')[0];
                    personalEventEnd.value = selectedEvent.end ? selectedEvent.end.toISOString().split('T')[0] : "";
                    personalEventDescription.value = selectedEvent.extendedProps.aciklama || "";
                    personalEventTuru.value = selectedEvent.extendedProps.etkinlikTuru || "Etkinlik";
                    personalEventFirma.value = selectedEvent.extendedProps.firmaId || "";

                    // Firma ve personel seçimi alanını göster/gizle
                    const firmaSection = document.getElementById('firma-selection');
                    const personelSection = document.getElementById('personel-selection');
                    if (['Toplanti', 'Ziyaret', 'Diger'].includes(selectedEvent.extendedProps.etkinlikTuru)) {
                        firmaSection.style.display = 'block';
                        personelSection.style.display = 'block';
                        loadOSGBFirms();
                        if (selectedEvent.extendedProps.firmaId) {
                            console.log("Firma ID ile personeller yükleniyor:", selectedEvent.extendedProps.firmaId);
                            // Drag ile seçilen firma ID’si yerine currentUserFirmaId kullan
                            loadPersoneller(currentUserFirmaId);
                        }
                        // Atanmış personelleri seçili yap
                        if (selectedEvent.extendedProps.atanmisKullanicilar) {
                            selectedEvent.extendedProps.atanmisKullanicilar.forEach(k => {
                                const option = personalEventPersoneller.querySelector(`option[value="${k.KullaniciId}"]`);
                                if (option) {
                                    console.log("Seçili personel:", k.AdSoyad, "KullaniciId:", k.KullaniciId);
                                    option.selected = true;
                                }
                            });
                        }
                    } else {
                        firmaSection.style.display = 'none';
                        personelSection.style.display = 'none';
                    }

                    personalEventClicked();
                }
            },
            dateClick: function (info) {
                console.log("Date clicked:", info.dateStr);
                // Geçmiş tarih kontrolü
                if (isDateInPast(info.dateStr)) {
                    Swal.fire('Hata!', 'Geçmiş tarihlere etkinlik veya eğitim oluşturulamaz.', 'error');
                    return;
                }

                selectedFirmaId = null; // Firma seçimini sıfırla
                tempDate = info.dateStr; // Tarihi sakla
                isDragAction = false; // Drag işlemi değil
                eventTypeSelectionModal.show(); // Her zaman event-type-selection-modal aç
            }
        });

        console.log("Rendering FullCalendar...");
        calendar.render();
        console.log("FullCalendar rendered successfully.");

        // SignalR bağlantısı
        console.log("Initializing SignalR connection...");
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("/calendarHub")
            .build();

        connection.on("ReceiveEvent", function (title, start, className) {
            console.log("Received event via SignalR:", title);
            calendar.refetchEvents();
        });

        connection.on("DeleteEvent", function (eventId) {
            console.log("Received delete event via SignalR:", eventId);
            calendar.getEventById(eventId)?.remove();
        });

        connection.start()
            .then(() => console.log("SignalR connected successfully!"))
            .catch(err => console.error("SignalR connection failed:", err));

        // Firma listesini yükle (sadece OSGB kullanıcıları için)
        console.log("Fetching OSGB firms...");
        if (userRoles.includes('OSGB')) {
            fetch('/api/Calendar/getOSGBFirms', {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
            })
                .then(response => {
                    console.log("Received response from /api/Calendar/getOSGBFirms:", response);
                    if (!response.ok) {
                        console.error("Error loading firms for OSGB:", response.statusText);
                        return null;
                    }
                    return response.json();
                })
                .then(data => {
                    if (data && Array.isArray(data)) {
                        console.log("Fetched firms data (raw):", data);
                        const firmaSelect = document.getElementById('selectedFirmaId');
                        const draggableEl = document.getElementById("firma-listesi");
                        if (!draggableEl) {
                            console.error("firma-listesi element not found!");
                            return;
                        }
                        if (data.length === 0) {
                            Swal.fire('Uyarı!', 'Henüz bir firmanız yok. Lütfen bir firma ekleyin.', 'warning');
                        }
                        firmaSelect.innerHTML = '<option value="">Firma Seçin...</option>';
                        draggableEl.innerHTML = '';
                        data.forEach(firma => {
                            const firmaDiv = document.createElement("div");
                            firmaDiv.className = "external-event fc-event bg-primary";
                            firmaDiv.setAttribute("data-class", "bg-primary");
                            const firmaId = firma.id !== undefined ? firma.id : (firma.Id !== undefined ? firma.Id : (firma.FirmaId !== undefined ? firma.FirmaId : "unknown"));
                            const firmaName = firma.name !== undefined ? firma.name : (firma.Name !== undefined ? firma.Name : (firma.FirmaAdi !== undefined ? firma.FirmaAdi : "Bilinmeyen Firma"));
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

                            console.log("Firma eklendi:", { id: firmaId, name: firmaName });
                        });
                        console.log("Firms loaded successfully, count:", data.length);
                        console.log("firma-listesi içeriği:", draggableEl.innerHTML);

                        new FullCalendar.Draggable(draggableEl, {
                            itemSelector: ".external-event",
                            eventData: function (el, ev) {
                                const firmaId = el.getAttribute("data-firma-id");
                                const currentView = calendar.view.type;

                                if (ev && ev.dataTransfer) {
                                    ev.dataTransfer.setDragImage(blankImage, 0, 0);
                                    console.log("Default drag ghost disabled for:", el.innerText, "in view:", currentView);
                                }

                                return {
                                    title: el.innerText.trim(),
                                    className: el.getAttribute("data-class") || "bg-primary",
                                    firmaId: firmaId || "unknown",
                                    create: true,
                                    allDay: true
                                };
                            }
                        });
                        console.log("FullCalendar Draggable initialized successfully");
                    } else {
                        console.error("No firms found or invalid data:", data);
                    }
                })
                .catch(err => {
                    console.error("Error loading firms:", err);
                });
        }

        // Eğitim türlerini yükle (sadece OSGB kullanıcıları için)
        console.log("Fetching education types...");
        if (userRoles.includes('OSGB')) {
            fetch('/api/Calendar/GetEgitimTurleri', {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
            })
                .then(response => {
                    console.log("Received response from /api/Calendar/GetEgitimTurleri:", response);
                    if (!response.ok) throw new Error('Network response was not ok ' + response.statusText);
                    return response.json();
                })
                .then(data => {
                    console.log("Fetched education types data:", data);
                    const select = document.getElementById('event-egitim-turu');
                    select.innerHTML = '<option value="">Seçin...</option>';
                    if (data.success && Array.isArray(data.data)) {
                        data.data.forEach(tur => {
                            const option = document.createElement('option');
                            option.value = tur.egitimTuruId || '';
                            option.text = tur.ad || `Eğitim Türü ${tur.egitimTuruId || 'Bilinmeyen'}`;
                            select.appendChild(option);
                            console.log("Eğitim türü eklendi:", { egitimTuruId: tur.egitimTuruId, ad: tur.ad });
                        });
                        console.log("Education types loaded successfully, count:", data.data.length);
                    } else {
                        console.warn("Education types not found or invalid data:", data.message);
                        select.innerHTML += '<option value="1">Temel İş Güvenliği</option><option value="2">İleri İş Güvenliği</option>';
                        Swal.fire('Uyarı!', 'Eğitim türleri veritabanından alınamadı. Varsayılan türler eklendi.', 'warning');
                    }
                    console.log("event-egitim-turu içeriği:", select.innerHTML);
                    eventModal._element.addEventListener('shown.bs.modal', function () {
                        select.style.display = "block";
                        console.log("Modal açıldı, select içeriği:", select.innerHTML);
                    });
                })
                .catch(err => {
                    console.error("Error loading education types:", err);
                    const select = document.getElementById('event-egitim-turu');
                    select.innerHTML += '<option value="1">Temel İş Güvenliği</option><option value="2">İleri İş Güvenliği</option>';
                    Swal.fire('Hata!', 'Eğitim türleri yüklenemedi. Varsayılan türler eklendi: ' + err.message, 'error');
                    console.log("event-egitim-turu içeriği (hata sonrası):", select.innerHTML);
                });
        }

        // Firmaları yükleme (eğitim modalı için)
        function loadOSGBFirms() {
            console.log("Loading OSGB firms...");
            fetch('/api/Calendar/getOSGBFirms', {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
            })
                .then(response => {
                    console.log("Received response from /api/Calendar/getOSGBFirms:", response.status, response.statusText);
                    if (!response.ok) throw new Error('Firmalar yüklenemedi: ' + response.statusText);
                    return response.json();
                })
                .then(data => {
                    console.log("Fetched OSGB firms data:", data);
                    if (Array.isArray(data)) {
                        const firmaSelect = document.getElementById('event-firma-id');
                        const personalFirmaSelect = document.getElementById('personal-event-firma');
                        firmaSelect.innerHTML = '<option value="">Seçin...</option>';
                        personalFirmaSelect.innerHTML = '<option value="">Seçin...</option>';
                        data.forEach(firma => {
                            const option = document.createElement('option');
                            option.value = firma.id;
                            option.text = firma.name;
                            firmaSelect.appendChild(option);
                            const option2 = document.createElement('option');
                            option2.value = firma.id;
                            option2.text = firma.name;
                            personalFirmaSelect.appendChild(option2);
                        });
                        // Eğer selectedFirmaId varsa, otomatik olarak seç
                        if (selectedFirmaId) {
                            firmaSelect.value = selectedFirmaId;
                            console.log("Firma otomatik seçildi:", selectedFirmaId);
                        }
                    } else {
                        throw new Error('Firmalar listesi Array değil:', data);
                    }
                })
                .catch(err => {
                    console.error("Error loading OSGB firms:", err);
                    Swal.fire('Hata!', 'Firmalar yüklenemedi: ' + err.message, 'error');
                });
        }

        // Personel listesini yükleme (currentUserFirmaId kullan)
        function loadPersoneller() {
            console.log("Loading personeller for currentUserFirmaId:", currentUserFirmaId);
            fetch(`/api/Calendar/GetFirmPersoneller?firmaId=${currentUserFirmaId}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
            })
                .then(response => {
                    console.log("Received response from /api/Calendar/GetFirmPersoneller:", response.status, response.statusText);
                    if (!response.ok) throw new Error('Personel listesi alınamadı: ' + response.statusText);
                    return response.json();
                })
                .then(data => {
                    console.log("Fetched personeller data:", data);
                    if (data.success && Array.isArray(data.data)) {
                        const personelSelect = document.getElementById('personal-event-personeller');
                        personelSelect.innerHTML = '';
                        data.data.forEach(personel => {
                            const option = document.createElement('option');
                            option.value = personel.kullaniciId;
                            option.text = personel.adSoyad + (personel.tcKimlikNo ? ` (${personel.tcKimlikNo})` : '');
                            personelSelect.appendChild(option);
                            console.log("Personel eklendi:", { kullaniciId: personel.kullaniciId, adSoyad: personel.adSoyad });
                        });
                        console.log("Personeller yüklendi, toplam:", data.data.length);
                    } else {
                        console.warn("Personel bulunamadı:", data.message);
                        Swal.fire('Uyarı!', 'Personel bulunamadı: ' + (data.message || 'Bilinmeyen hata'), 'warning');
                    }
                })
                .catch(err => {
                    console.error("Personel yükleme hatası:", err);
                    Swal.fire('Hata!', 'Personel listesi yüklenemedi: ' + err.message, 'error');
                });
        }

        // Event Listener'lar
        document.getElementById('confirmFirmaSelection').addEventListener('click', function () {
            selectedFirmaId = document.getElementById('selectedFirmaId').value;
            if (selectedFirmaId) {
                console.log("Firma seçildi:", selectedFirmaId);
                firmSelectionModal.hide();
                newEgitim(tempDate || new Date().toISOString().split("T")[0]);
            } else {
                Swal.fire('Hata!', 'Lütfen bir firma seçin.', 'error');
            }
        });

        document.getElementById("btn-confirm-event").addEventListener("click", function () {
            console.log("Confirm event clicked for ID:", selectedEvent?.id);
            if (selectedEvent) {
                fetch(`/api/Calendar/ConfirmEgitim?id=${selectedEvent.id}`, {
                    method: "POST",
                    headers: { "RequestVerificationToken": document.querySelector('input[name="__RequestVerificationToken"]').value }
                })
                    .then(response => {
                        console.log("Received response from /api/Calendar/ConfirmEgitim:", response);
                        if (!response.ok) throw new Error(`Failed to confirm education: ${response.statusText}`);
                        return response.json();
                    })
                    .then(data => {
                        if (data.success) {
                            console.log("Event confirmed successfully:", selectedEvent.id);
                            eventModal.hide();
                            calendar.refetchEvents();
                            selectedEvent = null;
                            Swal.fire('Başarılı!', 'Eğitim etkinliği onaylandı.', 'success');
                        } else {
                            console.error("Confirm failed:", data.message);
                            throw new Error(data.message || "Onaylama başarısız");
                        }
                    })
                    .catch(err => {
                        console.error("Error confirming event:", err);
                        Swal.fire('Hata!', 'Eğitim etkinliği onaylanamadı: ' + err.message, 'error');
                    });
            } else {
                console.error("No selected event to confirm.");
            }
        });

        document.getElementById("btn-delete-event").addEventListener("click", function () {
            console.log("Delete event button clicked.");
            if (selectedEvent) {
                const confirmMessage = `Eğitim etkinliği "${selectedEvent.title}" silinecek. Emin misiniz?`;
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
                        console.log("Deleting event with ID:", selectedEvent.id);
                        fetch(`/api/Calendar/DeleteEgitim?id=${selectedEvent.id}`, {
                            method: "POST",
                            headers: { "RequestVerificationToken": document.querySelector('input[name="__RequestVerificationToken"]').value }
                        })
                            .then(response => {
                                console.log("Received response from /api/Calendar/DeleteEgitim:", response);
                                if (!response.ok) throw new Error(`Failed to delete education: ${response.statusText}`);
                                return response.json();
                            })
                            .then(data => {
                                if (data.success) {
                                    console.log("Event deleted successfully:", selectedEvent.id);
                                    selectedEvent.remove();
                                    eventModal.hide();
                                    selectedEvent = null;
                                    Swal.fire('Başarılı!', 'Eğitim etkinliği silindi.', 'success');
                                } else {
                                    console.error("Delete failed:", data.message);
                                    throw new Error(data.message || "Silme başarısız");
                                }
                            })
                            .catch(err => {
                                console.error("Error deleting event:", err);
                                Swal.fire('Hata!', 'Eğitim etkinliği silinemedi: ' + err.message, 'error');
                            });
                    }
                });
            } else {
                console.error("No selected event to delete.");
            }
        });

        document.getElementById("edit-event-btn").addEventListener("click", function () {
            console.log("Edit event button clicked.");
            editEvent(this);
        });

        document.getElementById("btn-delete-personal-event").addEventListener("click", function () {
            console.log("Delete personal event button clicked.");
            if (selectedEvent) {
                const confirmMessage = `Etkinlik "${selectedEvent.title}" silinecek. Emin misiniz?`;
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
                        console.log("Deleting personal event with ID:", selectedEvent.id);
                        fetch(`/api/Calendar/DeleteEtkinlik?id=${parseInt(selectedEvent.id.replace('etkinlik-', ''))}`, {
                            method: "POST",
                            headers: { "RequestVerificationToken": document.querySelector('input[name="__RequestVerificationToken"]').value }
                        })
                            .then(response => {
                                console.log("Received response from /api/Calendar/DeleteEtkinlik:", response);
                                if (!response.ok) throw new Error(`Failed to delete personal event: ${response.statusText}`);
                                return response.json();
                            })
                            .then(data => {
                                if (data.success) {
                                    console.log("Personal event deleted successfully:", selectedEvent.id);
                                    selectedEvent.remove();
                                    personalEventModal.hide();
                                    selectedEvent = null;
                                    Swal.fire('Başarılı!', 'Etkinlik silindi.', 'success');
                                } else {
                                    console.error("Delete failed:", data.message);
                                    throw new Error(data.message || "Silme başarısız");
                                }
                            })
                            .catch(err => {
                                console.error("Error deleting personal event:", err);
                                Swal.fire('Hata!', 'Etkinlik silinemedi: ' + err.message, 'error');
                            });
                    }
                });
            } else {
                console.error("No selected personal event to delete.");
            }
        });

        document.getElementById("edit-personal-event-btn").addEventListener("click", function () {
            console.log("Edit personal event button clicked.");
            editPersonalEvent(this);
        });

        // "Eğitim Al" butonuna tıklama olayı
        document.getElementById("btn-egitim-al").addEventListener("click", function () {
            const egitimId = this.getAttribute("data-egitim-id");
            console.log("Eğitim Al butonuna tıklandı, EgitimId:", egitimId);

            // Backend'e istek göndererek EgitimKatilimcilar kaydını al
            fetch(`/Egitimlerim/GetKatilimId?egitimId=${egitimId}`, {
                method: "GET",
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
            })
                .then(response => {
                    if (!response.ok) throw new Error(response.statusText);
                    return response.json();
                })
                .then(data => {
                    if (data.success && data.katilimId) {
                        console.log("Eğitim kaydı bulundu, KatilimId:", data.katilimId);
                        // Modal'ı kapat
                        viewEventModal.hide();
                        // Egitimlerim/Detay sayfasına yönlendir
                        window.location.href = `/Egitimlerim/Detay/${data.katilimId}`;
                    } else {
                        console.error("Eğitim kaydı bulunamadı:", data.message);
                        Swal.fire('Hata!', data.message || 'Eğitim kaydı bulunamadı.', 'error');
                    }
                })
                .catch(err => {
                    console.error("Eğitim kaydı alınırken hata:", err);
                    Swal.fire('Hata!', 'Eğitim kaydı alınamadı: ' + err.message, 'error');
                });
        });

        eventForm.addEventListener("submit", function (e) {
            console.log("Form submit event triggered (Eğitim).");
            e.preventDefault();
            if (!eventForm.checkValidity()) {
                console.log("Form validation failed. Invalid fields:", eventForm.querySelectorAll(':invalid'));
                eventForm.classList.add("was-validated");
                Swal.fire('Hata!', 'Lütfen tüm zorunlu alanları doldurun.', 'error');
                return;
            }

            if (isSubmitting) {
                console.log("Zaten bir işlem yürütülüyor, çift submit önlendi.");
                return;
            }

            console.log("Form validated successfully, preparing egitimData...");
            console.log("event-firma-id value before submit:", eventFirmaId.value);
            const egitimData = {
                EgitimId: selectedEvent ? parseInt(selectedEvent.id) : null,
                Ad: eventTitle.value || "Belirtilmedi",
                EgitimTarihi: document.getElementById('event-tarihi').value ? new Date(document.getElementById('event-tarihi').value).toISOString() : eventForm.dataset.date,
                Sure: parseInt(eventSure.value) || 1,
                TehlikeSinifi: eventTehlikeSinifi.value || "AzTehlikeli",
                EgitimTuruId: eventEgitimTuru.value ? parseInt(eventEgitimTuru.value) : null,
                RefFirmaId: eventFirmaId.value ? parseInt(eventFirmaId.value) : null,
                AllDay: true
            };
            console.log("Prepared egitimData:", JSON.stringify(egitimData, null, 2));

            const confirmMessage = selectedEvent
                ? `Eğitim etkinliği "${eventTitle.value}" güncellenecek. Emin misiniz?`
                : `Yeni eğitim etkinliği "${eventTitle.value}" oluşturulacak. Emin misiniz?`;
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
                    saveEgitimToServer(egitimData, selectedEvent ? "Edit" : "Create")
                        .then(() => {
                            console.log("Eğitim başarıyla kaydedildi, modal kapatılıyor...");
                            eventModal.hide();
                            console.log("Refetching events...");
                            calendar.refetchEvents();
                            if (!selectedEvent && eventForm.dataset.event) {
                                const tempEvent = JSON.parse(eventForm.dataset.event);
                                console.log("Removing temporary event:", tempEvent.id);
                                calendar.getEventById(tempEvent.id)?.remove();
                            }

                            // Geçici etkinlikleri kaldır
                            calendar.getEvents().forEach(event => {
                                if (event.extendedProps.isTemp) {
                                    event.remove();
                                }
                            });
                            Swal.fire('Başarılı!', selectedEvent ? 'Eğitim etkinliği güncellendi.' : 'Eğitim etkinliği oluşturuldu.', 'success');
                        })
                        .catch(err => {
                            console.error("Submit error:", err);
                            isSubmitting = false;
                            Swal.fire('Hata!', 'Eğitim etkinliği kaydedilemedi: ' + err.message, 'error');
                            document.getElementById("btn-save-event").disabled = false;
                            document.getElementById("btn-save-event").innerHTML = "Kaydet";
                        });
                }
            });
        });

        personalEventForm.addEventListener("submit", function (e) {
            console.log("Form submit event triggered (Kişisel Etkinlik).");
            e.preventDefault();
            if (!personalEventForm.checkValidity()) {
                console.log("Form validation failed. Invalid fields:", personalEventForm.querySelectorAll(':invalid'));
                personalEventForm.classList.add("was-validated");
                Swal.fire('Hata!', 'Lütfen tüm zorunlu alanları doldurun.', 'error');
                return;
            }

            if (isSubmitting) {
                console.log("Zaten bir işlem yürütülüyor, çift submit önlendi.");
                return;
            }

            console.log("Form validated successfully, preparing etkinlikData...");
            const personelSelect = document.getElementById('personal-event-personeller');
            const atanmisKullaniciIds = Array.from(personelSelect.selectedOptions).map(option => parseInt(option.value));

            const etkinlikData = {
                EtkinlikId: selectedEvent ? parseInt(selectedEvent.id.replace('etkinlik-', '')) : null,
                Ad: personalEventTitle.value || "Belirtilmedi",
                BaslangicTarihi: personalEventStart.value ? new Date(personalEventStart.value).toISOString() : new Date().toISOString(),
                BitisTarihi: personalEventEnd.value ? new Date(personalEventEnd.value).toISOString() : null,
                Aciklama: personalEventDescription.value || "",
                EtkinlikTuru: personalEventTuru.value,
                AtananKullaniciIds: atanmisKullaniciIds.length > 0 ? atanmisKullaniciIds : null,
                RefFirmaId: ['Toplanti', 'Ziyaret', 'Diger'].includes(personalEventTuru.value) ? parseInt(personalEventFirma.value) : null,
                AllDay: true
            };
            console.log("Prepared etkinlikData:", JSON.stringify(etkinlikData, null, 2));

            const confirmMessage = selectedEvent
                ? `Etkinlik "${personalEventTitle.value}" güncellenecek. Emin misiniz?`
                : `Yeni etkinlik "${personalEventTitle.value}" oluşturulacak. Emin misiniz?`;
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
                    saveEtkinlikToServer(etkinlikData, selectedEvent ? "Edit" : "Create")
                        .then(() => {
                            console.log("Etkinlik başarıyla kaydedildi, modal kapatılıyor...");
                            personalEventModal.hide();
                            console.log("Refetching events...");
                            calendar.refetchEvents();
                            if (!selectedEvent && personalEventForm.dataset.event) {
                                const tempEvent = JSON.parse(personalEventForm.dataset.event);
                                console.log("Removing temporary event:", tempEvent.id);
                                calendar.getEventById(tempEvent.id)?.remove();
                            }

                            // Geçici etkinlikleri kaldır
                            calendar.getEvents().forEach(event => {
                                if (event.extendedProps.isTemp) {
                                    event.remove();
                                }
                            });
                            Swal.fire('Başarılı!', selectedEvent ? 'Etkinlik güncellendi.' : 'Etkinlik oluşturuldu.', 'success');
                        })
                        .catch(err => {
                            console.error("Submit error:", err);
                            isSubmitting = false;
                            Swal.fire('Hata!', 'Etkinlik kaydedilemedi: ' + err.message, 'error');
                            document.getElementById("btn-save-personal-event").disabled = false;
                            document.getElementById("btn-save-personal-event").innerHTML = "Kaydet";
                        });
                }
            });
        });

        // Tüm modallara geçici etkinlikleri temizleyecek event listener eklenmesi
        document.querySelectorAll('.modal').forEach(modalEl => {
            modalEl.addEventListener('shown.bs.modal', function () {
                // Modal açıldığında isSubmitting'i sıfırla
                isSubmitting = false;
                if (modalEl.id === 'event-modal') {
                    document.getElementById("btn-save-event").disabled = false;
                    document.getElementById("btn-save-event").innerHTML = "Kaydet";
                } else if (modalEl.id === 'personal-event-modal') {
                    document.getElementById("btn-save-personal-event").disabled = false;
                    document.getElementById("btn-save-personal-event").innerHTML = "Kaydet";
                }
            });
            modalEl.addEventListener('hidden.bs.modal', function () {
                // Modal kapandığında geçici etkinlikleri kaldır
                calendar.getEvents().forEach(event => {
                    if (event.extendedProps.isTemp) {
                        event.remove();
                    }
                });
                // Modal kapandığında formları tamamen sıfırla
                if (modalEl.id === 'event-modal') {
                    eventForm.reset();
                    eventTitle.value = "";
                    eventCategory.value = "";
                    eventFirmaId.value = "";
                    eventEgitimTuru.value = "";
                    eventTehlikeSinifi.value = "";
                    eventSure.value = "";
                    document.getElementById("event-tarihi").value = "";
                    const existingDetails = eventForm.querySelector('.event-details');
                    if (existingDetails) existingDetails.remove();
                } else if (modalEl.id === 'personal-event-modal') {
                    personalEventForm.reset();
                    personalEventTitle.value = "";
                    personalEventStart.value = "";
                    personalEventEnd.value = "";
                    personalEventDescription.value = "";
                    personalEventTuru.value = "Etkinlik";
                    personalEventFirma.value = "";
                    personalEventPersoneller.innerHTML = '';
                    const existingDetails = personalEventForm.querySelector('.event-details');
                    if (existingDetails) existingDetails.remove();
                }
            });
        });

        // Yaklaşan etkinlikleri Aktiviteler listesine ekleyen fonksiyon
        function populateUpcomingEvents(events) {
            console.log("Populating upcoming events to activity feed...");
            const activityFeed = document.getElementById("activity-feed");
            if (!activityFeed) {
                console.error("Activity feed element not found!");
                return;
            }

            // Mevcut içeriği temizle
            activityFeed.innerHTML = '';

            // Bugünden itibaren 7 gün içindeki etkinlikleri filtrele
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0); // UTC başlangıcı
            const endDate = new Date(today);
            endDate.setUTCDate(today.getUTCDate() + 7); // 7 gün sonrası

            console.log("Today (UTC):", today.toISOString(), "End Date (UTC):", endDate.toISOString());

            const upcomingEvents = events
                .filter(event => {
                    const eventStart = new Date(event.start);
                    const isWithinRange = eventStart >= today && eventStart <= endDate;
                    console.log("Checking event:", event.title, "Start (UTC):", eventStart.toISOString(), "Is within range:", isWithinRange);
                    return isWithinRange;
                })
                .sort((a, b) => new Date(a.start) - new Date(b.start)); // Tarihe göre sırala

            if (upcomingEvents.length === 0) {
                activityFeed.innerHTML = '<li class="text-muted">Yaklaşan etkinlik bulunmamaktadır.</li>';
                console.log("No upcoming events found.");
                return;
            }

            // Yaklaşan etkinlikleri listele
            upcomingEvents.forEach(event => {
                const eventStart = new Date(event.start);
                const startDate = eventStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
                const startTime = eventStart.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
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
            console.log("Upcoming events populated:", upcomingEvents.map(e => e.title));
        }

        function getInitialView() {
            if (window.innerWidth >= 768 && window.innerWidth < 1200) return "timeGridWeek";
            if (window.innerWidth <= 768) return "listMonth";
            return "dayGridMonth";
        }

        function newEgitim(dateStr) {
            console.log("newEgitim called with dateStr:", dateStr);
            if (!userRoles.includes('OSGB')) {
                Swal.fire('Yetki Hatası!', 'Eğitim oluşturma yetkiniz yok.', 'error');
                return;
            }
            // Oluşturma moduna geçmeden önce selectedEvent'i sıfırla
            selectedEvent = null;
            eventForm.dataset.date = dateStr;
            eventForm.dataset.event = JSON.stringify({ id: null, title: "Yeni Eğitim" });
            eventFirmaId.value = selectedFirmaId || "";
            loadOSGBFirms(); // Firma listesini yükle
            openEgitimModal(dateStr, selectedFirmaId, null);
        }

        function newPersonalEtkinlik(dateStr, etkinlikTuru) {
            console.log("newPersonalEtkinlik called with dateStr:", dateStr, "etkinlikTuru:", etkinlikTuru);
            selectedEvent = null;
            personalEventForm.dataset.date = dateStr;
            personalEventForm.dataset.event = JSON.stringify({ id: null, title: "Yeni " + etkinlikTuru });

            // Formu sıfırla
            personalEventForm.reset();
            personalEventTitle.value = "";
            personalEventStart.value = dateStr ? dateStr.split('T')[0] : "";
            personalEventEnd.value = "";
            personalEventDescription.value = "";
            personalEventTuru.value = etkinlikTuru;
            personalEventFirma.value = selectedFirmaId || "";
            personalEventForm.classList.remove("was-validated");

            // Modal başlığını güncelle
            const turLabel = {
                'Etkinlik': 'Etkinlik',
                'Toplanti': 'Toplantı',
                'Ziyaret': 'Ziyaret',
                'Diger': 'Diğer'
            };
            personalModalTitle.innerHTML = `Yeni ${turLabel[etkinlikTuru]} Oluştur`;

            // Firma ve personel seçimi alanını göster/gizle
            const firmaSection = document.getElementById('firma-selection');
            const personelSection = document.getElementById('personel-selection');
            if (['Toplanti', 'Ziyaret', 'Diger'].includes(etkinlikTuru)) {
                firmaSection.style.display = 'block';
                personelSection.style.display = 'block';
                loadOSGBFirms();
                console.log("Current user firmaId ile personeller yükleniyor (newPersonalEtkinlik):", currentUserFirmaId);
                loadPersoneller(); // Current user firmaId ile personelleri yükle
            } else {
                firmaSection.style.display = 'none';
                personelSection.style.display = 'none';
            }

            personalEventModal.show();

            // Oluşturma modunda butonları gizle
            document.getElementById("edit-personal-event-btn").setAttribute("hidden", true);
            document.getElementById("btn-delete-personal-event").setAttribute("hidden", true);
            document.getElementById("btn-save-personal-event").removeAttribute("hidden");
            document.getElementById("btn-save-personal-event").innerHTML = "Kaydet";
            document.getElementById("btn-save-personal-event").disabled = false;

            personalEventTyped();
        }

        function openEgitimModal(dateStr, firmaId, event) {
            console.log("openEgitimModal called with firmaId:", firmaId, "dateStr:", dateStr, "event:", event);
            // Oluşturma modunda olduğumuzu netleştir
            if (!selectedEvent) {
                // Yeni etkinlik oluşturma modunda, "Güncelle" tuşunu gizle
                document.getElementById("edit-event-btn").setAttribute("hidden", true);
                document.getElementById("btn-delete-event").setAttribute("hidden", true);
                document.getElementById("btn-save-event").removeAttribute("hidden");
                document.getElementById("btn-save-event").innerHTML = "Kaydet"; // "Güncelle" yerine "Kaydet" olarak ayarla
                document.getElementById("btn-save-event").disabled = false; // Tuşu aktif tut
                document.getElementById("btn-confirm-event").setAttribute("hidden", true);
            }

            // Formu tamamen sıfırla
            eventForm.reset();
            eventTitle.value = "";
            document.getElementById('event-tarihi').value = dateStr ? dateStr.split('T')[0] : "";
            eventEgitimTuru.value = "";
            eventTehlikeSinifi.value = "";
            eventSure.value = "";
            eventFirmaId.value = "";
            eventCategory.value = "";
            eventModal.show();
            modalTitle.innerHTML = "Yeni Eğitim Oluştur";
            eventForm.classList.remove("was-validated");
            eventForm.dataset.date = dateStr;
            eventForm.dataset.event = JSON.stringify({ id: null, title: event?.title || "Yeni Eğitim" });
            const existingDetails = eventForm.querySelector('.event-details');
            if (existingDetails) existingDetails.remove();
            eventFirmaId.value = firmaId || "";
            selectedFirmaId = firmaId;
            console.log("event-firma-id set to:", eventFirmaId.value);

            if (!selectedEvent) {
                // Oluşturma modunda, ek düzenlemeler
                document.getElementById("edit-event-btn").setAttribute("hidden", true);
                document.getElementById("btn-delete-event").setAttribute("hidden", true);
                document.getElementById("btn-save-event").removeAttribute("hidden");
                document.getElementById("btn-save-event").innerHTML = "Kaydet";
                document.getElementById("btn-confirm-event").setAttribute("hidden", true);
            }

            eventModal._element.addEventListener('shown.bs.modal', function () {
                eventModal._element.removeAttribute('aria-hidden');
                console.log("Modal açıldı, aria-hidden kaldırıldı.");
            }, { once: true });
            eventModal._element.addEventListener('hidden.bs.modal', function () {
                eventModal._element.removeAttribute('aria-hidden');
                console.log("Modal kapandı, aria-hidden kaldırıldı.");
                // Modal kapandığında geçici etkinlikleri kaldır
                calendar.getEvents().forEach(event => {
                    if (event.extendedProps.isTemp) {
                        event.remove();
                    }
                });
            }, { once: true });
            eventTyped(); // Formu düzenleme moduna geçir
        }

        function eventClicked() {
            console.log("eventClicked called.");
            eventForm.classList.add("view-event");
            eventTitle.classList.replace("d-block", "d-none");
            eventCategory.classList.replace("d-block", "d-none");
            eventEgitimTuru.classList.replace("d-block", "d-none");
            eventTehlikeSinifi.classList.replace("d-block", "d-none");
            eventSure.classList.replace("d-block", "d-none");
            document.getElementById("event-tarihi").classList.replace("d-block", "d-none");
            document.getElementById("event-firma-id").classList.replace("d-block", "d-none");
            document.getElementById("btn-save-event").setAttribute("hidden", true);

            eventTitle.setAttribute("readonly", true);
            eventCategory.setAttribute("disabled", true);
            eventEgitimTuru.setAttribute("disabled", true);
            eventTehlikeSinifi.setAttribute("disabled", true);
            eventSure.setAttribute("readonly", true);
            document.getElementById("event-tarihi").setAttribute("readonly", true);
            document.getElementById("event-firma-id").setAttribute("disabled", true);

            const existingDetails = eventForm.querySelector('.event-details');
            if (existingDetails) existingDetails.remove();

            // Bilgileri daha okunabilir hale getirmek için extendedProps’tan alıyoruz
            const firmaName = selectedEvent.extendedProps.firmaAdi || 'Bilinmeyen Firma';
            const egitimName = selectedEvent.extendedProps.egitimAdi || 'Belirtilmedi';
            const egitimTuru = selectedEvent.extendedProps.egitimTuruAdi || 'Bilinmeyen Tür';
            const startDate = new Date(selectedEvent.start).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
            const sure = selectedEvent.extendedProps.sure || 0;
            const tehlikeSinifi = selectedEvent.extendedProps.tehlikeSinifi || 'Bilinmeyen';

 Trevize

            const details = `
                <div class="event-details">
                    <p><strong>Eğitim Adı:</strong> ${egitimName}</p>
                    <p><strong>Firma:</strong> ${firmaName}</p>
                    <p><strong>Başlangıç Tarihi:</strong> ${startDate}</p>
                    <p><strong>Süre:</strong> ${sure} saat</p>
                    <p><strong>Tehlike Sınıfı:</strong> ${tehlikeSinifi}</p>
                    <p><strong>Eğitim Türü:</strong> ${egitimTuru}</p>
                </div>`;
            eventForm.insertAdjacentHTML('afterbegin', details);
        }

        function eventTyped() {
            console.log("eventTyped called.");
            eventForm.classList.remove("view-event");
            eventTitle.classList.replace("d-none", "d-block");
            eventCategory.classList.replace("d-none", "d-block");
            eventEgitimTuru.classList.replace("d-none", "d-block");
            eventTehlikeSinifi.classList.replace("d-none", "d-block");
            eventSure.classList.replace("d-none", "d-block");
            document.getElementById("event-tarihi").classList.replace("d-none", "d-block");
            document.getElementById("event-firma-id").classList.replace("d-none", "d-block");
            document.getElementById("btn-save-event").removeAttribute("hidden");

            eventTitle.removeAttribute("readonly");
            eventCategory.removeAttribute("disabled");
            eventEgitimTuru.removeAttribute("disabled");
            eventTehlikeSinifi.removeAttribute("disabled");
            eventSure.removeAttribute("readonly");
            document.getElementById("event-tarihi").removeAttribute("readonly");
            document.getElementById("event-firma-id").removeAttribute("disabled");

            const existingDetails = eventForm.querySelector('.event-details');
            if (existingDetails) existingDetails.remove();
        }

        function editEvent(btn) {
            console.log("editEvent called.");
            const id = btn.getAttribute("data-id");
            if (id === "edit-event") {
                btn.innerHTML = "İptal";
                document.getElementById("btn-save-event").innerHTML = "Güncelle";
                btn.removeAttribute("hidden");
                eventTyped();
            } else {
                btn.innerHTML = "Düzenle";
                eventClicked();
            }
        }

        function personalEventClicked() {
            console.log("personalEventClicked called.");
            personalEventForm.classList.add("view-event");
            personalEventTitle.classList.replace("d-block", "d-none");
            personalEventStart.classList.replace("d-block", "d-none");
            personalEventEnd.classList.replace("d-block", "d-none");
            personalEventDescription.classList.replace("d-block", "d-none");
            personalEventFirma.classList.replace("d-block", "d-none");
            personalEventPersoneller.classList.replace("d-block", "d-none");
            document.getElementById("btn-save-personal-event").setAttribute("hidden", true);

            personalEventTitle.setAttribute("readonly", true);
            personalEventStart.setAttribute("readonly", true);
            personalEventEnd.setAttribute("readonly", true);
            personalEventDescription.setAttribute("readonly", true);
            personalEventFirma.setAttribute("disabled", true);
            personalEventPersoneller.setAttribute("disabled", true);

            const existingDetails = personalEventForm.querySelector('.event-details');
            if (existingDetails) existingDetails.remove();

            const startDate = new Date(selectedEvent.start).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
            const endDate = selectedEvent.end ? new Date(selectedEvent.end).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : 'Belirtilmedi';
            const description = selectedEvent.extendedProps.aciklama || 'Açıklama yok';
            const etkinlikTuru = selectedEvent.extendedProps.etkinlikTuru || 'Etkinlik';
            const firmaAdi = selectedEvent.extendedProps.firmaAdi || 'Yok';
            const atanmisKullanicilar = selectedEvent.extendedProps.atanmisKullanicilar?.map(k => k.AdSoyad).join(', ') || 'Yok';

            const details = `
                <div class="event-details">
                    <p><strong>Etkinlik Adı:</strong> ${selectedEvent.title}</p>
                    <p><strong>Etkinlik Türü:</strong> ${etkinlikTuru}</p>
                    <p><strong>Firma:</strong> ${firmaAdi}</p>
                    <p><strong>Atanmış Personeller:</strong> ${atanmisKullanicilar}</p>
                    <p><strong>Başlangıç Tarihi:</strong> ${startDate}</p>
                    <p><strong>Bitiş Tarihi:</strong> ${endDate}</p>
                    <p><strong>Açıklama:</strong> ${description}</p>
                </div>`;
            personalEventForm.insertAdjacentHTML('afterbegin', details);
        }

        function personalEventTyped() {
            console.log("personalEventTyped called.");
            personalEventForm.classList.remove("view-event");
            personalEventTitle.classList.replace("d-none", "d-block");
            personalEventStart.classList.replace("d-none", "d-block");
            personalEventEnd.classList.replace("d-none", "d-block");
            personalEventDescription.classList.replace("d-none", "d-block");
            personalEventFirma.classList.replace("d-none", "d-block");
            personalEventPersoneller.classList.replace("d-none", "d-block");
            document.getElementById("btn-save-personal-event").removeAttribute("hidden");

            personalEventTitle.removeAttribute("readonly");
            personalEventStart.removeAttribute("readonly");
            personalEventEnd.removeAttribute("readonly");
            personalEventDescription.removeAttribute("readonly");
            personalEventFirma.removeAttribute("disabled");
            personalEventPersoneller.removeAttribute("disabled");

            const existingDetails = personalEventForm.querySelector('.event-details');
            if (existingDetails) existingDetails.remove();
        }

        function editPersonalEvent(btn) {
            console.log("editPersonalEvent called.");
            const id = btn.getAttribute("data-id");
            if (id === "edit-personal-event") {
                btn.innerHTML = "İptal";
                document.getElementById("btn-save-personal-event").innerHTML = "Güncelle";
                btn.removeAttribute("hidden");
                personalEventTyped();
            } else {
                btn.innerHTML = "Düzenle";
                personalEventClicked();
            }
        }

        function getEventClass(tehlikeSinifi) {
            return {
                "AzTehlikeli": "bg-success",
                "Tehlikeli": "bg-warning",
                "CokTehlikeli": "bg-danger"
            }[tehlikeSinifi] || "bg-primary";
        }

        function formatEgitimBilgisi(firmaAdi, egitimAdi, egitimTuru, tehlikeSinifi, startTime) {
            const tehlikeIkon = getTehlikeIkon(tehlikeSinifi);
            return `
                ${tehlikeIkon} 🕒 ${startTime}<br>
                🏢 ${firmaAdi}<br>
                📚 ${egitimAdi} (${egitimTuru})<br>
                ⚠️ ${tehlikeSinifi}
            `;
        }

        function getTehlikeIkon(tehlikeSinifi) {
            return {
                "AzTehlikeli": "✅",
                "Tehlikeli": "⚠️",
                "CokTehlikeli": "❌"
            }[tehlikeSinifi] || "ℹ️";
        }

        function saveEgitimToServer(egitimData, action = "Create") {
            if (isSubmitting) {
                console.log("Zaten bir işlem yürütülüyor, çift kayıt önlendi.");
                return Promise.reject(new Error("Çift kayıt önlendi."));
            }
            isSubmitting = true;

            const saveBtn = document.getElementById("btn-save-event");
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...';
            saveBtn.disabled = true;

            // Tarih formatını kontrol et ve ISO 8601 formatına çevir
            let egitimTarihi = egitimData.EgitimTarihi;
            if (egitimTarihi && egitimTarihi.length <= 10) {
                // Eğer sadece tarih formatında (YYYY-MM-DD) ise, saat bilgisi ekle
                egitimTarihi = new Date(egitimTarihi + "T00:00:00.000Z").toISOString();
            } else if (!egitimTarihi) {
                // Eğer tarih yoksa, hata fırlat
                throw new Error("Eğitim tarihi belirtilmedi.");
            }

            egitimData = {
                ...egitimData,
                Ad: egitimData.Ad || "Belirtilmedi",
                EgitimTarihi: egitimTarihi,
                Sure: egitimData.Sure || 1,
                TehlikeSinifi: egitimData.TehlikeSinifi || "AzTehlikeli",
                EgitimTuruId: egitimData.EgitimTuruId || null,
                RefFirmaId: selectedFirmaId || egitimData.RefFirmaId || null,
                AllDay: true
            };

            if (action === "Create") {
                egitimData.EgitimId = null;
            }

            const validTehlikeSinifiValues = ["AzTehlikeli", "Tehlikeli", "CokTehlikeli"];
            if (!validTehlikeSinifiValues.includes(egitimData.TehlikeSinifi)) {
                egitimData.TehlikeSinifi = "AzTehlikeli";
            }

            if (!egitimData.RefFirmaId || egitimData.RefFirmaId <= 0) {
                console.error("RefFirmaId eksik veya geçersiz:", egitimData.RefFirmaId);
                Swal.fire('Hata!', 'Firma ID\'si belirtilmedi veya geçersiz. Lütfen bir firma seçin.', 'error');
                isSubmitting = false;
                saveBtn.innerHTML = action === "Create" ? "Kaydet" : "Güncelle";
                saveBtn.disabled = false;
                return Promise.reject(new Error("Firma ID'si belirtilmedi."));
            }

            console.log("Sending request to:", "/api/Calendar/SaveEgitim", "with data:", JSON.stringify(egitimData, null, 2));
            const url = "/api/Calendar/SaveEgitim";
            return fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "RequestVerificationToken": document.querySelector('input[name="__RequestVerificationToken"]').value
                },
                body: JSON.stringify(egitimData)
            })
                .then(response => {
                    console.log("Response status:", response.status, "OK:", response.ok);
                    if (!response.ok) {
                        return response.text().then(text => {
                            console.error("Response text:", text);
                            throw new Error(`Failed to ${action.toLowerCase()} education: ${response.statusText} - ${text}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    console.log("Response data:", data);
                    if (data.success && data.egitimId) {
                        let tempEvent = eventForm.dataset.event ? JSON.parse(eventForm.dataset.event) : null;
                        if (tempEvent) {
                            let oldEvent = calendar.getEventById(tempEvent.id);
                            if (oldEvent) {
                                oldEvent.setProp('id', data.egitimId);
                                console.log(`Etkinlik ID güncellendi: Eski ID=${tempEvent.id}, Yeni ID=${data.egitimId}`);
                            }
                        }
                        calendar.refetchEvents();
                        Swal.fire('Başarılı!', action === "Create" ? 'Etkinlik oluşturuldu.' : 'Etkinlik güncellendi.', 'success');
                    } else {
                        throw new Error(data.message || `${action} failed`);
                    }
                    return data;
                })
                .catch(err => {
                    console.error("Submit error:", err);
                    isSubmitting = false;
                    Swal.fire('Hata!', 'Etkinlik kaydedilemedi: ' + err.message, 'error');
                    document.getElementById("btn-save-event").disabled = false;
                    document.getElementById("btn-save-event").innerHTML = "Kaydet";
                })
                .finally(() => {
                    isSubmitting = false;
                    document.getElementById("btn-save-event").disabled = false;
                    document.getElementById("btn-save-event").innerHTML = "Kaydet";
                });
        }

        function saveEtkinlikToServer(etkinlikData, action = "Create") {
            if (isSubmitting) {
                console.log("Zaten bir işlem yürütülüyor, çift kayıt önlendi.");
                return Promise.reject(new Error("Çift kayıt önlendi."));
            }
            isSubmitting = true;

            const saveBtn = document.getElementById("btn-save-personal-event");
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...';
            saveBtn.disabled = true;

            etkinlikData = {
                ...etkinlikData,
                Ad: etkinlikData.Ad || "Belirtilmedi",
                BaslangicTarihi: etkinlikData.BaslangicTarihi || new Date().toISOString(),
                BitisTarihi: etkinlikData.BitisTarihi || null,
                Aciklama: etkinlikData.Aciklama || "",
                AllDay: true
            };

            if (action === "Create") {
                etkinlikData.EtkinlikId = null;
            }

            console.log("Sending request to:", "/api/Calendar/SaveEtkinlik", "with data:", JSON.stringify(etkinlikData, null, 2));
            const url = "/api/Calendar/SaveEtkinlik";
            return fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "RequestVerificationToken": document.querySelector('input[name="__RequestVerificationToken"]').value
                },
                body: JSON.stringify(etkinlikData)
            })
                .then(response => {
                    console.log("Response status:", response.status, "OK:", response.ok);
                    if (!response.ok) {
                        return response.text().then(text => {
                            console.error("Response text:", text);
                            throw new Error(`Failed to ${action.toLowerCase()} personal event: ${response.statusText} - ${text}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    console.log("Response data:", data);
                    if (data.success && data.etkinlikId) {
                        let tempEvent = personalEventForm.dataset.event ? JSON.parse(personalEventForm.dataset.event) : null;
                        if (tempEvent) {
                            let oldEvent = calendar.getEventById(tempEvent.id);
                            if (oldEvent) {
                                oldEvent.setProp('id', "etkinlik-" + data.etkinlikId);
                                console.log(`Etkinlik ID güncellendi: Eski ID=${tempEvent.id}, Yeni ID=${data.etkinlikId}`);
                            }
                        }
                        calendar.refetchEvents();
                        Swal.fire('Başarılı!', action === "Create" ? 'Etkinlik oluşturuldu.' : 'Etkinlik güncellendi.', 'success');
                    } else {
                        throw new Error(data.message || `${action} failed`);
                    }
                    return data;
                })
                .catch(err => {
                    console.error("Submit error:", err);
                    isSubmitting = false;
                    Swal.fire('Hata!', 'Etkinlik kaydedilemedi: ' + err.message, 'error');
                    document.getElementById("btn-save-personal-event").disabled = false;
                    document.getElementById("btn-save-personal-event").innerHTML = "Kaydet";
                })
                .finally(() => {
                    isSubmitting = false;
                    document.getElementById("btn-save-personal-event").disabled = false;
                    document.getElementById("btn-save-personal-event").innerHTML = "Kaydet";
                });
        }
    });
});