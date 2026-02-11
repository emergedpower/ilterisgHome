// main.js (tam kod, orijinal haliyle güncellenmiş)

// Global değişkenler
window.currentShareUrl = '';
window.currentQrPngUrl = '';
window.selectedDokumanlar = [];
window.paylasimMap = {};
window.uploadProgressItems = {};

// Modülleri içe aktar (mevcut haliyle kalıyor)
import { encryptValue, base64ToBlob, downloadQrCode, md5 } from './utils.js';
import { setupInlineRename } from './renameManager.js';
import {
    showUploadProgressWindow,
    hideUploadProgressWindow,
    toggleUploadWindow,
    clearUploadHistory,
    firmaOdaklan,
    geriDonFirmalarim,
    personelOdaklan,
    geriDonPersonellerim,
    openYukleModal,
    setupModalReset,
    updateUploadProgress,
    currentManualSection
} from './uiManager.js';
import {
    loadDokumanlar,
    deleteDokuman,
    toggleSelectAll,
    setupDocumentUpload,
    openDokumanYukleModal
} from './documentManager.js';
import {
    loadGecmisPaylasimlar,
    cancelShare,
    openPaylasimModal,
    openQrModal,
    shareQrLink,
    sharePaylasim,
    kopyalaUrl,
    kopyalaPaylasimUrl
} from './shareManager.js';
import { openCreateFolderModal, refreshFolderStructure } from './folderManager.js';

// Global window nesnesine fonksiyonları bağla (mevcut haliyle kalıyor)
window.encryptValue = encryptValue;
window.base64ToBlob = base64ToBlob;
window.downloadQrCode = downloadQrCode;
window.md5 = md5;
window.setupInlineRename = setupInlineRename;
window.showUploadProgressWindow = showUploadProgressWindow;
window.hideUploadProgressWindow = hideUploadProgressWindow;
window.toggleUploadWindow = toggleUploadWindow;
window.clearUploadHistory = clearUploadHistory;
window.firmaOdaklan = firmaOdaklan;
window.geriDonFirmalarim = geriDonFirmalarim;
window.personelOdaklan = personelOdaklan;
window.geriDonPersonellerim = geriDonPersonellerim;
window.openYukleModal = openYukleModal;
window.loadDokumanlar = loadDokumanlar;
window.deleteDokuman = deleteDokuman;
window.toggleSelectAll = toggleSelectAll;
window.loadGecmisPaylasimlar = loadGecmisPaylasimlar;
window.cancelShare = cancelShare;
window.openPaylasimModal = openPaylasimModal;
window.openQrModal = openQrModal;
window.shareQrLink = shareQrLink;
window.sharePaylasim = sharePaylasim;
window.kopyalaUrl = kopyalaUrl;
window.kopyalaPaylasimUrl = kopyalaPaylasimUrl;
window.openCreateFolderModal = openCreateFolderModal;
window.refreshFolderStructure = refreshFolderStructure;
window.openDokumanYukleModal = openDokumanYukleModal;

// Başlangıç ayarları
$(document).ready(function () {
    console.log('main.js: document.ready tetiklendi');
    try {
        setupModalReset();
        setupDocumentUpload();
        console.log('main.js: setupModalReset ve setupDocumentUpload çağrıldı');

        // Başlangıçta dokümanları yükle
        if (typeof window.loadDokumanlar === 'function') {
            // ViewBag'den gelen global değişkenleri kullan
            const userRole = window.userRole;
            const firmaId = window.firmaId;
            const kullaniciId = window.kullaniciId;

            let initialRefTableName = 'Firmalar';
            let initialRefId = 1; // Varsayılan
            let initialTarget = '#manualFolders_firmam';
            let initialDokumanTuru = 'Manuel';

            if (userRole !== 'OSGB' && userRole !== 'İşveren' && kullaniciId > 0) {
                // FirmaId olmayan kullanıcılar için Kişisel Alan yükle
                initialRefTableName = 'Kullanicilar';
                initialRefId = kullaniciId;
                initialTarget = '#manualFolders_kisisel';
                window.currentManualSection = 'kisisel'; // currentManualSection'ı ayarla
                console.log(`main.js: FirmaId olmayan kullanıcı için Kişisel Alan yükleniyor: refTableName=${initialRefTableName}, refId=${initialRefId}, target=${initialTarget}, dokumanTuru=${initialDokumanTuru}`);
            } else if (firmaId > 0) {
                // FirmaId olanlar için orijinal
                initialRefId = firmaId;
                console.log(`main.js: FirmaId olan kullanıcı için Firmam yükleniyor: refTableName=${initialRefTableName}, refId=${initialRefId}, target=${initialTarget}, dokumanTuru=${initialDokumanTuru}`);
            } else {
                console.error('main.js: FirmaId veya KullaniciId tanımlı değil!');
                return;
            }

            loadDokumanlar(initialRefTableName, initialRefId, initialTarget, initialDokumanTuru, true);
        } else {
            console.error('main.js: loadDokumanlar fonksiyonu tanımlı değil! documentManager.js dosyasını kontrol edin.');
        }
    } catch (error) {
        console.error('main.js: document.ready içinde hata:', error);
    }
});