// 1. App State
let state = { 
    subject: '', // Standardized variable name
    count: 0, 
    answers: {}, 
    key: {}, 
    start: null, 
    timer: null,
    totalSeconds: 0 
};

const GOOGLE_SCRIPT_URL = "YOUR_APPS_SCRIPT_URL_HERE";

// 2. Setup Logic: Captures subject correctly
function openPopup(subName) {
    state.subject = subName; // This ensures the subject isn't 'Unknown'
    document.getElementById('sub-name').innerText = subName;
    document.getElementById('setup-popup').style.display = 'flex';
}

function startQuiz() {
    const input = document.getElementById('qty-input');
    state.count = parseInt(input.value);
    if (!state.count || state.count <= 0) return alert("Enter a valid number!");

    document.getElementById('setup-popup').style.display = 'none';
    document.getElementById('current-sub').innerText = state.subject;
    
    renderGrid('quiz-grid', 'answers', 'Question');
    renderGrid('key-grid', 'key', 'Key');
    
    // Timer Logic
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

// 3. Time Formatting Function
function formatDuration(totalSecs) {
    if (totalSecs < 60) return totalSecs + " sec";
    if (totalSecs < 3600) return Math.floor(totalSecs / 60) + " min";
    return (totalSecs / 3600).toFixed(1) + " hr";
}

// 4. Data Sync: Sends the subject and duration
async function processResults() {
    clearInterval(state.timer);
    let score = 0;
    for(let i=1; i<=state.count; i++) if(state.answers[i] === state.key[i]) score++;

    const payload = {
        subject: state.subject || "General", // Use standardized 'subject' key
        count: state.count,
        score: score,
        time: formatDuration(state.totalSeconds) // Sends readable string
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

// 5. History Loader: Cleans the date display
async function fetchHistory() {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        const tbody = document.getElementById('history-body');
        tbody.innerHTML = data.reverse().map(row => {
            // Clean Date: Remove timestamps if present
            const date = typeof row[0] === 'string' && row[0].includes('T') ? row[0].split('T')[0] : row[0];
            return `<tr>
                <td>${date}</td>
                <td>${row[1] || 'N/A'}</td>
                <td>${row[3]}/${row[2]}</td>
                <td>${row[5]}</td>
            </tr>`;
        }).join('');
    } catch (e) { console.error("Load failed", e); }
}
