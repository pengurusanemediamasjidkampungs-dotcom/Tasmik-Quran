/**
 * TASMIK QURAN DIGITAL 2026 - CORE ENGINE (ULTRA PRO V2.2)
 * ---------------------------------------------------
 * Integrasi: GitHub Pages + Google Apps Script + Google Sheets + Telegram Bot API
 * Update: Auto-Switch Pentashih (Aiman/Nuaim) & Robust Data Fallback
 */

// 1. KONFIGURASI GLOBAL
const CONFIG = {
    GAS_URL: "https://script.google.com/macros/s/AKfycbw1AOdJvjfJT5Edtl58OohjtHxldCqY2SC_v2cG1K5V044895CdyJNK-aKbVoHCmL09/exec",
    BOTS: {
        LELAKI: "8154726215:AAG-Pa2UNRHBxP0-j3fffQJ0rMBE8hZt5Rw",
        PEREMPUAN: "8559339927:AAFWwLyDpS4Z53k1fjpQD0UScq2fUmKY2Gk"
    },
    CHAT_ID: "-1003513910680",
    FILES: {
        LELAKI: "./peserta_lelaki.hjson",
        PEREMPUAN: "./peserta_perempuan.hjson",
        SILIBUS: "./silibus.hjson"
    }
};

// 2. STATE MANAGEMENT
let state = {
    currentUstaz: localStorage.getItem('ustaz_nama') || "USTAZ AIMAN",
    dataPesertaLelaki: [],
    dataPesertaPerempuan: [],
    dataSilibus: {},
    selected: {
        peserta: "",
        jantina: "LELAKI",
        surah: "An-Naas",
        muka: "604",
        tajwid: "3",
        fasohah: "3"
    },
    isRecording: false,
    audioBlob: null,
    mediaRecorder: null,
    audioChunks: []
};

// 3. INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 System Initializing...");
    updateUstazUI();
    await loadInitialData();
    setupEventListeners();
    renderRatingPickers();
});

// 4. DATA LOADING (ROBUST FETCH HJSON WITH FALLBACK)
async function loadInitialData() {
    const ts = new Date().getTime(); 
    const errorBanner = (msg) => {
        const div = document.createElement('div');
        div.id = "error-banner-top";
        div.style = "position:fixed; top:0; left:0; background:#ff4757; color:white; width:100%; z-index:9999; text-align:center; padding:10px; font-weight:bold; font-size:12px; box-shadow:0 2px 10px rgba(0,0,0,0.2);";
        div.innerHTML = `⚠️ RALAT SISTEM: ${msg} <br><small>Sila semak nama fail di GitHub (Case-Sensitive)</small>`;
        document.body.prepend(div);
    };

    try {
        console.log("📦 Fetching data files...");
        
        const [resL, resP, resS] = await Promise.all([
            fetch(`${CONFIG.FILES.LELAKI}?v=${ts}`),
            fetch(`${CONFIG.FILES.PEREMPUAN}?v=${ts}`),
            fetch(`${CONFIG.FILES.SILIBUS}?v=${ts}`)
        ]);

        if (!resL.ok) throw new Error(`Fail Peserta Lelaki tidak ditemui (${resL.status})`);
        if (!resP.ok) throw new Error(`Fail Peserta Perempuan tidak ditemui (${resP.status})`);
        if (!resS.ok) throw new Error(`Fail Silibus tidak ditemui (${resS.status})`);

        state.dataPesertaLelaki = Hjson.parse(await resL.text());
        state.dataPesertaPerempuan = Hjson.parse(await resP.text());
        state.dataSilibus = Hjson.parse(await resS.text());

        renderPesertaPicker();
        renderSurahPicker();
        
        console.log("✅ Data HJSON Loaded Successfully");

    } catch (err) {
        console.error("❌ Critical Load Error:", err.message);
        errorBanner(err.message);

        // --- LOGIK KEBAL DATA (FALLBACK) ---
        state.dataPesertaLelaki = [{nama: "⚠️ FAIL LELAKI TIADA"}];
        state.dataPesertaPerempuan = [{nama: "⚠️ FAIL PEREMPUAN TIADA"}];
        state.dataSilibus = { "Asas": [{nama: "Sila Refresh", ms: "0"}] };
        
        renderPesertaPicker();
        renderSurahPicker();
    }
}

// 5. UI RENDERING (WHEEL PICKERS)
function renderPesertaPicker() {
    const jSelect = document.getElementById('jantina');
    const jantina = jSelect ? jSelect.value : "LELAKI";
    state.selected.jantina = jantina;
    const senarai = jantina === "LELAKI" ? state.dataPesertaLelaki : state.dataPesertaPerempuan;
    const wrapper = document.getElementById('peserta-wrapper');
    
    if(!wrapper) return;
    wrapper.innerHTML = "";

    if (!senarai || senarai.length === 0) {
        wrapper.innerHTML = "<div class='wheel-item'>Tiada Data</div>";
        return;
    }

    senarai.forEach((p, index) => {
        const item = createWheelItem(p.nama, () => {
            state.selected.peserta = p.nama;
            highlightSelected('peserta-wrapper', index);
        });
        wrapper.appendChild(item);
        if(index === 0) item.click();
    });
}

function renderSurahPicker() {
    const wrapper = document.getElementById('surah-wrapper');
    if(!wrapper) return;
    wrapper.innerHTML = "";
    
    let allSurahs = [];
    if (state.dataSilibus) {
        Object.values(state.dataSilibus).forEach(group => {
            if (Array.isArray(group)) group.forEach(s => allSurahs.push(s));
        });
    }

    if (allSurahs.length === 0) {
        allSurahs.push({nama: "Tiada Silibus", ms: "0"});
    }

    allSurahs.forEach((s, index) => {
        const item = createWheelItem(`${s.nama} <small>(m/s ${s.ms})</small>`, () => {
            state.selected.surah = s.nama;
            state.selected.muka = s.ms;
            const mukaInput = document.getElementById('muka');
            if(mukaInput) mukaInput.value = s.ms;
            highlightSelected('surah-wrapper', index);
        });
        wrapper.appendChild(item);
        if(index === 0) item.click();
    });
}

function renderRatingPickers() {
    ['tajwid', 'fasohah'].forEach(type => {
        const wrapper = document.getElementById(`${type}-wrapper`);
        if(!wrapper) return;
        wrapper.innerHTML = "";
        for(let i=1; i<=5; i++) {
            const item = createWheelItem(i, () => {
                state.selected[type] = i.toString();
                highlightSelected(`${type}-wrapper`, i-1);
            });
            wrapper.appendChild(item);
            if(i === 3) item.click();
        }
    });
}

function createWheelItem(content, onClick) {
    const div = document.createElement('div');
    div.className = 'wheel-item';
    div.innerHTML = content;
    div.onclick = () => {
        onClick();
        div.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    return div;
}

function highlightSelected(wrapperId, index) {
    const el = document.getElementById(wrapperId);
    if(!el) return;
    const items = el.children;
    Array.from(items).forEach(item => item.classList.remove('selected'));
    if(items[index]) items[index].classList.add('selected');
}

// 6. AUDIO RECORDING (VOICE NOTE LOGIC)
async function toggleRecording() {
    const btn = document.getElementById('recordBtn');
    if(!btn) return;

    if (!state.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.mediaRecorder = new MediaRecorder(stream);
            state.audioChunks = [];

            state.mediaRecorder.ondataavailable = e => state.audioChunks.push(e.data);
            state.mediaRecorder.onstop = () => {
                state.audioBlob = new Blob(state.audioChunks, { type: 'audio/ogg; codecs=opus' });
                const audioPrev = document.getElementById('audioPlayback');
                const audioCont = document.getElementById('audio-container');
                if(audioPrev) audioPrev.src = URL.createObjectURL(state.audioBlob);
                if(audioCont) audioCont.classList.remove('d-none');
            };

            state.mediaRecorder.start();
            state.isRecording = true;
            btn.classList.add('recording');
            btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
        } catch (err) {
            alert("Ralat Mikrofon: Pastikan anda memberi kebenaran akses mikrofon di pelayar.");
        }
    } else {
        state.mediaRecorder.stop();
        state.isRecording = false;
        btn.classList.remove('recording');
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    }
}

// 7. SUBMISSION ENGINE (GAS & TELEGRAM)
async function hantarTasmik() {
    const mukaVal = document.getElementById('muka').value;
    const ulasanVal = document.getElementById('catatan').value;
    const btn = document.getElementById('submitBtn');

    if (!state.selected.peserta || !mukaVal || state.selected.peserta.includes("TIADA")) {
        alert("⚠️ Maklumat tidak lengkap atau data gagal dimuat!");
        return;
    }

    if(!confirm(`Hantar rekod tasmik untuk ${state.selected.peserta}?`)) return;

    const payload = {
        ustaz: state.currentUstaz,
        peserta: state.selected.peserta,
        jantina: state.selected.jantina,
        surah: state.selected.surah,
        muka: mukaVal,
        tajwid: state.selected.tajwid,
        fasohah: state.selected.fasohah,
        ulasan: ulasanVal || "-"
    };

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        await fetch(CONFIG.GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });

        if (state.audioBlob) {
            const token = CONFIG.BOTS[state.selected.jantina];
            const formData = new FormData();
            formData.append('chat_id', CONFIG.CHAT_ID);
            formData.append('voice', state.audioBlob, `tasmik_${payload.peserta}.ogg`);
            formData.append('caption', `🎙️ RAKAMAN TASMIK\n👤 ${payload.peserta}\n📖 ${payload.surah}\n✨ Tajwid: ${payload.tajwid} | Fasohah: ${payload.fasohah}\n✍️ Nota: ${payload.ulasan}`);

            await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
                method: 'POST',
                body: formData
            });
        }

        alert("✅ Berjaya! Rekod tasmik dan audio telah disimpan.");
        location.reload();

    } catch (err) {
        console.error("Submission Error:", err);
        alert("Ralat penghantaran. Sila cuba sebentar lagi.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    }
}

// 8. UTILITIES (AUTO-SWITCH TOGGLE)
function toggleUstaz() {
    // Logik tukar nama secara bergilir
    if (state.currentUstaz.includes("AIMAN")) {
        state.currentUstaz = "USTAZ NUAIM";
    } else {
        state.currentUstaz = "USTAZ AIMAN";
    }

    localStorage.setItem('ustaz_nama', state.currentUstaz);
    updateUstazUI();
    
    // Memberi maklum balas visual melalui console
    console.log(`🔄 Pentashih ditukar kepada: ${state.currentUstaz}`);
}

function updateUstazUI() {
    const el = document.getElementById('ustazNameDisplay');
    if(el) el.textContent = state.currentUstaz;
    
    const floatEl = document.querySelector('.pentashih-float small');
    if(floatEl) {
        const namaSahaja = state.currentUstaz.replace("USTAZ ", "");
        floatEl.innerHTML = `PENTASHIH<br>${namaSahaja}`;
    }
}

function setupEventListeners() {
    const jSelect = document.getElementById('jantina');
    if(jSelect) jSelect.addEventListener('change', renderPesertaPicker);
}
