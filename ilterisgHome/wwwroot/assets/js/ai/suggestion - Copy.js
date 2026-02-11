var mevzuatList = []; // Yerel mevzuatList değişkeni
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/ilterisg.ai")
    .build();

// Çakışmayı önlemek için SignalR bağlantısını koşullu başlat
if (!window.signalRConnectionStarted) {
    connection.start()
        .then(() => {
            console.log('[FRONTEND] SignalR bağlantısı kuruldu (suggestion.js)');
            window.signalRConnectionStarted = true;
        })
        .catch(err => console.error('[FRONTEND] SignalR bağlantı hatası:', err));
}

// --- Yardımcılar ---
function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, s => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[s]));
}

function mdToHtml(text) {
    let safe = escapeHtml(text || "");
    safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        (m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
    );
    safe = safe.replace(/\[([^\]]+)\]\(((?:\/[^\s)]*|\.{1,2}\/[^\s)]+|#[^\s)]+))\)/g,
        (m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
    );
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/(^|[^\*])\*(?!\s)([^*]+?)\*(?!\*)/g, "$1<em>$2</em>");
    const lines = safe.split(/\r?\n/);
    let html = "";
    let inList = false;
    for (const raw of lines) {
        const line = raw.trimEnd();
        if (line.trim() === "") {
            if (inList) { html += "</ul>"; inList = false; }
            continue;
        }
        const m = line.match(/^\s*[-•]\s+(.*)$/);
        if (m) {
            if (!inList) { html += '<ul class="ai-list">'; inList = true; }
            html += `<li>${m[1]}</li>`;
            continue;
        }
        if (inList) { html += "</ul>"; inList = false; }
        html += `<p class="ai-p">${line}</p>`;
    }
    if (inList) html += "</ul>";
    return html;
}

// Mevzuat listesini yükle
function loadMevzuatList() {
    $.ajax({
        url: '/RiskAnaliz/GetMevzuatList',
        type: 'GET',
        async: false,
        success: function (data) {
            mevzuatList = data;
            console.log('[FRONTEND] Mevzuat listesi yüklendi (suggestion.js):', JSON.stringify(mevzuatList, null, 2));
            $('.mevzuat-select').each(function () {
                var $select = $(this);
                $select.empty().append('<option value="0" disabled selected>Seçiniz</option>');
                $.each(mevzuatList, function (i, m) {
                    $select.append(`<option value="${m.id}">${m.mevzuatAdi}</option>`);
                });
            });
        },
        error: function (xhr, status, error) {
            console.error('[FRONTEND] Mevzuat listesi yüklenemedi (suggestion.js). Status:', status, 'Error:', error);
            Swal.fire({
                icon: 'error',
                title: window.translations.ErrorTitle,
                text: window.translations.LegislationListLoadError
            });
            mevzuatList = [];
        }
    });
}

// Manuel risk skorunu güncelle

function updateManualRiskSkor($row) {
    var analizMetodu = window.analizMetodu || $('#riskForm input[name=AnalizMetodu]:checked').val() || '5x5';
    var olasilik = parseInt($row.find('.manual-olasilik').val()) || ($row.data('olasilik-' + (analizMetodu === 'Fine-Kinney' ? 'fine-kinney' : '5x5')) || 3);
    var siddet = analizMetodu === '5x5' ? (parseInt($row.find('.manual-siddet').val()) || $row.data('siddet-5x5') || 3) : null;
    var maruziyet = analizMetodu === 'Fine-Kinney' ? (parseInt($row.find('.manual-maruziyet').val()) || $row.data('frekans-fine-kinney') || 3) : null;
    var finneySiddet = analizMetodu === 'Fine-Kinney' ? (parseInt($row.find('.manual-finney-siddet').val()) || $row.data('siddet-fine-kinney') || 3) : null;
    var skor = analizMetodu === 'Fine-Kinney' ? olasilik * maruziyet * finneySiddet : olasilik * siddet;
    var badgeClass = analizMetodu === 'Fine-Kinney' ?
        (skor >= 400 ? 'danger' : skor >= 100 ? 'warning' : 'success') :
        (skor >= 15 ? 'danger' : skor >= 8 ? 'warning' : 'success');
    $row.find('.manual-risk-skor').text(skor).removeClass('bg-danger bg-warning bg-success').addClass(`bg-${badgeClass}`);
    console.log('[FRONTEND] Manuel risk skoru güncellendi. Skor:', skor, 'BadgeClass:', badgeClass, 'AnalizMetodu:', analizMetodu, 'Olasilik:', olasilik, 'Siddet:', siddet, 'Maruziyet:', maruziyet, 'FinneySiddet:', finneySiddet);
}

// AI response tablosunu güncelle
function updateAIResponseTable(sahaIndex, manualRiskIndex) {
    var $aiResponseTable = $(`.ai-response-table[data-saha-index="${sahaIndex}"][data-manual-risk-index="${manualRiskIndex}"]`);
    var aiResponseData = $aiResponseTable.data('ai-response');
    if (!aiResponseData) return;
    var analizMetodu = window.analizMetodu || $('#riskForm input[name=AnalizMetodu]:checked').val() || '5x5';
    var olasilik = analizMetodu === '5x5' ? (aiResponseData.Olasilik5x5 || 3) : (aiResponseData.OlasilikFineKinney || 3);
    var siddet = analizMetodu === '5x5' ? (aiResponseData.Siddet5x5 || 3) : null;
    var maruziyet = analizMetodu === 'Fine-Kinney' ? (aiResponseData.FrekansFineKinney || 3) : null;
    var finneySiddet = analizMetodu === 'Fine-Kinney' ? (aiResponseData.SiddetFineKinney || 3) : null;
    var skor = analizMetodu === '5x5' ? olasilik * siddet : olasilik * maruziyet * finneySiddet;
    var badgeClass = analizMetodu === '5x5' ?
        (skor >= 15 ? 'danger' : skor >= 8 ? 'warning' : 'success') :
        (skor >= 400 ? 'danger' : skor >= 100 ? 'warning' : 'success');
    var escapedRiskTanimi = escapeHtml(aiResponseData.RiskTanimi || '');
    var escapedRiskFaktorleri = escapeHtml(aiResponseData.RiskFaktorleri || '');
    var escapedKontrolOnlemleri = escapeHtml(aiResponseData.KontrolOnlemleri || '');
    var escapedMevzuatAdi = aiResponseData.MevzuatAdi
        ? escapeHtml(aiResponseData.MevzuatAdi)
        : (aiResponseData.MevzuatId && mevzuatList.find(m => m.id === aiResponseData.MevzuatId)
            ? escapeHtml(mevzuatList.find(m => m.id === aiResponseData.MevzuatId).mevzuatAdi)
            : window.translations.SelectLegislation);
    var rowHtml = `
    <tr data-ai-response="true" data-saha-index="${sahaIndex}" data-manual-risk-index="${manualRiskIndex}"
        data-olasilik-5x5="${aiResponseData.Olasilik5x5 || 3}" data-siddet-5x5="${aiResponseData.Siddet5x5 || 3}"
        data-olasilik-fine-kinney="${aiResponseData.OlasilikFineKinney || 3}" data-frekans-fine-kinney="${aiResponseData.FrekansFineKinney || 3}"
        data-siddet-fine-kinney="${aiResponseData.SiddetFineKinney || 3}" data-mevzuat-id="${aiResponseData.MevzuatId || 0}">
        <td data-label="Risk Adı">${escapedRiskTanimi}</td>
        <td data-label="Açıklama">${escapedRiskFaktorleri}</td>
        <td data-label="Olasılık">${olasilik}</td>
        <td data-label="Şiddet" class="five-x-five-only" style="display: ${analizMetodu === '5x5' ? 'table-cell' : 'none'};">${siddet || '-'}</td>
        <td data-label="Maruziyet" class="fine-kinney-only" style="display: ${analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none'};">${maruziyet || '-'}</td>
        <td data-label="Finney Şiddet" class="fine-kinney-only" style="display: ${analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none'};">${finneySiddet || '-'}</td>
        <td data-label="Puan"><span class="badge bg-${badgeClass}">${skor}</span></td>
        <td data-label="Önerilen Önlem">${escapedKontrolOnlemleri}</td>
        <td data-label="Mevzuat">${escapedMevzuatAdi}</td>
        <td data-label="İşlem">
            <button type="button" class="btn btn-sm btn-primary edit-ai-response" data-saha-index="${sahaIndex}" data-manual-risk-index="${manualRiskIndex}">${window.translations.Edit || 'Düzenle'}</button>
            <button type="button" class="btn btn-sm btn-success approve-ai-response" data-saha-index="${sahaIndex}" data-manual-risk-index="${manualRiskIndex}">${window.translations.Add || 'Ekle'}</button>
        </td>
    </tr>`;
    $aiResponseTable.find('.ai-response-body').html(rowHtml);
    console.log('[FRONTEND] AI response tablosu güncellendi. SahaIndex:', sahaIndex, 'ManualRiskIndex:', manualRiskIndex, 'AnalizMetodu:', analizMetodu, 'MevzuatAdi:', escapedMevzuatAdi);
}

// --- SignalR event’leri ---
connection.on("ReceiveMessage", (user, message) => {
    var $aiResponseRow = $('.ai-bar-row.active');
    if ($aiResponseRow.length > 0) {
        var sahaIndex = parseInt($aiResponseRow.data('saha-index'));
        var manualRiskIndex = parseInt($aiResponseRow.data('manual-risk-index'));
        let currentRaw = $aiResponseRow.data('raw') || "";
        currentRaw += message;
        $aiResponseRow.data('raw', currentRaw);
        $aiResponseRow.find('.ai-text').val(currentRaw);
        console.log('[FRONTEND] ReceiveMessage alındı. SahaIndex:', sahaIndex, 'ManualRiskIndex:', manualRiskIndex, 'Message:', message);
    }
});

connection.on("ReceiveChunk", (chunk) => {
    var $aiResponseRow = $('.ai-bar-row.active');
    if ($aiResponseRow.length > 0) {
        var sahaIndex = parseInt($aiResponseRow.data('saha-index'));
        var manualRiskIndex = parseInt($aiResponseRow.data('manual-risk-index'));
        let currentRaw = $aiResponseRow.data('raw') || "";
        currentRaw += chunk;
        $aiResponseRow.data('raw', currentRaw);
        $aiResponseRow.find('.ai-text').val(currentRaw);
        console.log('[FRONTEND] ReceiveChunk alındı. SahaIndex:', sahaIndex, 'ManualRiskIndex:', manualRiskIndex, 'Chunk:', chunk);
    }
});

connection.on("ReceiveRiskSuggestion", (formattedResponse, jsonResponse) => {
    var $aiResponseTable = $('.ai-response-table.active');
    if ($aiResponseTable.length === 0) {
        console.warn('[FRONTEND] Aktif AI response tablosu bulunamadı.');
        $('#aiLoadingOverlay').removeClass('show');
        $('#aiLoadingCard').removeClass('show');
        return;
    }
    var sahaIndex = parseInt($aiResponseTable.closest('.ai-response-container').data('saha-index'));
    var manualRiskIndex = parseInt($aiResponseTable.closest('.ai-response-container').data('manual-risk-index'));
    console.log('[FRONTEND] ReceiveRiskSuggestion alındı. SahaIndex:', sahaIndex, 'ManualRiskIndex:', manualRiskIndex, 'FormattedResponse:', formattedResponse);
    // Mevzuat listesini yükle
    loadMevzuatList();
    if (!mevzuatList || !mevzuatList.length) {
        console.error('[FRONTEND] Mevzuat listesi yüklenemedi (ReceiveRiskSuggestion).');
        Swal.fire({
            icon: 'error',
            title: window.translations.ErrorTitle,
            text: window.translations.LegislationListLoadError
        });
        $('#aiLoadingOverlay').removeClass('show');
        $('#aiLoadingCard').removeClass('show');
        return;
    }
    // JSON yanıtını parse et
    var aiResponseData = JSON.parse(jsonResponse);
    var analizMetodu = window.analizMetodu || $('#riskForm input[name=AnalizMetodu]:checked').val() || '5x5';
    // Tablo sütunlarını analiz metoduna göre güncelle
    $aiResponseTable.find('.five-x-five-only').css('display', analizMetodu === '5x5' ? 'table-cell' : 'none');
    $aiResponseTable.find('.fine-kinney-only').css('display', analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none');
    // Değerleri analiz metoduna göre seç
    var olasilik = analizMetodu === '5x5' ? (aiResponseData.Olasilik5x5 || 3) : (aiResponseData.OlasilikFineKinney || 3);
    var siddet = analizMetodu === '5x5' ? (aiResponseData.Siddet5x5 || 3) : null;
    var maruziyet = analizMetodu === 'Fine-Kinney' ? (aiResponseData.FrekansFineKinney || 3) : null;
    var finneySiddet = analizMetodu === 'Fine-Kinney' ? (aiResponseData.SiddetFineKinney || 3) : null;
    var skor = analizMetodu === '5x5' ? olasilik * siddet : olasilik * maruziyet * finneySiddet;
    var badgeClass = analizMetodu === '5x5' ?
        (skor >= 15 ? 'danger' : skor >= 8 ? 'warning' : 'success') :
        (skor >= 400 ? 'danger' : skor >= 100 ? 'warning' : 'success');
    var escapedRiskTanimi = escapeHtml(aiResponseData.RiskTanimi || '');
    var escapedRiskFaktorleri = escapeHtml(aiResponseData.RiskFaktorleri || '');
    var escapedKontrolOnlemleri = escapeHtml(aiResponseData.KontrolOnlemleri || '');
    var escapedMevzuatAdi = aiResponseData.MevzuatAdi
        ? escapeHtml(aiResponseData.MevzuatAdi)
        : (aiResponseData.MevzuatId && mevzuatList.find(m => m.id === aiResponseData.MevzuatId)
            ? escapeHtml(mevzuatList.find(m => m.id === aiResponseData.MevzuatId).mevzuatAdi)
            : window.translations.SelectLegislation);
    // Tablo satırını oluştur
    var rowHtml = `
        <tr data-ai-response="true" data-saha-index="${sahaIndex}" data-manual-risk-index="${manualRiskIndex}"
            data-olasilik-5x5="${aiResponseData.Olasilik5x5 || 3}" data-siddet-5x5="${aiResponseData.Siddet5x5 || 3}"
            data-olasilik-fine-kinney="${aiResponseData.OlasilikFineKinney || 3}" data-frekans-fine-kinney="${aiResponseData.FrekansFineKinney || 3}"
            data-siddet-fine-kinney="${aiResponseData.SiddetFineKinney || 3}" data-mevzuat-id="${aiResponseData.MevzuatId || 0}">
            <td data-label="Risk Adı">${escapedRiskTanimi}</td>
            <td data-label="Açıklama">${escapedRiskFaktorleri}</td>
            <td data-label="RiskZarariTitle">${escapeHtml(aiResponseData.RiskZarari || '-')}</td> <!-- Yeni: RiskZarari td ekle -->
            <td data-label="Olasılık">${olasilik}</td>
            <td data-label="Şiddet" class="five-x-five-only" style="display: ${analizMetodu === '5x5' ? 'table-cell' : 'none'};">${siddet || '-'}</td>
            <td data-label="Maruziyet" class="fine-kinney-only" style="display: ${analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none'};">${maruziyet || '-'}</td>
            <td data-label="Finney Şiddet" class="fine-kinney-only" style="display: ${analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none'};">${finneySiddet || '-'}</td>
            <td data-label="Puan"><span class="badge bg-${badgeClass}">${skor}</span></td>
            <td data-label="Önerilen Önlem">${escapedKontrolOnlemleri}</td>
            <td data-label="Mevzuat">${escapedMevzuatAdi}</td>
            <td data-label="İşlem">
                <button type="button" class="btn btn-sm btn-primary edit-ai-response" data-saha-index="${sahaIndex}" data-manual-risk-index="${manualRiskIndex}">${window.translations.Edit || 'Düzenle'}</button>
                <button type="button" class="btn btn-sm btn-success approve-ai-response" data-saha-index="${sahaIndex}" data-manual-risk-index="${manualRiskIndex}">${window.translations.Add || 'Ekle'}</button>
            </td>
        </tr>`;
    $aiResponseTable.find('.ai-response-body').html(rowHtml);
    $aiResponseTable.data('ai-response', aiResponseData);
    $aiResponseTable.removeClass('active');
    $('#aiLoadingOverlay').removeClass('show');
    $('#aiLoadingCard').removeClass('show');
    Swal.fire({
        title: window.translations.SuccessTitle,
        text: window.translations.AIResponseReceived,
        icon: 'success',
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: true,
        confirmButtonText: window.translations.ConfirmButton
    });
    console.log('[FRONTEND] AI response tablosu güncellendi. SahaIndex:', sahaIndex, 'ManualRiskIndex:', manualRiskIndex, 'AnalizMetodu:', analizMetodu, 'MevzuatAdi:', escapedMevzuatAdi);
});

// AI önerisini düzenle (manuel risk formuna aktar)
$('#sahaAccordion').on('click', '.edit-ai-response', function () {
    var sahaIndex = parseInt($(this).data('saha-index'));
    var manualRiskIndex = parseInt($(this).data('manual-risk-index'));
    var $aiResponseTable = $(`.ai-response-table[data-saha-index="${sahaIndex}"][data-manual-risk-index="${manualRiskIndex}"]`);
    var aiResponseData = $aiResponseTable.data('ai-response');
    if (!aiResponseData) {
        Swal.fire({
            title: window.translations.WarningTitle,
            text: window.translations.NoAIResponse,
            icon: 'warning',
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: true,
            confirmButtonText: window.translations.ConfirmButton
        });
        return;
    }
    console.log('[FRONTEND] AI önerisi forma aktarılıyor. SahaIndex:', sahaIndex, 'ManualRiskIndex:', manualRiskIndex, 'AIResponse:', aiResponseData);
    // Mevzuat listesini yükle
    loadMevzuatList();
    if (!mevzuatList || !mevzuatList.length) {
        console.error('[FRONTEND] Mevzuat listesi yüklenemedi (edit-ai-response).');
        Swal.fire({
            icon: 'error',
            title: window.translations.ErrorTitle,
            text: window.translations.LegislationListLoadError
        });
        return;
    }
    var $row = $(`.manual-risk-table[data-saha-index="${sahaIndex}"] tr[data-manual-risk-index="${manualRiskIndex}"]`);
    if ($row.length === 0) {
        console.error('[FRONTEND] İlgili manuel risk satırı bulunamadı. SahaIndex:', sahaIndex, 'ManualRiskIndex:', manualRiskIndex);
        Swal.fire({
            icon: 'error',
            title: window.translations.ErrorTitle,
            text: 'Manuel risk satırı bulunamadı.'
        });
        return;
    }
    // AI verilerini satıra uygula
    $row.find('.manual-risk-adi').val(aiResponseData.RiskTanimi || '');
    $row.find('.manual-risk-faktorleri').val(aiResponseData.RiskFaktorleri || '');
    $row.find('.manual-risk-zarari').val(aiResponseData.RiskZarari || ''); // 🔴 Yeni eklendi
    $row.find('.manual-kontrol-onlemleri').val(aiResponseData.KontrolOnlemleri || '');
    var analizMetodu = window.analizMetodu || $('#riskForm input[name=AnalizMetodu]:checked').val() || '5x5';

    // Veri atributlarını güncelle
    $row.data('olasilik-5x5', aiResponseData.Olasilik5x5 || 3);
    $row.data('siddet-5x5', aiResponseData.Siddet5x5 || 3);
    $row.data('olasilik-fine-kinney', aiResponseData.OlasilikFineKinney || 3);
    $row.data('frekans-fine-kinney', aiResponseData.FrekansFineKinney || 3);
    $row.data('siddet-fine-kinney', aiResponseData.SiddetFineKinney || 3);

    // Inputları analiz metoduna göre ayarla
    if (analizMetodu === '5x5') {
        $row.find('.manual-olasilik').val(aiResponseData.Olasilik5x5 || 3).attr('max', 5);
        $row.find('.manual-siddet').val(aiResponseData.Siddet5x5 || 3).attr('max', 5).prop('required', true);
        $row.find('.manual-maruziyet').val('').removeAttr('required');
        $row.find('.manual-finney-siddet').val('').removeAttr('required');
    } else {
        $row.find('.manual-olasilik').val(aiResponseData.OlasilikFineKinney || 3).attr('max', 10);
        $row.find('.manual-maruziyet').val(aiResponseData.FrekansFineKinney || 3).attr('max', 10).prop('required', true);
        $row.find('.manual-finney-siddet').val(aiResponseData.SiddetFineKinney || 3).attr('max', 100).prop('required', true);
        $row.find('.manual-siddet').val('').removeAttr('required');
    }

    var $mevzuatSelect = $row.find('.mevzuat-select');
    $mevzuatSelect.val(aiResponseData.MevzuatId || 0);
    var mevzuatAdi = aiResponseData.MevzuatAdi
        ? aiResponseData.MevzuatAdi
        : (aiResponseData.MevzuatId && mevzuatList.find(m => m.id === aiResponseData.MevzuatId)
            ? mevzuatList.find(m => m.id === aiResponseData.MevzuatId).mevzuatAdi
            : window.translations.SelectLegislation);
    $row.find('.mevzuat-inline').text(mevzuatAdi).data('mevzuat-id', aiResponseData.MevzuatId || 0);

    // Skoru güncelle
    updateManualRiskSkor($row);

    Swal.fire({
        title: window.translations.SuccessTitle,
        text: window.translations.AIResponseApplied,
        icon: 'success',
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: true,
        confirmButtonText: window.translations.ConfirmButton
    });
});
