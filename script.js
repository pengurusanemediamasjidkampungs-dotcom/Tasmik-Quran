/**
 * TASMIK QURAN DIGITAL 2026 - CORE ENGINE (ULTRA PRO V3.0)
 * ---------------------------------------------------
 * Integrasi: GitHub Pages + Google Apps Script + Google Sheets + Telegram Bot API
 * Update: Multi-Tahap (1-6) Filter, Auto-Fill Ayat, & 12-Column Data Payload
 */

// 1. KONFIGURASI GLOBAL
const CONFIG = {
    // Sila pastikan GAS_URL ini adalah URL Deployment "Anyone" yang terbaru
    GAS_URL: "https://script.google.com/macros/s/AKfycbw5tyY3rrQFkGisxuE-pAc-Ii2Z4G2GYyUyvS6NeTSlrpKhlQ4aFEaWC-5ujnXCa9u1Ag/exec",
    BOT_TOKEN: "8154726215:AAG-Pa2UNRHBxP0-j3fffQJ0rMBE8hZt5Rw",
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
        tahap: "1",
        surah: "",
        muka: "",
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
    renderTahapPicker(); // Menjalankan filter tahap secara automatik
    renderRatingPickers();
});

// 4. DATA LOADING
async function loadInitialData() {
    const ts = new Date().getTime(); 
    try {
        const [resL, resP, resS] = await Promise.all([
            fetch(`${CONFIG.FILES.LELAKI}?v=${ts}`),
            fetch(`${CONFIG.FILES.PEREMPUAN}?v=${ts}`),
            fetch(`${CONFIG.FILES.SILIBUS}?v=${ts}`)
        ]);

        if (!resL.ok || !resP.ok || !resS.ok) throw new Error("Gagal memuatkan fail data.");

        state.dataPesertaLelaki = Hjson.parse(await resL.text());
        state.dataPesertaPerempuan = Hjson.parse(await resP.text());
        state.dataSilibus = Hjson.parse(await resS.text());

        renderPesertaPicker();
        console.log("✅ Data HJSON Loaded Successfully");

    } catch (err) {
        console.error("❌ Critical Load Error:", err.message);
        state.dataPesertaLelaki = [{nama: "⚠️ RALAT DATA"}];
        state.dataPesertaPerempuan = [{nama: "⚠️ RALAT DATA"}];
        state.dataSilibus = { "1": [{nama: "Sila Refresh", ms: "0", ayat: 0}] };
        renderPesertaPicker();
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

    senarai.forEach((p, index) => {
        const item = createWheelItem(p.nama, () => {
            state.selected.peserta = p.nama;
            highlightSelected('peserta-wrapper', index);
        });
        wrapper.appendChild(item);
        if(index === 0) item.click();
    });
}

function renderTahapPicker() {
    const wrapper = document.getElementById('tahap-wrapper');
    if(!wrapper) return;
    wrapper.innerHTML = "";

    const senaraiTahap = ["1", "2", "3", "4", "5", "6"];
    
    senaraiTahap.forEach((t, index) => {
        const item = createWheelItem(`TAHAP ${t}`, () => {
            state.selected.tahap = t;
            highlightSelected('tahap-wrapper', index);
            renderSurahPicker(t); // Filter surah mengikut tahap
        });
        wrapper.appendChild(item);
        if(index === 0) item.click();
    });
}

function renderSurahPicker(tahapTerpilih) {
    const wrapper = document.getElementById('surah-wrapper');
    if(!wrapper) return;
    wrapper.innerHTML = "";
    
    let senaraiSurah = state.dataSilibus[tahapTerpilih] || [];

    senaraiSurah.forEach((s, index) => {
        const item = createWheelItem(`${s.nama} <small>(m/s ${s.ms})</small>`, () => {
            state.selected.surah = s.nama;
            state.selected.muka = s.ms;
            
            // Auto-fill input fields
            if(document.getElementById('muka')) document.getElementById('muka').value = s.ms;
            if(document.getElementById('ayat_mula')) document.getElementById('ayat_mula').value = 1;
            if(document.getElementById('ayat_akhir')) document.getElementById('ayat_akhir').value = s.ayat;

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
        div.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
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

// 6. AUDIO RECORDING
async function toggleRecording() {
    const btn = document.getElementById('recordBtn');
    const statusText = document.getElementById('recordStatus');

    if (!state.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.mediaRecorder = new MediaRecorder(stream);
            state.audioChunks = [];
            
            state.mediaRecorder.ondataavailable = e => state.audioChunks.push(e.data);
            state.mediaRecorder.onstop = () => {
                state.audioBlob = new Blob(state.audioChunks, { type: 'audio/ogg; codecs=opus' });
                const audioURL = URL.createObjectURL(state.audioBlob);
                document.getElementById('audioPlayback').src = audioURL;
                document.getElementById('audio-container').classList.remove('d-none');
                if(statusText) statusText.innerText = "RAKAMAN SEDIA DISIMPAN";
            };

            state.mediaRecorder.start();
            state.isRecording = true;
            btn.classList.add('recording');
            btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
            if(statusText) statusText.innerText = "SEDANG MERAKAM...";
        } catch (err) { 
            alert("Akses Mikrofon Ditolak. Sila benarkan akses untuk merakam."); 
        }
    } else {
        state.mediaRecorder.stop();
        state.isRecording = false;
        btn.classList.remove('recording');
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    }
}

// 7. SUBMISSION ENGINE
async function hantarTasmik() {
    const btn = document.getElementById('submitBtn');
    const overlay = document.getElementById('statusOverlay');
    
    const payload = {
        ustaz: state.currentUstaz,
        peserta: state.selected.peserta,
        jenis_bacaan: document.getElementById('jenis_bacaan').value,
        tahap: "Tahap " + state.selected.tahap,
        surah: state.selected.surah,
        mukasurat: document.getElementById('muka').value,
        ayat_mula: document.getElementById('ayat_mula').value,
        ayat_akhir: document.getElementById('ayat_akhir').value,
        tajwid: state.selected.tajwid,
        fasohah: state.selected.fasohah,
        ulasan: document.getElementById('catatan').value || "-"
    };

    if (!payload.peserta || !payload.mukasurat) return alert("Maklumat tidak lengkap!");
    if (!confirm(`Hantar rekod untuk ${payload.peserta}?`)) return;

    btn.disabled = true;
    if(overlay) overlay.classList.remove('d-none');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        // A. Google Sheets (POST ke GAS)
        await fetch(CONFIG.GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // B. Telegram Voice Note & Caption
        if (state.audioBlob) {
            const formData = new FormData();
            formData.append('chat_id', CONFIG.CHAT_ID);
            formData.append('voice', state.audioBlob, `tasmik_${payload.peserta}.ogg`);
            
            const caption = `🎙️ *REKOD TASMIK DIGITAL*\n` +
                          `──────────────────\n` +
                          `👤 *Nama:* ${payload.peserta}\n` +
                          `📖 *Surah:* ${payload.surah}\n` +
                          `📄 *Muka:* ${payload.mukasurat}\n` +
                          `🔢 *Ayat:* ${payload.ayat_mula}-${payload.ayat_akhir}\n` +
                          `✨ *T:* ${payload.tajwid} | *F:* ${payload.fasohah}\n` +
                          `🎙️ *Ustaz:* ${payload.ustaz}`;
            
            formData.append('caption', caption);
            formData.append('parse_mode', 'Markdown');

            await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendVoice`, {
                method: 'POST',
                body: formData
            });
        }

        alert("✅ Berjaya Disimpan!");
        location.reload();

    } catch (err) {
        console.error(err);
        alert("Ralat penghantaran. Sila semak sambungan internet.");
    } finally {
        btn.disabled = false;
        if(overlay) overlay.classList.add('d-none');
    }
}

// 8. UTILITIES
function toggleUstaz() {
    // Kitaran: Aiman -> Nuaim -> Arif -> Aiman
    if (state.currentUstaz.includes("AIMAN")) {
        state.currentUstaz = "USTAZ NUAIM";
    } else if (state.currentUstaz.includes("NUAIM")) {
        state.currentUstaz = "USTAZ ARIF";
    } else {
        state.currentUstaz = "USTAZ AIMAN";
    }
    
    localStorage.setItem('ustaz_nama', state.currentUstaz);
    updateUstazUI();
}

function updateUstazUI() {
    const el = document.getElementById('ustazNameDisplay');
    if(el) el.textContent = state.currentUstaz;
    
    // Kemaskini elemen terapung jika ada
    const floatSmall = document.querySelector('.pentashih-float small');
    if(floatSmall) {
        const namaRingkas = state.currentUstaz.replace("USTAZ ", "");
        floatSmall.innerHTML = `PENTASHIH<br>${namaRingkas}`;
    }
}

function setupEventListeners() {
    const jSelect = document.getElementById('jantina');
    if(jSelect) jSelect.addEventListener('change', renderPesertaPicker);
}
