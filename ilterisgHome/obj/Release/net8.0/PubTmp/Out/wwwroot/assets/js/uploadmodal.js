/* wwwroot/assets/js/uploadmodal.js */
class UploadModal {
    filename = "";
    isUploading = false;
    progress = 0;
    progressTimeout = null;
    state = 0;

    constructor(el) {
        this.el = document.querySelector(el);
        this.form = this.el?.querySelector("#dokumanYukleForm");
        this.fileInput = this.el?.querySelector("#dosya");
        this.aciklamaInput = this.el?.querySelector("#aciklama");

        console.log("UploadModal initialized:", this.el);

        // Olay dinleyicileri
        this.el?.addEventListener("click", this.action.bind(this));
        if (this.fileInput) {
            this.fileInput.addEventListener("change", this.fileHandle.bind(this));
            console.log("File input change listener added");
        } else {
            console.error("File input (#dosya) not found");
        }
        if (this.form) {
            this.form.addEventListener("submit", this.handleFormSubmit.bind(this));
            console.log("Form submit listener added");
        } else {
            console.error("Form (#dokumanYukleForm) not found");
        }

        // Bootstrap modal olayları
        $(this.el).on("show.bs.modal", this.resetModal.bind(this));
        $(this.el).on("hidden.bs.modal", this.resetModal.bind(this));
    }

    action(e) {
        const action = e.target?.getAttribute("data-action");
        console.log("Action triggered:", action);
        if (action && typeof this[action] === "function") {
            this[action](e);
        }
        this.stateDisplay();
    }

    cancel() {
        console.log("Cancel method called");
        this.isUploading = false;
        this.progress = 0;
        clearTimeout(this.progressTimeout);
        this.progressTimeout = null;
        this.state = 0;
        this.stateDisplay();
        this.progressDisplay();
        this.fileReset();
        $(this.el).modal("hide");
    }

    file() {
        console.log("File selection triggered");
        this.fileInput?.click();
    }

    fileDisplay(name = "") {
        console.log("fileDisplay called with name:", name);
        this.filename = name;
        const fileValue = this.el?.querySelector("#file-name");
        if (fileValue) {
            fileValue.textContent = this.filename || "Dosya seçilmedi";
            console.log("File name updated to:", this.filename);
        } else {
            console.error("File name element (#file-name) not found");
        }
        this.el?.setAttribute("data-ready", this.filename ? "true" : "false");
        console.log("data-ready set to:", this.filename ? "true" : "false");

        // DOM'u manuel olarak güncelle
        const fileSelectedAction = this.el?.querySelector('[data-action-type="file-selected"]');
        const selectAction = this.el?.querySelector('[data-action-type="select"]');
        if (this.filename) {
            if (fileSelectedAction) fileSelectedAction.style.display = 'flex';
            if (selectAction) selectAction.style.display = 'none';
        } else {
            if (fileSelectedAction) fileSelectedAction.style.display = 'none';
            if (selectAction) selectAction.style.display = 'flex';
        }
    }

    fileHandle(e) {
        console.log("fileHandle called");
        const { target } = e;
        if (target?.files?.length) {
            console.log("File selected:", target.files[0].name);
            this.fileDisplay(target.files[0].name);
        } else {
            console.log("No file selected");
            this.fileDisplay("");
        }
    }

    fileReset() {
        console.log("fileReset called");
        if (this.fileInput) {
            this.fileInput.value = "";
            console.log("File input reset");
        } else {
            console.error("File input not found during reset");
        }
        if (this.aciklamaInput) {
            this.aciklamaInput.value = "";
            console.log("Description input reset");
        }
        this.fileDisplay("");
    }

    progressDisplay() {
        console.log("progressDisplay called, progress:", this.progress);
        const progressValue = this.el?.querySelector("[data-progress-value]");
        const progressFill = this.el?.querySelector("[data-progress-fill]");
        const progressTimes100 = Math.floor(this.progress * 100);

        if (progressValue) progressValue.textContent = `${progressTimes100}%`;
        if (progressFill) progressFill.style.transform = `translateX(${progressTimes100}%)`;
    }

    progressLoop() {
        this.progressDisplay();
        if (this.isUploading && this.progress < 1) {
            this.progress += 0.01;
            this.progressTimeout = setTimeout(this.progressLoop.bind(this), 50);
        }
    }

    stateDisplay() {
        console.log("stateDisplay called, new state:", this.state);
        this.el?.setAttribute("data-state", `${this.state}`);
    }

    success() {
        console.log("success method called");
        this.isUploading = false;
        this.state = 3;
        this.stateDisplay();
    }

    fail() {
        console.log("fail method called");
        this.isUploading = false;
        this.progress = 0;
        clearTimeout(this.progressTimeout);
        this.progressTimeout = null;
        this.state = 2;
        this.stateDisplay();
    }

    resetModal() {
        console.log("resetModal called");
        this.isUploading = false;
        this.progress = 0;
        clearTimeout(this.progressTimeout);
        this.progressTimeout = null;
        this.state = 0;
        this.stateDisplay();
        this.progressDisplay();
        this.fileReset();
        // Formu sıfırlama, ancak refTableName ve refId değerlerini koru
        const refTableName = $('#refTableName').val();
        const refId = $('#refId').val();
        const dokumanTuru = $('#dokumanTuru').val();
        const altKategori = $('#altKategori').val();
        this.form?.reset();
        $('#refTableName').val(refTableName);
        $('#refId').val(refId);
        $('#dokumanTuru').val(dokumanTuru);
        $('#altKategori').val(altKategori);
        console.log("Form reset, refTableName:", refTableName, "refId:", refId);
    }

    handleFormSubmit(e) {
        console.log("handleFormSubmit called");
        e.preventDefault();
        if (!this.isUploading) {
            this.isUploading = true;
            this.state = 1;
            this.progress = 0;
            this.stateDisplay();
            this.progressLoop();
            console.log("Starting file upload...");

            const formData = new FormData(this.form);
            const refTableName = formData.get("refTableName");
            const refId = formData.get("refId");
            const dokumanTuru = formData.get("dokumanTuru");
            const altKategori = formData.get("altKategori");
            console.log("Form data - refTableName:", refTableName, "refId:", refId, "dokumanTuru:", dokumanTuru, "altKategori:", altKategori);
            if (altKategori) {
                formData.set("aciklama", JSON.stringify({ altKategori: altKategori }));
                console.log("AltKategori set in formData:", altKategori);
            }

            $.ajax({
                url: "/Dokuman/DokumanYukle",
                type: "POST",
                data: formData,
                processData: false,
                contentType: false,
                success: (response) => {
                    console.log("Upload success, response:", response);
                    if (response.success) {
                        this.progress = 1;
                        this.success();
                        Swal.fire({
                            icon: "success",
                            title: "Başarılı",
                            text: "Doküman başarıyla yüklendi!",
                            confirmButtonText: "Tamam"
                        }).then(() => {
                            $(this.el).modal("hide");
                            console.log("Modal hidden after successful upload");

                            // Doküman listesini yenile
                            const klasorConfig = {
                                "Dekont": {
                                    refTableName: "Firmalar",
                                    firmamTarget: "#firmamOdemeler",
                                    firmalarimTarget: `#firmaOdemeler_${refId}`,
                                    dokumanTuru: "Dekont",
                                    altKategori: null
                                },
                                "Sozlesme_FirmaSozlesmesi": {
                                    refTableName: "Firmalar",
                                    firmamTarget: "#firmamFirmaSozlesmeleri",
                                    firmalarimTarget: `#firmaSozlesmeler_${refId}`,
                                    firmalarimRefTableName: "Sozlesmeler",
                                    dokumanTuru: "Sozlesme",
                                    altKategori: "FirmaSozlesmesi"
                                },
                                "Sozlesme_PersonelSozlesmesi": {
                                    refTableName: "Kullanicilar",
                                    firmamTarget: "#firmamPersonelSozlesmeleri",
                                    firmalarimTarget: null,
                                    dokumanTuru: "Sozlesme",
                                    altKategori: "PersonelSozlesmesi"
                                },
                                "EgitimMateryali": {
                                    refTableName: "EgitimTuruMateryalleri",
                                    firmamTarget: "#firmamEgitimler",
                                    firmalarimTarget: `#firmaEgitimler_${refId}`,
                                    dokumanTuru: "EgitimMateryali",
                                    altKategori: null
                                },
                                "Etkinlik": {
                                    refTableName: "Firmalar",
                                    firmamTarget: "#firmamEtkinlikler",
                                    firmalarimTarget: `#firmaEtkinlikler_${refId}`,
                                    dokumanTuru: null,
                                    altKategori: null
                                },
                                "ToplantiNotu": {
                                    refTableName: "Firmalar",
                                    firmamTarget: "#firmamEtkinlikler",
                                    firmalarimTarget: `#firmaEtkinlikler_${refId}`,
                                    dokumanTuru: null,
                                    altKategori: null
                                },
                                "Ziyaret": {
                                    refTableName: "Firmalar",
                                    firmamTarget: "#firmamEtkinlikler",
                                    firmalarimTarget: `#firmaEtkinlikler_${refId}`,
                                    dokumanTuru: null,
                                    altKategori: null
                                },
                                "Diger": {
                                    refTableName: "Firmalar",
                                    firmamTarget: "#firmamDiger",
                                    firmalarimTarget: `#firmaDiger_${refId}`,
                                    dokumanTuru: "Diger",
                                    altKategori: null
                                },
                                "Diger_Personel": {
                                    refTableName: "Kullanicilar",
                                    firmamTarget: null,
                                    firmalarimTarget: `#personelDiger_${refId}`,
                                    dokumanTuru: "Diger",
                                    altKategori: null
                                },
                                "Ozluk": {
                                    refTableName: "Kullanicilar",
                                    firmamTarget: null,
                                    firmalarimTarget: `#personelOzluk_${refId}`,
                                    dokumanTuru: null,
                                    altKategori: null
                                },
                                "KisiselAlan": {
                                    refTableName: "Firmalar",
                                    firmamTarget: "#firmamKisiselAlan",
                                    firmalarimTarget: `#firmaKisiselAlan_${refId}`,
                                    dokumanTuru: "KisiselAlan",
                                    altKategori: null
                                },
                                "KisiselAlan_Personel": {
                                    refTableName: "Kullanicilar",
                                    firmamTarget: null,
                                    firmalarimTarget: `#personelKisiselAlan_${refId}`,
                                    dokumanTuru: "KisiselAlan",
                                    altKategori: null
                                },
                                "KisiselAlan_Kisisel": {
                                    refTableName: "Kullanicilar",
                                    firmamTarget: null,
                                    firmalarimTarget: "#kisiselAlan",
                                    dokumanTuru: "KisiselAlan",
                                    altKategori: null
                                }
                            };

                            const key = altKategori ? `${dokumanTuru}_${altKategori}` : (dokumanTuru === "Diger" && refTableName === "Kullanicilar") ? "Diger_Personel" : (dokumanTuru === "KisiselAlan" && refTableName === "Kullanicilar" && $("#kisisel").hasClass("active")) ? "KisiselAlan_Kisisel" : (dokumanTuru === "KisiselAlan" && refTableName === "Kullanicilar") ? "KisiselAlan_Personel" : dokumanTuru || "Ozluk";
                            const config = klasorConfig[key];

                            if (config) {
                                const isFirmamActive = $("#firmam").hasClass("active");
                                const target = isFirmamActive ? config.firmamTarget : config.firmalarimTarget;
                                const loadRefTableName = (isFirmamActive || !config.firmalarimRefTableName) ? config.refTableName : config.firmalarimRefTableName;

                                if (target && typeof loadDokumanlar === "function") {
                                    loadDokumanlar(loadRefTableName, refId, target, config.dokumanTuru, config.altKategori);
                                    console.log("Dokumanlar loaded for target:", target);
                                } else {
                                    console.error("loadDokumanlar function not found or target invalid");
                                }
                            } else {
                                console.warn(`Klasör yapılandırması bulunamadı: ${key}`);
                            }
                        });
                    } else {
                        this.fail();
                        Swal.fire({
                            icon: "error",
                            title: "Hata",
                            text: response.message,
                            confirmButtonText: "Tamam"
                        });
                    }
                },
                error: (xhr, status, error) => {
                    console.error("Upload error:", error);
                    this.fail();
                    Swal.fire({
                        icon: "error",
                        title: "Hata",
                        text: "Doküman yüklenirken hata oluştu: " + error,
                        confirmButtonText: "Tamam"
                    });
                }
            });
        }
    }
}

// Modal başlat
$(document).ready(function () {
    console.log("Initializing UploadModal...");
    new UploadModal("#dokumanYukleModal");
});