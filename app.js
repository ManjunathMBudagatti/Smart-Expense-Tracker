// ---------- Smart Expense Tracker (Admin Layout + Modes) ----------
// Expense entity in backend:
// public class Expense {
//   public Guid Id { get; set; }
//   public DateTime Date { get; set; }
//   public string Note { get; set; }
//   public decimal Amount { get; set; }
//   public string CategoryName { get; set; }
// }

// ---- CONFIG (adjust when backend ready) ----
const API_BASE = 'https://localhost:7008/api/Expenses';
// const AUTH_BASE = 'https://localhost:7008/api/Auth'; // for future login/register
const USE_DEMO_LOGIN = true; // ✅ NOW: demo only; later set false and call real backend

// ---- STORAGE KEYS ----
const LS_CATS = 'smart_expense_cats_v1';
const LS_BALANCE = 'smart_expense_initial_balance';
const LS_USER_NAME = 'smart_expense_user_name';
const LS_THEME = 'smart_expense_theme';
const LS_AVATAR_URL = 'smart_expense_avatar_url';
const LS_SIDEBAR = 'smart_expense_sidebar'; // collapsed/expanded
const SS_MODE = 'smart_expense_mode';        // session mode: 'budget' or 'track'

// ---- DEFAULTS ----
const defaultCats = ['Food', 'Transport', 'Groceries', 'Entertainment', 'Bills', 'Other'];

// ---- STATE ----
let expenses = [];          // current period (selected month / all time)
let allTimeExpenses = [];   // last 12 months
let categories = JSON.parse(localStorage.getItem(LS_CATS) || 'null') || defaultCats.slice();
let initialBalance = parseFloat(localStorage.getItem(LS_BALANCE) || '10000'); // monthly budget
let editingId = null;
let currentMonthIndex = 0; // 0 = this month, 1 = last month, -1 = all time (last 12m)
let userName = localStorage.getItem(LS_USER_NAME) || 'User';
let currentTheme = localStorage.getItem(LS_THEME) || 'dark';
let avatarUrl = localStorage.getItem(LS_AVATAR_URL) || '';
let sidebarCollapsed = localStorage.getItem(LS_SIDEBAR) === 'true';
let currentMode = sessionStorage.getItem(SS_MODE) || 'budget'; // 'budget' | 'track'

// ---- ELEMENTS ----
const statusMessageEl = document.getElementById('statusMessage');
const appEl = document.getElementById('app');

// Shared elements
const sidebarBalanceEl = document.getElementById('sidebarBalance');
const sidebarMonthSpentEl = document.getElementById('sidebarMonthSpent');
const sidebarCatList = document.getElementById('sidebarCatList');
const monthSelector = document.getElementById('monthSelector');
const sidebarToggleBtn = document.getElementById('sidebarToggle');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeToggleCheckbox = document.getElementById('themeToggle');
const userNameEl = document.getElementById('userName');
const userAvatarEl = document.getElementById('userAvatar');
const avatarUrlInput = document.getElementById('avatarUrlInput');
const saveAvatarBtn = document.getElementById('saveAvatarBtn');
const modeBadgeEl = document.getElementById('modeBadge');
const budgetWarningEl = document.getElementById('budgetWarning');

// Dashboard / settings
const balanceEl = document.getElementById('balance');
const monthlyTotalEl = document.getElementById('monthlyTotal');
const totalCountEl = document.getElementById('totalCount');
const topCatEl = document.getElementById('topCat');
const balanceSettingDisplay = document.getElementById('balanceSettingDisplay');
const totalSpentSettingDisplay = document.getElementById('totalSpentSettingDisplay');
const initialBalanceInput = document.getElementById('initialBalanceInput');

// Categories (settings)
const catListDetailed = document.getElementById('catListDetailed');
const newCatNameInput = document.getElementById('newCatName');
const addCatBtn = document.getElementById('addCatBtn');

// Expenses page
const expenseTableBody = document.querySelector('#expenseTable tbody');
const addExpenseBtn = document.getElementById('addExpenseBtn');
const exportBtn = document.getElementById('exportBtn');

// Modal
const modalBackdrop = document.getElementById('modalBackdrop');
const modalTitleEl = document.getElementById('modalTitle');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const amtIn = document.getElementById('amt');
const catSelect = document.getElementById('catSelect');
const noteIn = document.getElementById('note');
const dateIn = document.getElementById('date');

// Login page
const loginForm = document.getElementById('loginForm');
const loginNameInput = document.getElementById('loginName');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');

// Charts
let monthlyTrendChart = null;
let categoryPieChart = null;
let dailyBarChart = null;
let sixMonthCategoryChart = null;

// ----------------------- INIT ------------------------
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page || 'login';

  applyTheme(currentTheme);
  applySidebarState();
  applyModeToUI();

  if (page === 'login') {
    initLoginPage();
    return;
  }

  // Shared for all app pages
  initUserProfile();
  initThemeControls();
  initSidebarToggle();
  initModeBadge();

  initMonthSelector();
  renderCats();
  initCategoryEvents();
  initBalanceEvents();
  initExpenseEvents();

  if (page === 'charts') {
    initCharts();
  }

  (async () => {
    await updateAll();
    if (page === 'charts') {
      updateCharts();
    }
  })();
});

// ----------------------- THEME & SIDEBAR ------------------------
function applyTheme(theme) {
  currentTheme = theme;
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
  localStorage.setItem(LS_THEME, currentTheme);

  if (themeToggleCheckbox) {
    themeToggleCheckbox.checked = currentTheme === 'dark';
  }
}

function initThemeControls() {
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
      showStatusMessage('Theme updated', 'success');
    });
  }
  if (themeToggleCheckbox) {
    themeToggleCheckbox.checked = currentTheme === 'dark';
    themeToggleCheckbox.addEventListener('change', (e) => {
      applyTheme(e.target.checked ? 'dark' : 'light');
      showStatusMessage('Theme updated', 'success');
    });
  }

  if (avatarUrlInput) {
    avatarUrlInput.value = avatarUrl;
  }
  if (saveAvatarBtn) {
    saveAvatarBtn.addEventListener('click', () => {
      avatarUrl = avatarUrlInput.value.trim();
      localStorage.setItem(LS_AVATAR_URL, avatarUrl);
      initUserProfile();
      showStatusMessage('Avatar updated', 'success');
    });
  }
}

function applySidebarState() {
  if (!appEl) return;
  if (sidebarCollapsed) appEl.classList.add('sidebar-collapsed');
  else appEl.classList.remove('sidebar-collapsed');
}

function initSidebarToggle() {
  if (!sidebarToggleBtn) return;
  sidebarToggleBtn.addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem(LS_SIDEBAR, sidebarCollapsed ? 'true' : 'false');
    applySidebarState();
  });
}

// ----------------------- MODE ------------------------
function applyModeToUI() {
  // Hide/show elements with data-mode="budget-only"
  const els = document.querySelectorAll('[data-mode="budget-only"]');
  els.forEach(el => {
    el.style.display = currentMode === 'budget' ? '' : 'none';
  });
}

function initModeBadge() {
  if (!modeBadgeEl) return;
  modeBadgeEl.textContent = `Mode: ${currentMode === 'budget' ? 'Budget (Monthly Balance)' : 'Track-Only (No Balance)'}`;
}

// ----------------------- STATUS BANNER ------------------------
function showStatusMessage(message, type = 'success') {
  if (!statusMessageEl) return;

  statusMessageEl.textContent = message;
  statusMessageEl.style.backgroundColor = type === 'error' ? 'var(--danger)' : 'var(--success)';
  statusMessageEl.style.color = '#020617';

  statusMessageEl.style.opacity = '1';
  statusMessageEl.style.transform = 'translateX(-50%) translateY(0)';

  setTimeout(() => {
    statusMessageEl.style.opacity = '0';
    statusMessageEl.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => (statusMessageEl.textContent = ''), 300);
  }, 2500);
}

// ----------------------- LOGIN PAGE ------------------------
function initLoginPage() {
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameVal = (loginNameInput?.value || '').trim() || 'User';
    const emailVal = (loginEmailInput?.value || '').trim();
    const passVal = (loginPasswordInput?.value || '').trim();
    const modeEl = document.querySelector('input[name="mode"]:checked');
    const modeVal = modeEl ? modeEl.value : 'budget';

    if (!emailVal || !passVal) {
      showStatusMessage('Please enter email and password.', 'error');
      return;
    }

    // Save mode for this session (always choose on login)
    currentMode = modeVal;
    sessionStorage.setItem(SS_MODE, currentMode);
    applyModeToUI();

    // Save user name for UI
    userName = nameVal;
    localStorage.setItem(LS_USER_NAME, userName);

    // DEMO ONLY: no real backend yet
    if (USE_DEMO_LOGIN) {
      showStatusMessage('Demo login successful', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 600);
      return;
    }

    // TODO: When backend ready, replace this part:
    // try {
    //   const res = await fetch(`${AUTH_BASE}/login`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ email: emailVal, password: passVal })
    //   });
    //   if (!res.ok) {
    //     throw new Error(`Login failed with status ${res.status}`);
    //   }
    //   const data = await res.json();
    //   // Store token etc. in localStorage/sessionStorage
    //   showStatusMessage('Login successful', 'success');
    //   window.location.href = 'dashboard.html';
    // } catch (err) {
    //   console.error('Login error:', err);
    //   showStatusMessage('Login failed. Check console.', 'error');
    // }
  });
}

// ----------------------- USER PROFILE ------------------------
function initUserProfile() {
  if (userNameEl) userNameEl.textContent = userName;

  if (userAvatarEl) {
    if (avatarUrl) {
      userAvatarEl.classList.add('has-image');
      userAvatarEl.style.backgroundImage = `url("${avatarUrl}")`;
      userAvatarEl.style.backgroundSize = 'cover';
      userAvatarEl.style.backgroundPosition = 'center';
      userAvatarEl.textContent = '';
    } else {
      userAvatarEl.classList.remove('has-image');
      userAvatarEl.style.backgroundImage = '';
      const initial = userName ? userName.charAt(0).toUpperCase() : 'U';
      userAvatarEl.textContent = initial;
    }
  }
}

window.editUserName = function () {
  const currentName = userNameEl ? userNameEl.textContent : 'User';
  const newName = prompt('Enter your new user name:', currentName || '');
  if (newName !== null && newName.trim() !== '') {
    userName = newName.trim();
    localStorage.setItem(LS_USER_NAME, userName);
    initUserProfile();
    showStatusMessage('User name updated', 'success');
  }
};

// ----------------------- MONTH SELECTOR ------------------------
function initMonthSelector() {
  if (!monthSelector) return;
  monthSelector.innerHTML = '';
  const now = new Date();
  const options = [
    { index: 0, label: `This Month (${now.toLocaleString(undefined, { month: 'short' })})` },
    { index: -1, label: 'All Time (Last 12 months)' }
  ];

  for (let i = 1; i <= 11; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      index: i,
      label: d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
    });
  }

  options.forEach((optData) => {
    const opt = document.createElement('option');
    opt.value = optData.index;
    opt.textContent = optData.label;
    monthSelector.appendChild(opt);
  });

  monthSelector.value = '0';
  currentMonthIndex = 0;

  monthSelector.addEventListener('change', async (e) => {
    currentMonthIndex = parseInt(e.target.value);
    await updateAll();
    if (typeof Chart !== 'undefined') {
      updateCharts();
    }
  });
}

// ----------------------- CATEGORIES ------------------------
function saveCategoryState() {
  localStorage.setItem(LS_CATS, JSON.stringify(categories));
}

function renderCats() {
  if (sidebarCatList) sidebarCatList.innerHTML = '';
  if (catSelect) catSelect.innerHTML = '';
  if (catListDetailed) catListDetailed.innerHTML = '';

  categories.forEach((c) => {
    // Sidebar pills
    if (sidebarCatList) {
      const d = document.createElement('div');
      d.className = 'cat';
      d.textContent = c;
      sidebarCatList.appendChild(d);
    }

    // Modal select
    if (catSelect) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      catSelect.appendChild(opt);
    }

    // Settings list
    if (catListDetailed) {
      const detailDiv = document.createElement('div');
      detailDiv.innerHTML = `<span>${c}</span><button class="btn ghost small delete-cat" data-cat="${c}">Del</button>`;
      catListDetailed.appendChild(detailDiv);
    }
  });
}

function initCategoryEvents() {
  if (addCatBtn) {
    addCatBtn.addEventListener('click', () => {
      const newCat = (newCatNameInput?.value || '').trim();
      if (!newCat) return;
      if (categories.includes(newCat)) {
        showStatusMessage(`Category "${newCat}" already exists.`, 'error');
        return;
      }
      categories.push(newCat);
      newCatNameInput.value = '';
      renderCats();
      saveCategoryState();
      showStatusMessage(`Category "${newCat}" added.`, 'success');
    });
  }

  if (catListDetailed) {
    catListDetailed.addEventListener('click', (e) => {
      if (e.target.matches('.delete-cat')) {
        const catName = e.target.dataset.cat;
        deleteCategory(catName);
      }
    });
  }
}

function deleteCategory(catName) {
  if (!confirm(`Delete category "${catName}"? Existing expenses keep this name.`)) return;
  categories = categories.filter((c) => c !== catName);
  renderCats();
  saveCategoryState();
  showStatusMessage(`Category "${catName}" deleted.`, 'success');
}

// ----------------------- BALANCE SETTINGS (Budget Mode) ------------------------
function initBalanceEvents() {
  if (!initialBalanceInput) return;
  initialBalanceInput.addEventListener('change', (e) => {
    const newBalance = parseFloat(e.target.value);
    if (!isNaN(newBalance) && newBalance >= 0) {
      initialBalance = newBalance;
      localStorage.setItem(LS_BALANCE, initialBalance.toFixed(2));
      updateAll();
      showStatusMessage('Monthly budget updated', 'success');
    } else {
      showStatusMessage('Please enter a valid amount.', 'error');
      e.target.value = initialBalance.toFixed(2);
    }
  });
}

// ----------------------- EXPENSE API ------------------------
async function fetchMonthlyExpenses(index = currentMonthIndex) {
  // index: 0 = this month, 1 = last month, -1 = all-time (then we use allTimeExpenses)
  if (index === -1) {
    expenses = allTimeExpenses.slice();
    return expenses;
  }

  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
  const targetMonth = targetDate.getMonth() + 1;
  const targetYear = targetDate.getFullYear();

  const url = `${API_BASE}/monthly?year=${targetYear}&month=${targetMonth}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
    promises.push(fetch(url).then((res) => (res.ok ? res.json() : [])).catch(() => []));
  }

  const results = await Promise.all(promises);
  allTimeExpenses = results.flat();

  const unique = {};
  allTimeExpenses.forEach((exp) => (unique[exp.id] = exp));
  allTimeExpenses = Object.values(unique);
}

// ----------------------- EXPENSE MODAL + CRUD ------------------------
function initExpenseEvents() {
  if (addExpenseBtn) addExpenseBtn.addEventListener('click', () => openModal());
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (saveBtn) saveBtn.addEventListener('click', onSaveExpense);
  if (exportBtn) exportBtn.addEventListener('click', exportCSV);

  if (expenseTableBody) {
    expenseTableBody.addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      const id = row?.dataset?.id;
      if (!id) return;
      if (e.target.matches('.edit')) {
        openModal(id);
      } else if (e.target.matches('.del')) {
        deleteExpense(id);
      }
    });
  }
}

function openModal(id = null) {
  editingId = id;
  if (!modalBackdrop) return;
  modalBackdrop.style.display = 'flex';

  if (id) {
    const exp = allTimeExpenses.find((e) => e.id === id);
    if (modalTitleEl) modalTitleEl.textContent = 'Edit Expense';
    if (exp) {
      if (amtIn) amtIn.value = exp.amount.toFixed(2);
      if (catSelect) catSelect.value = exp.categoryName;
      if (noteIn) noteIn.value = exp.note || '';
      if (dateIn) dateIn.value = exp.date.slice(0, 10);
    }
  } else {
    if (modalTitleEl) modalTitleEl.textContent = 'Add Expense';
    if (amtIn) amtIn.value = '';
    if (catSelect) catSelect.selectedIndex = 0;
    if (noteIn) noteIn.value = '';
    if (dateIn) dateIn.value = new Date().toISOString().slice(0, 10);
  }
}

function closeModal() {
  if (modalBackdrop) modalBackdrop.style.display = 'none';
  editingId = null;
}

async function onSaveExpense() {
  const a = parseFloat(amtIn?.value || '0');
  const c = catSelect?.value;
  const n = (noteIn?.value || '').trim();
  const d = dateIn?.value;

  if (isNaN(a) || a <= 0 || !c || !d) {
    showStatusMessage('Enter valid amount, category & date.', 'error');
    return;
  }

  const apiDate = `${d}T00:00:00.000Z`;
  const expenseData = {
    ...(editingId && { id: editingId }),
    date: apiDate,
    note: n,
    amount: a,
    categoryName: c
  };

  closeModal();
  const method = editingId ? 'PUT' : 'POST';
  const url = editingId ? `${API_BASE}/${editingId}` : API_BASE;
  showStatusMessage(`${method === 'POST' ? 'Adding' : 'Updating'} expense...`, 'success');

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(expenseData)
    });

    if (response.status === 200 || response.status === 201) {
      showStatusMessage(`Expense ${method === 'POST' ? 'added' : 'updated'} successfully`, 'success');

      if (method === 'POST' && response.status === 201) {
        const newExpense = await response.json();
        const expDate = new Date(newExpense.date);
        const now = new Date();
        const diffYears = now.getFullYear() - expDate.getFullYear();
        const diffMonths = now.getMonth() - expDate.getMonth() + diffYears * 12;
        if (diffMonths >= 0 && diffMonths <= 11) {
          currentMonthIndex = diffMonths;
          if (monthSelector) monthSelector.value = diffMonths.toString();
        } else {
          currentMonthIndex = 0;
          if (monthSelector) monthSelector.value = '0';
        }
      }
    } else {
      throw new Error(`API returned status ${response.status}: ${await response.text()}`);
    }
  } catch (error) {
    console.error('Error saving expense:', error);
    showStatusMessage('Error saving expense. Check console.', 'error');
  }

  await updateAll();
  if (typeof Chart !== 'undefined') {
    updateCharts();
  }
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense? This cannot be undone.')) return;

  showStatusMessage('Deleting expense...', 'success');
  try {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' }
    });

    if (response.status === 200) {
      showStatusMessage('Expense deleted', 'success');
    } else {
      throw new Error(`API returned status ${response.status}: ${await response.text()}`);
    }
  } catch (error) {
    console.error('Error deleting expense:', error);
    showStatusMessage('Error deleting expense. Check console.', 'error');
  }

  await updateAll();
  if (typeof Chart !== 'undefined') {
    updateCharts();
  }
}

// ----------------------- UPDATE ALL + RENDER ------------------------
async function updateAll() {
  await Promise.all([fetchAllTimeExpenses(), fetchMonthlyExpenses(currentMonthIndex)]);
  renderTable();
  renderDashboard();
  renderCats();
  saveCategoryState();
  initModeBadge();
  applyModeToUI();
}

function renderTable() {
  if (!expenseTableBody) return;
  const rows = expenses.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  expenseTableBody.innerHTML =
    rows
      .map(
        (r) => `
    <tr data-id="${r.id}">
      <td>${r.date.slice(0, 10)}</td>
      <td>${escapeHtml(r.note || '')}</td>
      <td>${r.categoryName}</td>
      <td>₹${Number(r.amount).toFixed(2)}</td>
      <td style="text-align:right">
        <button class="btn ghost small edit">Edit</button>
        <button class="btn ghost small del">Del</button>
      </td>
    </tr>
  `
      )
      .join('') || `<tr><td colspan="5" class="small">No expenses for this period.</td></tr>`;
}

function renderDashboard() {
  const allTotal = allTimeExpenses.reduce((s, x) => s + Number(x.amount || 0), 0);

  const currentPeriodTotal = expenses.reduce((s, x) => s + Number(x.amount || 0), 0);

  // ---- Budget Mode: Monthly balance, no negative ----
  if (currentMode === 'budget') {
    let remaining = initialBalance - currentPeriodTotal;
    if (remaining < 0) remaining = 0;

    if (sidebarBalanceEl) sidebarBalanceEl.textContent = `₹${remaining.toFixed(2)}`;
    if (sidebarMonthSpentEl) sidebarMonthSpentEl.textContent = `₹${currentPeriodTotal.toFixed(2)}`;
    if (balanceEl) balanceEl.textContent = `₹${remaining.toFixed(2)}`;
    if (balanceSettingDisplay) balanceSettingDisplay.textContent = `₹${remaining.toFixed(2)}`;
    if (totalSpentSettingDisplay) totalSpentSettingDisplay.textContent = `₹${allTotal.toFixed(2)}`;
    if (initialBalanceInput) initialBalanceInput.value = initialBalance.toFixed(2);

    // Warning when exceeded
    if (budgetWarningEl) {
      if (currentPeriodTotal > initialBalance) {
        budgetWarningEl.style.display = '';
      } else {
        budgetWarningEl.style.display = 'none';
      }
    }
  } else {
    // ---- Track-only Mode: No balance, only show spent ----
    if (sidebarBalanceEl) sidebarBalanceEl.textContent = '—';
    if (sidebarMonthSpentEl) sidebarMonthSpentEl.textContent = `₹${currentPeriodTotal.toFixed(2)}`;
    if (balanceEl) balanceEl.textContent = '—';
    if (balanceSettingDisplay) balanceSettingDisplay.textContent = '—';
    if (totalSpentSettingDisplay) totalSpentSettingDisplay.textContent = `₹${allTotal.toFixed(2)}`;
    if (initialBalanceInput) initialBalanceInput.value = initialBalance.toFixed(2); // still editable if user uses Budget later

    if (budgetWarningEl) budgetWarningEl.style.display = 'none';
  }

  // Shared stats
  if (monthlyTotalEl) monthlyTotalEl.textContent = `₹${currentPeriodTotal.toFixed(2)}`;
  if (totalCountEl) totalCountEl.textContent = expenses.length;

  const byCat = {};
  expenses.forEach((e) => {
    byCat[e.categoryName] = (byCat[e.categoryName] || 0) + Number(e.amount || 0);
  });
  const topCat = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a])[0] || '-';
  if (topCatEl) topCatEl.textContent = topCat;
}

// ----------------------- CHARTS (4 REAL GRAPHS) ------------------------
function initCharts() {
  if (typeof Chart === 'undefined') return;

  const monthlyTrendCtx = document.getElementById('monthlyTrendChart');
  const categoryPieCtx = document.getElementById('categoryPieChart');
  const dailyBarCtx = document.getElementById('dailyBarChart');
  const sixMonthCatCtx = document.getElementById('sixMonthCategoryChart');

  const sharedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'var(--text-light)', boxWidth: 12, padding: 12 } },
      tooltip: {}
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'var(--border-subtle)' },
        ticks: {
          color: 'var(--muted)',
          callback: (v) => '₹' + v.toLocaleString()
        }
      },
      x: {
        grid: { display: false },
        ticks: { color: 'var(--muted)' }
      }
    }
  };

  // 1. Monthly Trend (last 6 months)
  if (monthlyTrendCtx) {
    monthlyTrendChart = new Chart(monthlyTrendCtx.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Monthly Total',
            data: [],
            borderColor: 'var(--chart-accent-1)',
            backgroundColor: 'rgba(14,165,233,0.25)',
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        ...sharedOptions,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => '₹' + c.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2 })
            }
          }
        }
      }
    });
  }

  // 2. Category Pie (current period)
  if (categoryPieCtx) {
    categoryPieChart = new Chart(categoryPieCtx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: ['#0ea5e9', '#22c55e', '#f97316', '#e11d48', '#a855f7', '#64748b']
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: 'var(--text-light)', boxWidth: 10, padding: 10 } },
          tooltip: {
            callbacks: {
              label: (c) => {
                const total = c.dataset.data.reduce((a, b) => a + b, 0) || 1;
                const val = c.parsed;
                const pct = ((val / total) * 100).toFixed(1);
                return `${c.label}: ₹${val.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  // 3. Daily Spend (selected month)
  if (dailyBarCtx) {
    dailyBarChart = new Chart(dailyBarCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Daily Spend',
            data: [],
            backgroundColor: 'var(--chart-accent-2)',
            borderRadius: 3
          }
        ]
      },
      options: {
        ...sharedOptions,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => '₹' + c.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2 })
            }
          }
        }
      }
    });
  }

  // 4. Top categories last 6 months
  if (sixMonthCatCtx) {
    sixMonthCategoryChart = new Chart(sixMonthCatCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Amount',
            data: [],
            backgroundColor: 'var(--chart-accent-3)',
            borderRadius: 4
          }
        ]
      },
      options: {
        ...sharedOptions,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => '₹' + c.parsed.x.toLocaleString(undefined, { minimumFractionDigits: 2 })
            }
          }
        }
      }
    });
  }
}

function updateCharts() {
  if (typeof Chart === 'undefined') return;

  const now = new Date();
  const numMonths = 6;
  const monthKeys = [];
  const monthTotals = {};

  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = d.getFullYear() + '-' + (d.getMonth() + 1);
    monthKeys.push(k);
    monthTotals[k] = 0;
  }

  allTimeExpenses.forEach((e) => {
    const dt = new Date(e.date);
    if (isNaN(dt)) return;
    const k = dt.getFullYear() + '-' + (dt.getMonth() + 1);
    if (monthTotals[k] !== undefined) {
      monthTotals[k] += Number(e.amount || 0);
    }
  });

  // 1. Monthly Trend Chart
  if (monthlyTrendChart) {
    const labels = monthKeys.map((k) => {
      const [year, m] = k.split('-');
      return new Date(year, m - 1, 1).toLocaleString(undefined, { month: 'short' });
    });
    const data = monthKeys.map((k) => monthTotals[k] || 0);
    monthlyTrendChart.data.labels = labels;
    monthlyTrendChart.data.datasets[0].data = data;
    monthlyTrendChart.update();
  }

  // 2. Category Pie (current period)
  if (categoryPieChart) {
    const byCat = {};
    expenses.forEach((e) => {
      byCat[e.categoryName] = (byCat[e.categoryName] || 0) + Number(e.amount || 0);
    });
    const labels = Object.keys(byCat);
    const data = labels.map((l) => byCat[l]);
    categoryPieChart.data.labels = labels;
    categoryPieChart.data.datasets[0].data = data;
    categoryPieChart.update();
  }

  // 3. Daily Bar Chart
  if (dailyBarChart) {
    let idx = currentMonthIndex;
    if (idx < 0) idx = 0; // for "All Time", we just show this month daily
    const base = new Date(now.getFullYear(), now.getMonth() - idx, 1);
    const year = base.getFullYear();
    const month = base.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dailyTotals = new Array(daysInMonth).fill(0);
    expenses.forEach((e) => {
      const dt = new Date(e.date);
      if (dt.getFullYear() === year && dt.getMonth() === month) {
        const day = dt.getDate();
        dailyTotals[day - 1] += Number(e.amount || 0);
      }
    });

    const labels = [];
    for (let d = 1; d <= daysInMonth; d++) labels.push(d.toString());

    dailyBarChart.data.labels = labels;
    dailyBarChart.data.datasets[0].data = dailyTotals;
    dailyBarChart.update();
  }

  // 4. Six-month category totals
  if (sixMonthCategoryChart) {
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - (numMonths - 1), 1);
    const byCat6 = {};
    allTimeExpenses.forEach((e) => {
      const dt = new Date(e.date);
      if (isNaN(dt) || dt < cutoffDate) return;
      byCat6[e.categoryName] = (byCat6[e.categoryName] || 0) + Number(e.amount || 0);
    });

    const labelsAll = Object.keys(byCat6);
    const sorted = labelsAll.sort((a, b) => byCat6[b] - byCat6[a]).slice(0, 8);
    const data = sorted.map((l) => byCat6[l]);

    sixMonthCategoryChart.data.labels = sorted;
    sixMonthCategoryChart.data.datasets[0].data = data;
    sixMonthCategoryChart.update();
  }
}

// ----------------------- UTILITIES ------------------------
function exportCSV() {
  if (!allTimeExpenses.length) {
    showStatusMessage('No expenses to export.', 'error');
    return;
  }

  const headers = ['Date', 'Category', 'Note', 'Amount', 'Id'];
  const rows = allTimeExpenses.map((e) => [
    e.date.slice(0, 10),
    e.categoryName,
    '"' + (e.note || '').replace(/"/g, '""') + '"',
    e.amount,
    e.id
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'expenses.csv';
  a.click();
  URL.revokeObjectURL(url);
  showStatusMessage('Exported to expenses.csv', 'success');
}

function escapeHtml(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
