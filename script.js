/**
 * TASMIK QURAN DIGITAL 2026 - CORE ENGINE (ULTRA PRO)
 * ---------------------------------------------------
 * Integrasi: GitHub Pages + Google Apps Script + Google Sheets + Telegram Bot API
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
        LELAKI: "peserta_lelaki.hjson",
        PEREMPUAN: "peserta_perempuan.hjson",
        SILIBUS: "silibus.hjson"
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

// 4. DATA LOADING (HJSON)
async function loadInitialData() {
    try {
        const ts = new Date().getTime();
        const [resL, resP, resS] = await Promise.all([
            fetch(`${CONFIG.FILES.LELAKI}?v=${ts}`),
            fetch(`${CONFIG.FILES.PEREMPUAN}?v=${ts}`),
            fetch(`${CONFIG.FILES.SILIBUS}?v=${ts}`)
        ]);

        state.dataPesertaLelaki = Hjson.parse(await resL.text());
        state.dataPesertaPerempuan = Hjson.parse(await resP.text());
        state.dataSilibus = Hjson.parse(await resS.text());

        renderPesertaPicker();
        renderSurahPicker();
        console.log("✅ Data HJSON Loaded");
    } catch (err) {
        console.error("❌ Load Error:", err);
        alert("Gagal memuatkan data peserta/silibus.");
    }
}

// 5. UI RENDERING (WHEEL PICKERS)
function renderPesertaPicker() {
    const jantina = document.getElementById('jantina').value;
    state.selected.jantina = jantina;
    const senarai = jantina === "LELAKI" ? state.dataPesertaLelaki : state.dataPesertaPerempuan;
    const wrapper = document.getElementById('peserta-wrapper');
    
    wrapper.innerHTML = "";
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
    wrapper.innerHTML = "";
    let allSurahs = [];
    Object.values(state.dataSilibus).forEach(group => {
        group.forEach(s => allSurahs.push(s));
    });

    allSurahs.forEach((s, index) => {
        const item = createWheelItem(`${s.nama} <small>(m/s ${s.ms})</small>`, () => {
            state.selected.surah = s.nama;
            state.selected.muka = s.ms;
            document.getElementById('muka').value = s.ms;
            highlightSelected('surah-wrapper', index);
        });
        wrapper.appendChild(item);
        if(s.nama === "An-Naas") item.click();
    });
}

function renderRatingPickers() {
    ['tajwid', 'fasohah'].forEach(type => {
        const wrapper = document.getElementById(`${type}-wrapper`);
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
    const items = document.getElementById(wrapperId).children;
    Array.from(items).forEach(item => item.classList.remove('selected'));
    if(items[index]) items[index].classList.add('selected');
}

// 6. AUDIO RECORDING (VOICE NOTE LOGIC)
async function toggleRecording() {
    const btn = document.getElementById('recordBtn');
    
    if (!state.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.mediaRecorder = new MediaRecorder(stream);
            state.audioChunks = [];

            state.mediaRecorder.ondataavailable = e => state.audioChunks.push(e.data);
            state.mediaRecorder.onstop = () => {
                state.audioBlob = new Blob(state.audioChunks, { type: 'audio/ogg; codecs=opus' });
                document.getElementById('audioPlayback').src = URL.createObjectURL(state.audioBlob);
            };

            state.mediaRecorder.start();
            state.isRecording = true;
            btn.classList.add('recording');
            btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
        } catch (err) {
            alert("Akses mikrofon ditolak.");
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

    if (!state.selected.peserta || !mukaVal) {
        alert("⚠️ Nama peserta atau muka surat tidak lengkap!");
        return;
    }

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

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        // A. Hantar ke Google Sheets (GAS)
        await fetch(CONFIG.GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });

        // B. Hantar Audio ke Telegram (Direct API)
        if (state.audioBlob) {
            const token = CONFIG.BOTS[state.selected.jantina];
            const formData = new FormData();
            formData.append('chat_id', CONFIG.CHAT_ID);
            formData.append('voice', state.audioBlob, `tasmik_${payload.peserta}.ogg`);
            formData.append('caption', `🎙️ RAKAMAN TASMIK\n👤 ${payload.peserta}\n📖 ${payload.surah}`);

            await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
                method: 'POST',
                body: formData
            });
        }

        alert("✅ Rekod & Audio Berjaya Dihantar!");
        location.reload();

    } catch (err) {
        console.error("Submission Error:", err);
        alert("Gagal menghantar rekod.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    }
}

// 8. UTILITIES
function toggleUstaz() {
    const n = prompt("Nama Pentashih:", state.currentUstaz);
    if (n) {
        state.currentUstaz = n.toUpperCase();
        localStorage.setItem('ustaz_nama', state.currentUstaz);
        updateUstazUI();
    }
}

function updateUstazUI() {
    const el = document.getElementById('ustazNameDisplay');
    if(el) el.textContent = state.currentUstaz;
}

function setupEventListeners() {
    const jSelect = document.getElementById('jantina');
    if(jSelect) jSelect.addEventListener('change', renderPesertaPicker);
}
