document.addEventListener("DOMContentLoaded", function () {
    const startExamBtn = document.getElementById("start-exam-btn");
    const examContainer = document.getElementById("exam-container");
    const saveExamBtn = document.getElementById("save-exam-btn");
    const signDocumentBtn = document.getElementById("sign-document-btn");
    const approveDocumentBtn = document.getElementById("approve-document-btn");
    const documentApprovalModal = new bootstrap.Modal(document.getElementById("document-approval-modal"));
    const signatureModal = new bootstrap.Modal(document.getElementById("signature-modal"));
    const signaturePadCanvas = document.getElementById("signature-pad");
    const clearSignatureBtn = document.getElementById("clear-signature-btn");
    const saveSignatureBtn = document.getElementById("save-signature-btn");
    const nextTestBtn = document.getElementById("next-test-btn");
    const katilimIdInput = document.getElementById("katilim-id");
    const katilimId = katilimIdInput ? parseInt(katilimIdInput.value, 10) : null;

    let signaturePad = null;
    let currentQuestionIndex = 0;
    let answers = {};
    let isFinalExam = false;
    let currentTabIndex = 0;
    const tabs = ["egitim-turu-tab", "materyal-tab", "soru-tab", "onay-tab"];

    console.log("KatilimId:", katilimId);

    if (!katilimId || katilimId <= 0) {
        console.error("KatilimId sıfır veya tanımsız, Zaman:", new Date().toISOString());
        Swal.fire('Hata!', 'Katılım ID bulunamadı veya geçersiz.', 'error');
        return;
    }

    if (startExamBtn) {
        startExamBtn.addEventListener("click", function () {
            document.querySelector("#soru-tab").click();
            currentTabIndex = 2;
            startExamBtn.style.display = "none";
            if (examContainer) {
                examContainer.style.display = "block";
            }
            isFinalExam = false; // İlk sınav için
        });
    }

    document.querySelectorAll(".next-question-btn").forEach(btn => {
        btn.addEventListener("click", function (event) {
            event.preventDefault(); // Form submit işlemini engelle
            try {
                const currentQuestion = document.querySelector(`.question-container:nth-child(${currentQuestionIndex + 1})`);
                if (!currentQuestion) {
                    console.error("Mevcut soru bulunamadı, currentQuestionIndex:", currentQuestionIndex);
                    Swal.fire('Hata!', 'Mevcut soru bulunamadı.', 'error');
                    return;
                }

                const questionId = currentQuestion.getAttribute("data-question-id");
                const selectedAnswer = document.querySelector(`input[name="answer-${questionId}"]:checked`);
                if (!selectedAnswer) {
                    Swal.fire('Hata!', 'Lütfen bir cevap seçin.', 'error');
                    return;
                }

                answers[questionId] = selectedAnswer.value;
                console.log("Seçilen cevap:", questionId, selectedAnswer.value);
                console.log("Answers nesnesi:", answers);

                currentQuestion.classList.remove("active");
                currentQuestionIndex++;

                if (currentQuestionIndex < document.querySelectorAll(".question-container").length) {
                    const nextQuestion = document.querySelector(`.question-container:nth-child(${currentQuestionIndex + 1})`);
                    if (nextQuestion) {
                        nextQuestion.classList.add("active");
                    } else {
                        console.error("Sonraki soru bulunamadı, currentQuestionIndex:", currentQuestionIndex);
                        Swal.fire('Hata!', 'Sonraki soru bulunamadı.', 'error');
                    }
                } else {
                    if (saveExamBtn) {
                        saveExamBtn.style.display = "block";
                    }
                }
            } catch (err) {
                console.error("İleri butonunda hata:", err);
                Swal.fire('Hata!', 'Bir hata oluştu: ' + err.message, 'error');
            }
        });
    });

    if (saveExamBtn) {
        saveExamBtn.addEventListener("click", function (event) {
            event.preventDefault(); // Form submit işlemini engelle
            if (!katilimId || katilimId <= 0) {
                console.error("KatilimId sıfır veya tanımsız, Zaman:", new Date().toISOString());
                Swal.fire('Hata!', 'Katılım ID bulunamadı veya geçersiz.', 'error');
                return;
            }

            let score = 0;
            const totalQuestions = document.querySelectorAll(".question-container").length;

            document.querySelectorAll(".question-container").forEach(question => {
                const questionId = question.getAttribute("data-question-id");
                const correctAnswer = document.getElementById(`correct-answer-${questionId}`).value;
                console.log(`Soru ID: ${questionId}, Kullanıcı Cevabı: ${answers[questionId]}, Doğru Cevap: ${correctAnswer}`);
                if (answers[questionId] && answers[questionId] === correctAnswer) {
                    score++;
                }
            });

            const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
            console.log("Toplam Soru:", totalQuestions, "Doğru Sayısı:", score, "Yüzde:", percentage);

            // Form alanlarını doldur
            document.getElementById("form-katilim-id").value = katilimId;
            document.getElementById("form-puan").value = percentage;
            document.getElementById("form-is-final-exam").value = isFinalExam;

            // Formu submit et
            const form = document.getElementById("exam-form");
            const formData = new FormData(form);
            const actionUrl = isFinalExam ? '/Egitimlerim/SonrasiTest' : '/Egitimlerim/OncesiTest';
            fetch(actionUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            })
                .then(response => {
                    if (!response.ok) {
                        return response.text().then(text => {
                            throw new Error('Sınav kaydedilemedi: ' + response.statusText + ' - Response: ' + text);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        if (data.puan >= 70) {
                            Swal.fire('Başarılı!', `Sınavdan ${data.puan} puan aldınız. Eğitimi başarıyla tamamladınız!`, 'success');
                            if (examContainer) {
                                examContainer.style.display = "none";
                            }
                            const onayTab = document.querySelector("#onay-tab");
                            if (onayTab) {
                                onayTab.click();
                            }
                            currentTabIndex = 3; // Onay sekmesi
                        } else {
                            Swal.fire('Başarısız!', `Sınavdan ${data.puan} puan aldınız. Eğitimi tamamlamak için videoyu izleyin.`, 'warning');
                            if (examContainer) {
                                examContainer.style.display = "none";
                            }
                            const materyalTab = document.querySelector("#materyal-tab");
                            if (materyalTab) {
                                materyalTab.click();
                            }
                            currentTabIndex = 1;
                        }
                    } else {
                        Swal.fire('Hata!', data.message || 'Sınav kaydedilemedi.', 'error');
                    }
                })
                .catch(err => {
                    console.error("Form submit sırasında hata:", err);
                    Swal.fire('Hata!', 'Sınav kaydedilemedi: ' + err.message, 'error');
                });
        });
    }

    if (nextTestBtn) {
        nextTestBtn.addEventListener("click", function () {
            Swal.fire({
                icon: 'info',
                title: '2. Sınava Başlamalısınız',
                text: 'İlk sınavdan 70 puan ve üzeri alamadınız. Eğitimi tamamlamak için 2. sınava girmelisiniz.',
                confirmButtonText: 'Tamam'
            }).then(() => {
                document.querySelector("#soru-tab").click();
                currentTabIndex = 2;
                if (examContainer) {
                    examContainer.style.display = "block";
                    currentQuestionIndex = 0;
                    answers = {};
                    // Tüm soru container’larını sıfırla
                    document.querySelectorAll(".question-container").forEach(q => {
                        q.classList.remove("active");
                        // Seçili cevapları sıfırla
                        const questionId = q.getAttribute("data-question-id");
                        const radios = document.querySelectorAll(`input[name="answer-${questionId}"]`);
                        radios.forEach(radio => radio.checked = false);
                    });
                    // İlk soruyu aktif yap
                    const firstQuestion = document.querySelector(".question-container:nth-child(1)");
                    if (firstQuestion) {
                        firstQuestion.classList.add("active");
                    } else {
                        console.error("İlk soru bulunamadı.");
                        Swal.fire('Hata!', 'Sınav soruları yüklenemedi.', 'error');
                    }
                    if (saveExamBtn) {
                        saveExamBtn.style.display = "none";
                    }
                    isFinalExam = true; // 2. sınav için
                }
            });
        });
    }

    if (signDocumentBtn) {
        signDocumentBtn.addEventListener("click", function () {
            documentApprovalModal.show();
        });
    }

    if (approveDocumentBtn) {
        approveDocumentBtn.addEventListener("click", function () {
            documentApprovalModal.hide();
            signatureModal.show();
            // Canvas’ın boyutlarını ayarla
            const canvas = signaturePadCanvas;
            const parent = canvas.parentElement;
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = parent.offsetWidth * ratio;
            canvas.height = 200 * ratio; // Sabit yükseklik
            canvas.style.width = parent.offsetWidth + 'px';
            canvas.style.height = '200px';
            canvas.getContext("2d").scale(ratio, ratio);
            // SignaturePad’i başlat
            signaturePad = new SignaturePad(canvas, {
                backgroundColor: 'rgb(255, 255, 255)', // Beyaz arka plan
                penColor: 'rgb(0, 0, 0)', // Siyah kalem
                onBegin: function () {
                    console.log("Çizim başladı.");
                },
                onEnd: function () {
                    console.log("Çizim bitti.");
                }
            });
            // Canvas’ı temizle (önceki çizimleri kaldırmak için)
            signaturePad.clear();
        });
    }

    if (clearSignatureBtn) {
        clearSignatureBtn.addEventListener("click", function () {
            signaturePad.clear();
        });
    }

    if (saveSignatureBtn) {
        saveSignatureBtn.addEventListener("click", function () {
            if (!katilimId || katilimId <= 0) {
                console.error("KatilimId sıfır veya tanımsız, Zaman:", new Date().toISOString());
                Swal.fire('Hata!', 'Katılım ID bulunamadı veya geçersiz.', 'error');
                return;
            }

            // İmza verisini kontrol et
            if (signaturePad.isEmpty()) {
                Swal.fire('Hata!', 'Lütfen bir imza çizin.', 'error');
                return;
            }

            const signatureData = signaturePad.toDataURL('image/png');
            if (!signatureData) {
                console.error("İmza verisi alınamadı.");
                Swal.fire('Hata!', 'İmza verisi alınamadı.', 'error');
                return;
            }

            // Belgeyi oluştur ve imzanın altına ekle
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const userName = document.getElementById("kullaniciAdSoyad").value;
            const educationName = "@Model.Egitim.EgitimTuru.Ad";
            const approvalText = `Ben ${userName}, ${educationName} eğitimine katıldım, başarıyla tamamladım ve onaylıyorum.`;
            doc.setFontSize(12);
            doc.text(approvalText, 10, 10);

            // İmza görüntüsünü PDF’e ekle
            const imgWidth = 50;
            const imgHeight = 20;
            doc.addImage(signatureData, 'PNG', 10, 30, imgWidth, imgHeight);

            // PDF’i base64 formatında al
            const pdfBase64 = doc.output('datauristring').split(',')[1];

            const requestBody = {
                katilimId: katilimId,
                imzaVerisi: signatureData,
                pdfBase64: pdfBase64
            };
            console.log("İmza atma isteği zamanı:", new Date().toISOString());
            console.log("İmza atma isteği öncesi KatilimId:", katilimId);
            console.log("Gönderilen veri:", JSON.stringify(requestBody));

            fetch('/Egitimlerim/ImzaAt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]').value
                },
                body: JSON.stringify(requestBody)
            })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(data => {
                            throw new Error(data.message || 'İmza atılamadı: ' + response.statusText);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        signatureModal.hide();
                        Swal.fire('Başarılı!', 'İmza başarıyla atıldı. Eğitim tamamlandı!', 'success');
                        if (signDocumentBtn) {
                            signDocumentBtn.style.display = "none";
                        }
                        const egitimTuruTab = document.querySelector("#egitim-turu-tab");
                        if (egitimTuruTab) {
                            egitimTuruTab.click();
                        }
                        currentTabIndex = 0;
                        // Sayfayı yenile
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
                    } else {
                        Swal.fire('Hata!', data.message || 'İmza atılamadı.', 'error');
                    }
                })
                .catch(err => {
                    console.error("İmza atma isteği sırasında hata:", err);
                    Swal.fire('Hata!', 'İmza atılamadı: ' + err.message, 'error');
                });
        });
    }
});