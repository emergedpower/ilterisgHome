class UploadModal {
    filename = "";
    isCopying = false;
    isUploading = false;
    progress = 0;
    progressTimeout = null;
    state = 0;
    refTableName = "";
    refId = null;
    dokumanTuru = "";
    altKategori = "";
    aciklama = "";

    constructor(el) {
        this.el = document.querySelector(el);
        this.el?.addEventListener("click", this.action.bind(this));
        this.el?.querySelector("#file")?.addEventListener("change", this.fileHandle.bind(this));
    }

    open(refTableName, refId, dokumanTuru, altKategori) {
        this.refTableName = refTableName;
        this.refId = refId;
        this.dokumanTuru = dokumanTuru;
        this.altKategori = altKategori;
        this.aciklama = altKategori ? JSON.stringify({ altKategori: altKategori }) : '';

        // Dosya türü kısıtlamasını dinamik olarak ayarla
        const fileInput = this.el?.querySelector("#file");
        if (fileInput) {
            if (dokumanTuru === 'KisiselAlan') {
                fileInput.setAttribute('accept', '*'); // Kişisel Alan için tüm dosya türlerine izin ver
            } else {
                fileInput.setAttribute('accept', '.pdf,.doc,.docx,.png,.jpg,.jpeg'); // Diğer doküman türleri için belirli formatlar
            }
        }

        this.cancel(); // Modal açıldığında sıfırlama
        $(this.el).modal('show');
    }

    action(e) {
        const action = e.target?.getAttribute("data-action");
        if (action) {
            this[action]?.();
            this.stateDisplay();
        }
    }

    cancel() {
        this.isUploading = false;
        this.progress = 0;
        this.progressTimeout = null;
        this.state = 0;
        this.stateDisplay();
        this.progressDisplay();
        this.fileReset();
        $(this.el).modal('hide');
    }

    async copy() {
        const copyButton = this.el?.querySelector("[data-action='copy']");

        if (!this.isCopying && copyButton) {
            this.isCopying = true;
            copyButton.style.width = `${copyButton.offsetWidth}px`;
            copyButton.disabled = true;
            copyButton.textContent = "Copied!";
            navigator.clipboard.writeText(this.filename);
            await new Promise(res => setTimeout(res, 1000));
            this.isCopying = false;
            copyButton.removeAttribute("style");
            copyButton.disabled = false;
            copyButton.textContent = "Copy Link";
        }
    }

    fail() {
        this.isUploading = false;
        this.progress = 0;
        this.progressTimeout = null;
        this.state = 2;
        this.stateDisplay();
    }

    file() {
        this.el?.querySelector("#file").click();
    }

    fileDisplay(name = "") {
        this.filename = name;
        const fileValue = this.el?.querySelector("[data-file]");
        if (fileValue) fileValue.textContent = this.filename;
        this.el?.setAttribute("data-ready", this.filename ? "true" : "false");
    }

    fileHandle(e) {
        return new Promise(() => {
            const { target } = e;
            if (target?.files.length) {
                let reader = new FileReader();
                reader.onload = e2 => {
                    this.fileDisplay(target.files[0].name);
                };
                reader.readAsDataURL(target.files[0]);
            }
        });
    }

    fileReset() {
        const fileField = this.el?.querySelector("#file");
        if (fileField) fileField.value = null;
        this.fileDisplay();
    }

    progressDisplay() {
        const progressValue = this.el?.querySelector("[data-progress-value]");
        const progressFill = this.el?.querySelector("[data-progress-fill]");
        const progressTimes100 = Math.floor(this.progress * 100);

        if (progressValue) progressValue.textContent = `${progressTimes100}%`;
        if (progressFill) progressFill.style.transform = `translateX(${progressTimes100}%)`;
    }

    async progressLoop() {
        this.progressDisplay();

        if (this.isUploading) {
            if (this.progress === 0) {
                await new Promise(res => setTimeout(res, 1000));
                if (!this.isUploading) {
                    return;
                } else if (Utils.randomInt(0, 2) === 0) {
                    this.fail();
                    return;
                }
            }
            if (this.progress < 1) {
                this.progress += 0.01;
                this.progressTimeout = setTimeout(this.progressLoop.bind(this), 50);
            } else if (this.progress >= 1) {
                this.progressTimeout = setTimeout(() => {
                    if (this.isUploading) {
                        this.success();
                        this.stateDisplay();
                        this.progressTimeout = null;
                    }
                }, 250);
            }
        }
    }

    stateDisplay() {
        this.el?.setAttribute("data-state", `${this.state}`);
    }

    success() {
        this.isUploading = false;
        this.state = 3;
        this.stateDisplay();
    }

    async upload() {
        if (!this.isUploading) {
            this.isUploading = true;
            this.progress = 0;
            this.state = 1;
            this.progressLoop();

            const fileInput = this.el?.querySelector("#file");
            if (!fileInput.files.length) {
                this.fail();
                return;
            }

            const formData = new FormData();
            formData.append('dosya', fileInput.files[0]);
            formData.append('refTableName', this.refTableName);
            formData.append('refId', this.refId);
            formData.append('dokumanTuru', this.dokumanTuru);
            formData.append('altKategori', this.altKategori);
            formData.append('aciklama', this.aciklama);

            try {
                const response = await $.ajax({
                    url: '/Dokuman/DokumanYukle',
                    type: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false
                });

                if (response.success) {
                    this.success();
                    setTimeout(() => {
                        this.cancel();
                        // Tüm dokümanları yeniden yükle
                        loadDokumanlar('Firmalar', this.refId, '#firmamOdemeler', 'Dekont');
                        loadDokumanlar('Kullanicilar', this.refId, '#firmamPersonelSozlesmeleri', 'Sozlesme', 'PersonelSozlesmesi');
                        loadDokumanlar('Firmalar', this.refId, '#firmamFirmaSozlesmeleri', 'Sozlesme', 'FirmaSozlesmesi');
                        loadDokumanlar('EgitimTuruMateryalleri', this.refId, '#firmamEgitimler', 'EgitimMateryali');
                        loadDokumanlar('Firmalar', this.refId, '#firmamEtkinlikler', null);
                        loadDokumanlar('Firmalar', this.refId, '#firmamDiger', 'Diger');
                        loadDokumanlar('Firmalar', this.refId, '#firmamKisiselAlan', 'KisiselAlan');

                        // Diğer sekmeler için de yeniden yükleme yapılabilir
                        // Firmalarım, Personellerim ve Dokümanlarım sekmeleri için loadDokumanlar çağrıları
                    }, 1000);
                } else {
                    this.fail();
                }
            } catch (error) {
                this.fail();
            }
        }
    }
}

class Utils {
    static randomInt(min = 0, max = 2 ** 32) {
        const percent = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
        const relativeValue = (max - min) * percent;
        return Math.round(min + relativeValue);
    }
}