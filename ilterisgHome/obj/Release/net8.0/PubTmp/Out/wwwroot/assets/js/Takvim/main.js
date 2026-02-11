// main.js

document.addEventListener("DOMContentLoaded", async function () {
    console.log("[MAIN] Custom calendar initialization starting...");

    const calendarEl = document.getElementById("calendar");
    if (!calendarEl) {
        console.error("[MAIN] Calendar element not found!");
        return;
    }

    const { initializeModals, setupModalListeners } = await import('./ui-utils.js');
    const { initializeCalendar } = await import('./calendar-utils.js');
    const {
        handleNewEvent,
        handleEventTypeSelection,
        handleEventDragStart,
        handleEventReceive,
        handleEventDrop,
        handleEventClick,
        handleDateClick,
        handleExportReport,
        setupEventListeners,
        populateUpcomingEvents,
        loadOSGBFirms,
        loadEgitimTurleri,
        handleNewSinav
    } = await import('./event-handlers.js');

    const modals = initializeModals();
    let userRoles = [];
    let currentUserFirmaId = null;
    let isPersonel = false;
    let userId = null; // Yeni global userId değişkeni
    let selectedFirmaId = null;
    let tempDate = null;
    let isDragAction = false;

    async function getUserRolesAndFirmaId() {
        try {
            const response = await fetch('/api/Calendar/GetUserRoles', {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (data.success) {
                userRoles = data.roles || [];
                currentUserFirmaId = data.firmaId || 1;
                isPersonel = data.isPersonel || false;
                userId = data.kullaniciId || 0; // Kullanicilar.KullaniciId
                console.log("[MAIN] User roles fetched:", userRoles,
                    "Current user firmaId:", currentUserFirmaId,
                    "Is Personel:", isPersonel,
                    "UserId (Kullanicilar.KullaniciId):", userId);

                // Export modal vs. gibi yerlerden erişebilmek için global'e yaz
                window.currentUserId = userId;
                window.currentUserIsPersonel = isPersonel;
                window.currentUserFirmaId = currentUserFirmaId; // 🔹 BUNU EKLE



                if (!userRoles.includes('OSGB')) {
                    const egitimBtn = document.getElementById('select-egitim');
                    const toplantiBtn = document.getElementById('select-toplanti');
                    const ziyaretBtn = document.getElementById('select-ziyaret');
                    const digerBtn = document.getElementById('select-diger');

                    if (egitimBtn) egitimBtn.style.display = 'none';
                    if (toplantiBtn) toplantiBtn.style.display = 'none';
                    if (ziyaretBtn) ziyaretBtn.style.display = 'none';
                    if (digerBtn) digerBtn.style.display = 'none';
                } else {
                    const egitimBtn = document.getElementById('select-egitim');
                    const toplantiBtn = document.getElementById('select-toplanti');
                    const ziyaretBtn = document.getElementById('select-ziyaret');
                    const digerBtn = document.getElementById('select-diger');

                    if (egitimBtn) egitimBtn.style.display = 'inline-block';
                    if (toplantiBtn) toplantiBtn.style.display = 'inline-block';
                    if (ziyaretBtn) ziyaretBtn.style.display = 'inline-block';
                    if (digerBtn) digerBtn.style.display = 'inline-block';
                }
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            console.error("[MAIN] Failed to fetch user roles and firmaId:", err);
            throw err;
        }
    }

    try {
        await getUserRolesAndFirmaId();

        const handleEventFunctions = {
            handleEventDragStart: (info) => handleEventDragStart(info, userRoles),
            handleEventReceive: (info) => handleEventReceive(info, userRoles, modals, calendar),
            handleEventDrop: (info) => handleEventDrop(info, userRoles, calendar),
            handleEventClick: (info) => handleEventClick(info, userRoles, modals, isPersonel, calendar, userId), // userId parametresi eklendi
            handleDateClick: (info) => handleDateClick(info, modals),
            populateUpcomingEvents
        };

        const calendar = initializeCalendar(calendarEl, userRoles, currentUserFirmaId, modals, handleEventFunctions);
        calendar.render();
        console.log("[MAIN] Calendar rendered successfully.");

        const connection = new signalR.HubConnectionBuilder()
            .withUrl("/calendarHub")
            .withAutomaticReconnect()
            .build();

        connection.on("ReceiveEvent", (title, start, className) => {
            console.log("[MAIN] Received event via SignalR:", title);
            calendar.refetchEvents();
        });

        connection.on("DeleteEvent", (eventId) => {
            console.log("[MAIN] Received delete event via SignalR:", eventId);
            const event = calendar.getEventById(eventId);
            if (event) {
                event.remove();
            } else {
                console.warn("[MAIN] Silinecek etkinlik bulunamadı: ID:", eventId);
            }
        });

        connection.on("UpdateCalendar", (event) => {
            console.log("[MAIN] Takvim güncellemesi alındı:", event);
            const startDate = event.start ? new Date(event.start) : new Date();
            const endDate = event.end ? new Date(event.end) : null;

            const existingEvent = calendar.getEventById(event.id);
            if (existingEvent) {
                existingEvent.setProp("title", event.title || "Bilinmeyen Etkinlik");
                existingEvent.setStart(startDate);
                existingEvent.setEnd(endDate);
                existingEvent.setProp("classNames", event.className || "bg-success");
                existingEvent.setExtendedProp("description", event.description || "");
                existingEvent.setExtendedProp("firmaId", event.firmaId || null);
                existingEvent.setExtendedProp("firmaAdi", event.firmaAdi || "Belirtilmedi");
                existingEvent.setExtendedProp("type", event.type);
                existingEvent.setExtendedProp("etkinlikTuru", event.etkinlikTuru || "Etkinlik");
                existingEvent.setExtendedProp("isClosed", event.isClosed);
                existingEvent.setExtendedProp("atanmisKullanicilar", event.atanmisKullanicilar || []);
            } else {
                calendar.addEvent({
                    id: event.id,
                    title: event.title || "Bilinmeyen Etkinlik",
                    start: startDate,
                    end: endDate,
                    className: event.className || "bg-success",
                    allDay: event.allDay !== undefined ? event.allDay : true,
                    extendedProps: {
                        description: event.description || "",
                        sure: event.sure || 0,
                        tehlikeSinifi: event.tehlikeSinifi || null,
                        egitimTuruId: event.egitimTuruId || null,
                        egitimTuruAdi: event.egitimTuruAdi || "Bilinmeyen Tür",
                        firmaId: event.firmaId || null,
                        firmaAdi: event.firmaAdi || "Belirtilmedi",
                        egitimAdi: event.type === "egitim" ? (event.title.split(" - ")[1]?.split(" (")[0] || event.title) : event.title,
                        type: event.type,
                        etkinlikTuru: event.etkinlikTuru || "Etkinlik",
                        isClosed: event.isClosed,
                        atanmisKullanicilar: event.atanmisKullanicilar || []
                    }
                });
            }
            handleEventFunctions.populateUpcomingEvents(calendar.getEvents());
        });

        await connection.start();
        console.log("[MAIN] SignalR connected successfully!");

        setupModalListeners(modals, calendar);
        setupEventListeners(modals, userRoles, calendar, currentUserFirmaId);

        const btnNewEvent = document.getElementById("btn-new-event");
        if (btnNewEvent) {
            btnNewEvent.addEventListener("click", () => {
                console.log("[MAIN] New event button clicked.");
                selectedFirmaId = null;
                window.selectedFirmaId = null;
                tempDate = new Date().toISOString().split("T")[0];
                isDragAction = false;
                try {
                    modals.eventTypeSelectionModal.show();
                    console.log("[MAIN] eventTypeSelectionModal opened successfully via btn-new-event.");
                } catch (err) {
                    console.error("[MAIN] Failed to open eventTypeSelectionModal via btn-new-event:", err);
                }
            });
        } else {
            console.error("[MAIN] btn-new-event element not found!");
        }

        if (userRoles.includes('OSGB')) {
            const btnNewSinav = document.getElementById("btn-new-sinav");
            if (btnNewSinav) {
                btnNewSinav.addEventListener("click", (event) => {
                    console.log("[MAIN] btn-new-sinav clicked!", event);
                    try {
                        const handler = handleNewSinav();
                        handler(event); // handleNewSinav fonksiyonunu çağır
                    } catch (err) {
                        console.error("[MAIN] handleNewSinav error:", err);
                    }
                });
                console.log("[MAIN] btn-new-sinav event listener attached.");
            } else {
                console.warn("[MAIN] btn-new-sinav element not found! This is expected if the user is not in OSGB role.");
            }
        } else {
            console.log("[MAIN] User is not in OSGB role, btn-new-sinav will not be rendered.");
        }

        handleEventTypeSelection(modals, userRoles, currentUserFirmaId, calendar);
        handleExportReport(modals, currentUserFirmaId);

        if (userRoles.includes("OSGB")) {
            await loadOSGBFirms(modals, userRoles);
            await loadEgitimTurleri(userRoles, modals);
        }

        window.initMap = function () {
            console.log("[MAIN] Google Maps API yüklendi.");
        };
    } catch (err) {
        console.error("[MAIN] Initialization failed:", err);
    }
});