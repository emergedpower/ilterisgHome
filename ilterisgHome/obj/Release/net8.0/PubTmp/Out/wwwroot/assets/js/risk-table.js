const { createApp } = Vue;

createApp({
    data() {
        return {
            sahaRiskGruplari: window.initialRisks || [{ Saha: 'GenelSaha', Riskler: [] }],
            activeSahaIndex: 0,
            pageSize: 10,
            currentPage: 1,
            analizMetodu: document.querySelector('input[name="AnalizMetodu"]:checked')?.value || '5x5',
            teminSuresi: document.querySelector('#TeminSuresi')?.value || '90',
            firmaId: parseInt(document.querySelector('#SecilenFirmaField').value) || 0,
            analizGrupId: document.querySelector('input[name="AnalizGrupId"]').value,
            riskCache: {},
            isProcessing: false,
            translations: window.translations || {},
            mevzuatList: [],
            searchTerm: '',
            manualRisks: {}, // SahaIndex bazında manuel risk formlarını tutar
            aiResponses: {}, // SahaIndex ve manualRiskIndex bazında AI yanıtlarını tutar
            isRecognizing: false,
            finalTranscript: ''
        };
    },
    computed: {
        pagedRisks() {
            const cacheKey = `${this.sahaRiskGruplari[this.activeSahaIndex]?.Saha}_all`;
            const risks = this.riskCache[cacheKey]?.risks || [];
            const start = (this.currentPage - 1) * this.pageSize;
            return risks.slice(start, start + this.pageSize);
        },
        totalPages() {
            const cacheKey = `${this.sahaRiskGruplari[this.activeSahaIndex]?.Saha}_all`;
            return this.riskCache[cacheKey]?.totalPages || 1;
        }
    },
    methods: {
        addRisk(sahaIndex, risk) {
            this.sahaRiskGruplari[sahaIndex].Riskler.push({
                Id: null,
                RiskDegerlendirmeId: risk.id || `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                RiskAdi: risk.riskTanimi || risk.RiskAdi || '',
                RiskAciklamasi: risk.riskFaktorleri || risk.RiskAciklamasi || '',
                RiskZarari: risk.riskZarari || risk.RiskZarari || '',
                OnerilenOnlem: risk.kontrolOnlemleri || risk.OnerilenOnlem || '',
                Olasilik: this.analizMetodu === '5x5' ? (risk.olasilik5x5 || risk.Olasilik || 3) : (risk.olasilikFineKinney || risk.Olasilik || 3),
                Siddet: this.analizMetodu === '5x5' ? (risk.siddet5x5 || risk.Siddet || 3) : null,
                Maruziyet: this.analizMetodu === 'Fine-Kinney' ? (risk.frekansFineKinney || risk.Maruziyet || 3) : null,
                FinneySiddet: this.analizMetodu === 'Fine-Kinney' ? (risk.siddetFineKinney || risk.FinneySiddet || 3) : null,
                AnalizMetodu: this.analizMetodu,
                Saha: this.sahaRiskGruplari[sahaIndex].Saha,
                TeminSuresi: this.teminSuresi,
                Notlar: risk.Notlar || '',
                MevzuatId: parseInt(risk.mevzuatId || risk.MevzuatId) || 0,
                MevzuatAdi: risk.mevzuatAdi || risk.MevzuatAdi || this.translations.SelectLegislation,
                Olasilik5x5: risk.olasilik5x5 || risk.Olasilik || 3,
                Siddet5x5: risk.siddet5x5 || risk.Siddet || 3,
                OlasilikFineKinney: risk.olasilikFineKinney || risk.Olasilik || 3,
                FrekansFineKinney: risk.frekansFineKinney || risk.Maruziyet || 3,
                SiddetFineKinney: risk.siddetFineKinney || risk.FinneySiddet || 3
            });
            if (sahaIndex === this.activeSahaIndex) {
                this.$forceUpdate();
            }
            this.updateSubmitButton();
        },
        removeRisk(sahaIndex, riskIndex) {
            this.sahaRiskGruplari[sahaIndex].Riskler.splice(riskIndex, 1);
            if (sahaIndex === this.activeSahaIndex) {
                this.$forceUpdate();
            }
            this.updateSubmitButton();
        },
        addSaha() {
            if (this.isProcessing) return;
            this.isProcessing = true;
            const newSahaIndex = this.sahaRiskGruplari.length;
            this.sahaRiskGruplari.push({ Saha: 'GenelSaha', Riskler: [], isSubmitted: false });
            this.activeSahaIndex = newSahaIndex;
            this.currentPage = 1;
            this.isProcessing = false;
        },
        removeSaha(sahaIndex) {
            if (this.isProcessing || this.sahaRiskGruplari.length <= 1) return;
            this.isProcessing = true;
            Swal.fire({
                icon: 'warning',
                title: this.translations.DeleteField,
                text: this.translations.ConfirmDeleteField.replace('{0}', this.translations[this.sahaRiskGruplari[sahaIndex].Saha] || this.sahaRiskGruplari[sahaIndex].Saha),
                showCancelButton: true,
                confirmButtonText: this.translations.Yes,
                cancelButtonText: this.translations.No
            }).then((result) => {
                if (result.isConfirmed) {
                    fetch('/RiskAnaliz/DeleteSaha', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]').value
                        },
                        body: JSON.stringify({
                            FirmaId: this.firmaId,
                            AnalizGrupId: this.analizGrupId,
                            Saha: this.convertSahaToEnum(this.sahaRiskGruplari[sahaIndex].Saha)
                        })
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                this.sahaRiskGruplari.splice(sahaIndex, 1);
                                delete this.manualRisks[sahaIndex];
                                delete this.aiResponses[sahaIndex];
                                if (this.activeSahaIndex >= this.sahaRiskGruplari.length) {
                                    this.activeSahaIndex = this.sahaRiskGruplari.length - 1;
                                }
                                Swal.fire({ icon: 'success', text: this.translations.FieldDeleted });
                            } else {
                                Swal.fire({ icon: 'error', text: data.errors?.join('\n') || 'Hata oluştu' });
                            }
                        })
                        .catch(() => Swal.fire({ icon: 'error', text: 'Saha silme başarısız' }))
                        .finally(() => this.isProcessing = false);
                } else {
                    this.isProcessing = false;
                }
            });
        },
        loadRiskSuggestions(sahaIndex, saha, page = 1, forceAI = false) {
            if (this.isProcessing || !saha) {
                Swal.fire({ icon: 'error', text: this.translations.SelectFieldFirst });
                return;
            }
            this.isProcessing = true;
            const cacheKey = `${saha}_all`;
            if (this.riskCache[cacheKey] && !forceAI && !this.searchTerm) {
                this.currentPage = page;
                this.isProcessing = false;
                return;
            }
            document.getElementById('aiLoadingOverlay').classList.add('show');
            document.getElementById('aiLoadingCard').classList.add('show');
            fetch(`/RiskAnaliz/GetOnerilenRisklerBySaha?firmaId=${this.firmaId}&saha=${saha}&page=0&searchTerm=${this.searchTerm}`, {
                method: 'GET'
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.risks) {
                        this.riskCache[cacheKey] = {
                            risks: data.risks.map(r => ({
                                id: r.id,
                                riskTanimi: r.riskTanimi,
                                riskFaktorleri: r.riskFaktorleri,
                                riskZarari: r.riskZarari || '',
                                kontrolOnlemleri: r.kontrolOnlemleri,
                                olasilik5x5: r.olasilik5x5 || 3,
                                siddet5x5: r.siddet5x5 || 3,
                                olasilikFineKinney: r.olasilikFineKinney || 3,
                                frekansFineKinney: r.frekansFineKinney || 3,
                                siddetFineKinney: r.siddetFineKinney || 3,
                                mevzuatId: r.mevzuatId || 0,
                                mevzuatAdi: r.mevzuatAdi || this.translations.SelectLegislation,
                                isAiGenerated: r.isAiGenerated || false
                            })),
                            totalPages: Math.ceil(data.risks.length / this.pageSize) || 1
                        };
                        this.currentPage = page;
                        if (forceAI) {
                            fetch('/RiskAnaliz/AiGenerateSahaBased', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]').value
                                },
                                body: JSON.stringify({ Saha: saha, FreeText: '', ExistingRisks: data.risks.map(r => r.riskTanimi) })
                            })
                                .then(response => response.json())
                                .then(aiData => {
                                    if (aiData.success && aiData.data) {
                                        this.riskCache[cacheKey].risks.push(...aiData.data.map(r => ({
                                            id: r.id || `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                            riskTanimi: r.riskTanimi,
                                            riskFaktorleri: r.riskFaktorleri,
                                            riskZarari: r.riskZarari || '',
                                            kontrolOnlemleri: r.kontrolOnlemleri,
                                            olasilik5x5: r.olasilik5x5 || 3,
                                            siddet5x5: r.siddet5x5 || 3,
                                            olasilikFineKinney: r.olasilikFineKinney || 3,
                                            frekansFineKinney: r.frekansFineKinney || 3,
                                            siddetFineKinney: r.siddetFineKinney || 3,
                                            mevzuatId: r.mevzuatId || 1,
                                            mevzuatAdi: this.mevzuatList.find(m => m.id === (r.mevzuatId || 1))?.mevzuatAdi || '6331 Sayılı İş Sağlığı ve Güvenliği Kanunu',
                                            isAiGenerated: true
                                        })));
                                        this.riskCache[cacheKey].totalPages = Math.ceil(this.riskCache[cacheKey].risks.length / this.pageSize) || 1;
                                    }
                                });
                        }
                    }
                })
                .finally(() => {
                    document.getElementById('aiLoadingOverlay').classList.remove('show');
                    document.getElementById('aiLoadingCard').classList.remove('show');
                    this.isProcessing = false;
                });
        },
        addManualRisk(sahaIndex) {
            if (!this.sahaRiskGruplari[sahaIndex].Saha) {
                Swal.fire({ icon: 'error', text: this.translations.SelectFieldFirst });
                return;
            }
            if (!this.manualRisks[sahaIndex]) {
                this.manualRisks[sahaIndex] = [];
            }
            this.manualRisks[sahaIndex].push({
                RiskAdi: '',
                RiskAciklamasi: '',
                RiskZarari: '',
                Olasilik: 3,
                Siddet: this.analizMetodu === '5x5' ? 3 : null,
                Maruziyet: this.analizMetodu === 'Fine-Kinney' ? 3 : null,
                FinneySiddet: this.analizMetodu === 'Fine-Kinney' ? 3 : null,
                OnerilenOnlem: '',
                MevzuatId: 0,
                MevzuatAdi: this.translations.SelectLegislation
            });
            if (!this.aiResponses[sahaIndex]) {
                this.aiResponses[sahaIndex] = {};
            }
            this.aiResponses[sahaIndex][this.manualRisks[sahaIndex].length - 1] = null;
            this.$forceUpdate();
        },
        saveManualRisk(sahaIndex, manualRiskIndex) {
            const risk = this.manualRisks[sahaIndex][manualRiskIndex];
            if (!risk.RiskAdi) {
                Swal.fire({ icon: 'error', text: this.translations.RiskNameRequired });
                return;
            }
            if (!risk.RiskAciklamasi) {
                Swal.fire({ icon: 'error', text: this.translations.RiskDescriptionRequired });
                return;
            }
            if (!risk.RiskZarari) {
                Swal.fire({ icon: 'error', text: this.translations.RiskZarariRequired });
                return;
            }
            if (this.analizMetodu === 'Fine-Kinney') {
                if (risk.Olasilik < 0.2 || risk.Olasilik > 10) {
                    Swal.fire({ icon: 'error', text: this.translations.ProbabilityRangeFineKinney });
                    return;
                }
                if (risk.Maruziyet < 0.5 || risk.Maruziyet > 10) {
                    Swal.fire({ icon: 'error', text: this.translations.ExposureRange });
                    return;
                }
                if (risk.FinneySiddet < 1 || risk.FinneySiddet > 100) {
                    Swal.fire({ icon: 'error', text: this.translations.FinneySeverityRange });
                    return;
                }
            } else {
                if (risk.Olasilik < 0.2 || risk.Olasilik > 5) {
                    Swal.fire({ icon: 'error', text: this.translations.ProbabilityRange5x5 });
                    return;
                }
                if (risk.Siddet < 1 || risk.Siddet > 5) {
                    Swal.fire({ icon: 'error', text: this.translations.SeverityRange5x5 });
                    return;
                }
            }
            this.addRisk(sahaIndex, risk);
            this.manualRisks[sahaIndex].splice(manualRiskIndex, 1);
            delete this.aiResponses[sahaIndex][manualRiskIndex];
            Swal.fire({ icon: 'success', text: this.translations.ManualRiskSaved });
        },
        removeManualRisk(sahaIndex, manualRiskIndex) {
            this.manualRisks[sahaIndex].splice(manualRiskIndex, 1);
            delete this.aiResponses[sahaIndex][manualRiskIndex];
            this.$forceUpdate();
            Swal.fire({ icon: 'success', text: this.translations.ManualRiskDeleted });
        },
        updateSubmitButton() {
            const hasRisks = this.sahaRiskGruplari.some(g => g.Riskler && g.Riskler.length > 0);
            document.getElementById('submitButton').disabled = !hasRisks;
        },
        saveRisks() {
            if (this.isProcessing) return;
            this.isProcessing = true;
            const formData = {
                SecilenFirmaId: this.firmaId,
                AnalizGrupId: this.analizGrupId,
                AnalizMetodu: this.analizMetodu,
                TeminSuresi: this.teminSuresi,
                SahaRiskGruplari: this.sahaRiskGruplari.filter(g => g.Riskler.length > 0).map(g => ({
                    Saha: this.convertSahaToEnum(g.Saha),
                    Riskler: g.Riskler
                }))
            };
            fetch('/RiskAnaliz/RiskTuruVeOneriler', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]').value
                },
                body: JSON.stringify(formData)
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        Swal.fire({ icon: 'success', text: this.translations.RisksSaved });
                        window.location.href = data.redirectUrl || `/RiskAnaliz/OnlemSonrasiDurum?firmaId=${this.firmaId}&analizGrupId=${this.analizGrupId}`;
                    } else {
                        Swal.fire({ icon: 'error', text: data.errors?.join('\n') || 'Hata oluştu' });
                    }
                })
                .catch(() => Swal.fire({ icon: 'error', text: 'Kaydetme başarısız' }))
                .finally(() => this.isProcessing = false);
        },
        submitAIInput(sahaIndex, manualRiskIndex) {
            if (this.isProcessing) return;
            this.isProcessing = true;
            const riskFaktorleri = this.finalTranscript.trim();
            if (!riskFaktorleri) {
                Swal.fire({
                    title: this.translations.WarningTitle,
                    text: this.translations.NoVoiceInput || 'Lütfen bir risk tanımı girin.',
                    icon: 'warning',
                    timer: 3000,
                    timerProgressBar: true,
                    showConfirmButton: true,
                    confirmButtonText: this.translations.ConfirmButton
                });
                this.isProcessing = false;
                return;
            }
            if (!this.sahaRiskGruplari[sahaIndex].Saha) {
                Swal.fire({ icon: 'error', text: this.translations.SelectFieldFirst });
                this.isProcessing = false;
                return;
            }
            if (this.isRecognizing) {
                this.stopRecognition();
            }
            if (!this.aiResponses[sahaIndex]) {
                this.aiResponses[sahaIndex] = {};
            }
            this.aiResponses[sahaIndex][manualRiskIndex] = { loading: true };
            document.getElementById('aiLoadingOverlay').classList.add('show');
            document.getElementById('aiLoadingCard').classList.add('show');
            window.connection.invoke('AskGPT', riskFaktorleri, 'RiskCreator')
                .then(() => {
                    this.finalTranscript = '';
                    this.$forceUpdate();
                })
                .catch(err => {
                    console.error('[FRONTEND] AskGPT hatası:', err);
                    Swal.fire({
                        title: this.translations.ErrorTitle,
                        text: this.translations.AIResponseFailed,
                        icon: 'error',
                        timer: 3000,
                        timerProgressBar: true,
                        showConfirmButton: true,
                        confirmButtonText: this.translations.ConfirmButton
                    });
                    delete this.aiResponses[sahaIndex][manualRiskIndex];
                    this.isProcessing = false;
                    document.getElementById('aiLoadingOverlay').classList.remove('show');
                    document.getElementById('aiLoadingCard').classList.remove('show');
                });
        },
        editAIResponse(sahaIndex, manualRiskIndex) {
            const aiResponse = this.aiResponses[sahaIndex][manualRiskIndex];
            if (!aiResponse || aiResponse.loading) {
                Swal.fire({
                    title: this.translations.WarningTitle,
                    text: this.translations.NoAIResponse,
                    icon: 'warning',
                    timer: 3000,
                    timerProgressBar: true,
                    showConfirmButton: true,
                    confirmButtonText: this.translations.ConfirmButton
                });
                return;
            }
            const risk = this.manualRisks[sahaIndex][manualRiskIndex];
            risk.RiskAdi = aiResponse.RiskTanimi || '';
            risk.RiskAciklamasi = aiResponse.RiskFaktorleri || '';
            risk.RiskZarari = aiResponse.RiskZarari || '';
            risk.OnerilenOnlem = aiResponse.KontrolOnlemleri || '';
            risk.Olasilik = this.analizMetodu === '5x5' ? (aiResponse.Olasilik5x5 || 3) : (aiResponse.OlasilikFineKinney || 3);
            risk.Siddet = this.analizMetodu === '5x5' ? (aiResponse.Siddet5x5 || 3) : null;
            risk.Maruziyet = this.analizMetodu === 'Fine-Kinney' ? (aiResponse.FrekansFineKinney || 3) : null;
            risk.FinneySiddet = this.analizMetodu === 'Fine-Kinney' ? (aiResponse.SiddetFineKinney || 3) : null;
            risk.MevzuatId = aiResponse.MevzuatId || 0;
            risk.MevzuatAdi = aiResponse.MevzuatAdi || this.translations.SelectLegislation;
            this.$forceUpdate();
            Swal.fire({
                title: this.translations.SuccessTitle,
                text: this.translations.AIResponseApplied,
                icon: 'success',
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: true,
                confirmButtonText: this.translations.ConfirmButton
            });
        },
        approveAIResponse(sahaIndex, manualRiskIndex) {
            const aiResponse = this.aiResponses[sahaIndex][manualRiskIndex];
            if (!aiResponse || aiResponse.loading) {
                Swal.fire({
                    title: this.translations.WarningTitle,
                    text: this.translations.NoAIResponse,
                    icon: 'warning',
                    timer: 3000,
                    timerProgressBar: true,
                    showConfirmButton: true,
                    confirmButtonText: this.translations.ConfirmButton
                });
                return;
            }
            if (!this.sahaRiskGruplari[sahaIndex].Riskler.some(r => r.RiskAdi === aiResponse.RiskTanimi && r.Saha === this.sahaRiskGruplari[sahaIndex].Saha)) {
                this.addRisk(sahaIndex, aiResponse);
                this.manualRisks[sahaIndex].splice(manualRiskIndex, 1);
                delete this.aiResponses[sahaIndex][manualRiskIndex];
                Swal.fire({
                    icon: 'success',
                    text: this.translations.RiskAdded
                });
            } else {
                Swal.fire({
                    icon: 'warning',
                    text: this.translations.RiskAlreadySelected
                });
            }
        },
        startRecognition(sahaIndex, manualRiskIndex) {
            if (this.isRecognizing || !window.SpeechRecognition) {
                if (!window.SpeechRecognition) {
                    Swal.fire({
                        title: this.translations.ErrorTitle,
                        text: this.translations.SpeechRecognitionNotSupported,
                        icon: 'error',
                        timer: 3000,
                        timerProgressBar: true,
                        showConfirmButton: true,
                        confirmButtonText: this.translations.ConfirmButton
                    });
                }
                return;
            }
            navigator.permissions.query({ name: 'microphone' }).then(permissionStatus => {
                if (permissionStatus.state === 'denied') {
                    Swal.fire({
                        title: this.translations.ErrorTitle,
                        text: this.translations.SpeechRecognitionNotAllowed,
                        icon: 'error',
                        timer: 3000,
                        timerProgressBar: true,
                        showConfirmButton: true,
                        confirmButtonText: this.translations.ConfirmButton
                    });
                    return;
                }
                const recognition = new window.SpeechRecognition();
                recognition.lang = 'tr-TR';
                recognition.interimResults = true;
                recognition.continuous = true;
                recognition.onresult = event => {
                    let interimTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript.toLowerCase();
                        if (event.results[i].isFinal) {
                            this.finalTranscript += (this.finalTranscript ? ' ' : '') + transcript;
                        } else {
                            interimTranscript += transcript;
                        }
                    }
                    const cleanedText = (this.finalTranscript + (interimTranscript ? ' ' + interimTranscript : '')).replace(/\s+/g, ' ').trim();
                    this.finalTranscript = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
                    this.$forceUpdate();
                };
                recognition.onerror = event => {
                    let errorMessage;
                    if (event.error === 'not-allowed') {
                        errorMessage = this.translations.SpeechRecognitionNotAllowed;
                    } else if (event.error === 'no-speech') {
                        errorMessage = this.translations.SpeechNoSpeechError;
                    } else {
                        errorMessage = this.translations.SpeechRecognitionError + ' ' + event.error;
                    }
                    Swal.fire({
                        title: this.translations.ErrorTitle,
                        text: errorMessage,
                        icon: 'error',
                        timer: 3000,
                        timerProgressBar: true,
                        showConfirmButton: true,
                        confirmButtonText: this.translations.ConfirmButton
                    });
                    this.stopRecognition();
                };
                recognition.onend = () => {
                    if (this.isRecognizing) {
                        recognition.start();
                    }
                };
                recognition.start();
                this.isRecognizing = true;
                this.$forceUpdate();
            });
        },
        stopRecognition() {
            if (this.isRecognizing) {
                this.isRecognizing = false;
                this.$forceUpdate();
            }
        },
        updateManualRiskSkor(risk) {
            const isFineKinney = this.analizMetodu === 'Fine-Kinney';
            const skor = isFineKinney ? risk.Olasilik * risk.Maruziyet * risk.FinneySiddet : risk.Olasilik * risk.Siddet;
            return {
                skor,
                badgeClass: isFineKinney
                    ? skor >= 400 ? 'danger' : skor >= 100 ? 'warning' : 'success'
                    : skor >= 15 ? 'danger' : skor >= 8 ? 'warning' : 'success'
            };
        },
        updateAIResponseTable(sahaIndex, manualRiskIndex, aiResponseData) {
            if (!aiResponseData || aiResponseData.loading) return;
            const analizMetodu = this.analizMetodu;
            const olasilik = analizMetodu === '5x5' ? (aiResponseData.Olasilik5x5 || 3) : (aiResponseData.OlasilikFineKinney || 3);
            const siddet = analizMetodu === '5x5' ? (aiResponseData.Siddet5x5 || 3) : null;
            const maruziyet = analizMetodu === 'Fine-Kinney' ? (aiResponseData.FrekansFineKinney || 3) : null;
            const finneySiddet = analizMetodu === 'Fine-Kinney' ? (aiResponseData.SiddetFineKinney || 3) : null;
            const skor = analizMetodu === '5x5' ? olasilik * siddet : olasilik * maruziyet * finneySiddet;
            const badgeClass = analizMetodu === '5x5'
                ? skor >= 15 ? 'danger' : skor >= 8 ? 'warning' : 'success'
                : skor >= 400 ? 'danger' : skor >= 100 ? 'warning' : 'success';
            const escapedRiskTanimi = window.escapeHtml(aiResponseData.RiskTanimi || '');
            const escapedRiskFaktorleri = window.escapeHtml(aiResponseData.RiskFaktorleri || '');
            const escapedRiskZarari = window.escapeHtml(aiResponseData.RiskZarari || '');
            const escapedKontrolOnlemleri = window.escapeHtml(aiResponseData.KontrolOnlemleri || '');
            const escapedMevzuatAdi = aiResponseData.MevzuatAdi
                ? window.escapeHtml(aiResponseData.MevzuatAdi)
                : (aiResponseData.MevzuatId && this.mevzuatList.find(m => m.id === aiResponseData.MevzuatId)
                    ? window.escapeHtml(this.mevzuatList.find(m => m.id === aiResponseData.MevzuatId).mevzuatAdi)
                    : this.translations.SelectLegislation);
            this.aiResponses[sahaIndex][manualRiskIndex] = {
                ...aiResponseData,
                Olasilik5x5: aiResponseData.Olasilik5x5 || 3,
                Siddet5x5: aiResponseData.Siddet5x5 || 3,
                OlasilikFineKinney: aiResponseData.OlasilikFineKinney || 3,
                FrekansFineKinney: aiResponseData.FrekansFineKinney || 3,
                SiddetFineKinney: aiResponseData.SiddetFineKinney || 3,
                MevzuatId: aiResponseData.MevzuatId || 0,
                MevzuatAdi: escapedMevzuatAdi,
                Skor: skor,
                BadgeClass: badgeClass
            };
            this.$forceUpdate();
        },
        convertSahaToEnum(sahaString) {
            const SahaEnum = {
                GenelSaha: 0,
                Şantiye: 1,
                Tuvalet: 2,
                Mutfak: 3,
                Bahçe: 4,
                Sınıf: 5,
                Oda: 6,
                Depo: 7,
                ÜretimAlanı: 8,
                Ofis: 9,
                Otopark: 10,
                GirişÇıkış: 11,
                ElektrikOdası: 12,
                YangınMerkezi: 13,
                AcilDurumÇıkışı: 14,
                KonferansSalonu: 15,
                Laboratuvar: 16,
                YüklemeAlanı: 17,
                DinlenmeAlanı: 18,
                DışAlan: 19,
                HastanePoliklinik: 20,
                Ameliyathane: 21,
                Atölye: 22,
                SoğukDepo: 23,
                SıcakÇalışmaAlanı: 24,
                KimyasalDepolama: 25,
                MakineOdası: 26,
                ArşivOdası: 27,
                SporAlanı: 28,
                KantinYemekhane: 29,
                BakımOnarımAlanı: 30,
                YeraltıÇalışmaAlanı: 31,
                DenizLiman: 32,
                GeçiciÇalışmaAlanı: 33,
                HavayoluUçakHangarı: 34,
                Tersane: 35,
                EğlenceAlanı: 36,
                AlışverişMerkezi: 37,
                EnerjiSantrali: 38,
                KimyasalÜretimTesisi: 39,
                Sera: 40,
                Demiryoluİstasyonu: 41,
                DemiryoluHattı: 42,
                DemiryoluBakımAtölyesi: 43,
                DemiryoluLojistikMerkezi: 44,
                DemiryoluTüneli: 45
            };
            return SahaEnum[sahaString] !== undefined ? SahaEnum[sahaString] : 0;
        }
    },
    mounted() {
        // Analiz metodu değişikliği
        document.querySelectorAll('input[name="AnalizMetodu"]').forEach(input => {
            input.addEventListener('change', () => {
                this.analizMetodu = input.value;
                this.sahaRiskGruplari.forEach(saha => {
                    saha.Riskler.forEach(risk => {
                        if (this.analizMetodu === 'Fine-Kinney') {
                            risk.Olasilik = risk.OlasilikFineKinney || Math.min(risk.Olasilik || 3, 10);
                            risk.Maruziyet = risk.FrekansFineKinney || risk.Maruziyet || 3;
                            risk.FinneySiddet = risk.SiddetFineKinney || (risk.Siddet ? Math.min(risk.Siddet * 20, 100) : 3);
                            risk.Siddet = null;
                        } else {
                            risk.Olasilik = risk.Olasilik5x5 || Math.min(risk.Olasilik || 3, 5);
                            risk.Siddet = risk.Siddet5x5 || (risk.FinneySiddet ? Math.min(Math.ceil(risk.FinneySiddet / 20), 5) : 3);
                            risk.Maruziyet = null;
                            risk.FinneySiddet = null;
                        }
                        risk.AnalizMetodu = this.analizMetodu;
                    });
                });
                this.$forceUpdate();
            });
        });
        // TeminSuresi değişikliği
        document.getElementById('TeminSuresi').addEventListener('input', (e) => {
            this.teminSuresi = e.target.value;
            this.sahaRiskGruplari.forEach(saha => {
                saha.Riskler.forEach(risk => {
                    risk.TeminSuresi = this.teminSuresi;
                });
            });
        });
        // Mevzuat listesini yükle
        window.loadMevzuatList();
        this.mevzuatList = window.mevzuatList || [];
        // İlk yüklemede risk önerilerini yükle
        this.sahaRiskGruplari.forEach((saha, index) => {
            if (saha.Saha && saha.Saha !== 'GenelSaha') {
                this.loadRiskSuggestions(index, saha.Saha, 1);
            }
        });
        // SignalR event'leri
        window.connection.on("ReceiveMessage", (user, message) => {
            const activeSahaIndex = this.activeSahaIndex;
            const activeManualRiskIndex = Object.keys(this.aiResponses[activeSahaIndex] || {}).find(index => this.aiResponses[activeSahaIndex][index]?.loading);
            if (activeManualRiskIndex !== undefined) {
                this.finalTranscript += message;
                this.$forceUpdate();
            }
        });
        window.connection.on("ReceiveChunk", (chunk) => {
            const activeSahaIndex = this.activeSahaIndex;
            const activeManualRiskIndex = Object.keys(this.aiResponses[activeSahaIndex] || {}).find(index => this.aiResponses[activeSahaIndex][index]?.loading);
            if (activeManualRiskIndex !== undefined) {
                this.finalTranscript += chunk;
                this.$forceUpdate();
            }
        });
        window.connection.on("ReceiveRiskSuggestion", (formattedResponse, jsonResponse) => {
            const activeSahaIndex = this.activeSahaIndex;
            const activeManualRiskIndex = Object.keys(this.aiResponses[activeSahaIndex] || {}).find(index => this.aiResponses[activeSahaIndex][index]?.loading);
            if (activeManualRiskIndex === undefined) {
                console.warn('[FRONTEND] Aktif AI response bulunamadı.');
                document.getElementById('aiLoadingOverlay').classList.remove('show');
                document.getElementById('aiLoadingCard').classList.remove('show');
                return;
            }
            window.loadMevzuatList();
            if (!window.mevzuatList || !window.mevzuatList.length) {
                console.error('[FRONTEND] Mevzuat listesi yüklenemedi (ReceiveRiskSuggestion).');
                Swal.fire({
                    icon: 'error',
                    title: this.translations.ErrorTitle,
                    text: this.translations.LegislationListLoadError
                });
                document.getElementById('aiLoadingOverlay').classList.remove('show');
                document.getElementById('aiLoadingCard').classList.remove('show');
                return;
            }
            this.mevzuatList = window.mevzuatList;
            const aiResponseData = JSON.parse(jsonResponse);
            this.updateAIResponseTable(activeSahaIndex, activeManualRiskIndex, aiResponseData);
            document.getElementById('aiLoadingOverlay').classList.remove('show');
            document.getElementById('aiLoadingCard').classList.remove('show');
            Swal.fire({
                title: this.translations.SuccessTitle,
                text: this.translations.AIResponseReceived,
                icon: 'success',
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: true,
                confirmButtonText: this.translations.ConfirmButton
            });
        });
    },
    template: `
    <div class="accordion" id="sahaAccordion">
      <div v-for="(saha, sahaIndex) in sahaRiskGruplari" :key="sahaIndex" class="accordion-item" :data-saha-index="sahaIndex">
        <h2 class="accordion-header" :id="'sahaHeading_' + sahaIndex">
          <button class="accordion-button" :class="{ collapsed: sahaIndex !== activeSahaIndex }" type="button" data-bs-toggle="collapse" :data-bs-target="'#sahaCollapse_' + sahaIndex" :aria-expanded="sahaIndex === activeSahaIndex" :aria-controls="'sahaCollapse_' + sahaIndex" @click="activeSahaIndex = sahaIndex; currentPage = 1; if (saha.Saha && saha.Saha !== 'GenelSaha') loadRiskSuggestions(sahaIndex, saha.Saha, 1)">
            {{ translations[saha.Saha] || saha.Saha }}
          </button>
          <button v-if="sahaRiskGruplari.length > 1" type="button" class="btn btn-sm btn-danger remove-saha" :data-saha-index="sahaIndex" @click="removeSaha(sahaIndex)">
            <i class="bi bi-trash me-2"></i> {{ translations.DeleteField }}
          </button>
        </h2>
        <div :id="'sahaCollapse_' + sahaIndex" class="accordion-collapse collapse" :class="{ show: sahaIndex === activeSahaIndex }" :aria-labelledby="'sahaHeading_' + sahaIndex" data-bs-parent="#sahaAccordion">
          <div class="accordion-body" v-if="sahaIndex === activeSahaIndex">
            <div class="mb-3">
              <label class="form-label fw-bold">{{ translations.FieldSelection }}</label>
              <select class="form-select saha-select" v-model="sahaRiskGruplari[sahaIndex].Saha" @change="loadRiskSuggestions(sahaIndex, $event.target.value, 1, true)">
                <option value="">{{ translations.SelectField }}</option>
                @foreach (var saha in Enum.GetValues(typeof(SahaEnum)).Cast<SahaEnum>())
                {
                  var displayName = saha.GetType()
                    .GetField(saha.ToString())
                    ?.GetCustomAttributes(typeof(DisplayAttribute), false)
                    .Cast<DisplayAttribute>()
                    .FirstOrDefault()?.Name ?? saha.ToString();
                  <option value="@saha">@GetLocalizedSaha(displayName)</option>
                }
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold">{{ translations.SearchRisk }}</label>
              <input type="text" class="form-control risk-search" v-model="searchTerm" @input="loadRiskSuggestions(sahaIndex, sahaRiskGruplari[sahaIndex].Saha, 1)" :data-saha-index="sahaIndex" :placeholder="translations.EnterRiskName" />
            </div>
            <h5 class="mb-3">{{ translations.SuggestedRisks }}</h5>
            <div class="table-responsive">
              <table class="table table-striped table-hover risk-table" :data-saha-index="sahaIndex">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{{ translations.RiskName }}</th>
                    <th>{{ translations.RiskFactors }}</th>
                    <th>{{ translations.RiskZarariTitle }}</th>
                    <th>{{ translations.Probability }}</th>
                    <th class="five-x-five-only" :style="{ display: analizMetodu === '5x5' ? 'table-cell' : 'none' }">{{ translations.Severity }}</th>
                    <th class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ translations.Exposure }}</th>
                    <th class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ translations.FinneySeverity }}</th>
                    <th>{{ translations.Score }}</th>
                    <th>{{ translations.ControlMeasures }}</th>
                    <th>{{ translations.Legislation }}</th>
                    <th>{{ translations.Action }}</th>
                  </tr>
                </thead>
                <tbody class="risk-table-body">
                  <recycle-scroller class="scroller" :items="pagedRisks" :item-size="50" key-field="id">
                    <template v-slot="{ item: risk, index }">
                      <tr :class="{ 'selected-risk-highlight': sahaRiskGruplari[sahaIndex].Riskler.some(r => r.RiskDegerlendirmeId === risk.id) }" :data-risk-id="risk.id">
                        <td>{{ index + 1 + (currentPage - 1) * pageSize }}</td>
                        <td class="text-truncate" style="max-width: 150px;">
                          {{ risk.riskTanimi }} <span v-if="risk.isAiGenerated" class="badge bg-info ms-2 ai-indicator">AI</span>
                        </td>
                        <td class="text-truncate" style="max-width: 200px;">{{ risk.riskFaktorleri }}</td>
                        <td class="text-truncate" style="max-width: 150px;">{{ risk.riskZarari }}</td>
                        <td>{{ analizMetodu === '5x5' ? risk.olasilik5x5 : risk.olasilikFineKinney }}</td>
                        <td class="five-x-five-only" :style="{ display: analizMetodu === '5x5' ? 'table-cell' : 'none' }">{{ risk.siddet5x5 || '-' }}</td>
                        <td class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ risk.frekansFineKinney || '-' }}</td>
                        <td class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ risk.siddetFineKinney || '-' }}</td>
                        <td>
                          <span :class="'badge bg-' + (analizMetodu === '5x5' ? (risk.olasilik5x5 * risk.siddet5x5 >= 15 ? 'danger' : risk.olasilik5x5 * risk.siddet5x5 >= 8 ? 'warning' : 'success') : (risk.olasilikFineKinney * risk.frekansFineKinney * risk.siddetFineKinney >= 400 ? 'danger' : risk.olasilikFineKinney * risk.frekansFineKinney * risk.siddetFineKinney >= 100 ? 'warning' : 'success'))">
                            {{ analizMetodu === '5x5' ? risk.olasilik5x5 * risk.siddet5x5 : risk.olasilikFineKinney * risk.frekansFineKinney * risk.siddetFineKinney }}
                          </span>
                        </td>
                        <td class="text-truncate" style="max-width: 200px;">{{ risk.kontrolOnlemleri }}</td>
                        <td class="text-truncate" style="max-width: 150px;">{{ risk.mevzuatAdi }}</td>
                        <td>
                          <button type="button" class="btn btn-sm" :class="sahaRiskGruplari[sahaIndex].Riskler.some(r => r.RiskDegerlendirmeId === risk.id) ? 'btn-danger remove-risk' : 'btn-primary add-risk'" @click="sahaRiskGruplari[sahaIndex].Riskler.some(r => r.RiskDegerlendirmeId === risk.id) ? removeRisk(sahaIndex, sahaRiskGruplari[sahaIndex].Riskler.findIndex(r => r.RiskDegerlendirmeId === risk.id)) : addRisk(sahaIndex, risk)">
                            {{ sahaRiskGruplari[sahaIndex].Riskler.some(r => r.RiskDegerlendirmeId === risk.id) ? translations.Delete : translations.Add }}
                          </button>
                        </td>
                      </tr>
                    </template>
                  </recycle-scroller>
                </tbody>
              </table>
            </div>
            <div class="pagination-controls" :data-saha-index="sahaIndex">
              <button type="button" class="btn btn-outline-primary prev-page" :disabled="currentPage === 1" @click="currentPage--">{{ translations.Previous }}</button>
              <span class="page-info">{{ translations.Page }} {{ currentPage }} / {{ totalPages }}</span>
              <button type="button" class="btn btn-outline-primary next-page" :disabled="currentPage >= totalPages" @click="currentPage++">{{ translations.Next }}</button>
            </div>
            <button type="button" class="btn btn-outline-primary mt-3 mb-3 toggle-manual-risk" :data-saha-index="sahaIndex" @click="addManualRisk(sahaIndex)">
              <i class="bi bi-pencil-square me-2"></i> {{ translations.AddManualRiskPrompt }}
            </button>
            <div class="manual-risk-form" :data-saha-index="sahaIndex" v-if="manualRisks[sahaIndex] && manualRisks[sahaIndex].length">
              <h5 class="mb-3">{{ translations.AddManualRisk }}</h5>
              <div class="table-responsive">
                <table class="table table-striped table-hover manual-risk-table" :data-saha-index="sahaIndex">
                  <thead>
                    <tr>
                      <th>{{ translations.RiskName }}</th>
                      <th>{{ translations.RiskFactors }}</th>
                      <th>{{ translations.RiskZarariTitle }}</th>
                      <th>{{ translations.Probability }}</th>
                      <th class="five-x-five-only" :style="{ display: analizMetodu === '5x5' ? 'table-cell' : 'none' }">{{ translations.Severity }}</th>
                      <th class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ translations.Exposure }}</th>
                      <th class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ translations.FinneySeverity }}</th>
                      <th>{{ translations.Score }}</th>
                      <th>{{ translations.ControlMeasures }}</th>
                      <th>{{ translations.Legislation }}</th>
                      <th>{{ translations.Action }}</th>
                    </tr>
                  </thead>
                  <tbody class="manual-risk-body">
                    <tr v-for="(risk, manualRiskIndex) in manualRisks[sahaIndex]" :key="manualRiskIndex" :data-manual-risk-index="manualRiskIndex">
                      <td data-label="RiskName">
                        <input type="text" class="form-control manual-risk-adi" v-model="risk.RiskAdi" :placeholder="translations.EnterRiskName" required />
                        <div class="invalid-feedback">{{ translations.RiskNameRequired }}</div>
                      </td>
                      <td data-label="RiskFactors">
                        <textarea class="form-control manual-risk-faktorleri" v-model="risk.RiskAciklamasi" :placeholder="translations.EnterRiskFactors" maxlength="500"></textarea>
                      </td>
                      <td data-label="RiskZarariTitle">
                        <textarea class="form-control manual-risk-zarari" v-model="risk.RiskZarari" :placeholder="translations.EnterRiskZarari" maxlength="500"></textarea>
                        <div class="invalid-feedback">{{ translations.RiskZarariRequired }}</div>
                      </td>
                      <td data-label="Probability">
                        <div class="risk-factor">
                          <button type="button" class="btn btn-sm btn-outline-primary" @click="risk.Olasilik = Math.max(1, risk.Olasilik - 1); $forceUpdate();">-</button>
                          <input type="number" class="form-control manual-olasilik" v-model.number="risk.Olasilik" :min="1" :max="analizMetodu === '5x5' ? 5 : 10" required />
                          <button type="button" class="btn btn-sm btn-outline-primary" @click="risk.Olasilik = Math.min(analizMetodu === '5x5' ? 5 : 10, risk.Olasilik + 1); $forceUpdate();">+</button>
                        </div>
                      </td>
                      <td data-label="Severity" class="five-x-five-only" :style="{ display: analizMetodu === '5x5' ? 'table-cell' : 'none' }">
                        <div class="risk-factor">
                          <button type="button" class="btn btn-sm btn-outline-primary" @click="risk.Siddet = Math.max(1, risk.Siddet - 1); $forceUpdate();">-</button>
                          <input type="number" class="form-control manual-siddet" v-model.number="risk.Siddet" min="1" max="5" required />
                          <button type="button" class="btn btn-sm btn-outline-primary" @click="risk.Siddet = Math.min(5, risk.Siddet + 1); $forceUpdate();">+</button>
                        </div>
                      </td>
                      <td data-label="Exposure" class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">
                        <div class="risk-factor">
                          <button type="button" class="btn btn-sm btn-outline-primary" @click="risk.Maruziyet = Math.max(1, risk.Maruziyet - 1); $forceUpdate();">-</button>
                          <input type="number" class="form-control manual-maruziyet" v-model.number="risk.Maruziyet" min="1" max="10" required />
                          <button type="button" class="btn btn-sm btn-outline-primary" @click="risk.Maruziyet = Math.min(10, risk.Maruziyet + 1); $forceUpdate();">+</button>
                        </div>
                      </td>
                      <td data-label="FinneySeverity" class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">
                        <div class="risk-factor">
                          <button type="button" class="btn btn-sm btn-outline-primary" @click="risk.FinneySiddet = Math.max(1, risk.FinneySiddet - 1); $forceUpdate();">-</button>
                          <input type="number" class="form-control manual-finney-siddet" v-model.number="risk.FinneySiddet" min="1" max="100" required />
                          <button type="button" class="btn btn-sm btn-outline-primary" @click="risk.FinneySiddet = Math.min(100, risk.FinneySiddet + 1); $forceUpdate();">+</button>
                        </div>
                      </td>
                      <td data-label="Score">
                        <span :class="'badge bg-' + updateManualRiskSkor(risk).badgeClass">{{ updateManualRiskSkor(risk).skor }}</span>
                      </td>
                      <td data-label="ControlMeasures">
                        <textarea class="form-control manual-kontrol-onlemleri" v-model="risk.OnerilenOnlem" :placeholder="translations.EnterControlMeasures" maxlength="500"></textarea>
                      </td>
                      <td data-label="Legislation">
                        <select class="form-select mevzuat-select" v-model="risk.MevzuatId" @change="risk.MevzuatAdi = mevzuatList.find(m => m.id === risk.MevzuatId)?.mevzuatAdi || translations.SelectLegislation">
                          <option value="0" disabled>{{ translations.SelectLegislation }}</option>
                          <option v-for="mevzuat in mevzuatList" :value="mevzuat.id">{{ mevzuat.mevzuatAdi }}</option>
                        </select>
                      </td>
                      <td data-label="Action">
                        <button type="button" class="btn btn-sm btn-primary save-manual-risk" @click="saveManualRisk(sahaIndex, manualRiskIndex)">{{ translations.Save }}</button>
                        <button type="button" class="btn btn-sm btn-danger remove-manual-risk" @click="removeManualRisk(sahaIndex, manualRiskIndex)">{{ translations.Delete }}</button>
                      </td>
                    </tr>
                    <tr class="ai-bar-row" :data-saha-index="sahaIndex" :data-manual-risk-index="manualRiskIndex">
                      <td :colspan="analizMetodu === '5x5' ? 10 : 11" data-label="AIInput">
                        <div class="ai-bar input-group mb-3" :data-saha-index="sahaIndex" :data-manual-risk-index="manualRiskIndex">
                          <textarea class="form-control ai-text" rows="2" v-model="finalTranscript" :placeholder="translations.AIResponsePlaceholder"></textarea>
                          <button type="button" class="btn btn-outline-secondary ai-mic" :class="{ 'mic-on': isRecognizing }" :title="translations.VoiceInput" @click="isRecognizing ? stopRecognition() : startRecognition(sahaIndex, manualRiskIndex)">
                            <i :class="isRecognizing ? 'bi bi-mic-fill' : 'bi bi-mic'"></i>
                          </button>
                          <button type="button" class="btn btn-primary submit-ai-input" @click="submitAIInput(sahaIndex, manualRiskIndex)">{{ translations.Submit }}</button>
                        </div>
                        <div class="ai-response-container mb-3" :data-saha-index="sahaIndex" :data-manual-risk-index="manualRiskIndex">
                          <div class="table-responsive">
                            <table class="table table-striped table-hover ai-response-table" :data-saha-index="sahaIndex" :data-manual-risk-index="manualRiskIndex">
                              <thead>
                                <tr>
                                  <th>{{ translations.RiskName }}</th>
                                  <th>{{ translations.Description }}</th>
                                  <th>{{ translations.RiskZarariTitle }}</th>
                                  <th>{{ translations.Probability }}</th>
                                  <th class="five-x-five-only" :style="{ display: analizMetodu === '5x5' ? 'table-cell' : 'none' }">{{ translations.Severity }}</th>
                                  <th class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ translations.Exposure }}</th>
                                  <th class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ translations.FinneySeverity }}</th>
                                  <th>{{ translations.Score }}</th>
                                  <th>{{ translations.SuggestedMeasure }}</th>
                                  <th>{{ translations.Legislation }}</th>
                                  <th>{{ translations.Action }}</th>
                                </tr>
                              </thead>
                              <tbody class="ai-response-body">
                                <tr v-if="aiResponses[sahaIndex] && aiResponses[sahaIndex][manualRiskIndex] && !aiResponses[sahaIndex][manualRiskIndex].loading">
                                  <td data-label="RiskName">{{ aiResponses[sahaIndex][manualRiskIndex].RiskTanimi }}</td>
                                  <td data-label="Description">{{ aiResponses[sahaIndex][manualRiskIndex].RiskFaktorleri }}</td>
                                  <td data-label="RiskZarariTitle">{{ aiResponses[sahaIndex][manualRiskIndex].RiskZarari }}</td>
                                  <td data-label="Probability">{{ analizMetodu === '5x5' ? aiResponses[sahaIndex][manualRiskIndex].Olasilik5x5 : aiResponses[sahaIndex][manualRiskIndex].OlasilikFineKinney }}</td>
                                  <td data-label="Severity" class="five-x-five-only" :style="{ display: analizMetodu === '5x5' ? 'table-cell' : 'none' }">{{ aiResponses[sahaIndex][manualRiskIndex].Siddet5x5 || '-' }}</td>
                                  <td data-label="Exposure" class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ aiResponses[sahaIndex][manualRiskIndex].FrekansFineKinney || '-' }}</td>
                                  <td data-label="FinneySeverity" class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ aiResponses[sahaIndex][manualRiskIndex].SiddetFineKinney || '-' }}</td>
                                  <td data-label="Score">
                                    <span :class="'badge bg-' + aiResponses[sahaIndex][manualRiskIndex].BadgeClass">{{ aiResponses[sahaIndex][manualRiskIndex].Skor }}</span>
                                  </td>
                                  <td data-label="SuggestedMeasure">{{ aiResponses[sahaIndex][manualRiskIndex].KontrolOnlemleri }}</td>
                                  <td data-label="Legislation">{{ aiResponses[sahaIndex][manualRiskIndex].MevzuatAdi }}</td>
                                  <td data-label="Action">
                                    <button type="button" class="btn btn-sm btn-primary edit-ai-response" @click="editAIResponse(sahaIndex, manualRiskIndex)">{{ translations.Edit }}</button>
                                    <button type="button" class="btn btn-sm btn-success approve-ai-response" @click="approveAIResponse(sahaIndex, manualRiskIndex)">{{ translations.Add }}</button>
                                  </td>
                                </tr>
                                <tr v-else>
                                  <td :colspan="analizMetodu === '5x5' ? 10 : 11" class="text-center text-info">{{ translations.AIResponseLoading }}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button type="button" class="btn btn-primary mt-2 add-manual-risk" :data-saha-index="sahaIndex" @click="addManualRisk(sahaIndex)">
                <i class="bi bi-plus me-2"></i> {{ translations.AddNewRisk }}
              </button>
            </div>
            <h5 class="mb-3 mt-4">{{ translations.SelectedRisks }}</h5>
            <div class="table-responsive">
              <table class="table table-striped table-hover selected-risk-table" :data-saha-index="sahaIndex">
                <thead>
                  <tr>
                    <th>{{ translations.RiskName }}</th>
                    <th>{{ translations.Description }}</th>
                    <th>{{ translations.RiskZarariTitle }}</th>
                    <th>{{ translations.Probability }}</th>
                    <th class="five-x-five-only" :style="{ display: analizMetodu === '5x5' ? 'table-cell' : 'none' }">{{ translations.Severity }}</th>
                    <th class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ translations.Exposure }}</th>
                    <th class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ translations.FinneySeverity }}</th>
                    <th>{{ translations.Score }}</th>
                    <th>{{ translations.SuggestedMeasure }}</th>
                    <th>{{ translations.Legislation }}</th>
                    <th>{{ translations.Action }}</th>
                  </tr>
                </thead>
                <tbody class="selected-risks-body">
                  <recycle-scroller class="scroller" :items="sahaRiskGruplari[sahaIndex].Riskler" :item-size="50" key-field="RiskDegerlendirmeId">
                    <template v-slot="{ item: risk, index }">
                      <tr :data-risk-id="risk.RiskDegerlendirmeId">
                        <td>{{ risk.RiskAdi }}</td>
                        <td>{{ risk.RiskAciklamasi }}</td>
                        <td>{{ risk.RiskZarari }}</td>
                        <td>{{ risk.Olasilik }}</td>
                        <td class="five-x-five-only" :style="{ display: analizMetodu === '5x5' ? 'table-cell' : 'none' }">{{ risk.Siddet || '-' }}</td>
                        <td class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ risk.Maruziyet || '-' }}</td>
                        <td class="fine-kinney-only" :style="{ display: analizMetodu === 'Fine-Kinney' ? 'table-cell' : 'none' }">{{ risk.FinneySiddet || '-' }}</td>
                        <td>
                          <span :class="'badge bg-' + (analizMetodu === '5x5' ? (risk.Olasilik * risk.Siddet >= 15 ? 'danger' : risk.Olasilik * risk.Siddet >= 8 ? 'warning' : 'success') : (risk.Olasilik * risk.Maruziyet * risk.FinneySiddet >= 400 ? 'danger' : risk.Olasilik * risk.Maruziyet * risk.FinneySiddet >= 100 ? 'warning' : 'success'))">
                            {{ analizMetodu === '5x5' ? risk.Olasilik * risk.Siddet : risk.Olasilik * risk.Maruziyet * risk.FinneySiddet }}
                          </span>
                        </td>
                        <td>{{ risk.OnerilenOnlem }}</td>
                        <td>{{ risk.MevzuatAdi }}</td>
                        <td>
                          <button type="button" class="btn btn-sm btn-danger remove-risk" @click="removeRisk(sahaIndex, index)">{{ translations.Delete }}</button>
                        </td>
                      </tr>
                    </template>
                  </recycle-scroller>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <button type="button" class="btn btn-primary add-saha-btn" @click="addSaha">
        <i class="bi bi-plus me-2"></i> {{ translations.AddField }}
      </button>
      <button type="button" class="btn btn-primary mt-4" id="submitButton" @click="saveRisks" :disabled="!sahaRiskGruplari.some(g => g.Riskler && g.Riskler.length > 0)">
        <i class="bi bi-arrow-right me-2"></i> {{ translations.Continue }}
      </button>
    </div>
  `
}).mount('#risk-table-app');