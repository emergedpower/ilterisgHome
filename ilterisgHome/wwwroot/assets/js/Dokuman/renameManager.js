import { loadDokumanlar } from './documentManager.js';

export function setupInlineRename($element, refTableName, refId, targetElement, dokumanTuru) {
    console.log(`Inline Rename - DokumanId: ${$element.data('dokuman-id')}, refTableName=${refTableName}, refId=${refId}, targetElement=${targetElement}, dokumanTuru=${dokumanTuru}`);
    $element.off('dblclick.inlineRename').on('dblclick.inlineRename', function () {
        const $this = $(this);
        const dokumanId = parseInt($this.data('dokuman-id'));
        const currentName = $this.data('current-name') || $this.text().trim();
        const extension = currentName.includes('.') ? currentName.substring(currentName.lastIndexOf('.')) : '.pdf';
        const baseName = currentName.includes('.') ? currentName.substring(0, currentName.lastIndexOf('.')) : currentName;
        const $input = $('<input type="text" class="form-control form-control-sm" />')
            .val(baseName)
            .css({ width: '100%' });
        $this.html($input);
        $input.focus();
        $input.off('keypress blur').on('keypress blur', async function (e) {
            if (e.type === 'blur' || (e.type === 'keypress' && e.which === 13)) {
                const newName = $input.val().trim();
                if (!newName || newName === baseName) {
                    console.log("Inline Rename - Yeni isim geçersiz veya aynı:", { newName, currentName });
                    $this.text(currentName).data('current-name', currentName);
                    return;
                }
                const finalName = newName.includes('.') ? newName.substring(0, newName.lastIndexOf('.')) + extension : newName + extension;
                const payload = { dokumanId, newFileName: finalName };
                console.log("Inline Rename - Gönderilen Veri:", JSON.stringify(payload));
                try {
                    const response = await $.ajax({
                        url: '/Dokuman/DosyaAdiniDegistir',
                        type: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify(payload)
                    });
                    console.log("Inline Rename - Sunucu Yanıtı:", response);
                    if (response.success) {
                        $this.text(finalName).data('current-name', finalName);
                        Swal.fire({
                            icon: 'success',
                            title: window.translations.Success,
                            text: window.translations.FileNameChangedSuccessfully,
                            confirmButtonText: window.translations.OK
                        }).then(() => {
                            console.log(`Tablo Yenileme - Parametreler:`, { refTableName, refId, targetElement, dokumanTuru });
                            loadDokumanlar(refTableName, parseInt(refId), targetElement, dokumanTuru, true);
                        });
                    } else {
                        console.error(`Sunucu hatası: ${response.message}`);
                        Swal.fire({
                            icon: 'error',
                            title: window.translations.Error,
                            text: response.message || window.translations.ErrorRenamingFile,
                            confirmButtonText: window.translations.OK
                        });
                        $this.text(currentName).data('current-name', currentName);
                    }
                } catch (error) {
                    console.error("Inline Rename Error:", { error: error.message, response: error.responseText });
                    Swal.fire({
                        icon: 'error',
                        title: window.translations.Error,
                        text: `${window.translations.ErrorRenamingFile}: ${error.message}`,
                        confirmButtonText: window.translations.OK
                    });
                    $this.text(currentName).data('current-name', currentName);
                }
            }
        });
    });
}