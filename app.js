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
let editingId = null; // Stores UUID string for editing
let currentMonthIndex = 0; 
let userName = localStorage.getItem(LS_USER_NAME) || 'User';

// elements
const sidebarBalanceEl = document.getElementById('sidebarBalance');
const sinceInceptionEl = document.getElementById('sinceInception');
const balanceEl = document.getElementById('balance'); 
const balanceSettingDisplay = document.getElementById('balanceSettingDisplay'); 
const initialBalanceInput = document.getElementById('initialBalanceInput');
const totalSpentSettingDisplay = document.getElementById('totalSpentSettingDisplay'); 
const totalCountEl = document.getElementById('totalCount'); 
const monthlyTotalEl = document.getElementById('monthlyTotal');
const topCatEl = document.getElementById('topCat');
const sidebarCatList = document.getElementById('sidebarCatList');
const catListDetailed = document.getElementById('catListDetailed');
const newCatNameInput = document.getElementById('newCatName');
const addCatBtn = document.getElementById('addCatBtn');
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

// ----------------------- CORE FUNCTIONS ------------------------

/**
 * Shows an animated status message banner at the top of the screen.
 * @param {string} message - The text content of the message.
 * @param {string} type - 'success' or 'error'. Defaults to 'success'.
 */
function showStatusMessage(message, type = 'success') {
    if (!statusMessageEl) return;

    statusMessageEl.textContent = message;
    
    // Set color based on type
    statusMessageEl.style.backgroundColor = type === 'error' ? 'var(--danger)' : 'var(--success)';
    statusMessageEl.style.color = 'var(--bg1)';

    // Show message
    statusMessageEl.style.opacity = '1';
    statusMessageEl.style.transform = 'translateX(-50%) translateY(0)';

    // Hide message after 3 seconds
    setTimeout(() => {
        statusMessageEl.style.opacity = '0';
        statusMessageEl.style.transform = 'translateX(-50%) translateY(-20px)';
        // Reset message text after transition
        setTimeout(() => statusMessageEl.textContent = '', 300);
    }, 3000);
}


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

            if (targetView === 'dashboard') {
                setTimeout(() => {
                    [lineChart, pieChart, barChartMock, doughnutChartMock].forEach(chart => {
                        if (chart) chart.resize();
                    });
                }, 50);
            }
        });
    });

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
        showStatusMessage('User name updated!', 'success');
    }
}

// ----------------------- API & DATA FUNCTIONS ------------------------

async function fetchMonthlyExpenses(index = currentMonthIndex) {
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
    } catch (error) {
        console.error('Error fetching monthly expenses:', error);
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
        uniqueExpenses[exp.id] = exp;
    });
    allTimeExpenses = Object.values(uniqueExpenses);
}


function saveCategoryState() {
    localStorage.setItem(LS_CATS, JSON.stringify(categories));
}

function renderCats() {
    if(!sidebarCatList || !catSelect || !catListDetailed) return;
    sidebarCatList.innerHTML = ''; catSelect.innerHTML = ''; catListDetailed.innerHTML = '';

    categories.forEach(c => {
        // 1. Sidebar list
        const d = document.createElement('div'); d.className = 'cat'; d.textContent = c; sidebarCatList.appendChild(d);

        // 2. Modal select
        const opt = document.createElement('option'); opt.value = c; opt.textContent = c; catSelect.appendChild(opt);

        // 3. Detailed Settings List
        const detailDiv = document.createElement('div');
        detailDiv.innerHTML = `<span>${c}</span><button class='btn ghost small delete-cat' data-cat='${c}'>Del</button>`;
        catListDetailed.appendChild(detailDiv);
    });
}

function addCategory() {
    const newCat = newCatNameInput.value.trim();
    if (newCat && !categories.includes(newCat)) {
        categories.push(newCat);
        newCatNameInput.value = '';
        renderCats();
        saveCategoryState();
        showStatusMessage(`Category "${newCat}" added!`, 'success');
    } else if (categories.includes(newCat)) {
        showStatusMessage(`Category "${newCat}" already exists.`, 'error');
    }
}

function deleteCategory(catName) {
    if (confirm(`Are you sure you want to delete the category "${catName}"? Expenses assigned to this category will keep the category name.`)) {
        categories = categories.filter(c => c !== catName);
        renderCats();
        saveCategoryState();
        showStatusMessage(`Category "${catName}" deleted!`, 'success');
    }
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
    if (addCatBtn) addCatBtn.onclick = addCategory;

    // Balance Input Listener
    if(initialBalanceInput) initialBalanceInput.addEventListener('change', (e) => {
        const newBalance = parseFloat(e.target.value);
        if (!isNaN(newBalance) && newBalance >= 0) {
            initialBalance = newBalance;
            localStorage.setItem(LS_BALANCE, initialBalance.toFixed(2));
            updateAll();
            showStatusMessage('Initial balance updated!', 'success');
        } else {
            showStatusMessage('Please enter a valid balance.', 'error');
            e.target.value = initialBalance.toFixed(2); 
        }
    });

    if(exportBtn) exportBtn.addEventListener('click', exportCSV);

    if(expenseTableBody) expenseTableBody.addEventListener('click', e => {
        const id = e.target.closest('tr')?.dataset?.id; 
        if (!id) return;

        if (e.target.matches('.edit')) {
            openModal(id);
        } else if (e.target.matches('.del')) {
            deleteExpense(id);
        }
    });
    
    // Category Delete Listener
    if(catListDetailed) catListDetailed.addEventListener('click', e => {
        if (e.target.matches('.delete-cat')) {
            const catName = e.target.dataset.cat;
            deleteCategory(catName);
        }
    });
}

function openModal(id = null) {
    editingId = id;
    if (modalBackdrop) modalBackdrop.style.display = 'flex';
    const modalTitle = document.getElementById('modalTitle');

    if (id) {
        const expenseToEdit = allTimeExpenses.find(e => e.id === id);
        if (modalTitle) modalTitle.textContent = 'Edit Expense';
        
        if (expenseToEdit) {
            if(amtIn) amtIn.value = expenseToEdit.amount.toFixed(2);
            if(catSelect) catSelect.value = expenseToEdit.categoryName;
            if(noteIn) noteIn.value = expenseToEdit.note;
            if(dateIn) dateIn.value = expenseToEdit.date.slice(0, 10);
        }
    } else {
        if (modalTitle) modalTitle.textContent = 'Add Expense';
        if(amtIn) amtIn.value = '';
        if(catSelect) catSelect.selectedIndex = 0;
        if(noteIn) noteIn.value = '';
        if(dateIn) dateIn.value = new Date().toISOString().slice(0, 10);
    }
}
function closeModal() { if(modalBackdrop) modalBackdrop.style.display = 'none'; editingId = null; }

async function onSave() {
    const a = parseFloat(amtIn.value);
    const c = catSelect.value;
    const n = noteIn.value.trim();
    const d = dateIn.value;

    if (isNaN(a) || a <= 0 || !c || !d) {
        showStatusMessage('Please enter a valid amount, category, and date.', 'error');
        return;
    }

    const apiDate = `${d}T00:00:00.000Z`;

    const expenseData = {
        ...(editingId && { id: editingId }), 
        "date": apiDate,
        "note": n,
        "amount": a,
        "categoryName": c
    };

    closeModal();
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API_BASE}/${editingId}` : API_BASE;
    showStatusMessage(`${method === 'POST' ? 'Adding' : 'Updating'} expense...`, 'success'); 

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(expenseData)
        });

        if (response.status === 200 || response.status === 201) {
            showStatusMessage(`Expense ${method === 'POST' ? 'added' : 'updated'} successfully!`, 'success');
            
            if (method === 'POST' && response.status === 201) {
                 const newExpense = await response.json();
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
             }
        } else {
            throw new Error(`API returned status ${response.status}: ${await response.text()}`);
        }
    } catch (error) {
        console.error(`Error ${method === 'POST' ? 'adding' : 'updating'} expense:`, error);
        showStatusMessage(`Error: Could not save expense. Check console.`, 'error');
    }

    await updateAll();
}

async function deleteExpense(id) {
    if (!confirm("Are you sure you want to delete this expense? This cannot be undone.")) {
        return;
    }

    showStatusMessage('Deleting expense...', 'success');
    
    try {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.status === 200) {
            showStatusMessage('Expense deleted successfully!', 'success');
        } else {
            throw new Error(`API returned status ${response.status}: ${await response.text()}`);
        }
    } catch (error) {
        console.error('Error deleting expense:', error);
        showStatusMessage(`Error deleting expense. Check console.`, 'error');
    }
    
    await updateAll();
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
          <button class='btn ghost small edit'>Edit</button> 
          <button class='btn ghost small del'>Del</button>
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
    const currentBalance = initialBalance - allTotal;
    
    // Update Sidebar
    if (sidebarBalanceEl) sidebarBalanceEl.textContent = `₹${currentBalance.toFixed(2)}`;
    if (sinceInceptionEl) sinceInceptionEl.textContent = `₹${allTotal.toFixed(2)}`;

    // Update Dashboard View 
    if (balanceEl) balanceEl.textContent = `₹${currentBalance.toFixed(2)}`;
    
    // Update Settings View 
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

// ----------------------- CHART FUNCTIONS ------------------------

function initCharts() {
    const sharedOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: 'var(--text-light)', boxWidth: 12, padding: 15 } },
            tooltip: { 
                callbacks: { 
                    label: (context) => context.dataset.label + ': ₹' + context.parsed.toLocaleString(undefined, { minimumFractionDigits: 2 }),
                    title: (context) => context[0].label 
                } 
            }
        },
        scales: {
            y: { 
                beginAtZero: true, 
                grid: { color: 'var(--border-subtle)' }, 
                ticks: { color: 'var(--muted)', callback: (v) => '₹' + v.toLocaleString() } 
            },
            x: { 
                grid: { display: false }, 
                ticks: { color: 'var(--muted)' } 
            }
        }
    };
    
    const lineCtx = document.getElementById('lineChart');
    if(lineCtx) {
        lineChart = new Chart(lineCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: [], datasets: [{
                    label: 'Total Spent',
                    data: [],
                    backgroundColor: 'var(--chart-accent-1)', 
                    borderRadius: 4
                }]
            },
            options: {
                ...sharedOptions, 
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => '₹' + context.parsed.toLocaleString(undefined, { minimumFractionDigits: 2 }) } } },
            }
        });
    }

    const pieCtx = document.getElementById('pieChart');
    if(pieCtx) {
        pieChart = new Chart(pieCtx.getContext('2d'), {
            type: 'doughnut',
            data: { 
                labels: [], 
                datasets: [{ 
                    data: [], 
                    backgroundColor: ['#A855F7', '#EF4444', '#34d399', '#38bdf8', '#f97316', '#64748b'] // Adjusted colors for better contrast
                }] 
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: 'var(--text-light)', boxWidth: 12, padding: 15 } },
                    tooltip: { callbacks: { label: (context) => context.label + ': ₹' + context.parsed.toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' (' + (context.parsed / context.dataset.data.reduce((a, b) => a + b, 0) * 100).toFixed(1) + '%)' } }
                }
            }
        });
    }

    // Mock Line Chart
    const barCtx = document.getElementById('barChartMock');
    if(barCtx) {
        barChartMock = new Chart(barCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Cumulative Total',
                    data: [5000, 7500, 11000, 15000, 17000, 20000].map(v => v * 0.7),
                    borderColor: 'var(--chart-accent-3)',
                    tension: 0.3,
                    fill: false,
                }]
            },
            options: {
                ...sharedOptions, 
                plugins: { legend: { display: false } },
            }
        });
    }

    // Mock Doughnut Chart (Annual Mock)
    const doughnutCtx = document.getElementById('doughnutChartMock');
    if(doughnutCtx) {
        doughnutChartMock = new Chart(doughnutCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Food', 'Bills', 'Transport', 'Other'],
                datasets: [{
                    data: [4500, 3000, 1500, 1000],
                    backgroundColor: ['#A855F7', '#EF4444', '#34d399', '#38bdf8'] 
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: 'var(--text-light)', boxWidth: 12, padding: 15 } },
                    tooltip: { callbacks: { label: (context) => context.label + ': ₹' + context.parsed.toLocaleString() } }
                }
            }
        });
    }
}

function updateCharts() {
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

// ----------------------- UTILITIES ------------------------

function exportCSV() {
    if (!allTimeExpenses.length) return showStatusMessage('No expenses to export', 'error');

    const headers = ['Date', 'Category', 'Note', 'Amount', 'ID'];
    const rows = allTimeExpenses.map(e => [
        e.date.slice(0, 10), 
        e.categoryName, 
        '"' + (e.note || '').replace(/"/g, '""') + '"', // Escape quotes inside notes
        e.amount,
        e.id
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = 'expenses.csv'; 
    a.click(); 
    URL.revokeObjectURL(url);
    showStatusMessage('Exported to expenses.csv!', 'success');
}

function escapeHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }