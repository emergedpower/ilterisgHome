import { encryptValue, md5 } from './utils.js';
import { setupInlineRename } from './renameManager.js';
import { updateUploadProgress, showUploadProgressWindow, currentManualSection } from './uiManager.js';
import { refreshFolderStructure } from './folderManager.js';

// customFolderPath değerini saklamak için global değişken
let currentCustomFolderPath = '';

// YENİ: Çift yükleme önleme için global flag (timestamp ile)
const loadLocks = new Map(); // key: `${refTableName}_${refId}_${dokumanTuru}`, value: timestamp

function parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('.')) {
        const parts = dateStr.split(' ');
        const dateParts = parts[0].split('.');
        const timeParts = parts[1] ? parts[1].split(':') : [0, 0];
        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]);
    } else {
        return new Date(dateStr);
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export async function loadDokumanlar(refTableName, refId, targetElement, dokumanTuru = null, forceAccordionOpen = true) {
    const lockKey = `${refTableName}_${refId}_${dokumanTuru || 'null'}`;
    const now = Date.now();
    if (loadLocks.has(lockKey) && (now - loadLocks.get(lockKey)) < 100) { // 100ms lock
        console.warn(`loadDokumanlar kilitli: ${lockKey}, atlanıyor.`);
        return;
    }
    loadLocks.set(lockKey, now);

    try {
        console.log(`loadDokumanlar çağrıldı: refTableName=${refTableName}, refId=${refId}, targetElement=${targetElement}, dokumanTuru=${dokumanTuru}, forceAccordionOpen=${forceAccordionOpen}, currentManualSection=${currentManualSection}`);

        // YENİ: Sonlandırılmış personel kontrolü (accordion class'ında text-danger varsa)
        if ($(targetElement).closest('.accordion-button').hasClass('text-danger')) {
            console.log(`Sonlandırılmış personel yükleniyor: targetElement=${targetElement}, personelId=${refId}`);
        }

        if (!$(targetElement).length) {
            console.error(`Hata: targetElement bulunamadı: ${targetElement}`);
            Swal.fire({
                icon: 'error',
                title: window.translations.Error,
                text: `${window.translations.TargetTableNotFound}: ${targetElement}`,
                confirmButtonText: window.translations.OK
            });
            return;
        }
        if (!refTableName || !refId) {
            console.error(`Hata: Eksik parametreler: refTableName=${refTableName}, refId=${refId}`);
            Swal.fire({
                icon: 'error',
                title: window.translations.Error,
                text: window.translations.InvalidParameters,
                confirmButtonText: window.translations.OK
            });
            return;
        }
        if (dokumanTuru === 'Manuel') {
            let mainTarget;
            if (refTableName === 'Kullanicilar' && window.userRole !== 'OSGB' && window.userRole !== 'İşveren') {
                mainTarget = '#manualFolders_kisisel';
            } else {
                mainTarget = `#manualFolders_${currentManualSection || 'firmam'}`;
            }
            console.log(`Manuel dokümanlar için refreshFolderStructure çağrılıyor: refTableName=${refTableName}, refId=${refId}, targetElement=${mainTarget}`);
            await refreshFolderStructure(refTableName, refId, mainTarget, true);
            return;
        }
        const response = await $.ajax({
            url: '/Dokuman/DokumanListesi',
            type: 'GET',
            cache: false,
            data: { refTableName, refId, dokumanTuru }
        });
        console.log("loadDokumanlar - Sunucu Yanıtı:", JSON.stringify(response, null, 2));
        const $target = $(targetElement);
        const $emptyDiv = $(`${targetElement}Empty`); // Empty div'i seç
        if (response.success && response.dokumanlar && Array.isArray(response.dokumanlar)) {
            let table = '';
            response.dokumanlar.forEach(item => {
                let itemDokumanTuru = String(item.dokumanTuru || '').trim().toLowerCase();
                let filterDokumanTuru = dokumanTuru ? String(dokumanTuru).trim().toLowerCase() : null;
                let itemRefId = parseInt(item.refId);
                let inputRefId = parseInt(refId);
                console.log(`Doküman işleniyor: dokumanId=${item.dokumanId}, dosyaAdi=${item.dosyaAdi}, dokumanTuru=${itemDokumanTuru}, refId=${itemRefId}, refTableName=${item.refTableName}, dosyaYolu=${item.dosyaYolu}, encryptedPath=${item.encryptedPath}, filterDokumanTuru=${filterDokumanTuru}`);
                const isValidDokuman = (
                    (refTableName === 'Kullanicilar' && targetElement.toLowerCase().includes('kisiselalan') && itemDokumanTuru === 'kisiselalan' && itemRefId === inputRefId && (filterDokumanTuru === 'kisiselalan' || filterDokumanTuru === 'kisiselalankullanici' || filterDokumanTuru === null)) ||
                    (refTableName === 'Kullanicilar' && targetElement.toLowerCase().includes('ozluk') && ['kimlik', 'diploma', 'sertifika', 'izinbelgesi', 'isegirisevraklari', 'saglikraporu', 'isgoremezlikraporu', 'personelsozlesmeleri'].includes(itemDokumanTuru) && itemRefId === inputRefId) ||
                    (refTableName === 'Kullanicilar' && targetElement.toLowerCase().includes('diger') && itemDokumanTuru === 'diger' && itemRefId === inputRefId) ||
                    (refTableName === 'Firmalar' && targetElement.toLowerCase().includes('odemeler') && ['dekont', 'bordro'].includes(itemDokumanTuru) && itemRefId === inputRefId) ||
                    (refTableName === 'Firmalar' && targetElement.toLowerCase().includes('etkinlikler') && ['etkinlik', 'toplantinotu', 'ziyaret'].includes(itemDokumanTuru) && itemRefId === inputRefId) ||
                    (refTableName === 'Firmalar' && targetElement.toLowerCase().includes('diger') && itemDokumanTuru === 'diger' && itemRefId === inputRefId) ||
                    (refTableName === 'Firmalar' && targetElement.toLowerCase().includes('kisiselalan') && itemDokumanTuru === 'kisiselalan' && itemRefId === inputRefId) ||
                    (refTableName === 'Sozlesmeler' && itemDokumanTuru === 'firmasozlesmeleri' && itemRefId === inputRefId) ||
                    (refTableName === 'EgitimTuruMateryalleri' && itemDokumanTuru === 'egitimdokumanlari' && itemRefId === inputRefId)
                );
                if (isValidDokuman) {
                    let displayName = item.dosyaAdi;
                    const parts = displayName.split('_');
                    if (parts.length >= 3) {
                        displayName = parts.slice(2).join('_');
                    }
                    let encryptedPath = encodeURIComponent(item.encryptedPath || '');
                    const dateObj = parseDate(item.yuklemeTarihi);
                    const formattedDate = dateObj ? dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
                    // DokumanTuru çevirisi için window.translations objesini kullan
                    const translatedDokumanTuru = window.translations[item.dokumanTuru] || capitalize(item.dokumanTuru);
                    table += `<tr>
                        <td><input type="checkbox" class="dokuman-checkbox" value="${item.dokumanId}"></td>
                        <td class="editable-file-name" data-dokuman-id="${item.dokumanId}" data-current-name="${displayName}">${displayName || '-'}</td>
                        <td>${translatedDokumanTuru}</td>
                        <td>${formattedDate}</td>
                        <td>${item.aciklama || '-'}</td>
                        <td>
                            <a href="/Dokuman/Indir/?path=${encryptedPath}" class="btn btn-sm btn-info waves-effect waves-light me-1" title="İndir">
                                <i class="fas fa-download"></i>
                            </a>
                            <button class="btn btn-sm btn-danger waves-effect waves-light delete-dokuman-btn" data-dokuman-id="${item.dokumanId}" data-dosya-yolu="${item.dosyaYolu}" title="Sil">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>`;
                    console.log(`Doküman eklendi: dokumanId=${item.dokumanId}, dosyaAdi=${item.dosyaAdi}, displayName=${displayName}, translatedDokumanTuru=${translatedDokumanTuru}`);
                } else {
                    console.log(`Doküman filtrelenmedi: itemDokumanTuru=${itemDokumanTuru}, refTableName=${item.refTableName}, refId=${itemRefId}, inputRefId=${inputRefId}, targetElement=${targetElement}, filterDokumanTuru=${filterDokumanTuru}`);
                }
            });
            if (!table) {
                console.warn(`Tablo boş: ${targetElement}, filtrelenmiş doküman yok.`);
                $target.empty();
                $emptyDiv.show(); // Empty div'i göster
                $emptyDiv.find('p').text(response.message || 'Doküman bulunamadı'); // Backend'den gelen mesajı kullan
            } else {
                $target.empty().html(table);
                $emptyDiv.hide(); // Doluysa empty div'i gizle
            }
            console.log(`Tablo güncellendi: ${targetElement}, satır sayısı: ${$target.find('tr').length}, table içeriği: ${table || 'Boş'}`);
            const accordionCollapse = $target.closest('.accordion-collapse');
            if (forceAccordionOpen && accordionCollapse.length && !accordionCollapse.hasClass('show')) {
                console.log(`Accordion açılıyor: ${accordionCollapse.attr('id')}`);
                accordionCollapse.addClass('show');
                const accordionButton = accordionCollapse.prev('.accordion-header').find('.accordion-button');
                accordionButton.removeClass('collapsed').attr('aria-expanded', 'true');
            } else if (!forceAccordionOpen && accordionCollapse.length && accordionCollapse.hasClass('show')) {
                console.log(`Accordion kapatılıyor: ${accordionCollapse.attr('id')}`);
                accordionCollapse.removeClass('show');
                const accordionButton = accordionCollapse.prev('.accordion-header').find('.accordion-button');
                accordionButton.addClass('collapsed').attr('aria-expanded', 'false');
            }
            $target.find('.editable-file-name').each(function () {
                setupInlineRename($(this), refTableName, refId, targetElement, dokumanTuru);
            });
            $target.find('.delete-dokuman-btn').on('click', function () {
                const dokumanId = $(this).data('dokuman-id');
                const dosyaYolu = $(this).data('dosya-yolu');
                console.log(`Silme butonu tıklandı: dokumanId=${dokumanId}, dosyaYolu=${dosyaYolu}`);
                deleteDokuman(dokumanId, dosyaYolu, refTableName, refId, targetElement, dokumanTuru);
            });
            $target.find('.dokuman-checkbox').on('change', function () {
                const tableId = $target.attr('id');
                let shareButtonId;
                if (tableId.includes('firmam')) {
                    shareButtonId = `#share${tableId.charAt(0).toUpperCase() + tableId.slice(1)}`;
                } else if (tableId.includes('firma_')) {
                    const firmaId = tableId.split('_')[1];
                    const folderName = tableId.split('_')[0].replace('firma', '');
                    shareButtonId = `#shareFirma${folderName.charAt(0).toUpperCase() + folderName.slice(1)}_${firmaId}`;
                } else if (tableId.includes('personel')) {
                    const personelId = tableId.split('_')[1];
                    if (tableId.includes('Ozluk')) {
                        shareButtonId = `#sharePersonelOzluk_${personelId}`;
                    } else if (tableId.includes('Diger')) {
                        shareButtonId = `#sharePersonelDiger_${personelId}`;
                    } else if (tableId.includes('KisiselAlan')) {
                        shareButtonId = `#sharePersonelKisiselAlan_${personelId}`;
                    }
                } else if (tableId === 'kisiselAlan') {
                    shareButtonId = '#shareKisiselAlan';
                } else if (tableId.includes('subFolders_')) {
                    const folderId = tableId.split('_')[1];
                    shareButtonId = `#shareSubFolders_${folderId}`;
                }
                if (!shareButtonId) {
                    console.warn(`Paylaşım butonu ID'si hesaplanamadı: tableId=${tableId}`);
                    return;
                }
                const checkedCount = $target.find('.dokuman-checkbox:checked').length;
                $(shareButtonId).toggle(checkedCount > 0);
                console.log(`Paylaşım butonu durumu: ${shareButtonId}, checkedCount=${checkedCount}, refTableName=${refTableName}, refId=${refId}, dokumanTuru=${dokumanTuru}`);
            });
        } else {
            console.error(`Sunucu hatası: ${response.message || 'Dokümanlar yüklenirken hata oluştu'}, response.success: ${response.success}, response.dokumanlar: ${response.dokumanlar}`);
            Swal.fire({
                icon: 'error',
                title: window.translations.Error,
                text: response.message || window.translations.ErrorLoadingDocuments,
                confirmButtonText: window.translations.OK
            });
            $target.empty();
            $emptyDiv.show();
            $emptyDiv.find('p').text(response.message || 'Doküman bulunamadı');
        }
    } catch (error) {
        console.error("loadDokumanlar Error:", error);
        Swal.fire({
            icon: 'error',
            title: window.translations.Error,
            text: `${window.translations.ErrorLoadingDocuments} ${error.message}`,
            confirmButtonText: window.translations.OK
        });
        const $target = $(targetElement);
        const $emptyDiv = $(`${targetElement}Empty`);
        $target.empty();
        $emptyDiv.show();
        $emptyDiv.find('p').text(window.translations.NoDocumentFound);
    } finally {
        // Lock'i temizle (5sn sonra otomatik)
        setTimeout(() => loadLocks.delete(lockKey), 5000);
    }
}

export async function deleteDokuman(dokumanId, dosyaYolu, refTableName, refId, targetElement, dokumanTuru, klasorYolu = '') {
    klasorYolu = String(klasorYolu);
    console.log(`deleteDokuman çağrıldı: dokumanId=${dokumanId}, dosyaYolu=${dosyaYolu}, refTableName=${refTableName}, refId=${refId}, targetElement=${targetElement}, dokumanTuru=${dokumanTuru}, klasorYolu=${klasorYolu}, currentManualSection=${currentManualSection}, userRole=${window.userRole}`);
    if (!$(targetElement).length) {
        console.error(`Hata: targetElement bulunamadı: ${targetElement}`);
        Swal.fire({
            icon: 'error',
            title: window.translations.Error,
            text: `${window.translations.TargetTableNotFound}: ${targetElement}`,
            confirmButtonText: window.translations.OK
        });
        return;
    }
    if (!dokumanId || !dosyaYolu || !refTableName || !refId) {
        console.error(`Hata: Eksik parametreler: dokumanId=${dokumanId}, dosyaYolu=${dosyaYolu}, refTableName=${refTableName}, refId=${refId}`);
        Swal.fire({
            icon: 'error',
            title: window.translations.Error,
            text: window.translations.InvalidParameters,
            confirmButtonText: window.translations.OK
        });
        return;
    }
    Swal.fire({
        title: window.translations.DeleteDocument,
        text: window.translations.ConfirmDeleteDocument,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: window.translations.YesDelete,
        cancelButtonText: window.translations.No
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await $.ajax({
                    url: '/Dokuman/DeleteDokuman',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        DokumanId: dokumanId,
                        DosyaYolu: dosyaYolu
                    })
                });
                if (response.success) {
                    Swal.fire({
                        icon: 'success',
                        title: window.translations.Success,
                        text: window.translations.DocumentDeletedSuccessfully,
                        confirmButtonText: window.translations.OK
                    }).then(() => {
                        console.log(`Doküman silindi, liste güncelleniyor: ${targetElement}`);
                        if (dokumanTuru === 'Manuel') {
                            let mainTarget;
                            if (refTableName === 'Kullanicilar' && window.userRole !== 'OSGB' && window.userRole !== 'İşveren') {
                                mainTarget = '#manualFolders_kisisel';
                            } else if (refTableName === 'Firmalar' && currentManualSection !== 'firmam') {
                                mainTarget = `#manualFolders_firma_${refId}`;
                            } else if (refTableName === 'Kullanicilar') {
                                mainTarget = `#manualFolders_personel_${refId}`;
                            } else {
                                mainTarget = `#manualFolders_${currentManualSection || 'firmam'}`;
                            }
                            console.log(`Manuel doküman silme sonrası yenileme: mainTarget=${mainTarget}, refTableName=${refTableName}, refId=${refId}, currentManualSection=${currentManualSection}, userRole=${window.userRole}`);
                            refreshFolderStructure(refTableName, refId, mainTarget, true);
                        } else {
                            loadDokumanlar(refTableName, parseInt(refId), targetElement, dokumanTuru, true);
                        }
                    });
                } else {
                    console.error(`Sunucu hatası: ${response.message}`);
                    Swal.fire({
                        icon: 'error',
                        title: window.translations.Error,
                        text: response.message || window.translations.ErrorDeletingDocument,
                        confirmButtonText: window.translations.OK
                    });
                }
            } catch (error) {
                console.error("deleteDokuman Error:", error);
                Swal.fire({
                    icon: 'error',
                    title: window.translations.Error,
                    text: `${window.translations.ErrorDeletingDocument}: ${error.message}`,
                    confirmButtonText: window.translations.OK
                });
            }
        }
    });
}

export function toggleSelectAll(tableId) {
    const isChecked = $(`#selectAll${tableId.replace(/^(firmam|firma_|personel|kisisel|subFolders_)/, '').replace(/_\d+/, '')}${tableId.includes('_') ? '_' + tableId.split('_')[1] : ''}`).is(':checked');
    $(`#${tableId} .dokuman-checkbox`).prop('checked', isChecked);
    let shareButtonId;
    if (tableId.includes('firmam')) {
        shareButtonId = `#share${tableId.charAt(0).toUpperCase() + tableId.slice(1)}`;
    } else if (tableId.includes('firma_')) {
        const firmaId = tableId.split('_')[1];
        const folderName = tableId.split('_')[0].replace('firma', '');
        shareButtonId = `#shareFirma${folderName.charAt(0).toUpperCase() + folderName.slice(1)}_${firmaId}`;
    } else if (tableId.includes('personel')) {
        const personelId = tableId.split('_')[1];
        if (tableId.includes('Ozluk')) {
            shareButtonId = `#sharePersonelOzluk_${personelId}`;
        } else if (tableId.includes('Diger')) {
            shareButtonId = `#sharePersonelDiger_${personelId}`;
        } else if (tableId.includes('KisiselAlan')) {
            shareButtonId = `#sharePersonelKisiselAlan_${personelId}`;
        }
    } else if (tableId === 'kisiselAlan') {
        shareButtonId = '#shareKisiselAlan';
    } else if (tableId.includes('subFolders_')) {
        const folderId = tableId.split('_')[1];
        shareButtonId = `#shareSubFolders_${folderId}`;
    }
    if (!shareButtonId) {
        console.warn(`Paylaşım butonu ID'si hesaplanamadı: tableId=${tableId}`);
        return;
    }
    $(shareButtonId).toggle(isChecked);
    console.log(`toggleSelectAll: shareButtonId=${shareButtonId}, isChecked=${isChecked}`);
}

export function setupDocumentUpload() {
    $('#dokumanYukleForm').off('submit').on('submit', function (e) {
        e.preventDefault();
        const refTableName = $('#refTableName').val();
        const refId = $('#refId').val();
        let dokumanTuru = $('#dokumanTuru').val();
        const aciklama = $('#aciklama').val() || '';
        const customFolderPath = String($('#customFolderPath').val() || currentCustomFolderPath);
        console.log(`Submit öncesi customFolderPath kontrolü: ${customFolderPath || 'BOŞ'}`);
        console.log(`Form verileri: refTableName=${refTableName}, refId=${refId}, dokumanTuru=${dokumanTuru}, aciklama=${aciklama}, customFolderPath=${customFolderPath || 'BOŞ'}, currentManualSection=${currentManualSection}, userRole=${window.userRole}`);
        const files = $('#dosya')[0].files;
        if (!files || files.length === 0) {
            Swal.fire({
                icon: 'error',
                title: window.translations.Error,
                text: window.translations.SelectAtLeastOneFile,
                confirmButtonText: window.translations.OK
            });
            return;
        }
        if (!refTableName || !refId || !dokumanTuru) {
            Swal.fire({
                icon: 'error',
                title: window.translations.Error,
                text: window.translations.MissingFormParameters,
                confirmButtonText: window.translations.OK
            });
            console.error("Form parametreleri eksik:", { refTableName, refId, dokumanTuru, aciklama, customFolderPath });
            return;
        }
        if (dokumanTuru === 'Manuel' && !customFolderPath) {
            console.error('Manuel yükleme için customFolderPath eksik!');
            Swal.fire({
                icon: 'error',
                title: window.translations.Error,
                text: window.translations.ManualFolderPathRequired,
                confirmButtonText: window.translations.OK
            });
            return;
        }
        // YENİ: Manuel path validation (geçersiz karakterler)
        if (dokumanTuru === 'Manuel' && customFolderPath) {
            const invalidCharsRegex = /[:*?"<>|]/;
            if (invalidCharsRegex.test(customFolderPath)) {
                Swal.fire({
                    icon: 'error',
                    title: window.translations.Error,
                    text: window.translations.InvalidFolderPathCharacters,
                    confirmButtonText: window.translations.OK
                });
                return;
            }
        }
        if (refTableName === 'Kullanicilar' && dokumanTuru === 'KisiselAlanKullanici') {
            dokumanTuru = 'KisiselAlan';
        }
        const dokumanYukleModalElement = document.getElementById('dokumanYukleModal');
        const dokumanYukleModal = bootstrap.Modal.getInstance(dokumanYukleModalElement);
        if (dokumanYukleModal) {
            dokumanYukleModal.hide();
        } else {
            console.warn("DokumanYukleModal bulunamadı, manuel kapatılıyor.");
            dokumanYukleModalElement.classList.remove('show');
            dokumanYukleModalElement.style.display = 'none';
            document.body.classList.remove('modal-open');
            const modalBackdrop = document.querySelector('.modal-backdrop');
            if (modalBackdrop) modalBackdrop.remove();
        }
        Array.from(files).forEach(file => {
            const maxFileSize = 500 * 1024 * 1024;
            if (file.size > maxFileSize) {
                Swal.fire({
                    icon: 'error',
                    title: window.translations.Error,
                    text: `${window.translations.FileSizeTooLarge}: ${file.name}. ${window.translations.MaxFileSize}`,
                    confirmButtonText: window.translations.OK
                });
                return;
            }
            if (!file || !file.name || file.size === 0) {
                Swal.fire({
                    icon: 'error',
                    title: window.translations.Error,
                    text: `${window.translations.InvalidFile}: ${file.name || window.translations.UnknownFile}`,
                    confirmButtonText: window.translations.OK
                });
                return;
            }
            updateUploadProgress(file.name, 0, window.translations.Uploading);
            console.log(`Yükleme Başlıyor - Dosya Adı: ${file.name}, Boyut: ${file.size} bytes, Tür: ${file.type}`);
            const formData = new FormData();
            formData.append('dosya', file);
            formData.append('refTableName', refTableName);
            formData.append('refId', refId.toString());
            formData.append('dokumanTuru', dokumanTuru);
            formData.append('aciklama', aciklama);
            // Global dosya adlandırma tercihi ekle
            const useOriginalName = localStorage.getItem('globalUseOriginalName') === 'true';
            formData.append('useOriginalName', useOriginalName.toString());
            console.log(`Global dosya adlandırma tercihi eklendi: ${useOriginalName ? 'true' : 'false'}`);
            if (dokumanTuru === 'Manuel') {
                formData.append('customFolderPath', customFolderPath);
                console.log(`Manuel yükleme - customFolderPath=${customFolderPath} FormData'ya eklendi.`);
            }
            for (let [key, value] of formData.entries()) {
                console.log(`FormData - ${key}: ${value}`);
            }
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/Dokuman/DokumanYukle', true);
            showUploadProgressWindow();
            xhr.upload.onprogress = function (e) {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    updateUploadProgress(file.name, percentComplete, `${window.translations.Uploading}: ${percentComplete}%`);
                    console.log(`Yükleme İlerlemesi - ${file.name}: ${percentComplete}%`);
                } else {
                    updateUploadProgress(file.name, 0, window.translations.ProgressNotCalculable);
                    console.warn("İlerleme hesaplanamıyor: Content-Length başlığı eksik olabilir.");
                }
            };
            xhr.upload.onloadstart = function () {
                console.log(`Yükleme Başladı - Dosya: ${file.name}`);
                updateUploadProgress(file.name, 0, window.translations.Uploading);
            };
            xhr.upload.onloadend = function () {
                console.log(`Yükleme Bitti - Dosya: ${file.name}`);
            };
            xhr.onload = function () {
                console.log(`Sunucu Yanıtı Alındı - Status: ${xhr.status}, Response: ${xhr.responseText}`);
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            updateUploadProgress(file.name, 100, window.translations.Uploaded);
                            Swal.fire({
                                icon: 'success',
                                title: window.translations.Success,
                                text: response.message, // Backend'den gelen localize mesaj
                                confirmButtonText: window.translations.OK
                            }).then(() => {
                                $('#dokumanYukleForm').find('input:not(#customFolderPath), textarea').val('');
                                let targetElement;
                                let loadDokumanTuru = dokumanTuru;
                                let forceAccordionOpen = true;
                                if (refTableName === 'Firmalar' && dokumanTuru === 'Odemeler') {
                                    loadDokumanTuru = 'Odemeler';
                                    targetElement = currentManualSection === 'firmam' ? '#firmamOdemeler' : `#firmaOdemeler_${refId}`;
                                } else if (refTableName === 'Firmalar' && dokumanTuru === 'Etkinlikler') {
                                    loadDokumanTuru = 'Etkinlikler';
                                    targetElement = currentManualSection === 'firmam' ? '#firmamEtkinlikler' : `#firmaEtkinlikler_${refId}`;
                                } else if (refTableName === 'Sozlesmeler' && dokumanTuru === 'FirmaSozlesmeleri') {
                                    loadDokumanTuru = 'FirmaSozlesmeleri';
                                    targetElement = currentManualSection === 'firmam' ? '#firmamSozlesmeler' : `#firmaSozlesmeler_${refId}`;
                                } else if (refTableName === 'EgitimTuruMateryalleri' && dokumanTuru === 'EgitimDokumanlari') {
                                    loadDokumanTuru = 'EgitimDokumanlari';
                                    targetElement = currentManualSection === 'firmam' ? '#firmamEgitimler' : `#firmaEgitimler_${refId}`;
                                } else if (refTableName === 'Firmalar' && dokumanTuru === 'Diger') {
                                    loadDokumanTuru = 'Diger';
                                    targetElement = currentManualSection === 'firmam' ? '#firmamDiger' : `#firmaDiger_${refId}`;
                                } else if (refTableName === 'Firmalar' && dokumanTuru === 'KisiselAlan') {
                                    loadDokumanTuru = 'KisiselAlan';
                                    targetElement = currentManualSection === 'firmam' ? '#firmamKisiselAlan' : `#firmaKisiselAlan_${refId}`;
                                } else if (refTableName === 'Kullanicilar' && dokumanTuru === 'Ozluk') {
                                    loadDokumanTuru = 'Ozluk';
                                    targetElement = `#personelOzluk_${refId}`;
                                } else if (refTableName === 'Kullanicilar' && dokumanTuru === 'Diger') {
                                    loadDokumanTuru = 'Diger';
                                    targetElement = `#personelDiger_${refId}`;
                                } else if (refTableName === 'Kullanicilar' && dokumanTuru === 'KisiselAlan') {
                                    loadDokumanTuru = 'KisiselAlan';
                                    // YENİ: Personellerim sub-tab ayrımı (currentManualSection 'personellerim' ise personel target)
                                    if (currentManualSection === 'personellerim' || currentManualSection.startsWith('personel_')) {
                                        targetElement = `#personelKisiselAlan_${refId}`;
                                    } else {
                                        targetElement = currentManualSection === 'firmam' || currentManualSection === 'kisisel' ? '#kisiselAlan' : `#personelKisiselAlan_${refId}`;
                                    }
                                } else if (dokumanTuru === 'Manuel') {
                                    loadDokumanTuru = 'Manuel';
                                    if (refTableName === 'Kullanicilar' && window.userRole !== 'OSGB' && window.userRole !== 'İşveren') {
                                        targetElement = '#manualFolders_kisisel';
                                    } else if (refTableName === 'Firmalar' && currentManualSection !== 'firmam') {
                                        targetElement = `#manualFolders_firma_${refId}`;
                                    } else if (refTableName === 'Kullanicilar') {
                                        targetElement = `#manualFolders_personel_${refId}`;
                                    } else {
                                        targetElement = `#manualFolders_${currentManualSection || 'firmam'}`;
                                    }
                                    console.log(`Yükleme sonrası yenileme: targetElement=${targetElement}, refTableName=${refTableName}, refId=${refId}, currentManualSection=${currentManualSection}, userRole=${window.userRole}`);
                                    refreshFolderStructure(refTableName, refId, targetElement, true);
                                    return;
                                } else {
                                    console.warn(`Bilinmeyen refTableName veya dokumanTuru: ${refTableName}, ${dokumanTuru}`);
                                    return;
                                }
                                if (targetElement) {
                                    console.log(`Tablo güncelleniyor: targetElement=${targetElement}, loadDokumanTuru=${loadDokumanTuru}, customFolderPath=${customFolderPath}`);
                                    loadDokumanlar(refTableName, parseInt(refId), targetElement, loadDokumanTuru, forceAccordionOpen);
                                } else {
                                    console.error(`Hedef tablo belirlenemedi: refTableName=${refTableName}, dokumanTuru=${dokumanTuru}, refId=${refId}`);
                                    Swal.fire({
                                        icon: 'error',
                                        title: window.translations.Error,
                                        text: window.translations.TargetTableNotFound,
                                        confirmButtonText: window.translations.OK
                                    });
                                }
                            });
                        } else {
                            updateUploadProgress(file.name, 0, `${window.translations.Error}: ${response.message}`);
                            Swal.fire({
                                icon: 'error',
                                title: window.translations.Error,
                                text: response.message, // Backend'den gelen localize mesaj
                                confirmButtonText: window.translations.OK
                            });
                        }
                    } catch (error) {
                        updateUploadProgress(file.name, 0, window.translations.InvalidServerResponse);
                        Swal.fire({
                            icon: 'error',
                            title: window.translations.Error,
                            text: `${window.translations.ErrorProcessingServerResponse}: ${error.message}`,
                            confirmButtonText: window.translations.OK
                        });
                    }
                } else {
                    updateUploadProgress(file.name, 0, `${window.translations.Error}: ${xhr.statusText} (${xhr.status})`);
                    Swal.fire({
                        icon: 'error',
                        title: window.translations.Error,
                        text: `${window.translations.FileUploadError}: ${xhr.statusText}`,
                        confirmButtonText: window.translations.OK
                    });
                }
            };
            xhr.onerror = function () {
                console.error(`Yükleme Hatası - Dosya: ${file.name}, Hata: ${xhr.statusText}`);
                updateUploadProgress(file.name, 0, window.translations.ConnectionError);
                Swal.fire({
                    icon: 'error',
                    title: window.translations.Error,
                    text: window.translations.FileUploadConnectionError,
                    confirmButtonText: window.translations.OK
                });
            };
            xhr.onabort = function () {
                console.log(`Yükleme İptal Edildi - Dosya: ${file.name}`);
                updateUploadProgress(file.name, 0, window.translations.UploadCanceled);
                Swal.fire({
                    icon: 'warning',
                    title: window.translations.Canceled,
                    text: window.translations.FileUploadCanceled,
                    confirmButtonText: window.translations.OK
                });
            };
            xhr.send(formData);
        });
    });
}

export function openDokumanYukleModal(refTableName, refId, dokumanTuru, customPath = '') {
    console.log(`openDokumanYukleModal çağrıldı: refTableName=${refTableName}, refId=${refId}, dokumanTuru=${dokumanTuru}, customPath=${customPath || 'BOŞ'}, currentManualSection=${currentManualSection}`);
    currentCustomFolderPath = String(customPath).trim();
    if (!$('#customFolderPath').length) {
        console.error('Hata: #customFolderPath inputu DOM\'da bulunamadı!');
        Swal.fire({
            icon: 'error',
            title: 'Hata',
            text: 'Formda customFolderPath inputu eksik. Lütfen sayfayı kontrol edin.',
            confirmButtonText: 'Tamam'
        });
        return;
    }
    const focusableElements = document.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusableElements.forEach(el => {
        if (!document.getElementById('dokumanYukleModal').contains(el)) {
            el.setAttribute('inert', '');
        }
    });
    $('#refTableName').val(refTableName);
    $('#refId').val(refId);
    $('#dokumanTuru').val(dokumanTuru);
    $('#dosya').val('');
    $('#aciklama').val('');
    if (dokumanTuru === 'Manuel') {
        $('#customFolderPath').val(currentCustomFolderPath).attr('data-folder-path', currentCustomFolderPath);
        console.log(`openDokumanYukleModal: Manuel - customFolderPath set edildi = ${currentCustomFolderPath}, Okunan değer = ${$('#customFolderPath').val()}, Data attribute = ${$('#customFolderPath').attr('data-folder-path')}`);
    } else {
        $('#customFolderPath').val('').attr('data-folder-path', '');
        currentCustomFolderPath = '';
        console.log('openDokumanYukleModal: Manuel değil, customFolderPath sıfırlandı.');
    }
    $('#dokumanYukleModal').off('show.bs.modal').on('show.bs.modal', function () {
        console.log('show.bs.modal eventi tetiklendi!');
        if (dokumanTuru === 'Manuel') {
            $('#customFolderPath').val(currentCustomFolderPath).attr('data-folder-path', currentCustomFolderPath);
            console.log(`show.bs.modal: customFolderPath set edildi = ${currentCustomFolderPath}, Okunan değer = ${$('#customFolderPath').val()}, Data attribute = ${$('#customFolderPath').attr('data-folder-path')}`);
        }
    });
    $('#dokumanYukleModal').off('shown.bs.modal').on('shown.bs.modal', function () {
        console.log('shown.bs.modal eventi tetiklendi!');
        if (dokumanTuru === 'Manuel') {
            $('#customFolderPath').val(currentCustomFolderPath).attr('data-folder-path', currentCustomFolderPath);
            const setValue = $('#customFolderPath').val();
            console.log(`shown.bs.modal: customFolderPath zorla set edildi = ${currentCustomFolderPath}, Okunan değer = ${setValue}, Data attribute = ${$('#customFolderPath').attr('data-folder-path')}`);
            if (!setValue) {
                console.warn('customFolderPath modal açıldığında boş! Global değişkenden tekrar set ediliyor.');
                $('#customFolderPath').val(currentCustomFolderPath).attr('data-folder-path', currentCustomFolderPath);
            }
        }
        $('#dokumanYukleModal').find('input:visible:first').focus();
    });
    $('#dokumanYukleModal').off('hidden.bs.modal').on('hidden.bs.modal', function () {
        console.log('dokumanYukleModal hidden.bs.modal eventi tetiklendi, form sıfırlanıyor.');
        $('#dokumanYukleForm').find('input:not(#customFolderPath), textarea').val('');
        if (dokumanTuru !== 'Manuel') {
            $('#customFolderPath').val('').attr('data-folder-path', '');
            currentCustomFolderPath = '';
        }
        focusableElements.forEach(el => {
            el.removeAttribute('inert');
        });
    });
    console.log(`Modal açılmadan önce: #customFolderPath = ${$('#customFolderPath').length ? 'Var' : 'Yok'}, value = ${$('#customFolderPath').val()}, data-folder-path = ${$('#customFolderPath').attr('data-folder-path')}`);
    $('#dokumanYukleModal').modal('show');
}

// Global export for view ve diğer modüller
window.loadDokumanlar = loadDokumanlar;
window.deleteDokuman = deleteDokuman;
window.toggleSelectAll = toggleSelectAll;
window.setupDocumentUpload = setupDocumentUpload;
window.openDokumanYukleModal = openDokumanYukleModal;