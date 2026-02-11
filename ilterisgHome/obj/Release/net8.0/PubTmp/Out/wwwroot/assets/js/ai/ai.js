const connection = new signalR.HubConnectionBuilder()
    .withUrl("/ilterisg.ai")
    .build();

let currentGptDiv = null;

// Global: MeslekKKD için detay sakla (diğer modüller etkilemesin)
window.currentMeslekDetay = '';  // YENİ: Global yap, enriched için

// --- Yardımcılar ---
function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, s => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[s]));
}

/**
 * Basit, güvenli Markdown -> HTML çevirici.
 * Destek: **bold**, *italic*, listeler (- veya •), linkler (absolute/relative/#), paragraflar.
 * NOT: <br> eklemiyoruz; paragrafları <p>, listeleri <ul><li> ile yazıyoruz.
 */
function mdToHtml(text) {
    // 1) HTML escape
    let safe = escapeHtml(text || "");

    // 2) Linkler
    // 2a) Mutlak: [metin](https://...)
    safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        (m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
    );
    // 2b) Göreli/anchor: [metin](/), [metin](/Home/Contact), [metin](./x), [metin](../x), [metin](#id)
    safe = safe.replace(/\[([^\]]+)\]\(((?:\/[^\s)]*|\.{1,2}\/[^\s)]+|#[^\s)]+))\)/g,
        (m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
    );

    // 3) Bold ve italic
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");                 // **bold**
    safe = safe.replace(/(^|[^\*])\*(?!\s)([^*]+?)\*(?!\*)/g, "$1<em>$2</em>");   // *italic*

    // 4) Satır satır işle → liste/paragraf üret
    const lines = safe.split(/\r?\n/);
    let html = "";
    let inList = false;

    for (const raw of lines) {
        const line = raw.trimEnd();

        // Boş satır: sadece listeyi kapat, ekstra boşluk basma
        if (line.trim() === "") {
            if (inList) { html += "</ul>"; inList = false; }
            continue;
        }

        // Liste maddesi?
        const m = line.match(/^\s*[-•]\s+(.*)$/);
        if (m) {
            if (!inList) { html += '<ul class="ai-list">'; inList = true; }
            html += `<li>${m[1]}</li>`;
            continue;
        }

        // Normal satır → paragraf
        if (inList) { html += "</ul>"; inList = false; }
        html += `<p class="ai-p">${line}</p>`;
    }

    if (inList) html += "</ul>";
    return html;
}

// --- Risk konusu algılayıcı (TR duyarlı) ---
const RISK_TRIGGERS = [
    'risk analiz', 'risk analizi',
    '5x5', 'fine kinney', 'fine-kinney', 'finney', 'kinney', 'fk',
    'önlem sonrası', 'detaylar ve doğrulama',
    'yeni risk', 'saha', 'önerilen risk', 'mevzuat',
    'olasılık', 'şiddet', 'maruziyet',
    'rapor', 'logolu', 'logosuz', 'pdf',
    'risk türü ve öneriler',
    // yeni eklenenler:
    'test metodları', 'test yöntemleri', 'test metotları',
    'yöntem', 'yöntemler', 'metot', 'metotlar',
    'analiz yöntemi', 'risk yöntemi', 'risk metodu'
];

function isRiskQuestion(q) {
    const t = (q || '').toLocaleLowerCase('tr-TR');
    if (RISK_TRIGGERS.some(k => t.includes(k))) return true;
    // ek güvenlik ağı: "risk" + ("test" veya "yöntem/metot") birlikteyse
    const hasRisk = t.includes('risk');
    const hasMethod = t.includes('test') || t.includes('yöntem') || t.includes('metot');
    return hasRisk && hasMethod;
}

// --- SignalR event'leri ---

// Sunucu ilk "ReceiveMessage" gönderdiğinde: GPT için konteyner + typing
connection.on("ReceiveMessage", (user, message) => {
    const responseArea = document.getElementById("aiResponseArea");
    responseArea.style.display = "block";
    responseArea.classList.add("active");

    currentGptDiv = document.createElement("div");
    currentGptDiv.className = "gpt-msg";
    currentGptDiv.dataset.raw = ""; // ham metin biriktirme
    currentGptDiv.innerHTML = `
        <strong class="gpt-label">
            <img src="/images/logos/ailogo1.svg" alt="AI Logo" style="width:24px;height:24px;vertical-align:middle;">
            İLTER-BOT
        </strong>
        <span class="minimal-typing-indicator active"><span></span><span></span><span></span></span>
        <span class="gpt-text"></span>
    `;
    responseArea.appendChild(currentGptDiv);
    responseArea.scrollTop = responseArea.scrollHeight;
});

// AI yanıtını stream et
connection.on("ReceiveChunk", (chunk) => {
    const responseArea = document.getElementById("aiResponseArea");
    responseArea.style.display = "block";
    responseArea.classList.add("active");

    // Eğer konteyner yoksa oluştur
    if (!currentGptDiv || !responseArea.contains(currentGptDiv)) {
        currentGptDiv = document.createElement("div");
        currentGptDiv.className = "gpt-msg";
        currentGptDiv.dataset.raw = "";
        currentGptDiv.innerHTML = `
            <strong class="gpt-label">
                <img src="/images/logos/ailogo1.svg" alt="AI Logo" style="width:24px;height:24px;vertical-align:middle;">
                İLTER-BOT
            </strong>
            <span class="minimal-typing-indicator active"><span></span><span></span><span></span></span>
            <span class="gpt-text"></span>
        `;
        responseArea.appendChild(currentGptDiv);
    }

    // Bu mesaja ait typing'i kapat
    const typing = currentGptDiv.querySelector(".minimal-typing-indicator");
    if (typing) typing.classList.remove("active");

    // Ham metni biriktir → Markdown'u HTML'e çevir → yaz
    currentGptDiv.dataset.raw = (currentGptDiv.dataset.raw || "") + chunk;
    const rendered = mdToHtml(currentGptDiv.dataset.raw);
    currentGptDiv.querySelector(".gpt-text").innerHTML = rendered;

    responseArea.scrollTop = responseArea.scrollHeight;
});

// Yönlendirme (backend isterse) → yeni sekmede aç
connection.on("ReceiveRedirect", (url) => {
    const responseArea = document.getElementById("aiResponseArea");
    responseArea.style.display = "block";
    responseArea.classList.add("active");
    responseArea.insertAdjacentHTML(
        "beforeend",
        `<div class="gpt-msg">👉 <a href="${url}" target="_blank" rel="noopener noreferrer">Buraya tıklayın</a></div>`
    );
    setTimeout(() => window.open(url, "_blank", "noopener"), 800);
});

// Bağlantıyı başlat
connection.start()
    .then(() => console.log("SignalR bağlantısı kuruldu"))
    .catch(err => console.error("SignalR bağlantı hatası:", err));

// Gönder butonu
document.getElementById("aiSend")?.addEventListener("click", async () => {
    const input = document.getElementById("aiInput");
    let question = input.value.trim();
    if (!question) return;

    const responseArea = document.getElementById("aiResponseArea");
    responseArea.style.display = "block";
    responseArea.classList.add("active");

    responseArea.insertAdjacentHTML(
        "beforeend",
        `<div class="user-msg"><strong>Siz:</strong> ${escapeHtml(question)}</div>`
    );
    responseArea.scrollTop = responseArea.scrollHeight;

    input.value = "";

    // --- Modül seçimi: önce data-attr/URL, risk sorusuyse otomatik RiskAnaliz ---
    const baseModule =
        responseArea?.dataset?.module
        || (location.pathname.toLowerCase().startsWith('/riskanaliz') ? 'RiskAnalizController' : 'HomeController');

    const moduleName = isRiskQuestion(question) ? 'RiskAnalizController' : baseModule;

    // YENİ: MeslekKKD için enriched question (global detay ile)
    let enrichedQuestion = question;
    if (window.currentMeslekDetay && moduleName === 'MeslekKKDOnerisi') {
        enrichedQuestion = `${question} (Meslek Detayı: ${window.currentMeslekDetay})`;
    }

    await connection.invoke("AskGPT", enrichedQuestion, moduleName)
        .catch(async (err) => {
            console.error("AskGPT hatası:", err);
            // YENİ: Fallback - MeslekKKD için AskAIKKD AJAX (non-stream)
            if (window.currentMeslekDetay && moduleName === 'MeslekKKDOnerisi') {
                try {
                    const fallbackResponse = await fetch('/MeslekKKD/AskAIKKD', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            question: question,  // Orijinal soru (enriched değil, action zaten yapar)
                            meslekDetay: window.currentMeslekDetay
                        })
                    });
                    const fallbackData = await fallbackResponse.json();
                    if (fallbackData.success) {
                        // Yanıtı göster (formatted ile)
                        const gptDiv = document.createElement("div");
                        gptDiv.className = "gpt-msg";
                        gptDiv.innerHTML = `
                            <strong class="gpt-label">
                                <img src="/images/logos/ailogo1.svg" alt="AI Logo" style="width:24px;height:24px;vertical-align:middle;">
                                İLTER-BOT
                            </strong>
                            <pre class="gpt-text">${escapeHtml(fallbackData.formatted)}</pre>
                        `;
                        responseArea.appendChild(gptDiv);
                        responseArea.scrollTop = responseArea.scrollHeight;
                    } else {
                        console.error("Fallback hatası:", fallbackData.message);
                        responseArea.insertAdjacentHTML("beforeend",
                            `<div class="gpt-msg"><strong>İLTER-BOT:</strong> ${escapeHtml(fallbackData.message)}</div>`
                        );
                    }
                } catch (fallbackErr) {
                    console.error("Fallback AJAX hatası:", fallbackErr);
                }
            }
        });
});

// Enter tuşu ile gönder
document.getElementById("aiInput")?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
        document.getElementById("aiSend")?.click();
    }
});