// 1. Unified App State
let state = { 
    subject: '', 
    count: 0, 
    answers: {}, 
    key: {}, 
    start: null, 
    timer: null 
};

// Replace with your current Google Web App URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby0U7038RLpJYZwvRv2ax-lZS1AFE6kzFAaVts7L2o3bUeG2QMEvfHZ-gjRRzqRrN4A/exec";

// 2. Navigation Control
function showPage(n) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page${n}`).classList.add('active');
    window.scrollTo(0, 0);
}

// 3. Setup Logic (Fixed Subject Issue)
function openPopup(subName) {
    state.subject = subName; // Standardized: this ensures subject isn't 'Unknown'
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
    
    // Set UI Title
    document.getElementById('current-sub').innerText = state.subject;
    
    // Clear previous session data
    state.answers = {};
    state.key = {};
    
    // Render dynamic grids
    renderGrid('quiz-grid', 'answers', 'Question');
    renderGrid('key-grid', 'key', 'Key');
    
    // Start Timer
    state.start = Date.now();
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => {
        let diff = Date.now() - state.start;
        // Format: HH:MM:SS
        document.getElementById('timer').innerText = new Date(diff).toISOString().substr(11, 8);
    }, 1000);
    
    showPage(2);
}

// 4. Interface Rendering
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
            </div>
        `;
        el.appendChild(card);
    }
}

function sel(key, i, val, btn) {
    state[key][i] = val;
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// 5. Data Processing & Google Sheets Sync
async function processResults() {
    clearInterval(state.timer);
    let score = 0;
    for(let i=1; i<=state.count; i++) {
        if(state.answers[i] === state.key[i]) score++;
    }

    const timeTaken = document.getElementById('timer').innerText;

    // Payload keys must match exactly what Google Apps Script expects
    const payload = {
        subject: state.subject,
        count: state.count,
        score: score,
        time: timeTaken
    };

    // Send to Google Sheet
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) { 
        console.error("Save failed", e); 
    }

    initCharts(score, state.count);
    fetchHistory(); 
    showPage(4);
}

// 6. Historical Data Loader (Fixed Time/Date Display)
async function fetchHistory() {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        const tbody = document.getElementById('history-body');
        
        tbody.innerHTML = data.reverse().map(row => {
            // Remove 'T' and 'Z' if the sheet returns ISO strings
            const displayDate = typeof row[0] === 'string' && row[0].includes('T') 
                                ? row[0].split('T')[0] 
                                : row[0];

            // Fix the 1899 Time Error by stripping the date portion if present
            const displayTime = typeof row[5] === 'string' && row[5].includes('T')
                                ? row[5].split('T')[1].split('.')[0]
                                : row[5];

            return `
                <tr>
                    <td>${displayDate}</td>
                    <td>${row[1] || 'N/A'}</td>
                    <td>${row[3]}/${row[2]}</td>
                    <td>${displayTime}</td>
                </tr>
            `;
        }).join('');
    } catch (e) { 
        console.error("History load failed", e); 
    }
}

// 7. Dashboard Charts (Fixed Squashing)
function initCharts(s, t) {
    const wrong = t - s;
    const chartConfig = { 
        responsive: true, 
        maintainAspectRatio: false, // Prevents charts from squashing
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true, grid: { color: '#30363d' }, ticks: { color: '#8b949e' } },
            x: { grid: { display: false }, ticks: { color: '#8b949e' } }
        }
    };

    // Accuracy Doughnut
    new Chart(document.getElementById('c1'), { 
        type: 'doughnut', 
        data: { labels: ['C', 'W'], datasets: [{ data: [s, wrong], backgroundColor: ['#238636','#da3633'], borderWidth: 0, cutout: '70%' }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // Score Bar
    new Chart(document.getElementById('c2'), { 
        type: 'bar', 
        data: { labels: ['C', 'W'], datasets: [{ data: [s, wrong], backgroundColor: ['#58a6ff','#f0883e'] }] }, 
        options: chartConfig 
    });

    // Performance Curve
    new Chart(document.getElementById('c3'), { 
        type: 'line', 
        data: { labels: ['S', 'M', 'E'], datasets: [{ data: [0, s/2, s], borderColor: '#58a6ff', tension: 0.4 }] }, 
        options: chartConfig 
    });

    // Daily Progress
    new Chart(document.getElementById('c4'), { 
        type: 'line', 
        data: { labels: ['Avg', 'Today'], datasets: [{ data: [15, (s/t)*100], borderColor: '#238636', fill: true, backgroundColor: 'rgba(35, 134, 54, 0.1)' }] }, 
        options: chartConfig 
    });
}
