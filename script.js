// 1. Unified App State
let state = { 
    subject: '', 
    count: 0, 
    answers: {}, 
    key: {}, 
    start: null, 
    timer: null,
    totalSeconds: 0 
};

// Use your exact Google Web App URL here
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby0U7038RLpJYZwvRv2ax-lZS1AFE6kzFAaVts7L2o3bUeG2QMEvfHZ-gjRRzqRrN4A/exec";

function showPage(n) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page${n}`).classList.add('active');
    window.scrollTo(0, 0);
}

// 2. Setup Logic: Captures subject correctly
function openPopup(subName) {
    state.subject = subName; 
    document.getElementById('sub-name').innerText = subName;
    document.getElementById('setup-popup').style.display = 'flex';
}

function closePopup() { 
    document.getElementById('setup-popup').style.display = 'none'; 
}

function startQuiz() {
    const input = document.getElementById('qty-input');
    state.count = parseInt(input.value);
    if (!state.count || state.count <= 0) return alert("Enter a valid number!");

    closePopup();
    document.getElementById('current-sub').innerText = state.subject;
    
    renderGrid('quiz-grid', 'answers', 'Question');
    renderGrid('key-grid', 'key', 'Key');
    
    // Timer Reset and Start
    state.totalSeconds = 0;
    state.start = Date.now();
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => {
        state.totalSeconds++;
        const h = Math.floor(state.totalSeconds / 3600);
        const m = Math.floor((state.totalSeconds % 3600) / 60);
        const s = state.totalSeconds % 60;
        document.getElementById('timer').innerText = 
            [h, m, s].map(v => v < 10 ? "0" + v : v).join(":");
    }, 1000);
    
    showPage(2);
}

// 3. Time Formatting Logic: Sec, Min, or Hr
function formatDuration(totalSecs) {
    if (totalSecs < 60) return totalSecs + " sec";
    if (totalSecs < 3600) return Math.floor(totalSecs / 60) + " min";
    return (totalSecs / 3600).toFixed(1) + " hr";
}

function renderGrid(id, dataKey, label) {
    const el = document.getElementById(id);
    el.innerHTML = '';
    for(let i=1; i<=state.count; i++) {
        el.innerHTML += `<div class="item-card">
            <span>${label} ${i}</span>
            <div class="option-row">
                ${['a','b','c','d','e'].map(o => `<button class="opt-btn" onclick="sel('${dataKey}',${i},'${o}',this)">${o.toUpperCase()}</button>`).join('')}
            </div></div>`;
    }
}

function sel(key, i, val, btn) {
    state[key][i] = val;
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// 4. Results Processing: Syncs cleaned data to Sheets
async function processResults() {
    clearInterval(state.timer);
    let score = 0;
    for(let i=1; i<=state.count; i++) if(state.answers[i] === state.key[i]) score++;

    const payload = {
        subject: state.subject || "General",
        count: state.count,
        score: score,
        time: formatDuration(state.totalSeconds) // Sends human-readable time
    };

    try {
        await fetch(GOOGLE_SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });
    } catch (e) { console.error("Save failed", e); }

    initCharts(score, state.count);
    fetchHistory(); 
    showPage(4);
}

async function fetchHistory() {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        const tbody = document.getElementById('history-body');
        tbody.innerHTML = data.reverse().map(row => {
            const date = typeof row[0] === 'string' && row[0].includes('T') ? row[0].split('T')[0] : row[0];
            return `<tr><td>${date}</td><td>${row[1] || 'N/A'}</td><td>${row[3]}/${row[2]}</td><td>${row[5]}</td></tr>`;
        }).join('');
    } catch (e) { console.error("History load failed", e); }
}

function initCharts(s, t) {
    const ctx1 = document.getElementById('c1').getContext('2d');
    new Chart(ctx1, { type: 'doughnut', data: { datasets: [{ data: [s, t-s], backgroundColor: ['#238636','#da3633'] }] }, options: { responsive: true, maintainAspectRatio: false } });
    // Add other charts as needed following this pattern
}
