// Dokumanlar.js

let currentShareUrl = '';
let currentQrPngUrl = '';
let selectedDokumanlar = [];
let paylasimMap = {};
let uploadProgressItems = {};

// Şifreleme fonksiyonu
async function encryptValue(value) {
    try {
        const response = await $.ajax({
            url: '/Dokuman/Encrypt',
            type: 'GET',
            data: { value: value }
        });
        if (response.success) {
            return response.encryptedValue;
        } else {
            throw new Error(response.message);
        }
    } catch (error) {
        console.error("Şifreleme hatası:", error);
        throw error;
    }
}

// Base64'ü Blob'a dönüştürme
function base64ToBlob(base64, contentType) {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
}

// QR kodunu indirme
function downloadQrCode(base64Url, fileName) {
    const blob = base64ToBlob(base64Url, 'image/png');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'qrcode.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Inline rename işlevini tanımla
function setupInlineRename($element) {
    $element.off('dblclick').on('dblclick', function () {
        var $this = $(this);
        var dokumanId = parseInt($this.data('dokuman-id')); // Integer'a dönüştür
        console.log("Inline Rename - DokumanId:", dokumanId);
        var currentName = $this.text().trim();
        var $input = $('<input type="text" class="form-control form-control-sm" />')
            .val(currentName)
            .css({ width: '100%' });

        $this.html($input);
        $input.focus();

        // Enter ve blur olaylarını bağla
        $input.off('keypress blur').on('keypress blur', function (e) {
            if (e.type === 'blur' || (e.type === 'keypress' && e.which === 13)) {
                var newName = $input.val().trim();
                if (newName && newName !== currentName) {
                    var payload = { dokumanId: dokumanId, newFileName: newName };
                    console.log("Inline Rename - Gönderilen Veri:", JSON.stringify(payload));
                    $.ajax({
                        url: '/Dokuman/DosyaAdiniDegistir',
                        type: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify(payload),
                        success: function (response) {
                            console.log("Inline Rename - Sunucu Yanıtı:", response);
                            if (response.success) {
                                $this.text(newName);
                                Swal.fire({
                                    icon: 'success',
                                    title: 'Başarılı',
                                    text: 'Dosya adı başarıyla değiştirildi.',
                                    confirmButtonText: 'Tamam'
                                });
                            } else {
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Hata',
                                    text: response.message || 'Doküman bulunamadı.',
                                    confirmButtonText: 'Tamam'
                                });
                                $this.text(currentName);
                            }
                        },
                        error: function (xhr, status, error) {
                            console.error("Inline Rename Error:", { status: status, error: error, response: xhr.responseText });
                            Swal.fire({
                                icon: 'error',
                                title: 'Hata',
                                text: 'Dosya adı değiştirilirken hata oluştu: ' + (xhr.responseJSON?.message || error),
                                confirmButtonText: 'Tamam'
                            });
                            $this.text(currentName);
                        },
                        complete: function () {
                            // Durumu sıfırla ve olayları tekrar bağla
                            setupInlineRename($this);
                        }
                    });
                } else {
                    console.log("Inline Rename - Yeni isim geçersiz veya aynı:", { newName: newName, currentName: currentName });
                    $this.text(currentName);
                    setupInlineRename($this);
                }
            }
        });
    });
}

// Yükleme ilerleme penceresini göster
function showUploadProgressWindow() {
    $('#uploadProgressWindow').show();
}

// Yükleme ilerleme penceresini gizle
function hideUploadProgressWindow() {
    $('#uploadProgressWindow').hide();
}

// Yükleme ilerleme penceresini küçült/geri yükle
window.toggleUploadWindow = function () {
    $('#uploadProgressWindow').toggleClass('minimized');
    var isMinimized = $('#uploadProgressWindow').hasClass('minimized');
    $('.minimize-btn').text(isMinimized ? '+' : '−');
};

// Yükleme geçmişini temizle
window.clearUploadHistory = function () {
    $('#uploadProgressList').empty();
    uploadProgressItems = {};
    hideUploadProgressWindow();
};

// Yükleme ilerlemesini güncelle
function updateUploadProgress(fileName, progress, status) {
    // Dosya adını güvenli bir şekilde işlemek için MD5 hash kullanıyoruz
    var itemId = md5(encodeURIComponent(fileName)); // Türkçe karakterler için encode
    var $item = uploadProgressItems[itemId];

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
        uploadProgressItems[itemId] = $item;
        showUploadProgressWindow(); // Pencereyi hemen göster
    } else {
        $item.find('.progress-bar').css('width', `${progress}%`);
        $item.find('.status').text(status);
    }

    // İlerleme çubuğunu güncellemek için animasyon
    requestAnimationFrame(() => {
        $item.find('.progress-bar').css('transition', 'width 0.3s ease');
    });
}

// Basit MD5 fonksiyonu (dosya adı için unique ID oluşturmak)
function md5(str) {
    function md5cycle(x, k) {
        var a = x[0], b = x[1], c = x[2], d = x[3];
        a = ff(a, b, c, d, k[0], 7, -680876936);
        d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17, 606105819);
        b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897);
        d = ff(d, a, b, c, k[5], 12, 1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341);
        b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7, 1770035416);
        d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063);
        b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7, 1804603682);
        d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290);
        b = ff(b, c, d, a, k[15], 22, 1236535329);
        a = gg(a, b, c, d, k[1], 5, -165796510);
        d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14, 643717713);
        b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691);
        d = gg(d, a, b, c, k[10], 9, 38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335);
        b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5, 568446438);
        d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961);
        b = gg(b, c, d, a, k[8], 20, 1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467);
        d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14, 1735328473);
        b = gg(b, c, d, a, k[12], 20, -1926607734);
        a = hh(a, b, c, d, k[5], 4, -378558);
        d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16, 1839030562);
        b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060);
        d = hh(d, a, b, c, k[4], 11, 1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632);
        b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4, 681279174);
        d = hh(d, a, b, c, k[0], 11, -358537222);
        c = hh(c, d, a, b, k[3], 16, -722521979);
        b = hh(b, c, d, a, k[6], 23, 76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487);
        d = hh(d, a, b, c, k[12], 11, -421815835);
        c = hh(c, d, a, b, k[15], 16, 530742520);
        b = hh(b, c, d, a, k[2], 23, -995338651);
        a = ii(a, b, c, d, k[0], 6, -198630844);
        d = ii(d, a, b, c, k[7], 10, 1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905);
        b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6, 1700485571);
        d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523);
        b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6, 1873313359);
        d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380);
        b = ii(b, c, d, a, k[13], 21, 1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070);
        d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15, 718787259);
        b = ii(b, c, d, a, k[9], 21, -343485551);
        x[0] = add32(a, x[0]);
        x[1] = add32(b, x[1]);
        x[2] = add32(c, x[2]);
        x[3] = add32(d, x[3]);
    }

    function cmn(q, a, b, x, s, t) {
        a = add32(add32(a, q), add32(x, t));
        return add32((a << s) | (a >>> (32 - s)), b);
    }

    function ff(a, b, c, d, x, s, t) {
        return cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }

    function gg(a, b, c, d, x, s, t) {
        return cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }

    function hh(a, b, c, d, x, s, t) {
        return cmn(b ^ c ^ d, a, b, x, s, t);
    }

    function ii(a, b, c, d, x, s, t) {
        return cmn(c ^ (b | (~d)), a, b, x, s, t);
    }

    function md51(s) {
        var n = s.length,
            state = [1732584193, -271733879, -1732584194, 271733878],
            i;
        for (i = 64; i <= s.length; i += 64) {
            md5cycle(state, md5blk(s.substring(i - 64, i)));
        }
        s = s.substring(i - 64);
        var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < s.length; i++)
            tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i++) tail[i] = 0;
        }
        tail[14] = n * 8;
        md5cycle(state, tail);
        return state;
    }

    function md5blk(s) {
        var md5blks = [], i;
        for (i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = s.charCodeAt(i) +
                (s.charCodeAt(i + 1) << 8) +
                (s.charCodeAt(i + 2) << 16) +
                (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
    }

    var hex_chr = '0123456789abcdef'.split('');

    function rhex(n) {
        var s = '', j = 0;
        for (; j < 4; j++)
            s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] +
                hex_chr[(n >> (j * 8)) & 0x0F];
        return s;
    }

    function hex(x) {
        for (var i = 0; i < x.length; i++)
            x[i] = rhex(x[i]);
        return x.join('');
    }

    function add32(a, b) {
        return (a + b) & 0xFFFFFFFF;
    }

    return hex(md51(str));
}

// Doküman listesini yükleme
window.loadDokumanlar = async function (refTableName, refId, targetElement, dokumanTuru, altKategori) {
    try {
        const response = await $.ajax({
            url: '/Dokuman/DokumanListesi',
            type: 'GET',
            data: { refTableName: refTableName, refId: refId }
        });

        if (response.success) {
            var table = '';
            for (let i = 0; i < response.dokumanlar.length; i++) {
                let item = response.dokumanlar[i];
                var itemDokumanTuru = String(item.dokumanTuru).toLowerCase().trim();
                var filterDokumanTuru = dokumanTuru ? String(dokumanTuru).toLowerCase().trim() : null;
                var itemAltKategori = null;
                if (item.aciklama) {
                    try {
                        var aciklamaJson = JSON.parse(item.aciklama);
                        itemAltKategori = aciklamaJson.altKategori;
                    } catch {
                        // JSON değilse geç
                    }
                }

                if ((!filterDokumanTuru || itemDokumanTuru === filterDokumanTuru) &&
                    (!altKategori || itemAltKategori === altKategori)) {
                    let encryptedPath = await encryptValue(item.dosyaYolu);
                    table += `<tr>
                                <td><input type="checkbox" class="dokuman-checkbox" value="${item.dokumanId}"></td>
                                <td class="editable-file-name" data-dokuman-id="${item.dokumanId}">${item.dosyaAdi || '-'}</td>
                                <td>${item.dokumanTuru || '-'}</td>
                                <td>${item.yuklemeTarihi ? new Date(item.yuklemeTarihi).toLocaleDateString('tr-TR') : '-'}</td>
                                <td>${item.aciklama || '-'}</td>
                                <td>
                                    <a href="/Dokuman/Indir/?path=${encodeURIComponent(encryptedPath)}" class="btn btn-sm btn-info waves-effect waves-light me-1" title="İndir">
                                        <i class="fas fa-download"></i>
                                    </a>
                                    <button class="btn btn-sm btn-danger waves-effect waves-light delete-dokuman-btn" data-dokuman-id="${item.dokumanId}" data-dosya-yolu="${item.dosyaYolu}" title="Sil">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>`;
                }
            }
            $(targetElement).html(table);
            if (table === '') {
                $(targetElement).html('<tr><td colspan="6" class="text-center">Doküman bulunamadı.</td></tr>');
            }

            // Inline rename işlevini bağla
            $(targetElement).find('.editable-file-name').each(function () {
                setupInlineRename($(this));
            });

            // Silme butonuna olay dinleyicisi ekle
            $(targetElement).find('.delete-dokuman-btn').on('click', function () {
                var dokumanId = $(this).data('dokuman-id');
                var dosyaYolu = $(this).data('dosya-yolu');
                deleteDokuman(dokumanId, dosyaYolu, refTableName, refId, targetElement, dokumanTuru, altKategori);
            });

            $(targetElement).find('.dokuman-checkbox').on('change', function () {
                var tableId = $(targetElement).attr('id');
                var shareButtonId;
                if (tableId.includes('firmam')) {
                    shareButtonId = `#share${tableId.charAt(0).toUpperCase() + tableId.slice(1)}`;
                } else if (tableId.includes('firma_')) {
                    var firmaId = tableId.split('_')[1];
                    var folderName = tableId.split('_')[0];
                    shareButtonId = `#shareFirma${folderName.charAt(5).toUpperCase() + folderName.slice(6)}_${firmaId}`;
                } else if (tableId.includes('personel')) {
                    var personelId = tableId.split('_')[1];
                    var folderName = tableId.split('_')[0];
                    shareButtonId = `#sharePersonel${folderName.charAt(8).toUpperCase() + folderName.slice(9)}_${personelId}`;
                } else if (tableId === 'kisiselAlan') {
                    shareButtonId = '#shareKisiselAlan';
                }

                var checkedCount = $(targetElement).find('.dokuman-checkbox:checked').length;
                if (checkedCount > 0) {
                    $(shareButtonId).show();
                } else {
                    $(shareButtonId).hide();
                }
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Hata',
                text: response.message,
                confirmButtonText: 'Tamam'
            });
            $(targetElement).html('<tr><td colspan="6" class="text-center">Dokümanlar yüklenirken hata oluştu.</td></tr>');
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Hata',
            text: 'Dokümanlar yüklenirken hata oluştu: ' + error.message,
            confirmButtonText: 'Tamam'
        });
        $(targetElement).html('<tr><td colspan="6" class="text-center">Dokümanlar yüklenemedi.</td></tr>');
    }
};

// Doküman silme fonksiyonu
window.deleteDokuman = async function (dokumanId, dosyaYolu, refTableName, refId, targetElement, dokumanTuru, altKategori) {
    Swal.fire({
        title: 'Dokümanı Sil',
        text: 'Bu dokümanı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Evet, Sil',
        cancelButtonText: 'Hayır'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await $.ajax({
                    url: '/Dokuman/DeleteDokuman',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ dokumanId: dokumanId, dosyaYolu: dosyaYolu })
                });

                if (response.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Başarılı',
                        text: 'Doküman başarıyla silindi.',
                        confirmButtonText: 'Tamam'
                    });
                    // Tabloyu güncelle
                    loadDokumanlar(refTableName, refId, targetElement, dokumanTuru, altKategori);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Hata',
                        text: response.message || 'Doküman silinirken bir hata oluştu.',
                        confirmButtonText: 'Tamam'
                    });
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Hata',
                    text: 'Doküman silinirken hata oluştu: ' + error.message,
                    confirmButtonText: 'Tamam'
                });
            }
        }
    });
};

window.toggleSelectAll = function (tableId) {
    var isChecked = $(`#selectAll${tableId.replace(/^(firmam|firma_|personel|kisisel)/, '').replace(/_\d+/, '')}${tableId.includes('_') ? '_' + tableId.split('_')[1] : ''}`).is(':checked');
    $(`#${tableId} .dokuman-checkbox`).prop('checked', isChecked);
    var shareButtonId;
    if (tableId.includes('firmam')) {
        shareButtonId = `#share${tableId.charAt(0).toUpperCase() + tableId.slice(1)}`;
    } else if (tableId.includes('firma_')) {
        var firmaId = tableId.split('_')[1];
        var folderName = tableId.split('_')[0];
        shareButtonId = `#shareFirma${folderName.charAt(5).toUpperCase() + folderName.slice(6)}_${firmaId}`;
    } else if (tableId.includes('personel')) {
        var personelId = tableId.split('_')[1];
        var folderName = tableId.split('_')[0];
        shareButtonId = `#sharePersonel${folderName.charAt(8).toUpperCase() + folderName.slice(9)}_${personelId}`;
    } else if (tableId === 'kisiselAlan') {
        shareButtonId = '#shareKisiselAlan';
    }

    if (isChecked) {
        $(shareButtonId).show();
    } else {
        $(shareButtonId).hide();
    }
};

// Geçmiş paylaşımları yükleme
window.loadGecmisPaylasimlar = async function () {
    try {
        const response = await $.ajax({
            url: '/Dokuman/Paylasimlarim',
            type: 'GET',
            data: { includeExpired: false }
        });

        var html = response.length === 0 ? '<div class="alert alert-warning">Henüz paylaşımınız bulunmamaktadır.</div>' : '<div class="paylasimlar-container">';
        for (let i = 0; i < response.length; i++) {
            let paylasim = response[i];
            var isActive = paylasim.sureliMi ? new Date(paylasim.gecerlilikTarihi) > new Date() : true;
            var statusDot = isActive ? '<span class="badge bg-success me-1">Aktif</span>' : '<span class="badge bg-danger me-1">Süresi Doldu</span>';
            var dokumanList = '';
            var dokumanIdList = paylasim.dokumanIdList && Array.isArray(paylasim.dokumanIdList) ? paylasim.dokumanIdList.join(',') : '';
            let encryptedToken = await encryptValue(paylasim.token);
            var paylasimUrl = `https://localhost:7081/Dokuman/PaylasimGoruntule?key=${encodeURIComponent(encryptedToken)}`;
            $.each(paylasim.dokumanlar, function (j, dokuman) {
                dokumanList += `<span class="dokuman-item">${dokuman.dosyaAdi} (${dokuman.dokumanTuru})</span>`;
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
                        <button onclick="sharePaylasim('${paylasim.token}')" class="btn btn-sm btn-primary waves-effect waves-light" title="Paylaş">
                            <i class="fas fa-share-alt"></i>
                        </button>
                        <button onclick="kopyalaPaylasimUrl('${paylasimUrl}')" class="btn btn-sm btn-secondary waves-effect waves-light" title="Bağlantıyı Kopyala">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="cancel-share-btn btn btn-sm btn-danger waves-effect waves-light" data-token="${paylasim.token}" title="Paylaşımı İptal Et">
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
        $('#gecmisPaylasimlarList').html('<div class="alert alert-danger">Geçmiş paylaşımlar yüklenemedi. Lütfen daha sonra tekrar deneyin.</div>');
    }
};

// Paylaşımı iptal etme
window.cancelShare = async function (token) {
    console.log("Cancel Share - Token:", token);
    Swal.fire({
        title: 'Paylaşımı İptal Et',
        text: 'Bu paylaşımı iptal etmek istediğinizden emin misiniz? Bağlantı artık erişilemez olacak.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Evet, İptal Et',
        cancelButtonText: 'Hayır'
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
                        title: 'Başarılı',
                        text: 'Paylaşım başarıyla iptal edildi.',
                        confirmButtonText: 'Tamam'
                    });
                    loadGecmisPaylasimlar(); // Listeyi yenile
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Hata',
                        text: response.message || 'Paylaşım bulunamadı.',
                        confirmButtonText: 'Tamam'
                    });
                }
            } catch (error) {
                console.error("Cancel Share Error:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Hata',
                    text: 'Paylaşım iptal edilirken hata oluştu: ' + error.message,
                    confirmButtonText: 'Tamam'
                });
            }
        }
    });
};

window.firmaOdaklan = function (firmaId) {
    $('.firma-container').hide();
    $(`#firma_${firmaId}`).show();
    $('#geriFirmalarim').show();
    $('#firmalarimHeading .accordion-button').html(`<i class="mdi mdi-folder me-2"></i> Firma: ${$(`#firma_${firmaId} .firma-button`).text().trim()}`);
};

window.geriDonFirmalarim = function () {
    $('.firma-container').show();
    $('#geriFirmalarim').hide();
    $('#firmalarimHeading .accordion-button').html('<i class="mdi mdi-folder me-2"></i> Firmalarım');
};

window.personelOdaklan = function (personelId) {
    $('.personel-container').hide();
    $(`#personel_${personelId}`).show();
    $('#geriPersonellerim').show();
    $('#personellerimHeading .accordion-button').html(`<i class="mdi mdi-folder me-2"></i> Personel: ${$(`#personel_${personelId} .personel-button`).text().trim()}`);
};

window.geriDonPersonellerim = function () {
    $('.personel-container').show();
    $('#geriPersonellerim').hide();
    $('#personellerimHeading .accordion-button').html('<i class="mdi mdi-folder me-2"></i> Personellerim');
};

window.openYukleModal = function (refTableName, refId, dokumanTuru, altKategori) {
    $('#refTableName').val(refTableName);
    $('#refId').val(refId);
    $('#dokumanTuru').val(dokumanTuru);
    $('#altKategori').val(altKategori || '');
    $('#aciklama').val(altKategori ? JSON.stringify({ altKategori: altKategori }) : '');

    if (dokumanTuru === 'KisiselAlan') {
        $('#dosya').attr('accept', '.jpg,.jpeg,.png,.pdf,.rar,.zip');
    } else {
        $('#dosya').attr('accept', '.pdf,.doc,.docx,.png,.jpg,.jpeg,.rar,.zip');
    }

    $('#dosya').val('');
    $('#dokumanYukleForm')[0].reset();
    $('#dokumanYukleModal').modal('show');
};

$('#dokumanYukleModal').on('hidden.bs.modal', function () {
    $('#dokumanYukleForm')[0].reset();
    $('#refTableName').val('');
    $('#refId').val('');
    $('#dokumanTuru').val('');
    $('#altKategori').val('');
    $('#aciklama').val('');
    $('#dosya').val('');
});

$('#dokumanYukleForm').submit(function (e) {
    e.preventDefault();
    var files = $('#dosya')[0].files; // Doğrudan DOM elementinden dosyaları al
    if (!files || files.length === 0) {
        Swal.fire({
            icon: 'error',
            title: 'Hata',
            text: 'Lütfen en az bir dosya seçin.',
            confirmButtonText: 'Tamam'
        });
        return;
    }

    var refTableName = $('#refTableName').val();
    var refId = $('#refId').val();
    var dokumanTuru = $('#dokumanTuru').val();
    var altKategori = $('#altKategori').val();
    var aciklama = altKategori ? JSON.stringify({ altKategori: altKategori }) : $('#aciklama').val();

    // Parametrelerin null olup olmadığını kontrol et
    if (!refTableName || !refId || !dokumanTuru) {
        Swal.fire({
            icon: 'error',
            title: 'Hata',
            text: 'Eksik form bilgisi: RefTableName, RefId veya DokumanTuru eksik.',
            confirmButtonText: 'Tamam'
        });
        console.error("Form parametreleri eksik:", { refTableName, refId, dokumanTuru, aciklama });
        return;
    }

    // Modal'ı hemen kapat
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

    // Her dosya için ayrı yükleme işlemi
    Array.from(files).forEach(file => {
        // Dosya boyutunu kontrol et (örneğin, 500 MB sınırı - sunucu tarafıyla uyumlu)
        const maxFileSize = 500 * 1024 * 1024; // 500 MB
        if (file.size > maxFileSize) {
            Swal.fire({
                icon: 'error',
                title: 'Hata',
                text: `Dosya boyutu çok büyük: ${file.name}. Maksimum 500 MB dosya yüklenebilir.`,
                confirmButtonText: 'Tamam'
            });
            return;
        }

        // Dosyanın gerçekten seçildiğini kontrol et
        if (!file || !file.name || file.size === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Hata',
                text: `Dosya geçersiz veya erişilemez: ${file.name || 'Bilinmeyen dosya'}.`,
                confirmButtonText: 'Tamam'
            });
            return;
        }

        // Yükleme işlemi başlar başlamaz ilerleme çubuğunu başlat
        updateUploadProgress(file.name, 0, 'Yükleniyor...'); // Yükleme başlar başlamaz durumu göster

        console.log(`Yükleme Başlıyor - Dosya Adı: ${file.name}, Boyut: ${file.size} bytes, Tür: ${file.type}`);

        var formData = new FormData();
        formData.append('dosya', file);
        formData.append('refTableName', refTableName);
        formData.append('refId', refId.toString()); // RefId'nin string olarak gönderildiğinden emin ol
        formData.append('dokumanTuru', dokumanTuru);
        formData.append('aciklama', aciklama || '');

        // FormData içeriğini kontrol et
        for (let [key, value] of formData.entries()) {
            console.log(`FormData - ${key}: ${value}`);
        }

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/Dokuman/DokumanYukle', true);

        // Yükleme başlamadan önce ilerleme çubuğunu göster
        showUploadProgressWindow();

        // Yükleme ilerlemesini takip et
        xhr.upload.onprogress = function (e) {
            console.log(`onprogress Tetiklendi - Dosya: ${file.name}, Loaded: ${e.loaded}, Total: ${e.total}, LengthComputable: ${e.lengthComputable}`);
            if (e.lengthComputable) {
                var percentComplete = Math.round((e.loaded / e.total) * 100);
                updateUploadProgress(file.name, percentComplete, `Yükleniyor: ${percentComplete}%`);
                console.log(`Yükleme İlerlemesi - ${file.name}: ${percentComplete}%`);
            } else {
                updateUploadProgress(file.name, 0, 'İlerleme hesaplanamıyor');
                console.warn("İlerleme hesaplanamıyor: Content-Length başlığı eksik olabilir.");
            }
        };

        // Yükleme olaylarını dinle
        xhr.upload.onloadstart = function () {
            console.log(`Yükleme Başladı - Dosya: ${file.name}`);
            updateUploadProgress(file.name, 0, 'Yükleniyor...');
        };

        xhr.upload.onloadend = function () {
            console.log(`Yükleme Bitti - Dosya: ${file.name}`);
        };

        xhr.onload = function () {
            console.log(`Sunucu Yanıtı Alındı - Status: ${xhr.status}, Response: ${xhr.responseText}`);
            if (xhr.status === 200) {
                try {
                    var response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        updateUploadProgress(file.name, 100, 'Yüklendi');
                        Swal.fire({
                            icon: 'success',
                            title: 'Başarılı',
                            text: 'Doküman başarıyla yüklendi!',
                            confirmButtonText: 'Tamam'
                        }).then(() => {
                            $('#dokumanYukleForm')[0].reset();

                            const klasorConfig = {
                                'Dekont': {
                                    refTableName: 'Firmalar',
                                    firmamTarget: '#firmamOdemeler',
                                    firmalarimTarget: `#firmaOdemeler_${refId}`,
                                    dokumanTuru: 'Dekont',
                                    altKategori: null
                                },
                                'Sozlesme_FirmaSozlesmesi': {
                                    refTableName: 'Firmalar',
                                    firmamTarget: '#firmamFirmaSozlesmeleri',
                                    firmalarimTarget: `#firmaSozlesmeler_${refId}`,
                                    firmalarimRefTableName: 'Sozlesmeler',
                                    dokumanTuru: 'Sozlesme',
                                    altKategori: 'FirmaSozlesmesi'
                                },
                                'Sozlesme_PersonelSozlesmesi': {
                                    refTableName: 'Kullanicilar',
                                    firmamTarget: '#firmamPersonelSozlesmeleri',
                                    firmalarimTarget: null,
                                    dokumanTuru: 'Sozlesme',
                                    altKategori: 'PersonelSozlesmesi'
                                },
                                'EgitimMateryali': {
                                    refTableName: 'EgitimTuruMateryalleri',
                                    firmamTarget: '#firmamEgitimler',
                                    firmalarimTarget: `#firmaEgitimler_${refId}`,
                                    dokumanTuru: 'EgitimMateryali',
                                    altKategori: null
                                },
                                'Etkinlik': {
                                    refTableName: 'Firmalar',
                                    firmamTarget: '#firmamEtkinlikler',
                                    firmalarimTarget: `#firmaEtkinlikler_${refId}`,
                                    dokumanTuru: null,
                                    altKategori: null
                                },
                                'ToplantiNotu': {
                                    refTableName: 'Firmalar',
                                    firmamTarget: '#firmamEtkinlikler',
                                    firmalarimTarget: `#firmaEtkinlikler_${refId}`,
                                    dokumanTuru: null,
                                    altKategori: null
                                },
                                'Ziyaret': {
                                    refTableName: 'Firmalar',
                                    firmamTarget: '#firmamEtkinlikler',
                                    firmalarimTarget: `#firmaEtkinlikler_${refId}`,
                                    dokumanTuru: null,
                                    altKategori: null
                                },
                                'Diger': {
                                    refTableName: 'Firmalar',
                                    firmamTarget: '#firmamDiger',
                                    firmalarimTarget: `#firmaDiger_${refId}`,
                                    dokumanTuru: 'Diger',
                                    altKategori: null
                                },
                                'Diger_Personel': {
                                    refTableName: 'Kullanicilar',
                                    firmamTarget: null,
                                    firmalarimTarget: `#personelDiger_${refId}`,
                                    dokumanTuru: 'Diger',
                                    altKategori: null
                                },
                                'Ozluk': {
                                    refTableName: 'Kullanicilar',
                                    firmamTarget: null,
                                    firmalarimTarget: `#personelOzluk_${refId}`,
                                    dokumanTuru: null,
                                    altKategori: null
                                },
                                'KisiselAlan': {
                                    refTableName: 'Firmalar',
                                    firmamTarget: '#firmamKisiselAlan',
                                    firmalarimTarget: `#firmaKisiselAlan_${refId}`,
                                    dokumanTuru: 'KisiselAlan',
                                    altKategori: null
                                },
                                'KisiselAlan_Personel': {
                                    refTableName: 'Kullanicilar',
                                    firmamTarget: null,
                                    firmalarimTarget: `#personelKisiselAlan_${refId}`,
                                    dokumanTuru: 'KisiselAlan',
                                    altKategori: null
                                },
                                'KisiselAlan_Kisisel': {
                                    refTableName: 'Kullanicilar',
                                    firmamTarget: null,
                                    firmalarimTarget: '#kisiselAlan',
                                    dokumanTuru: 'KisiselAlan',
                                    altKategori: null
                                }
                            };

                            const key = altKategori ? `${dokumanTuru}_${altKategori}` : (dokumanTuru === 'Diger' && refTableName === 'Kullanicilar') ? 'Diger_Personel' : (dokumanTuru === 'KisiselAlan' && refTableName === 'Kullanicilar' && $('#kisisel').hasClass('active')) ? 'KisiselAlan_Kisisel' : (dokumanTuru === 'KisiselAlan' && refTableName === 'Kullanicilar') ? 'KisiselAlan_Personel' : dokumanTuru || 'Ozluk';
                            const config = klasorConfig[key];

                            if (config) {
                                const isFirmamActive = $('#firmam').hasClass('active');
                                const target = isFirmamActive ? config.firmamTarget : config.firmalarimTarget;
                                const loadRefTableName = (isFirmamActive || !config.firmalarimRefTableName) ? config.refTableName : config.firmalarimRefTableName;

                                if (target) {
                                    loadDokumanlar(loadRefTableName, refId, target, config.dokumanTuru, config.altKategori);
                                }
                            } else {
                                console.warn(`Klasör yapılandırması bulunamadı: ${key}`);
                            }
                        });
                    } else {
                        updateUploadProgress(file.name, 0, 'Hata: ' + response.message);
                        Swal.fire({
                            icon: 'error',
                            title: 'Hata',
                            text: response.message,
                            confirmButtonText: 'Tamam'
                        });
                    }
                } catch (error) {
                    updateUploadProgress(file.name, 0, 'Hata: Sunucu yanıtı geçersiz');
                    Swal.fire({
                        icon: 'error',
                        title: 'Hata',
                        text: 'Sunucu yanıtı işlenirken hata oluştu: ' + error.message,
                        confirmButtonText: 'Tamam'
                    });
                }
            } else {
                updateUploadProgress(file.name, 0, 'Hata: Sunucu hatası (' + xhr.status + ')');
                Swal.fire({
                    icon: 'error',
                    title: 'Hata',
                    text: 'Doküman yüklenirken hata oluştu: ' + xhr.statusText,
                    confirmButtonText: 'Tamam'
                });
            }
        };

        xhr.onerror = function () {
            console.error(`Yükleme Hatası - Dosya: ${file.name}, Hata: ${xhr.statusText}`);
            updateUploadProgress(file.name, 0, 'Hata: Bağlantı hatası');
            Swal.fire({
                icon: 'error',
                title: 'Hata',
                text: 'Doküman yüklenirken bağlantı hatası oluştu.',
                confirmButtonText: 'Tamam'
            });
        };

        xhr.onabort = function () {
            console.log(`Yükleme İptal Edildi - Dosya: ${file.name}`);
            updateUploadProgress(file.name, 0, 'Hata: Yükleme iptal edildi');
            Swal.fire({
                icon: 'warning',
                title: 'İptal Edildi',
                text: 'Dosya yükleme işlemi iptal edildi.',
                confirmButtonText: 'Tamam'
            });
        };

        xhr.send(formData);
    });
});

window.openPaylasimModal = function (refTableName, refId, dokumanTuru, tableId) {
    selectedDokumanlar = [];
    $(`#${tableId} .dokuman-checkbox:checked`).each(function () {
        selectedDokumanlar.push(parseInt($(this).val()));
    });

    if (selectedDokumanlar.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Uyarı',
            text: 'Paylaşmak için en az bir doküman seçmelisiniz.',
            confirmButtonText: 'Tamam'
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
            title: 'Bilgi',
            text: 'Zaten paylaşım bağlantısı oluşturuldu!',
            confirmButtonText: 'Tamam'
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
                        title: 'Başarılı',
                        text: 'Paylaşım bağlantısı oluşturuldu!',
                        confirmButtonText: 'Tamam'
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Hata',
                        text: response.message,
                        confirmButtonText: 'Tamam'
                    });
                }
            },
            error: function (xhr, status, error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Hata',
                    text: 'Paylaşım oluşturulurken hata oluştu: ' + error,
                    confirmButtonText: 'Tamam'
                });
            }
        });
    });
};

window.openQrModal = function () {
    $('#qrCodeContainer').html('<canvas id="qrCanvas"></canvas>');
    try {
        var qrCanvas = document.getElementById("qrCanvas");
        if (!qrCanvas) {
            throw new Error("QR Canvas elementi bulunamadı!");
        }
        QRCode.toCanvas(qrCanvas, currentShareUrl, { width: 200, height: 200 }, function (error) {
            if (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Hata',
                    text: 'QR Kod oluşturma hatası: ' + error.message,
                    confirmButtonText: 'Tamam'
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
            title: 'Hata',
            text: 'QR Kod oluşturma hatası: ' + error.message,
            confirmButtonText: 'Tamam'
        });
    }
    $('#qrModal').modal('show');
};

window.shareQrLink = async function () {
    const blob = base64ToBlob(currentQrPngUrl, 'image/png');
    const file = new File([blob], 'qrcode.png', { type: 'image/png' });

    if (navigator.share) {
        try {
            await navigator.share({
                files: [file],
                title: 'Seninle şunları paylaştım',
                text: `Seninle şunları paylaştım: ${currentShareUrl}`
            });
            return;
        } catch (error) {
            console.error("Paylaşım hatası:", error);
        }
    }

    Swal.fire({
        title: 'Paylaş',
        html: `
            <p>Bağlantıyı paylaşmak için bir platform seçin:</p>
            <div class="share-buttons">
                <a href="https://api.whatsapp.com/send?text=${encodeURIComponent("Seninle şunları paylaştım: " + currentShareUrl)}" target="_blank" class="btn btn-success btn-sm me-2">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                </a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentShareUrl)}" target="_blank" class="btn btn-primary btn-sm me-2">
                    <i class="fab fa-facebook"></i> Facebook
                </a>
                <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(currentShareUrl)}&text=${encodeURIComponent("Seninle şunları paylaştım")}" target="_blank" class="btn btn-info btn-sm me-2">
                    <i class="fab fa-x-twitter"></i> X
                </a>
                <a href="mailto:?subject=Seninle şunları paylaştım&body=${encodeURIComponent("Seninle şunları paylaştım: " + currentShareUrl)}" class="btn btn-secondary btn-sm me-2">
                    <i class="fas fa-envelope"></i> E-posta
                </a>
            </div>
            <div class="mt-3">
                <button onclick="downloadQrCode('${currentQrPngUrl}', 'qrcode.png')" class="btn btn-primary btn-sm">
                    <i class="fas fa-download"></i> QR Kodunu İndir
                </button>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Kapat'
    });
};

window.sharePaylasim = async function (token) {
    let encryptedToken = await encryptValue(token);
    currentShareUrl = `https://localhost:7081/Dokuman/PaylasimGoruntule?key=${encodeURIComponent(encryptedToken)}`;
    var tempCanvas = document.createElement('canvas');
    QRCode.toCanvas(tempCanvas, currentShareUrl, { width: 200, height: 200 }, function (error) {
        if (error) {
            Swal.fire({
                icon: 'error',
                title: 'Hata',
                text: 'QR Kod oluşturma hatası: ' + error.message,
                confirmButtonText: 'Tamam'
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
                    title: 'Seninle şunları paylaştım',
                    text: `Seninle şunları paylaştım: ${currentShareUrl}`
                });
                return;
            } catch (error) {
                console.error("Paylaşım hatası:", error);
            }
        }

        Swal.fire({
            title: 'Paylaş',
            html: `
                <p>Bağlantıyı paylaşmak için bir platform seçin:</p>
                <div class="share-buttons">
                    <a href="https://api.whatsapp.com/send?text=${encodeURIComponent("Seninle şunları paylaştım: " + currentShareUrl)}" target="_blank" class="btn btn-success btn-sm me-2">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </a>
                    <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentShareUrl)}" target="_blank" class="btn btn-primary btn-sm me-2">
                        <i class="fab fa-facebook"></i> Facebook
                    </a>
                    <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(currentShareUrl)}&text=${encodeURIComponent("Seninle şunları paylaştım")}" target="_blank" class="btn btn-info btn-sm me-2">
                        <i class="fab fa-x-twitter"></i> X
                    </a>
                    <a href="mailto:?subject=Seninle şunları paylaştım&body=${encodeURIComponent("Seninle şunları paylaştım: " + currentShareUrl)}" class="btn btn-secondary btn-sm me-2">
                        <i class="fas fa-envelope"></i> E-posta
                    </a>
                </div>
                <div class="mt-3">
                    <button onclick="downloadQrCode('${currentQrPngUrl}', 'qrcode.png')" class="btn btn-primary btn-sm">
                        <i class="fas fa-download"></i> QR Kodunu İndir
                    </button>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'Kapat'
        });
    });
};

window.kopyalaUrl = function () {
    var urlInput = document.getElementById('paylasimUrl');
    urlInput.select();
    document.execCommand('copy');
    Swal.fire({
        icon: 'success',
        title: 'Kopyalandı',
        text: 'Paylaşım bağlantısı panoya kopyalandı.',
        confirmButtonText: 'Tamam'
    });
};

window.kopyalaPaylasimUrl = function (url) {
    var tempInput = document.createElement('input');
    document.body.appendChild(tempInput);
    tempInput.value = url;
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    Swal.fire({
        icon: 'success',
        title: 'Kopyalandı',
        text: 'Paylaşım bağlantısı panoya kopyalandı.',
        confirmButtonText: 'Tamam'
    });
};