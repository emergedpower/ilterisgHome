import { md5 } from './utils.js';
import { refreshFolderStructure } from './folderManager.js';
import { openDokumanYukleModal } from './documentManager.js';

// Yükleme ilerleme penceresi fonksiyonları
export function showUploadProgressWindow() {
    $('#uploadProgressWindow').show();
}
export function hideUploadProgressWindow() {
    $('#uploadProgressWindow').hide();
}
export function toggleUploadWindow() {
    $('#uploadProgressWindow').toggleClass('minimized');
    var isMinimized = $('#uploadProgressWindow').hasClass('minimized');
    $('.minimize-btn').text(isMinimized ? '+' : '−');
}
export function clearUploadHistory() {
    $('#uploadProgressList').empty();
    window.uploadProgressItems = {};
    hideUploadProgressWindow();
}
export function updateUploadProgress(fileName, progress, status) {
    var itemId = md5(encodeURIComponent(fileName));
    var $item = window.uploadProgressItems[itemId];
    if (!$item) {
        $item = $(`
            <div class="upload-progress-item" id="${itemId}">
                <div class="file-name">${fileName}</div>
                <div class="progress">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                </div>
                <div class="status">${status}</div>
            </div>
        `);
        $('#uploadProgressList').prepend($item);
        window.uploadProgressItems[itemId] = $item;
        showUploadProgressWindow();
    } else {
        $item.find('.progress-bar').css('width', `${progress}%`);
        $item.find('.status').text(status);
    }
    requestAnimationFrame(() => {
        $item.find('.progress-bar').css('transition', 'width 0.3s ease');
    });
}

// Global manuel section tracker
export let currentManualSection = 'firmam'; // Varsayılan
export let currentFirmaId = null; // Aktif firma ID
export let currentPersonelId = null; // Aktif personel ID

// Firma odaklanma
export function firmaOdaklan(firmaId) {
    $('.firma-container').hide();
    $(`#firma_${firmaId}`).show();
    $('#geriFirmalarim').show();
    $('#firmalarimHeading .accordion-button').html(`<i class="mdi mdi-folder me-2"></i> Firma: ${$(`#firma_${firmaId} .firma-button`).text().trim()}`);
    currentManualSection = `firma_${firmaId}`;
    currentFirmaId = firmaId;
    currentPersonelId = null; // Sıfırla
    console.log(`firmaOdaklan çağrıldı: firmaId=${firmaId}, currentManualSection=${currentManualSection}`);
    // Manuel klasörleri yenile
    refreshFolderStructure('Firmalar', firmaId, `#manualFolders_firma_${firmaId}`, true);
}

// Firmalarım'a geri dön
export function geriDonFirmalarim() {
    $('.firma-container').show();
    $('#geriFirmalarim').hide();
    $('#firmalarimHeading .accordion-button').html('<i class="mdi mdi-folder me-2"></i> Firmalarım');
    currentManualSection = 'firmam';
    currentFirmaId = null;
    currentPersonelId = null;
    console.log('geriDonFirmalarim çağrıldı');
    // Root manuel klasörleri yenile
    refreshFolderStructure('Firmalar', window.firmaId || 1, '#manualFolders_firmam', true);
}

// Personel odaklanma (personellerim sekmesi)
export function personelOdaklan(personelId) {
    $('.personel-container').hide();
    $(`#personel_${personelId}.personel-container`).show();
    $('#geriPersonellerim').show();
    $('[id^="geriFirmaPersonelleri_"]').hide();
    $('#personellerimHeading .accordion-button').html(`<i class="mdi mdi-folder me-2"></i> Personel: ${$(`#personel_${personelId} .personel-button`).text().trim()}`);
    currentManualSection = `personel_${personelId}`;
    currentPersonelId = personelId;
    currentFirmaId = null; // Sıfırla
    console.log(`personelOdaklan çağrıldı: personelId=${personelId}, currentManualSection=${currentManualSection}`);
    refreshFolderStructure('Kullanicilar', personelId, `#manualFolders_personel_${personelId}`, true);
}

// Personellerim'e geri dön
export function geriDonPersonellerim() {
    $('.personel-container').show();
    $('#geriPersonellerim').hide();
    $('[id^="geriFirmaPersonelleri_"]').hide();
    $('#personellerimHeading .accordion-button').html('<i class="mdi mdi-folder me-2"></i> Personellerim');
    currentManualSection = 'firmam'; // Varsayılan'a dön
    currentPersonelId = null;
    currentFirmaId = null;
    console.log('geriDonPersonellerim çağrıldı');
    refreshFolderStructure('Firmalar', window.firmaId || 1, '#manualFolders_firmam', true);
}

// Firma Personelleri odaklanma
export function firmaPersonelOdaklan(firmaId, personelId) {
    $(`#firma_${firmaId} .firma-personel-container`).hide();
    $(`#personel_${personelId}.firma-personel-container`).show();
    $(`#geriFirmaPersonelleri_${firmaId}`).show();
    $('#geriPersonellerim').hide();
    $(`#firmaPersonelleriHeading_${firmaId} .accordion-button`).html(`<i class="mdi mdi-folder me-2"></i> Personel: ${$(`#personel_${personelId} .personel-button`).text().trim()}`);
    currentManualSection = `personel_${personelId}`;
    currentPersonelId = personelId;
    currentFirmaId = firmaId;
    console.log(`firmaPersonelOdaklan çağrıldı: firmaId=${firmaId}, personelId=${personelId}, currentManualSection=${currentManualSection}`);
    refreshFolderStructure('Kullanicilar', personelId, `#manualFolders_personel_${personelId}`, true);
}

// Firma Personelleri'ne geri dön
export function geriDonFirmaPersonelleri(firmaId) {
    $(`#firma_${firmaId} .firma-personel-container`).show();
    $(`#geriFirmaPersonelleri_${firmaId}`).hide();
    $('#geriPersonellerim').hide();
    $(`#firmaPersonelleriHeading_${firmaId} .accordion-button`).html('<i class="mdi mdi-folder me-2"></i> Firma Personelleri');
    currentManualSection = `firma_${firmaId}`;
    currentPersonelId = null;
    console.log(`geriDonFirmaPersonelleri çağrıldı: firmaId=${firmaId}`);
    refreshFolderStructure('Firmalar', firmaId, `#manualFolders_firma_${firmaId}`, true);
}

// Manuel Klasör Odaklanma
export function odaklanManualFolder(folderId, folderName, parentPath = '') {
    if (parentPath) {
        console.log(`odaklanManualFolder: parentPath=${parentPath} algılandı, odaklanma atlanıyor: folderId=${folderId}, folderName=${folderName}`);
        return;
    }
    console.log(`odaklanManualFolder çağrıldı: folderId=${folderId}, folderName=${folderName}, currentManualSection=${currentManualSection}`);
    const containerSelector = `#manualFolders_${currentManualSection} > .accordion-item`;
    $(containerSelector).not(`#folder_${folderId}`).collapse('hide');
    $(`#folder_${folderId}`).show();
    $(`#geriManual_${currentManualSection}`).show();
    const headingSelector = `#${currentManualSection}ManuelHeading .accordion-button`;
    $(headingSelector).html(`<i class="mdi mdi-folder me-2"></i> ${folderName}`);
    $(`#rootActions_${currentManualSection}`).hide();
    $(`#folderCollapse_${folderId}`).collapse('show');
    $(`#folderHeading_${folderId} .accordion-button`).removeClass('collapsed').attr('aria-expanded', 'true');
    console.log(`Aktif klasör: #folder_${folderId}, subActions: #subActions_${folderId}, subFolders: #subFolders_${folderId}, files-table: #folder_${folderId} .files-table`);
}

// Manuel Klasörlere Geri Dön
export function geriDonManual() {
    const section = currentManualSection || 'firmam';
    console.log(`geriDonManual çağrıldı: section=${section}`);
    const containerSelector = `#manualFolders_${section} > .accordion-item`;
    $(containerSelector).show();
    $(`#geriManual_${section}`).hide();
    const headingSelector = `#${section}ManuelHeading .accordion-button`;
    $(headingSelector).html('<i class="mdi mdi-folder-account me-2"></i> Manuel Klasörler');
    $(`#rootActions_${section}`).show();
    $(`#manualFolders_${section} .accordion-collapse`).collapse('hide');
    $(`#manualFolders_${section} .accordion-button`).addClass('collapsed').attr('aria-expanded', 'false');
    // Doğru refTableName ve refId belirle
    const refTableName = section.startsWith('firma_') || section === 'firmam' ? 'Firmalar' : 'Kullanicilar';
    const refId = section === 'firmam' ? (window.firmaId || 1) : // Firmam için window.firmaId kullan
        section.match(/\d+$/) ? parseInt(section.match(/\d+$/)[0]) : 1;
    console.log(`geriDonManual: refTableName=${refTableName}, refId=${refId}, targetElement=#manualFolders_${section}`);
    refreshFolderStructure(refTableName, refId, `#manualFolders_${section}`, true);
}

// Doküman yükleme modalını aç
export function openYukleModal(refTableName, refId, dokumanTuru, customPath = '') {
    console.log(`openYukleModal çağrıldı: refTableName=${refTableName}, refId=${refId}, dokumanTuru=${dokumanTuru}, customPath=${customPath || 'BOŞ'}, currentManualSection=${currentManualSection}`);
    if (dokumanTuru === 'Manuel' && !customPath) {
        Swal.fire({
            title: window.translations.EnterFolderPath,
            input: 'text',
            inputPlaceholder: window.translations.FolderPathExample,
            inputValidator: (value) => {
                if (!value) {
                    return window.translations.FolderPathRequired;
                }
                const invalidCharsRegex = /[:*?"<>|]/;
                if (invalidCharsRegex.test(value)) {
                    return window.translations.InvalidFolderPathCharacters;
                }
            },
            showCancelButton: true,
            confirmButtonText: window.translations.Upload,
            cancelButtonText: window.translations.Cancel
        }).then((result) => {
            if (result.isConfirmed) {
                customPath = result.value;
                console.log(`Kullanıcı path girdi: ${customPath}`);
                openDokumanYukleModal(refTableName, refId, dokumanTuru, customPath);
            }
        });
    } else {
        console.log(`openDokumanYukleModal çağrılıyor: customPath=${customPath}`);
        openDokumanYukleModal(refTableName, refId, dokumanTuru, customPath);
    }
}

// Modal kapandığında formu sıfırla
export function setupModalReset() {
    $('#dokumanYukleModal').on('hidden.bs.modal', function () {
        console.log('dokumanYukleModal hidden.bs.modal eventi tetiklendi, form sıfırlanıyor.');
        $('#dokumanYukleForm').find('#dosya, #aciklama').val('');
        // #customFolderPath sıfırlanmamalı, manuel için korunur
    });
}

// Tab değişimi dinle ve currentManualSection'ı güncelle
$(document).ready(function () {
    $('.nav-link').on('shown.bs.tab', function (e) {
        // Uyumlu hale getir: href yoksa data-bs-target kullan (diğer tab'lar href, sub-tab'lar data-bs-target kullanıyor)
        let targetAttr = $(e.target).attr('href');
        if (!targetAttr) {
            targetAttr = $(e.target).attr('data-bs-target');
        }
        const tabId = targetAttr ? targetAttr.substring(1) : '';
        if (!tabId) {
            console.warn('Tab target bulunamadı:', e.target);
            return;
        }
        // Personellerim sub-tab'ları için özel logic: aktif/ayrılmış ayrımı yapma, genel "personellerim" tut
        if (tabId === 'aktifPersoneller' || tabId === 'sonlandirilmisPersoneller') {
            currentManualSection = 'personellerim';  // Sub-tab fark etmez, accordion'lar personel bazlı
        } else {
            currentManualSection = tabId === 'kisisel' ? 'kisisel' :
                tabId === 'firmam' ? 'firmam' :
                    tabId === 'firmalarim' ? 'firma_' + (currentFirmaId || '') :
                        tabId === 'personellerim' ? 'personel_' + (currentPersonelId || '') : currentManualSection;
        }
        console.log(`Tab değişti: tabId=${tabId}, currentManualSection=${currentManualSection}`);
    });
    setupModalReset(); // Modal reset'i hazırla
});

// Global export for view onclick
window.geriDonManual = geriDonManual;
window.odaklanManualFolder = odaklanManualFolder;
window.firmaOdaklan = firmaOdaklan;
window.geriDonFirmalarim = geriDonFirmalarim;
window.personelOdaklan = personelOdaklan;
window.geriDonPersonellerim = geriDonPersonellerim;
window.firmaPersonelOdaklan = firmaPersonelOdaklan;
window.geriDonFirmaPersonelleri = geriDonFirmaPersonelleri;
window.openYukleModal = openYukleModal;
window.showUploadProgressWindow = showUploadProgressWindow;
window.updateUploadProgress = updateUploadProgress;