// ---------- API Integrated Smart Expense Tracker
const API_BASE = 'https://localhost:7008/api/Expenses';
const LS_CATS = 'smart_expense_cats_v1';
const LS_BALANCE = 'smart_expense_initial_balance';
const LS_USER_NAME = 'smart_expense_user_name';
const defaultCats = ['Food', 'Transport', 'Groceries', 'Entertainment', 'Bills', 'Other'];

// state
let expenses = [];
let allTimeExpenses = [];
let categories = JSON.parse(localStorage.getItem(LS_CATS) || 'null') || defaultCats.slice();
let initialBalance = parseFloat(localStorage.getItem(LS_BALANCE) || '100000');
let editingId = null;
let currentMonthIndex = 0; 
let userName = localStorage.getItem(LS_USER_NAME) || 'User';

// elements
const balanceEl = document.getElementById('balance'); 
const balanceSettingDisplay = document.getElementById('balanceSettingDisplay'); 
const initialBalanceInput = document.getElementById('initialBalanceInput');
const totalSpentEl = document.getElementById('totalSpent'); 
const totalSpentSettingDisplay = document.getElementById('totalSpentSettingDisplay'); 
const totalCountEl = document.getElementById('totalCount'); 
const monthlyTotalEl = document.getElementById('monthlyTotal');
const topCatEl = document.getElementById('topCat');
const catList = document.getElementById('catList');
const expenseTableBody = document.querySelector('#expenseTable tbody');
const addExpenseBtn = document.getElementById('addExpenseBtn');
const modalBackdrop = document.getElementById('modalBackdrop');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const amtIn = document.getElementById('amt');
const catSelect = document.getElementById('catSelect');
const noteIn = document.getElementById('note');
const dateIn = document.getElementById('date');
const exportBtn = document.getElementById('exportBtn');
const monthSelector = document.getElementById('monthSelector');
const statusMessageEl = document.getElementById('statusMessage');
const userNameEl = document.getElementById('userName');

// View elements
const navLinks = document.querySelectorAll('.nav-link');
const views = document.querySelectorAll('.view');


// charts
let lineChart = null, pieChart = null, barChartMock = null, doughnutChartMock = null;

// init
(async function init() {
    initCharts();
    initMonthSelector();
    monthSelector.selectedIndex = 0;
    currentMonthIndex = 0;
    
    // Set initial values
    if(initialBalanceInput) initialBalanceInput.value = initialBalance.toFixed(2);
    if(userNameEl) userNameEl.textContent = userName;

    renderCats();
    await updateAll(); 
    initEvents();
    initViewSwitching(); 
})();

// ----------------------- FUNCTIONS ------------------------

function initViewSwitching() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = e.currentTarget.dataset.view;

            // Update active state of nav links
            navLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');

            // Show target view, hide others
            views.forEach(v => {
                v.classList.remove('active');
                if (v.id === `${targetView}-view`) {
                    v.classList.add('active');
                }
            });

            // Force chart re-render after view switch for correct sizing
            if (targetView === 'dashboard') {
                setTimeout(() => {
                    [lineChart, pieChart, barChartMock, doughnutChartMock].forEach(chart => {
                        if (chart) chart.resize();
                    });
                }, 50);
            }
        });
    });

    // Start on Dashboard view
    const dashboardView = document.getElementById('dashboard-view');
    if (dashboardView) dashboardView.classList.add('active');
}

window.editUserName = function() {
    const currentName = userNameEl ? userNameEl.textContent : 'User';
    const newName = prompt("Enter your new user name:", currentName);
    if (newName !== null && newName.trim() !== "") {
        userName = newName.trim();
        if(userNameEl) userNameEl.textContent = userName;
        localStorage.setItem(LS_USER_NAME, userName);
    }
}


async function fetchMonthlyExpenses(index = currentMonthIndex) {
    if(statusMessageEl) statusMessageEl.textContent = 'Fetching monthly data...';

    if (index === -1) {
        index = 0; 
    }

    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const targetMonth = targetDate.getMonth() + 1;
    const targetYear = targetDate.getFullYear();

    const url = `${API_BASE}/monthly?year=${targetYear}&month=${targetMonth}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        expenses = data;
        if(statusMessageEl) statusMessageEl.textContent = '';
    } catch (error) {
        console.error('Error fetching monthly expenses:', error);
        if(statusMessageEl) statusMessageEl.textContent = `Error: Could not fetch data. Is the API running at ${API_BASE}?`;
        expenses = [];
    }
    return expenses;
}

async function fetchAllTimeExpenses() {
    const now = new Date();
    const promises = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const url = `${API_BASE}/monthly?year=${year}&month=${month}`;
        promises.push(fetch(url).then(res => res.ok ? res.json() : []).catch(() => []));
    }

    const results = await Promise.all(promises);
    allTimeExpenses = results.flat();

    const uniqueExpenses = {};
    allTimeExpenses.forEach(exp => {
        uniqueExpenses[exp.id || exp.note + exp.amount + exp.date] = exp;
    });
    allTimeExpenses = Object.values(uniqueExpenses);
}


function saveCategoryState() {
    localStorage.setItem(LS_CATS, JSON.stringify(categories));
}

function renderCats() {
    if(!catList || !catSelect) return;
    catList.innerHTML = ''; catSelect.innerHTML = '';
    categories.forEach(c => {
        const d = document.createElement('div'); d.className = 'cat'; d.textContent = c; catList.appendChild(d);

        const opt = document.createElement('option'); opt.value = c; opt.textContent = c; catSelect.appendChild(opt);
    })
}

function initMonthSelector() {
    if(!monthSelector) return;
    monthSelector.innerHTML = '';
    const now = new Date();
    const options = [
        { index: 0, label: `This Month (${now.toLocaleString(undefined, { month: 'short' })})` },
        { index: -1, label: 'All Time (Last 12m)' }
    ];

    for (let i = 1; i <= 11; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        options.push({ index: i, label: d.toLocaleString(undefined, { month: 'long', year: 'numeric' }) });
    }

    options.forEach(optData => {
        const opt = document.createElement('option');
        opt.value = optData.index;
        opt.textContent = optData.label;
        monthSelector.appendChild(opt);
    });

    monthSelector.addEventListener('change', async (e) => {
        currentMonthIndex = parseInt(e.target.value);
        await updateAll();
    });
}

function initEvents() {
    if (addExpenseBtn) addExpenseBtn.onclick = () => openModal();
    if (cancelBtn) cancelBtn.onclick = closeModal;
    if (saveBtn) saveBtn.onclick = onSave;
    
    // Balance Input Listener
    if(initialBalanceInput) initialBalanceInput.addEventListener('change', (e) => {
        const newBalance = parseFloat(e.target.value);
        if (!isNaN(newBalance) && newBalance >= 0) {
            initialBalance = newBalance;
            localStorage.setItem(LS_BALANCE, initialBalance.toFixed(2));
            updateAll();
        } else {
            alert('Please enter a valid balance.');
            e.target.value = initialBalance.toFixed(2); 
        }
    });

    if(exportBtn) exportBtn.addEventListener('click', exportCSV);

    if(expenseTableBody) expenseTableBody.addEventListener('click', e => {
        const id = e.target.closest('[data-id]')?.dataset?.id;
        if (!id) return;
        if (e.target.matches('.edit') || e.target.matches('.del')) {
            alert('Edit and Delete actions are disabled until the corresponding PUT/DELETE API endpoints are implemented.');
        }
    });
}

function openModal(id = null) {
    if (id) {
        alert('Editing is disabled until the API provides a PUT/PATCH endpoint.');
        return;
    }
    editingId = id;
    if (modalBackdrop) modalBackdrop.style.display = 'flex';
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Add Expense';

    if(amtIn) amtIn.value = '';
    if(catSelect) catSelect.selectedIndex = 0;
    if(noteIn) noteIn.value = '';
    if(dateIn) dateIn.value = new Date().toISOString().slice(0, 10);
}
function closeModal() { if(modalBackdrop) modalBackdrop.style.display = 'none'; editingId = null; }

// API CALL: POST new expense
async function onSave() {
    const a = parseFloat(amtIn.value);
    const c = catSelect.value;
    const n = noteIn.value.trim();
    const d = dateIn.value;

    if (isNaN(a) || a <= 0 || !c || !d) return alert('Please enter a valid amount, select a category, and choose a date.');

    const apiDate = `${d}T00:00:00.000Z`;

    const expenseData = {
        "date": apiDate,
        "note": n,
        "amount": a,
        "categoryName": c
    };

    closeModal();
    if(statusMessageEl) statusMessageEl.textContent = 'Saving expense...';

    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(expenseData)
        });

        if (response.status === 201) {
            const newExpense = await response.json();
            if(statusMessageEl) statusMessageEl.textContent = 'Expense saved successfully!';

            const expenseMonth = new Date(newExpense.date);
            const now = new Date();
            const diffYears = now.getFullYear() - expenseMonth.getFullYear();
            const diffMonths = now.getMonth() - expenseMonth.getMonth() + (diffYears * 12);

            if (diffMonths >= 0 && diffMonths <= 11) {
                currentMonthIndex = diffMonths;
                if(monthSelector) monthSelector.value = diffMonths.toString();
            } else {
                currentMonthIndex = 0;
                if(monthSelector) monthSelector.value = '0';
            }
        } else {
            throw new Error(`API returned status ${response.status}: ${await response.text()}`);
        }
    } catch (error) {
        console.error('Error saving expense:', error);
        if(statusMessageEl) statusMessageEl.textContent = `Error saving expense: ${error.message}. Check console.`;
    }

    await updateAll();
    setTimeout(() => { if(statusMessageEl) statusMessageEl.textContent = ''; }, 3000);
}

function renderTable() {
    const monthlyExpenses = expenses;

    const rows = monthlyExpenses.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    if(expenseTableBody) expenseTableBody.innerHTML = rows.map(r => `<tr data-id="${r.id}">
        <td>${r.date.slice(0, 10)}</td>
        <td>${escapeHtml(r.note || '')}</td>
        <td>${r.categoryName}</td>
        <td>₹${Number(r.amount).toFixed(2)}</td>
        <td style='text-align:right'>
          <button class='btn ghost small edit' style='padding:5px 8px; font-size:12px;'>Edit</button> 
          <button class='btn ghost small del' style='padding:5px 8px; font-size:12px;'>Del</button>
        </td>
      </tr>`).join('') || '<tr><td colspan=5 class="small muted">No expenses found for this period.</td></tr>';
}

async function updateAll() {
    const [monthlyData] = await Promise.all([
        fetchMonthlyExpenses(currentMonthIndex),
        fetchAllTimeExpenses()
    ]);
    expenses = monthlyData;

    renderTable();
    renderDashboard();
    renderCats();
    updateCharts();
    saveCategoryState();
}

function renderDashboard() {
    const allTotal = allTimeExpenses.reduce((s, x) => s + Number(x.amount || 0), 0);
    
    // Balance Calculation
    const currentBalance = initialBalance - allTotal;
    
    // Update Dashboard View (Fixing the TypeError by checking existence)
    if (balanceEl) balanceEl.textContent = `₹${currentBalance.toFixed(2)}`;
    if (totalSpentEl) totalSpentEl.textContent = `₹${allTotal.toFixed(2)}`;
    
    // Update Settings View (Fixing the TypeError by checking existence)
    if (balanceSettingDisplay) balanceSettingDisplay.textContent = `₹${currentBalance.toFixed(2)}`;
    if (totalSpentSettingDisplay) totalSpentSettingDisplay.textContent = `₹${allTotal.toFixed(2)}`;
    if (initialBalanceInput) initialBalanceInput.value = initialBalance.toFixed(2); 

    const currentPeriodExpenses = expenses;

    const periodTotal = currentPeriodExpenses.reduce((s, x) => s + Number(x.amount || 0), 0);

    const byCat = {};
    currentPeriodExpenses.forEach(e => byCat[e.categoryName] = (byCat[e.categoryName] || 0) + Number(e.amount || 0));
    const topCat = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a])[0] || '-';

    if (monthlyTotalEl) monthlyTotalEl.textContent = `₹${periodTotal.toFixed(2)}`;
    if (totalCountEl) totalCountEl.textContent = currentPeriodExpenses.length;
    if (topCatEl) topCatEl.textContent = topCat;
}

// Charts
function initCharts() {
    // Shared chart options for dark theme and **BLACK** text
    const sharedOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                labels: { color: 'black', boxWidth: 12, padding: 15 } 
            },
            tooltip: { 
                callbacks: { 
                    label: (context) => context.dataset.label + ': ₹' + context.parsed.y.toFixed(2),
                    title: (context) => context[0].label 
                } 
            }
        },
        scales: {
            y: { 
                beginAtZero: true, 
                grid: { color: 'var(--border-subtle)' }, 
                ticks: { color: 'black', callback: (v) => '₹' + v.toLocaleString() } 
            },
            x: { 
                grid: { display: false }, 
                ticks: { color: 'black' } 
            }
        }
    };
    
    // 1. Monthly Expenses Trend (Bar Chart - LineChart ID for consistency)
    const lineCtx = document.getElementById('lineChart');
    if(lineCtx) {
        lineChart = new Chart(lineCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: [], datasets: [{
                    label: 'Total Spent',
                    data: [],
                    backgroundColor: 'rgba(167, 243, 208, 0.9)', 
                    borderRadius: 4
                }]
            },
            options: {
                ...sharedOptions, 
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => '₹' + context.parsed.y.toFixed(2) } } },
            }
        });
    }

    // 2. Spending by Category (Doughnut Chart)
    const pieCtx = document.getElementById('pieChart');
    if(pieCtx) {
        pieChart = new Chart(pieCtx.getContext('2d'), {
            type: 'doughnut',
            data: { 
                labels: [], 
                datasets: [{ 
                    data: [], 
                    backgroundColor: ['#34d399', '#38bdf8', '#f97316', '#a855f7', '#ef4444', '#64748b'] 
                }] 
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'bottom', 
                        labels: { color: 'black', boxWidth: 12, padding: 15 }
                    },
                    tooltip: { callbacks: { label: (context) => context.label + ': ₹' + context.parsed.toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' (' + (context.parsed / context.dataset.data.reduce((a, b) => a + b, 0) * 100).toFixed(1) + '%)' } }
                }
            }
        });
    }

    // 3. Mock Bar Chart (Total Expenses by Month)
    const barCtx = document.getElementById('barChartMock');
    if(barCtx) {
        barChartMock = new Chart(barCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Cumulative Total',
                    data: [5000, 7500, 11000, 15000, 17000, 20000],
                    borderColor: '#f97316',
                    tension: 0.3,
                    fill: false,
                }]
            },
            options: {
                ...sharedOptions, 
                plugins: { legend: { display: false } },
                scales: {
                    ...sharedOptions.scales,
                    y: { 
                        ...sharedOptions.scales.y,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'black' } 
                    },
                    x: {
                        ...sharedOptions.scales.x,
                        ticks: { color: 'black' }
                    }
                }
            }
        });
    }

    // 4. Mock Doughnut Chart (Top Categories Annual)
    const doughnutCtx = document.getElementById('doughnutChartMock');
    if(doughnutCtx) {
        doughnutChartMock = new Chart(doughnutCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Food', 'Bills', 'Transport', 'Other'],
                datasets: [{
                    data: [4500, 3000, 1500, 1000],
                    backgroundColor: ['#34d399', '#38bdf8', '#ef4444', '#64748b'] 
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'bottom', 
                        labels: { color: 'black', boxWidth: 12, padding: 15 }
                    },
                    tooltip: { callbacks: { label: (context) => context.label + ': ₹' + context.parsed.toLocaleString() } }
                }
            }
        });
    }
}

function updateCharts() {
    // Primary Charts Update Logic (remains the same)
    const now = new Date();
    const numMonths = 6;
    const monthKeys = [];
    const monthMap = {};

    for (let i = numMonths - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.getFullYear() + '-' + (d.getMonth() + 1);
        monthKeys.push(key);
        monthMap[key] = 0;
    }

    allTimeExpenses.forEach(e => {
        const dt = new Date(e.date);
        if (isNaN(dt)) return;
        const key = dt.getFullYear() + '-' + (dt.getMonth() + 1);
        if (monthMap[key] !== undefined) monthMap[key] += Number(e.amount || 0);
    });

    if (lineChart) {
        const lineData = monthKeys.map(k => monthMap[k] || 0);
        lineChart.data.labels = monthKeys.map(k => { const p = k.split('-'); return new Date(p[0], p[1] - 1, 1).toLocaleString(undefined, { month: 'short' }); });
        lineChart.data.datasets[0].data = lineData;
        lineChart.update();
    }

    if (pieChart) {
        const currentPeriodExpenses = expenses;
        const byCat = {};
        currentPeriodExpenses.forEach(e => byCat[e.categoryName] = (byCat[e.categoryName] || 0) + Number(e.amount || 0));
        const labels = Object.keys(byCat);
        const data = labels.map(l => byCat[l]);

        pieChart.data.labels = labels;
        pieChart.data.datasets[0].data = data;
        pieChart.update();
    }
}

function exportCSV() {
    if (!allTimeExpenses.length) return alert('No expenses to export');
    const headers = ['Date', 'Category', 'Note', 'Amount'];
    const rows = allTimeExpenses.map(e => [e.date.slice(0, 10), e.categoryName, '"' + (e.note || '') + '"', e.amount]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'expenses.csv'; a.click(); URL.revokeObjectURL(url);
}

function escapeHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }