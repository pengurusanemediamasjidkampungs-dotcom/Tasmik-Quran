/**
 * Tasmik Quran 2026 - Core Logic (Professional Grade)
 * Author: Gemini Adaptive AI
 * Backend: Google Apps Script (GAS)
 * Storage: Google Sheets (Tab LELAKI/PEREMPUAN)
 */

// =========================================
// 1. KONFIGURASI & STATE
// =========================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbw1AOdJvjfJT5Edtl58OohjtHxldCqY2SC_v2cG1K5V044895CdyJNK-aKbVoHCmL09/exec";

let currentUstaz = localStorage.getItem('ustaz_nama') || "USTAZ AIMAN";
let dataPesertaLelaki = [];
let dataPesertaPerempuan = [];
let dataSilibus = {};

// State Pilihan
let selectedPeserta = "";
let selectedSurah = "An-Naas";
let selectedTajwid = "3";
let selectedFasohah = "3";

// Audio State
let mediaRecorder;
let audioChunks = [];
let audioBlob = null;
let isRecording = false;

// =========================================
// 2. INITIALIZATION (STARTUP)
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    updateUstazUI();
    initSystem();
    setupWheelPickers();
});

async function initSystem() {
    try {
        const ts = new Date().getTime();
        // Load HJSON files
        const [resL, resP, resS] = await Promise.all([
            fetch(`peserta_lelaki.hjson?v=${ts}`),
            fetch(`peserta_perempuan.hjson?v=${ts}`),
            fetch(`silibus.hjson?v=${ts}`)
        ]);

        const textL = await resL.text();
        const textP = await resP.text();
        const textS = await resS.text();

        dataPesertaLelaki = Hjson.parse(textL);
        dataPesertaPerempuan = Hjson.parse(textP);
        dataSilibus = Hjson.parse(textS);

        loadPeserta(); // Load senarai nama default (Lelaki)
        renderSurahPicker();
        
    } catch (err) {
        console.error("Initialization Error:", err);
        alert("Gagal memuatkan data silibus/peserta. Sila periksa fail HJSON anda.");
    }
}

// =========================================
// 3. UI RENDERING (WHEEL PICKERS)
// =========================================

function loadPeserta() {
    const jantina = document.getElementById('jantina').value;
    const senarai = jantina === "LELAKI" ? dataPesertaLelaki : dataPesertaPerempuan;
    const wrapper = document.getElementById('peserta-wrapper');
    
    wrapper.innerHTML = "";
    senarai.forEach((p, index) => {
        const item = document.createElement('div');
        item.className = 'wheel-item';
        item.textContent = p.nama;
        item.onclick = () => selectItem('peserta', item, p.nama);
        wrapper.appendChild(item);
        if(index === 0) selectItem('peserta', item, p.nama); // Auto-select first
    });
}

function renderSurahPicker() {
    const wrapper = document.getElementById('surah-wrapper');
    wrapper.innerHTML = "";
    
    // Gabungkan semua surah dari semua tahap silibus
    Object.values(dataSilibus).flat().forEach((s, index) => {
        const item = document.createElement('div');
        item.className = 'wheel-item';
        item.innerHTML = `<span>${s.nama}</span> <small style="font-size:0.6rem; opacity:0.6;">(m/s ${s.ms})</small>`;
        item.onclick = () => {
            selectItem('surah', item, s.nama);
            document.getElementById('muka').value = s.ms; // Auto-fill muka surat
        };
        wrapper.appendChild(item);
        if(s.nama === "An-Naas") selectItem('surah', item, s.nama);
    });
}

function setupWheelPickers() {
    // Setup Rating Pickers (Tajwid & Fasohah)
    const pickers = ['tajwid', 'fasohah'];
    pickers.forEach(p => {
        const wrapper = document.getElementById(`${p}-wrapper`);
        for(let i=1; i<=5; i++) {
            const item = document.createElement('div');
            item.className = 'wheel-item';
            item.textContent = i;
            item.onclick = () => selectItem(p, item, i.toString());
            wrapper.appendChild(item);
            if(i === 3) selectItem(p, item, "3");
        }
    });
}

function selectItem(type, element, value) {
    const parent = element.parentElement;
    Array.from(parent.children).forEach(child => child.classList.remove('selected'));
    element.classList.add('selected');
    
    // Update global state
    if(type === 'peserta') selectedPeserta = value;
    if(type === 'surah') selectedSurah = value;
    if(type === 'tajwid') selectedTajwid = value;
    if(type === 'fasohah') selectedFasohah = value;

    // Center the selected item
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
}

// =========================================
// 4. AUDIO RECORDING LOGIC
// =========================================

async function toggleRecording() {
    const btn = document.getElementById('recordBtn');
    
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                audioBlob = new Blob(audioChunks, { type: 'audio/ogg; codecs=opus' });
                const audioUrl = URL.createObjectURL(audioBlob);
                document.getElementById('audioPlayback').src = audioUrl;
            };

            mediaRecorder.start();
            isRecording = true;
            btn.classList.add('recording');
            btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
        } catch (err) {
            alert("Sila benarkan akses mikrofon untuk merakam.");
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        btn.classList.remove('recording');
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    }
}

// =========================================
// 5. PENGHANTARAN DATA (GAS)
// =========================================

async function hantarTasmik() {
    const jantina = document.getElementById('jantina').value;
    const muka = document.getElementById('muka').value;
    const ulasan = document.getElementById('catatan').value;

    if (!selectedPeserta || !muka) {
        alert("⚠️ Ralat: Nama peserta atau muka surat tidak lengkap.");
        return;
    }

    const payload = {
        ustaz: currentUstaz,
        peserta: selectedPeserta,
        jantina: jantina,
        surah: selectedSurah,
        muka: muka,
        tajwid: selectedTajwid,
        fasohah: selectedFasohah,
        ulasan: ulasan
    };

    // UI Loading State
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        // 1. Hantar Data ke Google Sheets & Telegram via GAS
        await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors', // Penting untuk GAS
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Kerana 'no-cors', kita tak boleh baca response body, 
        // tapi jika fetch tidak masuk catch block, ia dikira berjaya.
        
        alert(`✅ Rekod ${selectedPeserta} berjaya dihantar!`);
        location.reload();

    } catch (error) {
        console.error("Submission Error:", error);
        alert("❌ Ralat sistem. Sila cuba lagi.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    }
}

// =========================================
// 6. UTILITIES
// =========================================

function toggleUstaz() {
    const nama = prompt("Masukkan Nama Pentashih:", currentUstaz);
    if (nama) {
        currentUstaz = nama.toUpperCase();
        localStorage.setItem('ustaz_nama', currentUstaz);
        updateUstazUI();
    }
}

function updateUstazUI() {
    const el = document.getElementById('ustazNameDisplay');
    if (el) el.textContent = currentUstaz;
}
