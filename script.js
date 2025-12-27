// 1. App State
let state = { 
    subject: '', 
    count: 0, 
    answers: {}, 
    key: {}, 
    start: null, 
    timer: null,
    totalSeconds: 0 
};

// Replace with your current Google Web App URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbznqDNmA6Rhls94QJ6jXcnLOV-h3KRz031TxrKWgwgGN7Jhj6-u8EmkaukqQMVPxW4o/exec";

// 2. Navigation
function showPage(n) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page${n}`).classList.add('active');
    window.scrollTo(0, 0);
}

// 3. Setup Logic (Fixed Subject Issue)
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
    
    if (!state.count || state.count <= 0) {
        return alert("Please enter a valid number of questions!");
    }

    closePopup();
    document.getElementById('current-sub').innerText = state.subject;
    
    state.answers = {};
    state.key = {};
    renderGrid('quiz-grid', 'answers', 'Question');
    renderGrid('key-grid', 'key', 'Key');
    
    // Timer Reset
    state.totalSeconds = 0;
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

// 4. Time Formatting Function (Requested Format)
function formatDuration(totalSecs) {
    if (totalSecs < 60) return totalSecs + " sec";
    if (totalSecs < 3600) return Math.floor(totalSecs / 60) + " min";
    return (totalSecs / 3600).toFixed(1) + " hr";
}

// 5. Interface Rendering
function renderGrid(containerId, dataKey, label) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    for(let i=1; i<=state.count; i++) {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <span style="font-weight:bold; color:var(--primary)">${label} ${i}</span>
            <div class="option-row">
                ${['a','b','c','d','e'].map(o => `
                    <button class="opt-btn ${state[dataKey][i] === o ? 'active' : ''}" 
                    onclick="sel('${dataKey}',${i},'${o}',this)">${o.toUpperCase()}</button>
                `).join('')}
            </div>`;
        el.appendChild(card);
    }
}

function sel(key, i, val, btn) {
    state[key][i] = val;
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// 6. Data Processing & Sync
// --- Updated Page 2 Navigation ---
function goToKeyEntry() {
    // 1. STOP THE TIMER HERE (End of Quiz Section)
    clearInterval(state.timer);
    
    // 2. The final time is now locked in state.totalSeconds
    console.log("Section Time Locked at: " + state.totalSeconds + " seconds");
    
    // 3. Move to the Key Entry page
    showPage(3);
}

// --- Updated Results Processing ---
async function processResults() {
    // We NO LONGER clear the timer here because it's already stopped.
    
    let score = 0;
    for(let i=1; i<=state.count; i++) {
        if(state.answers[i] === state.key[i]) score++;
    }

    // This uses the time recorded when the quiz ended, 
    // ignoring the time spent on the Key Entry page.
    const timeFormatted = formatDuration(state.totalSeconds);

    const payload = {
        subject: state.subject || 'General',
        count: state.count,
        score: score,
        time: timeFormatted 
    };

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(payload)
        });
    } catch (e) { console.error("Save failed", e); }

    initCharts(score, state.count);
    fetchHistory(); 
    showPage(4);
}

// 7. Historical Data Loader (Clean Display)
async function fetchHistory() {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        const tbody = document.getElementById('history-body');
        
        tbody.innerHTML = data.reverse().map(row => {
            const displayDate = typeof row[0] === 'string' && row[0].includes('T') 
                                ? row[0].split('T')[0] : row[0];

            return `
                <tr>
                    <td>${displayDate}</td>
                    <td>${row[1] || 'N/A'}</td>
                    <td>${row[3]}/${row[2]}</td>
                    <td>${row[5]}</td>
                </tr>`;
        }).join('');
    } catch (e) { console.error("History load failed", e); }
}

// 8. Charts Initialization
function initCharts(s, t) {
    const wrong = t - s;
    const chartConfig = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

    new Chart(document.getElementById('c1'), { 
        type: 'doughnut', 
        data: { labels: ['C', 'W'], datasets: [{ data: [s, wrong], backgroundColor: ['#238636','#da3633'], borderWidth: 0, cutout: '70%' }] }, 
        options: chartConfig 
    });

    new Chart(document.getElementById('c2'), { 
        type: 'bar', 
        data: { labels: ['C', 'W'], datasets: [{ data: [s, wrong], backgroundColor: ['#58a6ff','#f0883e'] }] }, 
        options: chartConfig 
    });

    new Chart(document.getElementById('c3'), { 
        type: 'line', 
        data: { labels: ['S', 'M', 'E'], datasets: [{ data: [0, s/2, s], borderColor: '#58a6ff', tension: 0.4 }] }, 
        options: chartConfig 
    });

    new Chart(document.getElementById('c4'), { 
        type: 'line', 
        data: { labels: ['Avg', 'Now'], datasets: [{ data: [15, (s/t)*100], borderColor: '#238636', fill: true, backgroundColor: 'rgba(35, 134, 54, 0.1)' }] }, 
        options: chartConfig 
    });
}

