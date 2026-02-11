import { loadDokumanlar, deleteDokuman } from './documentManager.js';
import { openYukleModal, odaklanManualFolder, geriDonManual, currentManualSection } from './uiManager.js';
import { setupInlineRename } from './renameManager.js';

// Basit ve güvenilir bir ID üretici
export function simpleHash(str, refTableName, refId) {
    str = String(str); // Her zaman string'e dönüştür
    if (!str) {
        console.warn('simpleHash: Boş string, "root" döndürülüyor');
        return 'root';
    }
    // Sekme bazında benzersiz ID için refTableName ve refId ekle
    const combinedStr = `${refTableName}_${refId}_${str}`;
    let hash = 0;
    for (let i = 0; i < combinedStr.length; i++) {
        const char = combinedStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    const result = Math.abs(hash).toString(36);
    console.log(`simpleHash: input=${combinedStr}, output=${result}`);
    return result;
}

export function openCreateFolderModal(refTableName, refId, parentPath = '') {
    console.log(`openCreateFolderModal: refTableName=${refTableName}, refId=${refId}, parentPath=${parentPath}, currentManualSection=${currentManualSection}`);
    $('#folderRefTableName').val(refTableName);
    $('#folderRefId').val(refId);
    const initialPath = parentPath ? `${parentPath}/` : '';
    $('#customFolderPath').val(initialPath);
    console.log(`Modal açıldı, başlangıç customFolderPath: ${initialPath}`);
    $('#createFolderModal').modal('show').on('shown.bs.modal', function () {
        $('#customFolderPath').focus();
        console.log('Modal tamamen açıldı, input odaklandı.');
    });
    $('#createFolderForm').off('submit').on('submit', function (e) {
        e.preventDefault();
        const formData = $(this).serializeArray();
        const refTableNameVal = formData.find(item => item.name === 'refTableName')?.value;
        const refIdVal = parseInt(formData.find(item => item.name === 'refId')?.value, 10);
        let customFolderPath = formData.find(item => item.name === 'customFolderPath')?.value || '';
        console.log(`Submit öncesi customFolderPath: ${customFolderPath}`);
        console.log(`Form Gönderildi: refTableName=${refTableNameVal}, refId=${refIdVal}, customFolderPath=${customFolderPath || 'BOŞ'}, userRole=${window.userRole}`);
        if (!customFolderPath) {
            console.warn('customFolderPath boş - Gönderim engellendi!');
            Swal.fire({
                icon: 'error',
                title: window.translations.Error,
                text: window.translations.FolderPathRequired,
                confirmButtonText: window.translations.OK
            });
            return;
        }
        const invalidCharsRegex = /[:*?"<>|]/;
        if (invalidCharsRegex.test(customFolderPath)) {
            console.warn(`Geçersiz karakter bulundu: ${customFolderPath}`);
            Swal.fire({
                icon: 'error',
                title: window.translations.Error,
                text: window.translations.InvalidFolderPathCharacters,
                confirmButtonText: window.translations.OK
            });
            return;
        }
        // Fix: Eğer parentPath varsa ve customFolderPath parentPath/ ile başlamıyorsa, prepend et
        if (parentPath && !customFolderPath.startsWith(`${parentPath}/`)) {
            customFolderPath = `${parentPath}/${customFolderPath}`;
            console.log(`Parent path prepend edildi: yeni customFolderPath=${customFolderPath}`);
        }
        // Dinamik targetElement seçimi
        let targetElement;
        if (refTableNameVal === 'Kullanicilar' && window.userRole !== 'OSGB' && window.userRole !== 'İşveren') {
            targetElement = '#manualFolders_kisisel';
        } else if (refTableNameVal === 'Firmalar' && currentManualSection !== 'firmam') {
            targetElement = `#manualFolders_firma_${refIdVal}`;
        } else if (refTableNameVal === 'Kullanicilar') {
            targetElement = `#manualFolders_personel_${refIdVal}`;
        } else {
            targetElement = `#manualFolders_${currentManualSection || 'firmam'}`;
        }
        console.log(`Hedef element belirlendi: ${targetElement}`);
        const data = {
            RefTableName: String(refTableNameVal),
            RefId: refIdVal,
            CustomFolderPath: String(customFolderPath),
            __RequestVerificationToken: $('input[name="__RequestVerificationToken"]').val()
        };
        $.ajax({
            url: '/Dokuman/CreateManualFolder',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            beforeSend: function (xhr) {
                console.log('AJAX isteği gönderiliyor: ', JSON.stringify(data));
                xhr.setRequestHeader('RequestVerificationToken', data.__RequestVerificationToken);
            },
            success: function (response) {
                console.log(`Klasör Oluşturma Başarılı: ${JSON.stringify(response)}`);
                if (response.success) {
                    Swal.fire({
                        icon: 'success',
                        title: window.translations.Success,
                        text: response.message || window.translations.FolderCreatedSuccessfully,
                        confirmButtonText: window.translations.OK
                    });
                    $('#createFolderModal').modal('hide');
                    console.log(`Yenileme çağrılıyor: target=${targetElement}`);
                    refreshFolderStructure(refTableNameVal, refIdVal, targetElement, true); // preserveState: true
                } else {
                    console.error(`Klasör Oluşturma Hatası: ${response.message}`);
                    Swal.fire({
                        icon: 'error',
                        title: window.translations.Error,
                        text: response.message || window.translations.ErrorCreatingFolder,
                        confirmButtonText: window.translations.OK
                    });
                }
            },
            error: function (xhr, status, error) {
                console.error(`Klasör Oluşturma AJAX Hatası: status=${status}, error=${error}, response=${xhr.responseText}`);
                Swal.fire({
                    icon: 'error',
                    title: window.translations.Error,
                    text: window.translations.ErrorCreatingFolder + ' ' + error,
                    confirmButtonText: window.translations.OK
                });
            }
        });
    });
}

$(document).on('input', '#customFolderPath', function () {
    const currentValue = $(this).val();
    console.log(`customFolderPath giriş: mevcut değer = ${currentValue}`);
    if (currentValue.length > 0) {
        const lastChar = currentValue.slice(-1);
        console.log(`Son eklenen karakter: ${lastChar}`);
    }
});

export async function refreshFolderStructure(refTableName, refId, targetElement, preserveState = false) {
    console.log(`refreshFolderStructure: refTableName=${refTableName}, refId=${refId}, targetElement=${targetElement}, preserveState=${preserveState}, currentManualSection=${currentManualSection}, userRole=${window.userRole}`);
    // Hedef elementin varlığını kontrol et
    if (!$(targetElement).length) {
        console.error(`Hata: targetElement bulunamadı: ${targetElement}`);
        Swal.fire({
            icon: 'error',
            title: window.translations.Error,
            text: `${window.translations.TargetElementNotFound}: ${targetElement}`,
            confirmButtonText: window.translations.OK
        });
        return;
    }
    // Mevcut accordion durumlarını kaydet
    let stateMap = new Map();
    if (preserveState) {
        $(targetElement).find('.accordion-collapse').each(function () {
            const collapseId = $(this).attr('id');
            const isShown = $(this).hasClass('show');
            stateMap.set(collapseId, isShown);
            console.log(`State kaydedildi: ${collapseId} = ${isShown ? 'açık' : 'kapalı'}`);
        });
    }
    try {
        const response = await $.ajax({
            url: '/Dokuman/GetFolderStructure',
            type: 'GET',
            data: { refTableName, refId },
            cache: false // Önbelleği devre dışı bırak
        });
        console.log(`GetFolderStructure Başarılı: ${JSON.stringify(response)}`);
        if (response.success) {
            // DOM'u tamamen temizle
            $(targetElement).empty();
            if (response.structure.folders.length === 0 && response.structure.files.length === 0) {
                console.log(`Klasör yapısı boş, render edilmiyor: ${targetElement}`);
                $(targetElement).html(`<p>${window.translations.NoManualFoldersOrFiles}</p>`);
            } else {
                console.log(`Klasör yapısı render ediliyor: folders=${response.structure.folders.length}, files=${response.structure.files.length}`);
                let html = '';
                response.structure.folders.forEach((subFolder, index) => {
                    html += generateFolderHtml(subFolder, refTableName, refId, '', index);
                });
                // DOM'a HTML'yi ekle
                $(targetElement).html(html);
                // Alt klasörleri render et
                response.structure.folders.forEach((subFolder, index) => {
                    const fullPath = subFolder.name;
                    const folderId = simpleHash(fullPath + '_' + index, refTableName, refId);
                    renderSubFolders(subFolder, `#subFolders_${folderId}`, refTableName, refId, fullPath);
                });
                // Accordion durumlarını geri yükle
                if (preserveState) {
                    stateMap.forEach((isShown, collapseId) => {
                        const $collapse = $(`#${collapseId}`);
                        const $button = $collapse.prev('.accordion-header').find('.accordion-button');
                        if ($collapse.length && $button.length) {
                            // Mevcut durumu sıfırla
                            $collapse.removeClass('show');
                            $button.addClass('collapsed').attr('aria-expanded', 'false');
                            if (isShown) {
                                // Açık olması gerekiyorsa, durumu geri yükle
                                $collapse.addClass('show');
                                $button.removeClass('collapsed').attr('aria-expanded', 'true');
                                console.log(`State geri yüklendi: ${collapseId} açıldı`);
                            } else {
                                console.log(`State geri yüklendi: ${collapseId} kapatıldı`);
                            }
                        } else {
                            console.log(`State geri yüklenemedi: ${collapseId} bulunamadı`);
                        }
                    });
                    // Bootstrap accordion olaylarını yeniden başlat
                    $(targetElement).find('.accordion-collapse').each(function () {
                        const $collapse = $(this);
                        const collapseId = $collapse.attr('id');
                        if (!stateMap.has(collapseId)) {
                            // Yeni oluşturulan accordion'lar kapalı olmalı
                            $collapse.removeClass('show');
                            $collapse.prev('.accordion-header').find('.accordion-button').addClass('collapsed').attr('aria-expanded', 'false');
                            console.log(`Yeni accordion kapatıldı: ${collapseId}`);
                        }
                    });
                } else {
                    // preserveState=false ise tüm accordion'lar kapalı başlasın
                    $(targetElement).find('.accordion-collapse').removeClass('show');
                    $(targetElement).find('.accordion-button').addClass('collapsed').attr('aria-expanded', 'false');
                    console.log(`preserveState=false, tüm accordion'lar kapatıldı`);
                }
                // Olay dinleyicilerini yeniden bağla
                $(targetElement).find('.delete-dokuman-btn').off('click').on('click', function () {
                    const dokumanId = $(this).data('dokuman-id');
                    const dosyaYolu = $(this).data('dosya-yolu');
                    const klasorYolu = $(this).data('klasor-yolu') || '';
                    const folderId = simpleHash(klasorYolu + '_' + '0', refTableName, refId);
                    let target = `#subFolders_${folderId}`;
                    if ($(target).length === 0) {
                        console.warn(`Hedef element bulunamadı: ${target}, fallback to parent: ${targetElement}`);
                        target = targetElement;
                    }
                    deleteDokuman(dokumanId, dosyaYolu, refTableName, refId, target, 'Manuel', klasorYolu);
                });
                $(targetElement).find('.editable-file-name').each(function () {
                    setupInlineRename($(this), refTableName, refId, targetElement, 'Manuel');
                });
                $(targetElement).find('.editable-folder-name').each(function () {
                    setupInlineFolderRename($(this), refTableName, refId, targetElement);
                });
                $(targetElement).find('.accordion-button').off('click').on('click', function () {
                    const $button = $(this);
                    const folderName = $button.text().trim().replace(/<i[^>]*>.*<\/i>/, '');
                    const folderId = $button.closest('.accordion-item').attr('id').split('_')[1];
                    const parentPath = $button.closest('.accordion-item').data('parent-path') || '';
                    odaklanManualFolder(folderId, folderName, parentPath);
                });
                // Yeni: .dokuman-checkbox için paylaşım butonu olay dinleyicisi
                $(targetElement).find('.dokuman-checkbox').off('change').on('change', function () {
                    const $accordionItem = $(this).closest('.accordion-item');
                    const folderId = $accordionItem.attr('id').split('_')[1]; // folder_${folderId}
                    const tableId = `subFolders_${folderId}`;
                    const shareButtonId = `#shareSubFolders_${folderId}`;
                    // Checkbox'ların varlığını ve durumunu kontrol et
                    const $checkboxes = $accordionItem.find('.table-responsive.files-table .dokuman-checkbox');
                    const checkedCount = $checkboxes.filter(':checked').length;
                    console.log(`Checkbox kontrolü: tableId=${tableId}, toplam checkbox=${$checkboxes.length}, seçili checkbox=${checkedCount}`);
                    // Paylaşım butonunun varlığını kontrol et
                    console.log(`Paylaşım butonu kontrolü: ${shareButtonId} var mı? ${$(shareButtonId).length ? 'Var' : 'Yok'}`);
                    // Checkbox'ların durumunu detaylı logla
                    $checkboxes.each(function () {
                        console.log(`Checkbox: value=${$(this).val()}, checked=${$(this).is(':checked')}`);
                    });
                    $(shareButtonId).toggle(checkedCount > 0);
                    console.log(`Paylaşım butonu durumu: ${shareButtonId}, checkedCount=${checkedCount}, refTableName=${refTableName}, refId=${refId}, dokumanTuru=Manuel`);
                });
                // DOM render'ını garantile
                requestAnimationFrame(() => {
                    console.log(`DOM render edildi: ${targetElement}`);
                    // Tarayıcıya render için zaman tanı
                    setTimeout(() => {
                        $(targetElement).trigger('refreshComplete');
                    }, 0);
                });
            }
        } else {
            console.error(`GetFolderStructure Hatası: ${response.message}`);
            Swal.fire({
                icon: 'error',
                title: window.translations.Error,
                text: response.message,
                confirmButtonText: window.translations.OK
            });
            $(targetElement).html('<p>' + window.translations.ErrorLoadingFolderStructure + '</p>');
        }
    } catch (error) {
        console.error(`GetFolderStructure AJAX Hatası: error=${error.message}`);
        Swal.fire({
            icon: 'error',
            title: window.translations.Error,
            text: window.translations.ErrorLoadingFolderStructure + ' ' + error.message,
            confirmButtonText: window.translations.OK
        });
        $(targetElement).html('<p>' + window.translations.ErrorLoadingFolderStructure + '</p>');
    }
}

// Folder HTML generate (subfolder için recursive)
function generateFolderHtml(folder, refTableName, refId, parentPath, index) {
    const fullPath = parentPath ? `${parentPath}/${folder.name}` : folder.name;
    const folderId = simpleHash(fullPath + '_' + index, refTableName, refId);
    const currentParentPath = parentPath ? parentPath : '';
    let html = `
        <div class="accordion-item" id="folder_${folderId}" data-parent-path="${currentParentPath}" data-full-path="${fullPath}">
            <h2 class="accordion-header" id="folderHeading_${folderId}">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#folderCollapse_${folderId}" aria-expanded="false" aria-controls="folderCollapse_${folderId}">
                    <i class="mdi mdi-folder me-2"></i> <span class="editable-folder-name" data-old-name="${folder.name}" data-full-path="${fullPath}">${folder.name}</span>
                </button>
            </h2>
            <div id="folderCollapse_${folderId}" class="accordion-collapse collapse" aria-labelledby="folderHeading_${folderId}">
                <div class="accordion-body">
                    <div class="float-end mb-3 folder-actions">
                        <button class="btn btn-primary btn-sm waves-effect waves-light share-btn" id="shareSubFolders_${folderId}" onclick="openPaylasimModal('${refTableName}', ${refId}, 'Manuel', 'subFolders_${folderId}')" style="display: none;">
                            <i class="mdi mdi-share font-size-16"></i>
                        </button>
                        <button class="btn btn-primary btn-sm waves-effect waves-light me-2" onclick="openCreateFolderModal('${refTableName}', ${refId}, '${fullPath}')">
                            <i class="mdi mdi-folder-plus me-1"></i> ${window.translations.CreateSubFolder}
                        </button>
                        <button class="btn btn-primary btn-sm waves-effect waves-light me-2" onclick="openYukleModal('${refTableName}', ${refId}, 'Manuel', '${fullPath}')">
                            <i class="mdi mdi-plus me-1"></i> ${window.translations.UploadDocument}
                        </button>
                        <button class="btn btn-danger btn-sm waves-effect waves-light" onclick="deleteManualFolder('${refTableName}', ${refId}, '${fullPath}')">
                            <i class="mdi mdi-trash-can me-1"></i> ${window.translations.DeleteFolder}
                        </button>
                    </div>
                    <div class="clearfix"></div>
                    <div id="subFolders_${folderId}" class="sub-folders accordion mb-3"></div>
                    <div class="table-responsive files-table">
                        <table class="table table-hover table-centered table-nowrap mb-0">
                            <thead>
                                <tr>
                                    <th><input type="checkbox" id="selectAll_${folderId}" onchange="toggleSelectAll('#subFolders_${folderId}')"></th>
                                    <th>${window.translations.FileName}</th>
                                    <th>${window.translations.Type}</th>
                                    <th>${window.translations.UploadDate}</th>
                                    <th>${window.translations.Description}</th>
                                    <th>${window.translations.Actions}</th>
                                </tr>
                            </thead>
                            <tbody>`;
    if (folder.files && folder.files.length > 0) {
        folder.files.forEach(file => {
            console.log(`Dosya işleniyor: ${JSON.stringify(file)}`);
            const klasorYolu = file.klasorYolu || fullPath || '';
            let displayName = file.dosyaAdi;
            const parts = displayName.split('_');
            if (parts.length >= 3) {
                displayName = parts.slice(2).join('_');
            }
            html += `
                <tr>
                    <td><input type="checkbox" class="dokuman-checkbox" value="${file.dokumanId}"></td>
                    <td class="editable-file-name" data-dokuman-id="${file.dokumanId}" data-current-name="${displayName}">${displayName || '-'}</td>
                    <td>${window.translations.Manuel}</td>
                    <td>${file.yuklemeTarihi || '-'}</td>
                    <td>-</td>
                    <td>
                        <a href="/Dokuman/Indir/?path=${encodeURIComponent(file.encryptedPath)}" class="btn btn-sm btn-info waves-effect waves-light me-1" title="${window.translations.Download}">
                            <i class="fas fa-download"></i>
                        </a>
                        <button class="btn btn-sm btn-danger waves-effect waves-light delete-dokuman-btn"
                                data-dokuman-id="${file.dokumanId}"
                                data-dosya-yolu="${file.dosyaYolu}"
                                data-klasor-yolu="${klasorYolu}"
                                title="${window.translations.Delete}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        });
    } else {
        html += `<tr><td colspan="6">${window.translations.NoFilesYet}</td></tr>`;
    }
    html += `</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    return html;
}

function renderSubFolders(folder, subTarget, refTableName, refId, parentPath) {
    let subHtml = '';
    if (folder.folders && folder.folders.length > 0) {
        folder.folders.forEach((subFolder, index) => {
            subHtml += generateFolderHtml(subFolder, refTableName, refId, parentPath, index);
        });
        $(subTarget).html(subHtml);
        folder.folders.forEach((subFolder, index) => {
            const subFullPath = `${parentPath}/${subFolder.name}`;
            const subFolderId = simpleHash(subFullPath + '_' + index, refTableName, refId);
            renderSubFolders(subFolder, `#subFolders_${subFolderId}`, refTableName, refId, subFullPath);
        });
    } else {
        $(subTarget).html('');
    }
    $(subTarget).find('.sub-folder-actions').show();
    $(subTarget).find('.files-table').show();
    console.log(`renderSubFolders: subTarget=${subTarget}, alt klasör butonları ve tablolar gösterildi`);
}

window.openCreateFolderModal = openCreateFolderModal;
window.refreshFolderStructure = refreshFolderStructure;
window.deleteManualFolder = function (refTableName, refId, folderPath) {
    console.log(`deleteManualFolder: refTableName=${refTableName}, refId=${refId}, folderPath=${folderPath}, userRole=${window.userRole}`);
    // Dinamik targetElement seçimi
    let targetElement;
    if (refTableName === 'Kullanicilar' && window.userRole !== 'OSGB' && window.userRole !== 'İşveren') {
        targetElement = '#manualFolders_kisisel';
    } else if (refTableName === 'Firmalar' && currentManualSection !== 'firmam') {
        targetElement = `#manualFolders_firma_${refId}`;
    } else if (refTableName === 'Kullanicilar') {
        targetElement = `#manualFolders_personel_${refId}`;
    } else {
        targetElement = `#manualFolders_${currentManualSection || 'firmam'}`;
    }
    console.log(`Hedef element belirlendi: ${targetElement}`);
    Swal.fire({
        title: window.translations.Confirm,
        text: `${window.translations.ConfirmDeleteFolder} (${folderPath}) ${window.translations.ConfirmDeleteFolderContents}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: window.translations.YesDelete,
        cancelButtonText: window.translations.Cancel
    }).then((result) => {
        if (result.isConfirmed) {
            const data = {
                RefTableName: String(refTableName),
                RefId: parseInt(refId, 10),
                FolderPath: String(folderPath),
                __RequestVerificationToken: $('input[name="__RequestVerificationToken"]').val()
            };
            $.ajax({
                url: '/Dokuman/DeleteManualFolder',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(data),
                beforeSend: function (xhr) {
                    console.log('AJAX isteği gönderiliyor: ', JSON.stringify(data));
                    xhr.setRequestHeader('RequestVerificationToken', data.__RequestVerificationToken);
                },
                success: function (response) {
                    console.log(`Klasör Silme Başarılı: ${JSON.stringify(response)}`);
                    if (response.success) {
                        Swal.fire({
                            icon: 'success',
                            title: window.translations.Success,
                            text: response.message || window.translations.FolderDeletedSuccessfully,
                            confirmButtonText: window.translations.OK
                        });
                        refreshFolderStructure(refTableName, refId, targetElement, true); // Yenile
                    } else {
                        console.error(`Klasör Silme Hatası: ${response.message}`);
                        Swal.fire({
                            icon: 'error',
                            title: window.translations.Error,
                            text: response.message || window.translations.ErrorDeletingFolder,
                            confirmButtonText: window.translations.OK
                        });
                    }
                },
                error: function (xhr, status, error) {
                    console.error(`Klasör Silme AJAX Hatası: status=${status}, error=${error}, response=${xhr.responseText}`);
                    Swal.fire({
                        icon: 'error',
                        title: window.translations.Error,
                        text: window.translations.ErrorDeletingFolder + ' ' + error,
                        confirmButtonText: window.translations.OK
                    });
                }
            });
        }
    });
};
export function setupInlineFolderRename($element, refTableName, refId, targetElement) {
    $element.off('dblclick').on('dblclick', function () {
        const oldName = String($(this).data('old-name')); // String'e dönüştür
        const fullPath = String($(this).closest('.accordion-item').data('full-path')); // String'e dönüştür
        const $span = $(this);
        const $input = $('<input type="text" class="form-control form-control-sm d-inline-block" style="width: auto;">').val(oldName);
        console.log(`setupInlineFolderRename: oldName=${oldName}, fullPath=${fullPath}`);
        $span.hide().after($input);
        $input.focus().select();
        $input.on('blur keydown', function (e) {
            if (e.type === 'blur' || e.key === 'Enter') {
                let newName = $(this).val().trim();
                console.log(`setupInlineFolderRename: newName=${newName}, oldName=${oldName}, fullPath=${fullPath}`);
                // Boş veya aynı isim kontrolü
                if (!newName) {
                    Swal.fire({
                        icon: 'error',
                        title: window.translations.Error,
                        text: window.translations.FolderNameCannotBeEmpty,
                        confirmButtonText: window.translations.OK
                    });
                    $span.show();
                    $(this).remove();
                    return;
                }
                // Yasaklı karakter kontrolü
                const invalidCharsRegex = /[:*?"<>|]/;
                if (invalidCharsRegex.test(newName)) {
                    Swal.fire({
                        icon: 'error',
                        title: window.translations.Error,
                        text: window.translations.InvalidCharacters,
                        confirmButtonText: window.translations.OK
                    });
                    $span.show();
                    $(this).remove();
                    return;
                }
                // newName'i string'e dönüştür
                newName = String(newName);
                if (newName && newName !== oldName) {
                    renameManualFolder(refTableName, refId, fullPath, newName, targetElement);
                }
                $span.show();
                $(this).remove();
            } else if (e.key === 'Escape') {
                $span.show();
                $(this).remove();
            }
        });
    });
}
function renameManualFolder(refTableName, refId, oldFolderPath, newFolderName, targetElement) {
    console.log(`renameManualFolder: refTableName=${refTableName}, refId=${refId}, oldFolderPath=${oldFolderPath}, newFolderName=${newFolderName}`);
    // Dinamik targetElement seçimi
    let target;
    if (refTableName === 'Kullanicilar' && window.userRole !== 'OSGB' && window.userRole !== 'İşveren') {
        target = '#manualFolders_kisisel';
    } else if (refTableName === 'Firmalar' && currentManualSection !== 'firmam') {
        target = `#manualFolders_firma_${refId}`;
    } else if (refTableName === 'Kullanicilar') {
        target = `#manualFolders_personel_${refId}`;
    } else {
        target = `#manualFolders_${currentManualSection || 'firmam'}`;
    }
    console.log(`Hedef element belirlendi: ${target}`);
    // JSON gövdesini oluştururken tüm değerleri string'e dönüştür
    const data = {
        RefTableName: String(refTableName),
        RefId: parseInt(refId, 10),
        OldFolderPath: String(oldFolderPath),
        NewFolderName: String(newFolderName),
        __RequestVerificationToken: $('input[name="__RequestVerificationToken"]').val()
    };
    // JSON gövdesini logla
    console.log('Oluşturulan data nesnesi:', data);
    const jsonData = JSON.stringify(data);
    console.log('JSON.stringify sonucu:', jsonData);
    $.ajax({
        url: '/Dokuman/RenameManualFolder',
        type: 'POST',
        contentType: 'application/json',
        data: jsonData,
        beforeSend: function (xhr) {
            console.log('AJAX isteği gönderiliyor:', jsonData);
            xhr.setRequestHeader('RequestVerificationToken', data.__RequestVerificationToken);
        },
        success: function (response) {
            console.log(`Klasör Yeniden Adlandırma Başarılı: ${JSON.stringify(response)}`);
            if (response.success) {
                Swal.fire({
                    icon: 'success',
                    title: window.translations.Success,
                    text: window.translations.FolderNameChangedSuccessfully,
                    confirmButtonText: window.translations.OK
                });
                refreshFolderStructure(refTableName, refId, target, true);
            } else {
                console.error(`Klasör Yeniden Adlandırma Hatası: ${response.message}`);
                Swal.fire({
                    icon: 'error',
                    title: window.translations.Error,
                    text: response.message || window.translations.ErrorRenamingFolder,
                    confirmButtonText: window.translations.OK
                });
            }
        },
        error: function (xhr, status, error) {
            console.error(`Klasör Yeniden Adlandırma AJAX Hatası: status=${status}, error=${error}, response=${xhr.responseText}`);
            Swal.fire({
                icon: 'error',
                title: window.translations.Error,
                text: window.translations.ErrorRenamingFolder + ' ' + error,
                confirmButtonText: window.translations.OK
            });
        }
    });
}