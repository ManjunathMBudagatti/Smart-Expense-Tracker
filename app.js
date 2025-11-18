// -------- Smart Expense Tracker Frontend (Multi-page) --------

// ---- CONFIG ----
const API_BASE = 'https://localhost:7008/api/Expenses';
const USE_DEMO_LOGIN = true;

// ---- STORAGE KEYS ----
const LS_CATS = 'set_cats_v1';
const LS_BALANCE = 'set_initial_balance';
const LS_THEME = 'set_theme';
const LS_USER_NAME = 'set_user_name';
const LS_CURRENT_USER = 'set_current_user';
const LS_SELECTED_MONTH = 'set_selected_month';
const SS_MODE = 'set_mode'; // budget | track

// ---- STATE ----
const currentPage = document.body.dataset.page || 'login';

let activeUser = null;
try {
  activeUser = JSON.parse(localStorage.getItem(LS_CURRENT_USER) || 'null');
} catch {
  activeUser = null;
}

let currentMode = sessionStorage.getItem(SS_MODE) || (activeUser && activeUser.mode) || 'budget';
let currentTheme = localStorage.getItem(LS_THEME) || 'dark';
let currentMonthIndex = 0; // 0=this month, 1=last, -1=all time
let categories =
  JSON.parse(localStorage.getItem(LS_CATS) || 'null') || [
    'Food',
    'Transport',
    'Groceries',
    'Entertainment',
    'Bills',
    'Other'
  ];
let initialBalance = parseFloat(localStorage.getItem(LS_BALANCE) || '10000');
let allTimeExpenses = [];
let expenses = [];
let userName = localStorage.getItem(LS_USER_NAME) || (activeUser && activeUser.name) || 'User';
let avatarUrl = localStorage.getItem('set_avatar_url') || '';

let editingId = null;
let pendingDeleteId = null;

// ---- ELEMENTS (common) ----
const statusMessageEl = document.getElementById('statusMessage');
const appEl = document.getElementById('app');
const monthSelector = document.getElementById('monthSelector');
const sidebarToggleBtn = document.getElementById('sidebarToggle');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeToggleCheckbox = document.getElementById('themeToggle');
const userNameEl = document.getElementById('userName');
const userAvatarEl = document.getElementById('userAvatar');
const modeBadgeEl = document.getElementById('modeBadge');
const budgetWarningEl = document.getElementById('budgetWarning');

// Sidebar elements
const sidebarBalanceEl = document.getElementById('sidebarBalance');
const sidebarMonthSpentEl = document.getElementById('sidebarMonthSpent');
const sidebarCatList = document.getElementById('sidebarCatList');
const addExpenseBtn = document.getElementById('addExpenseBtn');

// Dashboard summary
const summaryTotalEl = document.getElementById('summaryTotal');
const summaryTxnsEl = document.getElementById('summaryTxns');
const insightTextEl = document.getElementById('insightText');

// Settings
const initialBalanceInput = document.getElementById('initialBalanceInput');
const balanceSettingDisplay = document.getElementById('balanceSettingDisplay');
const totalSpentSettingDisplay = document.getElementById('totalSpentSettingDisplay');
const avatarUrlInput = document.getElementById('avatarUrlInput');
const saveAvatarBtn = document.getElementById('saveAvatarBtn');
const newCatNameInput = document.getElementById('newCatName');
const addCatBtn = document.getElementById('addCatBtn');
const catListDetailed = document.getElementById('catListDetailed');

// Expenses
const expenseTableBody = document.querySelector('#expenseTable tbody');
const exportBtn = document.getElementById('exportBtn');

// Modal (add/edit)
const modalBackdrop = document.getElementById('modalBackdrop');
const modalTitleEl = document.getElementById('modalTitle');
const amtIn = document.getElementById('amt');
const catSelect = document.getElementById('catSelect');
const noteIn = document.getElementById('note');
const dateIn = document.getElementById('date');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');

// Delete confirm modal
const confirmBackdrop = document.getElementById('confirmBackdrop');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

// Login page
const loginForm = document.getElementById('loginForm');
const loginNameInput = document.getElementById('loginName');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');

// Charts
let dashTrendChart = null;
let dashCategoryChart = null;
let monthlyTrendChart = null;
let categoryPieChart = null;
let dailyBarChart = null;
let sixMonthCategoryChart = null;

// ---- ROUTING GUARD ----
if (currentPage === 'login') {
  if (activeUser) {
    window.location.href = 'dashboard.html';
  }
} else {
  if (!activeUser) {
    window.location.href = 'index.html';
  }
}

// ---- MAIN INIT ----
document.addEventListener('DOMContentLoaded', () => {
  if (currentPage === 'login') {
    applyTheme(currentTheme);
    initLoginPage();
    return;
  }

  loadSelectedMonth();
  applyTheme(currentTheme);
  initCommonLayout();
  renderCats();
  initCategoryEvents();
  initBalanceEvents();
  initExpenseEvents();
  initThemeControls();
  applyModeToUI();
  updateModeBadge();

  if (monthSelector) initMonthSelector();

  if (currentPage === 'dashboard' || currentPage === 'charts') {
    if (typeof Chart !== 'undefined') {
      initCharts();
    }
  }

  (async () => {
    await updateAll();
    if (currentPage === 'dashboard' || currentPage === 'charts') {
      if (typeof Chart !== 'undefined') updateCharts();
    }
  })();
});

// ---------------- STATUS MESSAGE ----------------
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
  }, 2600);
}

// ---------------- THEME & LAYOUT ----------------
function applyTheme(theme) {
  currentTheme = theme;
  if (theme === 'light') {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
  localStorage.setItem(LS_THEME, currentTheme);
  if (themeToggleCheckbox) {
    themeToggleCheckbox.checked = currentTheme === 'dark';
  }
}

function initCommonLayout() {
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

  if (sidebarToggleBtn && appEl) {
    sidebarToggleBtn.addEventListener('click', () => {
      appEl.classList.toggle('sidebar-open');
    });
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

  if (avatarUrlInput) avatarUrlInput.value = avatarUrl;

  if (saveAvatarBtn) {
    saveAvatarBtn.addEventListener('click', () => {
      avatarUrl = (avatarUrlInput.value || '').trim();
      localStorage.setItem('set_avatar_url', avatarUrl);
      initCommonLayout();
      showStatusMessage('Avatar updated', 'success');
    });
  }
}

// ---------------- MODE ----------------
function applyModeToUI() {
  const els = document.querySelectorAll('[data-mode="budget-only"]');
  els.forEach((el) => {
    el.style.display = currentMode === 'budget' ? '' : 'none';
  });

  if (budgetWarningEl && currentMode !== 'budget') {
    budgetWarningEl.style.display = 'none';
  }
}

function updateModeBadge() {
  if (!modeBadgeEl) return;
  modeBadgeEl.textContent =
    'Mode: ' + (currentMode === 'budget' ? 'Budget (Monthly Balance)' : 'Track-Only');
}

// ---------------- LOGIN PAGE ----------------
function initLoginPage() {
  if (!loginForm) return;
  loginForm.addEventListener('submit', (e) => {
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

    currentMode = modeVal;
    sessionStorage.setItem(SS_MODE, currentMode);

    activeUser = {
      name: nameVal,
      email: emailVal,
      mode: currentMode
    };
    userName = nameVal;
    localStorage.setItem(LS_CURRENT_USER, JSON.stringify(activeUser));
    localStorage.setItem(LS_USER_NAME, userName);

    if (USE_DEMO_LOGIN) {
      showStatusMessage('Login successful', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 400);
      return;
    }
  });
}

window.editUserName = function () {
  const currentName = userNameEl ? userNameEl.textContent : 'User';
  const newName = prompt('Enter your new user name:', currentName || '');
  if (newName !== null && newName.trim() !== '') {
    userName = newName.trim();
    localStorage.setItem(LS_USER_NAME, userName);
    if (activeUser) {
      activeUser.name = userName;
      localStorage.setItem(LS_CURRENT_USER, JSON.stringify(activeUser));
    }
    if (userNameEl) userNameEl.textContent = userName;
    if (userAvatarEl && !avatarUrl) {
      const initial = userName.charAt(0).toUpperCase();
      userAvatarEl.textContent = initial;
    }
    showStatusMessage('User name updated', 'success');
  }
};

// ---------------- MONTH SELECTOR ----------------
function loadSelectedMonth() {
  const raw = localStorage.getItem(LS_SELECTED_MONTH);
  if (raw === null) {
    currentMonthIndex = 0;
  } else {
    const n = parseInt(raw, 10);
    currentMonthIndex = isNaN(n) ? 0 : n;
  }
}

function saveSelectedMonth() {
  localStorage.setItem(LS_SELECTED_MONTH, String(currentMonthIndex));
}

function initMonthSelector() {
  if (!monthSelector) return;
  monthSelector.innerHTML = '';
  const now = new Date();
  const options = [
    {
      index: 0,
      label: `This Month (${now.toLocaleString(undefined, { month: 'short' })})`
    },
    { index: -1, label: 'All Time (Last 12 months)' }
  ];
  for (let i = 1; i <= 11; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      index: i,
      label: d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
    });
  }
  options.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.index;
    opt.textContent = o.label;
    monthSelector.appendChild(opt);
  });
  monthSelector.value = String(currentMonthIndex);
  monthSelector.addEventListener('change', async (e) => {
    currentMonthIndex = parseInt(e.target.value, 10);
    saveSelectedMonth();
    await updateAll();
    if (currentPage === 'dashboard' || currentPage === 'charts') {
      if (typeof Chart !== 'undefined') updateCharts();
    }
  });
}

// ---------------- CATEGORIES ----------------
function renderCats() {
  if (sidebarCatList) sidebarCatList.innerHTML = '';
  if (catSelect) catSelect.innerHTML = '';
  if (catListDetailed) catListDetailed.innerHTML = '';

  categories.forEach((c) => {
    if (sidebarCatList) {
      const d = document.createElement('div');
      d.className = 'cat';
      d.textContent = c;
      sidebarCatList.appendChild(d);
    }
    if (catSelect) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      catSelect.appendChild(opt);
    }
    if (catListDetailed) {
      const div = document.createElement('div');
      div.innerHTML = `<span>${c}</span><button class="btn ghost small delete-cat" data-cat="${c}">Del</button>`;
      catListDetailed.appendChild(div);
    }
  });
  localStorage.setItem(LS_CATS, JSON.stringify(categories));
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
      showStatusMessage(`Category "${newCat}" added`, 'success');
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
  if (!catName) return;
  if (!confirm(`Delete category "${catName}"? Existing expenses keep this name.`)) return;
  categories = categories.filter((c) => c !== catName);
  renderCats();
  showStatusMessage(`Category "${catName}" deleted`, 'success');
}

// ---------------- BALANCE SETTINGS ----------------
function initBalanceEvents() {
  if (!initialBalanceInput) return;
  initialBalanceInput.value = initialBalance.toFixed(2);
  initialBalanceInput.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      initialBalance = val;
      localStorage.setItem(LS_BALANCE, initialBalance.toFixed(2));
      updateAll();
      showStatusMessage('Monthly budget updated', 'success');
    } else {
      showStatusMessage('Enter valid amount.', 'error');
      e.target.value = initialBalance.toFixed(2);
    }
  });
}

// ---------------- EXPENSE API ----------------
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
  allTimeExpenses.forEach((e) => {
    unique[e.id] = e;
  });
  allTimeExpenses = Object.values(unique);
}

async function fetchMonthlyExpenses(index = currentMonthIndex) {
  if (index === -1) {
    expenses = allTimeExpenses.slice();
    return expenses;
  }
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - index, 1);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const url = `${API_BASE}/monthly?year=${year}&month=${month}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    expenses = await res.json();
  } catch (err) {
    console.error('Error fetching monthly expenses', err);
    expenses = [];
  }
  return expenses;
}

// ---------------- EXPENSE UI & CRUD ----------------
function initExpenseEvents() {
  if (addExpenseBtn) {
    addExpenseBtn.addEventListener('click', () => openModal());
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => closeModal());
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', onSaveExpense);
  }
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCSV);
  }

  if (expenseTableBody) {
    expenseTableBody.addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      if (!row) return;
      const id = row.dataset.id;
      if (!id) return;
      if (e.target.matches('.edit')) {
        openModal(id);
      } else if (e.target.matches('.del')) {
        askDelete(id);
      }
    });
  }

  if (confirmCancelBtn && confirmBackdrop) {
    confirmCancelBtn.addEventListener('click', () => {
      pendingDeleteId = null;
      confirmBackdrop.style.display = 'none';
    });
  }

  if (confirmDeleteBtn && confirmBackdrop) {
    confirmDeleteBtn.addEventListener('click', async () => {
      const id = pendingDeleteId;
      pendingDeleteId = null;
      confirmBackdrop.style.display = 'none';
      if (id) await deleteExpense(id);
    });
  }
}

function openModal(id = null) {
  editingId = id;
  if (!modalBackdrop) return;
  modalBackdrop.style.display = 'flex';

  if (modalTitleEl) modalTitleEl.textContent = id ? 'Edit Expense' : 'Add Expense';

  if (id) {
    const exp = allTimeExpenses.find((e) => e.id === id);
    if (!exp) return;
    if (amtIn) amtIn.value = exp.amount.toFixed(2);
    if (catSelect) catSelect.value = exp.categoryName;
    if (noteIn) noteIn.value = exp.note || '';
    if (dateIn) dateIn.value = exp.date.slice(0, 10);
  } else {
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
  const amount = parseFloat(amtIn?.value || '0');
  const categoryName = catSelect?.value;
  const note = (noteIn?.value || '').trim();
  const d = dateIn?.value;

  if (isNaN(amount) || amount <= 0 || !categoryName || !d) {
    showStatusMessage('Enter valid amount, category & date.', 'error');
    return;
  }

  const apiDate = `${d}T00:00:00.000Z`;
  const payload = {
    ...(editingId && { id: editingId }),
    date: apiDate,
    note,
    amount,
    categoryName
  };

  closeModal();
  const method = editingId ? 'PUT' : 'POST';
  const url = editingId ? `${API_BASE}/${editingId}` : API_BASE;
  showStatusMessage(`${editingId ? 'Updating' : 'Adding'} expense...`, 'success');

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!(res.status === 200 || res.status === 201)) {
      throw new Error(`Status ${res.status}: ${await res.text()}`);
    }
    showStatusMessage(`Expense ${editingId ? 'updated' : 'added'} successfully`, 'success');

    if (!editingId && res.status === 201) {
      const newExp = await res.json();
      const expDate = new Date(newExp.date);
      const now = new Date();
      const diffYears = now.getFullYear() - expDate.getFullYear();
      const diffMonths = now.getMonth() - expDate.getMonth() + diffYears * 12;
      if (diffMonths >= 0 && diffMonths <= 11) {
        currentMonthIndex = diffMonths;
      } else {
        currentMonthIndex = 0;
      }
      saveSelectedMonth();
      if (monthSelector) monthSelector.value = String(currentMonthIndex);
    }
  } catch (err) {
    console.error('Error saving expense', err);
    showStatusMessage('Error saving expense. Check console.', 'error');
  }

  await updateAll();
  if (currentPage === 'dashboard' || currentPage === 'charts') {
    if (typeof Chart !== 'undefined') updateCharts();
  }
}

function askDelete(id) {
  pendingDeleteId = id;
  if (confirmBackdrop) confirmBackdrop.style.display = 'flex';
}

async function deleteExpense(id) {
  showStatusMessage('Deleting expense...', 'success');
  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' }
    });
    if (res.status !== 200) {
      throw new Error(`Status ${res.status}: ${await res.text()}`);
    }
    showStatusMessage('Expense deleted', 'success');
  } catch (err) {
    console.error('Error deleting expense', err);
    showStatusMessage('Error deleting expense. Check console.', 'error');
  }
  await updateAll();
  if (currentPage === 'dashboard' || currentPage === 'charts') {
    if (typeof Chart !== 'undefined') updateCharts();
  }
}

// ---------------- UPDATE & RENDER ----------------
async function updateAll() {
  await fetchAllTimeExpenses();
  await fetchMonthlyExpenses(currentMonthIndex);
  renderTable();
  renderDashboard();
  renderCats();
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
      </tr>`
      )
      .join('') || `<tr><td colspan="5" class="small">No expenses for this period.</td></tr>`;
}

function getMonthTotalByIndex(idx) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - idx, 1);
  const year = d.getFullYear();
  const month = d.getMonth();
  let total = 0;
  allTimeExpenses.forEach((e) => {
    const dt = new Date(e.date);
    if (!isNaN(dt) && dt.getFullYear() === year && dt.getMonth() === month) {
      total += Number(e.amount || 0);
    }
  });
  return total;
}

function renderDashboard() {
  const allTotal = allTimeExpenses.reduce((s, x) => s + Number(x.amount || 0), 0);
  const periodTotal = expenses.reduce((s, x) => s + Number(x.amount || 0), 0);

  if (sidebarMonthSpentEl) sidebarMonthSpentEl.textContent = `₹${periodTotal.toFixed(2)}`;

  if (currentMode === 'budget') {
    const remainingRaw = initialBalance - periodTotal;
    const remaining = remainingRaw < 0 ? 0 : remainingRaw;
    if (sidebarBalanceEl) sidebarBalanceEl.textContent = `₹${remaining.toFixed(2)}`;
    if (budgetWarningEl) {
      budgetWarningEl.style.display = remainingRaw < 0 ? '' : 'none';
    }
  } else {
    if (sidebarBalanceEl) sidebarBalanceEl.textContent = '—';
  }

  if (balanceSettingDisplay) {
    if (currentMode === 'budget') {
      const remainingRaw = initialBalance - periodTotal;
      const remaining = remainingRaw < 0 ? 0 : remainingRaw;
      balanceSettingDisplay.textContent = `₹${remaining.toFixed(2)}`;
    } else {
      balanceSettingDisplay.textContent = '—';
    }
  }
  if (totalSpentSettingDisplay) {
    totalSpentSettingDisplay.textContent = `₹${allTotal.toFixed(2)}`;
  }
  if (initialBalanceInput) {
    initialBalanceInput.value = initialBalance.toFixed(2);
  }

  // Summary cards
  if (summaryTotalEl) summaryTotalEl.textContent = `₹${periodTotal.toFixed(2)}`;
  if (summaryTxnsEl) summaryTxnsEl.textContent = expenses.length;

  // Insight based on previous month
  if (insightTextEl) {
    let baseIdx = currentMonthIndex;
    if (baseIdx < 0) baseIdx = 0;
    const prevIdx = baseIdx + 1;
    if (prevIdx > 11) {
      insightTextEl.textContent = 'Not enough history to compare with a previous month yet.';
    } else {
      const lastTotal = getMonthTotalByIndex(prevIdx);
      if (lastTotal > 0) {
        const diff = periodTotal - lastTotal;
        const pct = Math.abs(diff) / lastTotal * 100;
        if (diff < -0.01) {
          insightTextEl.textContent = `Nice! You spent ${pct.toFixed(
            1
          )}% less than the previous month.`;
        } else if (diff > 0.01) {
          insightTextEl.textContent = `Heads up, you spent ${pct.toFixed(
            1
          )}% more than the previous month.`;
        } else {
          insightTextEl.textContent = 'You spent almost the same as the previous month.';
        }
      } else if (periodTotal > 0) {
        insightTextEl.textContent = 'This is your first tracked month — great start!';
      } else {
        insightTextEl.textContent = 'Add some expenses to see smart insights here.';
      }
    }
  }
}

// ---------------- CHARTS ----------------
function initCharts() {
  if (typeof Chart === 'undefined') return;

  const dashTrendCtx = document.getElementById('dashTrendChart');
  const dashCategoryCtx = document.getElementById('dashCategoryChart');
  const monthlyTrendCtx = document.getElementById('monthlyTrendChart');
  const categoryPieCtx = document.getElementById('categoryPieChart');
  const dailyBarCtx = document.getElementById('dailyBarChart');
  const sixMonthCatCtx = document.getElementById('sixMonthCategoryChart');

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.2)' },
        ticks: {
          color: 'var(--muted)',
          callback: (v) => '₹' + v.toLocaleString()
        }
      },
      x: {
        grid: { display: false },
        ticks: { color: 'var(--muted)' }
      }
    },
    plugins: {
      legend: {
        labels: { color: 'var(--text-light)', boxWidth: 12, padding: 10 }
      }
    }
  };

  if (dashTrendCtx) {
    dashTrendChart = new Chart(dashTrendCtx.getContext('2d'), {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Monthly Total', data: [], borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.2)', tension: 0.3, fill: true }] },
      options: {
        ...baseOptions,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) =>
                '₹' +
                c.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2 })
            }
          }
        }
      }
    });
  }

  if (dashCategoryCtx) {
    dashCategoryChart = new Chart(dashCategoryCtx.getContext('2d'), {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], backgroundColor: ['#0ea5e9', '#22c55e', '#f97316', '#e11d48', '#a855f7', '#64748b'] }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: 'var(--text-light)', boxWidth: 10, padding: 10 }
          },
          tooltip: {
            callbacks: {
              label: (c) => {
                const total = c.dataset.data.reduce((a, b) => a + b, 0) || 1;
                const val = c.parsed;
                const pct = ((val / total) * 100).toFixed(1);
                return `${c.label}: ₹${val.toLocaleString(undefined, {
                  minimumFractionDigits: 2
                })} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  if (monthlyTrendCtx) {
    monthlyTrendChart = new Chart(monthlyTrendCtx.getContext('2d'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Monthly Total', data: [], backgroundColor: '#38bdf8', borderRadius: 4 }] },
      options: {
        ...baseOptions,
        plugins: { legend: { display: false } }
      }
    });
  }

  if (categoryPieCtx) {
    categoryPieChart = new Chart(categoryPieCtx.getContext('2d'), {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], backgroundColor: ['#0ea5e9', '#22c55e', '#f97316', '#e11d48', '#a855f7', '#64748b'] }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: 'var(--text-light)', boxWidth: 10, padding: 10 }
          },
          tooltip: {
            callbacks: {
              label: (c) => {
                const total = c.dataset.data.reduce((a, b) => a + b, 0) || 1;
                const val = c.parsed;
                const pct = ((val / total) * 100).toFixed(1);
                return `${c.label}: ₹${val.toLocaleString(undefined, {
                  minimumFractionDigits: 2
                })} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  if (dailyBarCtx) {
    dailyBarChart = new Chart(dailyBarCtx.getContext('2d'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Daily Spend', data: [], backgroundColor: '#22c55e', borderRadius: 3 }] },
      options: {
        ...baseOptions,
        plugins: { legend: { display: false } }
      }
    });
  }

  if (sixMonthCatCtx) {
    sixMonthCategoryChart = new Chart(sixMonthCatCtx.getContext('2d'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Amount', data: [], backgroundColor: '#f97316', borderRadius: 4 }] },
      options: {
        ...baseOptions,
        indexAxis: 'y',
        plugins: { legend: { display: false } }
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
    const key = d.getFullYear() + '-' + (d.getMonth() + 1);
    monthKeys.push(key);
    monthTotals[key] = 0;
  }

  allTimeExpenses.forEach((e) => {
    const dt = new Date(e.date);
    if (isNaN(dt)) return;
    const key = dt.getFullYear() + '-' + (dt.getMonth() + 1);
    if (monthTotals[key] !== undefined) {
      monthTotals[key] += Number(e.amount || 0);
    }
  });

  const monthLabels = monthKeys.map((k) => {
    const [year, m] = k.split('-');
    return new Date(year, m - 1, 1).toLocaleString(undefined, { month: 'short' });
  });
  const monthData = monthKeys.map((k) => monthTotals[k] || 0);

  if (dashTrendChart) {
    dashTrendChart.data.labels = monthLabels;
    dashTrendChart.data.datasets[0].data = monthData;
    dashTrendChart.update();
  }

  if (monthlyTrendChart) {
    monthlyTrendChart.data.labels = monthLabels;
    monthlyTrendChart.data.datasets[0].data = monthData;
    monthlyTrendChart.update();
  }

  // Category charts use current period "expenses"
  const byCat = {};
  expenses.forEach((e) => {
    byCat[e.categoryName] = (byCat[e.categoryName] || 0) + Number(e.amount || 0);
  });
  const catLabels = Object.keys(byCat);
  const catData = catLabels.map((l) => byCat[l]);

  if (dashCategoryChart) {
    dashCategoryChart.data.labels = catLabels;
    dashCategoryChart.data.datasets[0].data = catData;
    dashCategoryChart.update();
  }

  if (categoryPieChart) {
    categoryPieChart.data.labels = catLabels;
    categoryPieChart.data.datasets[0].data = catData;
    categoryPieChart.update();
  }

  // Daily bar: use selected month (or current if all time)
  if (dailyBarChart) {
    let idx = currentMonthIndex;
    if (idx < 0) idx = 0;
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

  // Top categories last 6 months
  if (sixMonthCategoryChart) {
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - (numMonths - 1), 1);
    const byCatLast6 = {};
    allTimeExpenses.forEach((e) => {
      const dt = new Date(e.date);
      if (isNaN(dt) || dt < cutoffDate) return;
      byCatLast6[e.categoryName] =
        (byCatLast6[e.categoryName] || 0) + Number(e.amount || 0);
    });
    const labelsAll = Object.keys(byCatLast6);
    const sorted = labelsAll.sort((a, b) => byCatLast6[b] - byCatLast6[a]).slice(0, 8);
    const data = sorted.map((l) => byCatLast6[l]);

    sixMonthCategoryChart.data.labels = sorted;
    sixMonthCategoryChart.data.datasets[0].data = data;
    sixMonthCategoryChart.update();
  }
}

// ---------------- UTILITIES ----------------
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
