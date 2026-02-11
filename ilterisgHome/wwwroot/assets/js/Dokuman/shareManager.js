import { encryptValue, base64ToBlob, downloadQrCode } from './utils.js';
let currentShareUrl = '';
let currentQrPngUrl = '';
let selectedDokumanlar = [];
let paylasimMap = {};
// paylasim.js
export async function loadGecmisPaylasimlar() {
    try {
        const response = await $.ajax({
            url: '/Dokuman/Paylasimlarim',
            type: 'GET',
            data: { includeExpired: false }
        });
        var html = response.length === 0 ? '<div class="alert alert-warning">' + window.translations.NoSharesFound + '</div>' : '<div class="paylasimlar-container">';
        for (let i = 0; i < response.length; i++) {
            let paylasim = response[i];
            var isActive = paylasim.sureliMi ? new Date(paylasim.gecerlilikTarihi) > new Date() : true;
            var statusDot = isActive ? '<span class="badge bg-success me-1">' + window.translations.Active + '</span>' : '<span class="badge bg-danger me-1">' + window.translations.Expired + '</span>';
            var dokumanList = '';
            var dokumanIdList = paylasim.dokumanIdList && Array.isArray(paylasim.dokumanIdList) ? paylasim.dokumanIdList.join(',') : '';
            let encryptedToken = await encryptValue(paylasim.token);
            var paylasimUrl = `https://localhost:7081/Dokuman/PaylasimGoruntule?key=${encodeURIComponent(encryptedToken)}`;
            $.each(paylasim.dokumanlar, function (j, dokuman) {
                // Dosya adını düzenle
                const cleanName = cleanFileName(dokuman.dosyaAdi);
                dokumanList += `<span class="dokuman-item">${cleanName} (${dokuman.dokumanTuru})</span>`;
            });
            if (dokumanIdList) {
                paylasimMap[dokumanIdList] = paylasimUrl;
            }
            console.log("Paylaşım Token:", paylasim.token, "IsActive:", isActive, "GecerlilikTarihi:", paylasim.gecerlilikTarihi);
            html += `
                <div class="paylasim-card">
                    <div class="paylasim-header">
                        <span class="paylasim-tarihi">${new Date(paylasim.olusturmaTarihi).toLocaleString('tr-TR')}</span>
                        <span class="paylasim-durum">${statusDot}</span>
                    </div>
                    <div class="paylasim-dokumanlar">${dokumanList}</div>
                    <div class="paylasim-islemler">
                        <button onclick="window.sharePaylasim('${paylasim.token}')" class="btn btn-sm btn-primary waves-effect waves-light" title="${window.translations.Share}">
                            <i class="fas fa-share-alt"></i>
                        </button>
                        <button onclick="window.kopyalaPaylasimUrl('${paylasimUrl}')" class="btn btn-sm btn-secondary waves-effect waves-light" title="${window.translations.CopyLink}">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="cancel-share-btn btn btn-sm btn-danger waves-effect waves-light" data-token="${paylasim.token}" title="${window.translations.CancelShare}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>`;
        }
        html += response.length > 0 ? '</div>' : '';
        $('#gecmisPaylasimlarList').html(html);
        // İptal Et butonuna olay dinleyicisi ekle
        $('#gecmisPaylasimlarList').find('.cancel-share-btn').off('click').on('click', function () {
            var token = $(this).data('token');
            cancelShare(token);
        });
    } catch (error) {
        $('#gecmisPaylasimlarList').html('<div class="alert alert-danger">' + window.translations.ErrorLoadingPastShares + '</div>');
    }
}
// Dosya adını düzenleme fonksiyonu
function cleanFileName(rawName) {
    // Örnek: 20250721221827_3cbcfa38_21.07.2025 Tarihli Dekont.jpg → 21.07.2025 Tarihli Dekont.jpg
    const parts = rawName.split('_');
    if (parts.length >= 3) {
        return parts.slice(2).join('_');
    }
    return rawName; // Fallback
}
export async function cancelShare(token) {
    console.log("Cancel Share - Token:", token);
    Swal.fire({
        title: window.translations.CancelShare,
        text: window.translations.ConfirmCancelShare,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: window.translations.YesCancel,
        cancelButtonText: window.translations.No
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const payload = { token: token };
                console.log("Cancel Share - Gönderilen Veri:", JSON.stringify(payload));
                const response = await $.ajax({
                    url: '/Dokuman/PaylasimiKapat',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(payload)
                });
                console.log("Cancel Share - Sunucu Yanıtı:", response);
                if (response.success) {
                    Swal.fire({
                        icon: 'success',
                        title: window.translations.Success,
                        text: window.translations.ShareCanceledSuccessfully,
                        confirmButtonText: window.translations.OK
                    });
                    loadGecmisPaylasimlar(); // Listeyi yenile
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: window.translations.Error,
                        text: response.message || window.translations.ShareNotFound,
                        confirmButtonText: window.translations.OK
                    });
                }
            } catch (error) {
                console.error("Cancel Share Error:", error);
                Swal.fire({
                    icon: 'error',
                    title: window.translations.Error,
                    text: window.translations.ErrorCancelingShare + ' ' + error.message,
                    confirmButtonText: window.translations.OK
                });
            }
        }
    });
}
export function openPaylasimModal(refTableName, refId, dokumanTuru, tableId) {
    selectedDokumanlar = [];
    let $checkboxes;
    // Manuel klasörler için
    if (tableId.includes('subFolders_')) {
        const folderId = tableId.split('_')[1];
        $checkboxes = $(`#folder_${folderId} .table-responsive.files-table .dokuman-checkbox:checked`);
    } else {
        // Diğer tablolar için
        $checkboxes = $(`#${tableId} .dokuman-checkbox:checked`);
    }
    $checkboxes.each(function () {
        selectedDokumanlar.push(parseInt($(this).val()));
    });
    console.log(`openPaylasimModal: tableId=${tableId}, seçili dokümanlar=${JSON.stringify(selectedDokumanlar)}, refTableName=${refTableName}, refId=${refId}, dokumanTuru=${dokumanTuru}`);
    if (selectedDokumanlar.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: window.translations.Warning,
            text: window.translations.SelectAtLeastOneDocument,
            confirmButtonText: window.translations.OK
        });
        return;
    }
    var dokumanIdList = selectedDokumanlar.sort((a, b) => a - b).join(',');
    if (paylasimMap[dokumanIdList]) {
        currentShareUrl = paylasimMap[dokumanIdList];
        $('#paylasimUrl').val(currentShareUrl);
        $('#paylasimSonuc').show();
        $('#paylasimOlusturBtn').hide();
        Swal.fire({
            icon: 'info',
            title: window.translations.Info,
            text: window.translations.ShareLinkAlreadyExists,
            confirmButtonText: window.translations.OK
        });
        return;
    }
    $('#paylasimRefTableName').val(refTableName);
    $('#paylasimRefId').val(refId);
    $('#paylasimSonuc').hide();
    $('#paylasimOlusturBtn').show();
    $('#paylasimModal').modal('show');
    $('input[name="paylasimTuru"]').change(function () {
        if ($('#sureli').is(':checked')) {
            $('#sureDiv').show();
        } else {
            $('#sureDiv').hide();
        }
    });
    $('#paylasimOlusturBtn').off('click').on('click', function () {
        var payload = {
            dokumanIdList: selectedDokumanlar,
            refTableName: refTableName,
            refId: refId,
            sureliMi: $('#sureli').is(':checked'),
            sureSaat: parseInt($('#sureSaat').val()) || 24,
            sadeceGoruntulemeMi: $('#sadeceGoruntuleme').is(':checked')
        };
        $.ajax({
            url: '/Dokuman/PaylasimOlustur',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(payload),
            success: function (response) {
                if (response.success) {
                    currentShareUrl = response.paylasimUrl;
                    $('#paylasimUrl').val(currentShareUrl);
                    $('#paylasimSonuc').show();
                    $('#paylasimOlusturBtn').hide();
                    paylasimMap[dokumanIdList] = currentShareUrl;
                    loadGecmisPaylasimlar();
                    Swal.fire({
                        icon: 'success',
                        title: window.translations.Success,
                        text: window.translations.ShareLinkCreated,
                        confirmButtonText: window.translations.OK
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: window.translations.Error,
                        text: response.message,
                        confirmButtonText: window.translations.OK
                    });
                }
            },
            error: function (xhr, status, error) {
                Swal.fire({
                    icon: 'error',
                    title: window.translations.Error,
                    text: window.translations.ErrorCreatingShare + ' ' + error,
                    confirmButtonText: window.translations.OK
                });
            }
        });
    });
}
export function openQrModal() {
    $('#qrCodeContainer').html('<canvas id="qrCanvas"></canvas>');
    try {
        var qrCanvas = document.getElementById("qrCanvas");
        if (!qrCanvas) {
            throw new Error(window.translations.QrCanvasNotFound);
        }
        QRCode.toCanvas(qrCanvas, currentShareUrl, { width: 200, height: 200 }, function (error) {
            if (error) {
                Swal.fire({
                    icon: 'error',
                    title: window.translations.Error,
                    text: window.translations.QrCodeGenerationError + ' ' + error.message,
                    confirmButtonText: window.translations.OK
                });
                return;
            }
            currentQrPngUrl = qrCanvas.toDataURL('image/png');
            const blob = base64ToBlob(currentQrPngUrl, 'image/png');
            const blobUrl = URL.createObjectURL(blob);
            $('#qrDownloadLink').attr('href', blobUrl);
            $('#qrDownloadLink').attr('download', 'qrcode.png');
        });
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: window.translations.Error,
            text: window.translations.QrCodeGenerationError + ' ' + error.message,
            confirmButtonText: window.translations.OK
        });
    }
    $('#qrModal').modal('show');
}
export async function shareQrLink() {
    const blob = base64ToBlob(currentQrPngUrl, 'image/png');
    const file = new File([blob], 'qrcode.png', { type: 'image/png' });
    if (navigator.share) {
        try {
            await navigator.share({
                files: [file],
                title: window.translations.ShareTitle,
                text: `${window.translations.ShareText}: ${currentShareUrl}`
            });
            return;
        } catch (error) {
            console.error("Paylaşım hatası:", error);
        }
    }
    Swal.fire({
        title: window.translations.Share,
        html: `
            <p>${window.translations.ChoosePlatform}</p>
            <div class="share-buttons">
                <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(`${window.translations.ShareText}: ${currentShareUrl}`)}" target="_blank" class="btn btn-success btn-sm me-2">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                </a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentShareUrl)}" target="_blank" class="btn btn-primary btn-sm me-2">
                    <i class="fab fa-facebook"></i> Facebook
                </a>
                <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(currentShareUrl)}&text=${encodeURIComponent(window.translations.ShareText)}" target="_blank" class="btn btn-info btn-sm me-2">
                    <i class="fab fa-x-twitter"></i> X
                </a>
                <a href="mailto:?subject=${encodeURIComponent(window.translations.ShareTitle)}&body=${encodeURIComponent(`${window.translations.ShareText}: ${currentShareUrl}`)}" class="btn btn-secondary btn-sm me-2">
                    <i class="fas fa-envelope"></i> ${window.translations.Email}
                </a>
            </div>
            <div class="mt-3">
                <button onclick="downloadQrCode('${currentQrPngUrl}', 'qrcode.png')" class="btn btn-primary btn-sm">
                    <i class="fas fa-download"></i> ${window.translations.DownloadQrCode}
                </button>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: window.translations.Close
    });
}
export async function sharePaylasim(token) {
    let encryptedToken = await encryptValue(token);
    currentShareUrl = `https://localhost:7081/Dokuman/PaylasimGoruntule?key=${encodeURIComponent(encryptedToken)}`;
    var tempCanvas = document.createElement('canvas');
    QRCode.toCanvas(tempCanvas, currentShareUrl, { width: 200, height: 200 }, function (error) {
        if (error) {
            Swal.fire({
                icon: 'error',
                title: window.translations.Error,
                text: window.translations.QrCodeGenerationError + ' ' + error.message,
                confirmButtonText: window.translations.OK
            });
            return;
        }
        currentQrPngUrl = tempCanvas.toDataURL('image/png');
        const blob = base64ToBlob(currentQrPngUrl, 'image/png');
        const file = new File([blob], 'qrcode.png', { type: 'image/png' });
        if (navigator.share) {
            try {
                navigator.share({
                    files: [file],
                    title: window.translations.ShareTitle,
                    text: `${window.translations.ShareText}: ${currentShareUrl}`
                });
                return;
            } catch (error) {
                console.error("Paylaşım hatası:", error);
            }
        }
        Swal.fire({
            title: window.translations.Share,
            html: `
                <p>${window.translations.ChoosePlatform}</p>
                <div class="share-buttons">
                    <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(`${window.translations.ShareText}: ${currentShareUrl}`)}" target="_blank" class="btn btn-success btn-sm me-2">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </a>
                    <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentShareUrl)}" target="_blank" class="btn btn-primary btn-sm me-2">
                        <i class="fab fa-facebook"></i> Facebook
                    </a>
                    <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(currentShareUrl)}&text=${encodeURIComponent(window.translations.ShareText)}" target="_blank" class="btn btn-info btn-sm me-2">
                        <i class="fab fa-x-twitter"></i> X
                    </a>
                    <a href="mailto:?subject=${encodeURIComponent(window.translations.ShareTitle)}&body=${encodeURIComponent(`${window.translations.ShareText}: ${currentShareUrl}`)}" class="btn btn-secondary btn-sm me-2">
                        <i class="fas fa-envelope"></i> ${window.translations.Email}
                    </a>
                </div>
                <div class="mt-3">
                    <button onclick="downloadQrCode('${currentQrPngUrl}', 'qrcode.png')" class="btn btn-primary btn-sm">
                        <i class="fas fa-download"></i> ${window.translations.DownloadQrCode}
                    </button>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: window.translations.Close
        });
    });
}
export function kopyalaUrl() {
    var urlInput = document.getElementById('paylasimUrl');
    urlInput.select();
    document.execCommand('copy');
    Swal.fire({
        icon: 'success',
        title: window.translations.Copied,
        text: window.translations.ShareLinkCopied,
        confirmButtonText: window.translations.OK
    });
}
export function kopyalaPaylasimUrl(url) {
    var tempInput = document.createElement('input');
    document.body.appendChild(tempInput);
    tempInput.value = url;
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    Swal.fire({
        icon: 'success',
        title: window.translations.Copied,
        text: window.translations.ShareLinkCopied,
        confirmButtonText: window.translations.OK
    });
}