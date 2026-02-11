import { showError } from './ui-utils.js';

export function initializeCalendar(calendarEl, userRoles, currentUserFirmaId, modals, handleEventFunctions) {
    const calendar = new FullCalendar.Calendar(calendarEl, {
        timeZone: "UTC",
        locale: "tr",
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
            calendar.changeView(getInitialView());
        },
        businessHours: {
            daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
            startTime: '00:00',
            endTime: '23:59'
        },
        slotMinTime: '00:00:00',
        slotMaxTime: '24:00:00',
        scrollTime: '06:00:00',
        allDaySlot: true, // allDay slotunu kaldır
        displayEventTime: false, // Zaman gösterimini kapat
        eventAllow: function (dropLocation, draggedEvent) {
            return true;
        },
        eventDragStart: handleEventFunctions.handleEventDragStart,
        eventReceive: handleEventFunctions.handleEventReceive,
        eventDrop: handleEventFunctions.handleEventDrop,
        eventClick: function (info) {
            console.log("Modal açılıyor. Event ID:", info.event.id);
            console.log("Event extendedProps:", info.event.extendedProps);
            console.log("Atanmış Kullanıcılar:", info.event.extendedProps.atanmisKullanicilar);

            handleEventFunctions.handleEventClick(info);
        },
        dateClick: handleEventFunctions.handleDateClick,
        events: function (fetchInfo, successCallback, failureCallback) {
            fetch('/api/Calendar/GetEgitimlerForCalendar')
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok ' + response.statusText);
                    return response.json();
                })
                .then(data => {
                    const events = data.map(event => {
                        let description = event.description || '';
                        if (event.type === 'egitim') {
                            const firmaName = event.firmaAdi || 'Bilinmeyen Firma';
                            const egitimName = event.title || 'Belirtilmedi';
                            const egitimTuru = event.egitimTuruAdi || 'Bilinmeyen Tür';
                            const tehlikeSinifi = event.tehlikeSinifi || 'Bilinmeyen';
                            const startTime = new Date(event.start).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                            description = formatEgitimBilgisi(firmaName, egitimName, egitimTuru, tehlikeSinifi, startTime);
                        } else if (event.type === 'sinav') {
                            const sinavAdi = event.title || 'Sınav Adı Belirtilmemiş';
                            const grupAdi = event.grupAdi || 'Grup Belirtilmedi';
                            const firmaAdi = event.firmaAdi || 'Firma Belirtilmedi';
                            const kullanicilar = Array.isArray(event.atanmisKullanicilar) && event.atanmisKullanicilar.length > 0
                                ? event.atanmisKullanicilar.map(k => k.AdSoyad).join(', ')
                                : 'Kullanıcı Belirtilmedi';
                            description = `
                                📝 ${sinavAdi}<br>
                                🏢 ${firmaAdi}<br>
                                👥 ${grupAdi}<br>
                                👤 Kullanıcılar: ${kullanicilar}
                            `;
                        }

                        // allDay etkinlikler için end tarihi düzeltmesi
                        let endDate = event.end ? new Date(event.end) : null;
                        if (event.allDay && event.start && event.end && event.start === event.end) {
                            endDate = new Date(event.start);
                            endDate.setDate(endDate.getDate() + 1); // FullCalendar için bir gün ekle
                            console.log("[CALENDAR UTILS] allDay etkinlik için end tarihi düzeltildi:", event.id, "Yeni end:", endDate.toISOString());
                        }

                        return {
                            id: event.id,
                            title: event.title,
                            start: event.start,
                            end: endDate ? endDate.toISOString() : null,
                            className: event.className,
                            allDay: event.allDay !== undefined ? event.allDay : true, // allDay varsayılan true
                            extendedProps: {
                                description: description,
                                sure: event.sure || 0,
                                tehlikeSinifi: event.tehlikeSinifi,
                                egitimTuruId: event.egitimTuruId || null,
                                egitimTuruAdi: event.egitimTuruAdi || 'Bilinmeyen Tür',
                                firmaId: event.firmaId || null,
                                firmaAdi: event.firmaAdi || 'Bilinmeyen Firma',
                                grupAdi: event.grupAdi || 'Grup Bilgisi Yok',
                                egitimAdi: event.type === 'egitim' ? (event.title.split(' - ')[1]?.split(' (')[0] || event.title) : event.title,
                                type: event.type,
                                etkinlikTuru: event.etkinlikTuru,
                                isClosed: event.isClosed,
                                refEtkinlikId: event.refEtkinlikId || null,
                                atanmisKullanicilar: Array.isArray(event.atanmisKullanicilar) ? event.atanmisKullanicilar : []
                            }
                        };
                    });
                    successCallback(events);
                    handleEventFunctions.populateUpcomingEvents(events);
                })
                .catch(err => {
                    failureCallback(err);
                    showError('Takvim verileri yüklenemedi: ' + err.message);
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
        }
    });

    calendar.render();
    return calendar;
}

function getInitialView() {
    if (window.innerWidth >= 768 && window.innerWidth < 1200) return "timeGridWeek";
    if (window.innerWidth <= 768) return "listMonth";
    return "dayGridMonth";
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

export function isDateInPast(dateStr) {
    const selectedDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate < today;
}

export function getEventClass(tehlikeSinifi) {
    return {
        "AzTehlikeli": "bg-success",
        "Tehlikeli": "bg-warning",
        "CokTehlikeli": "bg-danger"
    }[tehlikeSinifi] || "bg-primary";
}