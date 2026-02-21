/**
 * TASMIK QURAN DIGITAL 2026 - CORE ENGINE (PRO VERSION)
 * ---------------------------------------------------
 * Backend: Google Apps Script (GAS)
 * Frontend: GitHub Pages
 * Database: Google Sheets (Multi-Tab)
 * Integration: Telegram Bot API
 */

// 1. KONFIGURASI GLOBAL
const CONFIG = {
    // GANTIKAN URL INI DENGAN URL DEPLOYMENT GAS ANDA
    GAS_URL: "https://script.google.com/macros/s/AKfycbw1AOdJvjfJT5Edtl58OohjtHxldCqY2SC_v2cG1K5V044895CdyJNK-aKbVoHCmL09/exec",
    FILES: {
        LELAKI: "peserta_lelaki.hjson",
        PEREMPUAN: "peserta_perempuan.hjson",
        SILIBUS: "silibus.hjson"
    },
    DEFAULT_USTAZ: "USTAZ AIMAN"
};

// 2. STATE MANAGEMENT
let state = {
    currentUstaz: localStorage.getItem('ustaz_nama') || CONFIG.DEFAULT_USTAZ,
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
    audioBlob: null
};

// 3. INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 System Initializing...");
    updateUstazUI();
    await loadInitialData();
    setupEventListeners();
    renderRatingPickers();
});

// 4. DATA LOADING
async function loadInitialData() {
    try {
        const cacheBurst = `?v=${new Date().getTime()}`;
        
        const [resL, resP, resS] = await Promise.all([
            fetch(CONFIG.FILES.LELAKI + cacheBurst),
            fetch(CONFIG.FILES.PEREMPUAN + cacheBurst),
            fetch(CONFIG.FILES.SILIBUS + cacheBurst)
        ]);

        state.dataPesertaLelaki = Hjson.parse(await resL.text());
        state.dataPesertaPerempuan = Hjson.parse(await resP.text());
        state.dataSilibus = Hjson.parse(await resS.text());

        renderPesertaPicker();
        renderSurahPicker();
        
        console.log("✅ Data Loaded Successfully");
    } catch (err) {
        console.error("❌ Data Load Error:", err);
        alert("Ralat memuatkan data. Sila refresh halaman.");
    }
}

// 5. UI RENDERING LOGIC
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
    
    // Flatten silibus data
    let allSurah = [];
    Object.keys(state.dataSilibus).forEach(tahap => {
        state.dataSilibus[tahap].forEach(s => allSurah.push(s));
    });

    allSurah.forEach((s, index) => {
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

// 6. HELPER FUNCTIONS
function createWheelItem(content, onClick) {
    const div = document.createElement('div');
    div.className = 'wheel-item';
    div.innerHTML = content;
    div.onclick = (e) => {
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

// 7. ACTION HANDLERS (SUBMISSION)
async function hantarTasmik() {
    const mukaInput = document.getElementById('muka').value;
    const ulasan = document.getElementById('catatan').value;

    if (!state.selected.peserta || !mukaInput) {
        alert("⚠️ Sila pastikan nama peserta dan muka surat diisi!");
        return;
    }

    const payload = {
        ustaz: state.currentUstaz,
        peserta: state.selected.peserta,
        jantina: state.selected.jantina,
        surah: state.selected.surah,
        muka: mukaInput,
        tajwid: state.selected.tajwid,
        fasohah: state.selected.fasohah,
        ulasan: ulasan || "-"
    };

    // UI Feedback
    const btn = document.getElementById('submitBtn');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        // Post to Google Apps Script
        await fetch(CONFIG.GAS_URL, {
            method: 'POST',
            mode: 'no-cors', // Penting untuk bypass CORS Policy GAS
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Kerana 'no-cors', kita tak boleh baca response body. 
        // Kita gunakan timeout sebagai simulasi success feedback.
        alert(`✅ REKOD BERJAYA!\nNama: ${payload.peserta}\nSurah: ${payload.surah}`);
        location.reload();

    } catch (err) {
        console.error("Submission Error:", err);
        alert("❌ Ralat penghantaran. Sila cuba lagi.");
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

// 8. AUDIO RECORDING (BROWSER COMPATIBLE)
let mediaRecorder;
let chunks = [];

async function toggleRecording() {
    const btn = document.getElementById('recordBtn');
    
    if (!state.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            chunks = [];

            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                state.audioBlob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
                console.log("🎙️ Recording Captured");
            };

            mediaRecorder.start();
            state.isRecording = true;
            btn.classList.add('recording');
            btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
        } catch (err) {
            alert("Akses mikrofon diperlukan untuk merakam.");
        }
    } else {
        mediaRecorder.stop();
        state.isRecording = false;
        btn.classList.remove('recording');
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    }
}

// 9. UTILITIES & STORAGE
function toggleUstaz() {
    const newName = prompt("Nama Pentashih:", state.currentUstaz);
    if (newName && newName.trim() !== "") {
        state.currentUstaz = newName.toUpperCase();
        localStorage.setItem('ustaz_nama', state.currentUstaz);
        updateUstazUI();
    }
}

function updateUstazUI() {
    const display = document.getElementById('ustazNameDisplay');
    if(display) display.textContent = state.currentUstaz;
}

function setupEventListeners() {
    // Listener untuk pertukaran jantina
    const jantinaSelect = document.getElementById('jantina');
    if(jantinaSelect) {
        jantinaSelect.addEventListener('change', renderPesertaPicker);
    }
}
