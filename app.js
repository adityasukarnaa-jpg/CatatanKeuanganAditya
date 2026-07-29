// =====================================================================
// KONFIGURASI — WAJIB DIISI
// Tempel URL Web App hasil deploy Google Apps Script di sini.
// Lihat README.md untuk cara mendapatkannya.
// =====================================================================
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxSI6ED7Cirxs29SKgqrr2ywt4wSrlN2Mn1z2rX6MRF1fRr2nh2fOvfS3kUxWEx0NGqbQ/exec";

const EXPENSE_CATEGORIES = ['Makanan', 'Transportasi', 'Belanja Rumah', 'Tagihan & Utilitas', 'Kesehatan', 'Pendidikan', 'Hiburan', 'Lainnya'];
const INCOME_CATEGORIES = ['Gaji', 'Usaha', 'Lainnya'];

let entries = [];
let currentType = 'out';
let selectedCategory = EXPENSE_CATEGORIES[0];
let selectedMonth = todayStr().slice(0, 7);
let openDropdown = null;

// ---------- Helpers ----------
function todayStr() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function rupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
}

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function dayLabelFull(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function isConfigured() {
  return APPS_SCRIPT_URL && !APPS_SCRIPT_URL.includes('PASTE_URL');
}

// ---------- API ----------
async function apiList() {
  const res = await fetch(APPS_SCRIPT_URL, { method: 'GET' });
  if (!res.ok) throw new Error('Gagal mengambil data');
  const data = await res.json();
  return data.entries || [];
}

async function apiAdd(entry) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari CORS preflight
    body: JSON.stringify({ action: 'add', entry }),
  });
  if (!res.ok) throw new Error('Gagal menyimpan');
  return res.json();
}

async function apiDelete(id) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'delete', id }),
  });
  if (!res.ok) throw new Error('Gagal menghapus');
  return res.json();
}

// ---------- Init ----------
async function init() {
  document.getElementById('fDate').value = todayStr();
  renderCategoryMenu();
  setupDropdown('categoryTrigger', 'categoryMenu');
  setupDropdown('monthTrigger', 'monthMenu');
  document.getElementById('todayLabel').textContent = dayLabelFull(todayStr());
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown') && openDropdown) closeDropdown(openDropdown);
  });

  if (!isConfigured()) {
    document.getElementById('configNotice').hidden = false;
    document.getElementById('loadingMsg').hidden = true;
    document.getElementById('appBody').hidden = false;
    document.getElementById('submitBtn').disabled = true;
    renderAll();
    return;
  }

  try {
    entries = await apiList();
  } catch (e) {
    document.getElementById('saveError').hidden = false;
  }
  document.getElementById('loadingMsg').hidden = true;
  document.getElementById('appBody').hidden = false;
  renderAll();
}

// ---------- Generic dropdown open/close ----------
function setupDropdown(triggerId, menuId) {
  const trigger = document.getElementById(triggerId);
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = trigger.classList.contains('open');
    if (openDropdown) closeDropdown(openDropdown);
    if (!isOpen) openDropdownEl(triggerId, menuId);
  });
}

function openDropdownEl(triggerId, menuId) {
  document.getElementById(triggerId).classList.add('open');
  document.getElementById(triggerId).setAttribute('aria-expanded', 'true');
  document.getElementById(menuId).hidden = false;
  openDropdown = { triggerId, menuId };
}

function closeDropdown(ref) {
  document.getElementById(ref.triggerId).classList.remove('open');
  document.getElementById(ref.triggerId).setAttribute('aria-expanded', 'false');
  document.getElementById(ref.menuId).hidden = true;
  openDropdown = null;
}

// ---------- Category dropdown ----------
function renderCategoryMenu() {
  const menu = document.getElementById('categoryMenu');
  const list = currentType === 'out' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  if (!list.includes(selectedCategory)) selectedCategory = list[0];
  menu.innerHTML = '';
  for (const c of list) {
    const opt = document.createElement('div');
    opt.className = `dropdown-option${c === selectedCategory ? ' selected' : ''}`;
    opt.textContent = c;
    opt.setAttribute('role', 'option');
    opt.tabIndex = 0;
    const choose = () => {
      selectedCategory = c;
      document.getElementById('categoryTriggerText').textContent = c;
      renderCategoryMenu();
      if (openDropdown) closeDropdown(openDropdown);
    };
    opt.addEventListener('click', choose);
    opt.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    menu.appendChild(opt);
  }
  document.getElementById('categoryTriggerText').textContent = selectedCategory;
}

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('tab-catat').hidden = tab !== 'catat';
    document.getElementById('tab-rekap').hidden = tab !== 'rekap';
    if (tab === 'rekap') renderRekap();
  });
});

// ---------- Type toggle ----------
document.querySelectorAll('.type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentType = btn.dataset.type;
    renderCategoryMenu();
  });
});

// ---------- Form submit ----------
document.getElementById('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('fAmount').value);
  if (!amount || amount <= 0) return;

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: document.getElementById('fDate').value,
    type: currentType,
    category: selectedCategory,
    amount,
    note: document.getElementById('fNote').value.trim(),
  };

  entries.unshift(entry);
  renderAll();
  document.getElementById('fAmount').value = '';
  document.getElementById('fNote').value = '';

  if (isConfigured()) {
    try {
      await apiAdd(entry);
      document.getElementById('saveError').hidden = true;
    } catch (err) {
      document.getElementById('saveError').hidden = false;
    }
  }
});

// ---------- Delete ----------
async function handleDelete(id) {
  entries = entries.filter((e) => e.id !== id);
  renderAll();
  if (isConfigured()) {
    try {
      await apiDelete(id);
      document.getElementById('saveError').hidden = true;
    } catch (err) {
      document.getElementById('saveError').hidden = false;
    }
  }
}

// ---------- Rendering ----------
function renderAll() {
  renderTodayLedger();
  populateMonthSelect();
  renderRekap();
  renderStamp();
}

function renderStamp() {
  const ym = todayStr().slice(0, 7);
  const monthEntries = entries.filter((e) => e.date.slice(0, 7) === ym);
  let out = 0, income = 0;
  for (const e of monthEntries) {
    if (e.type === 'out') out += Number(e.amount); else income += Number(e.amount);
  }
  document.getElementById('stampSaldo').textContent = rupiah(income - out);
}

function renderTodayLedger() {
  const today = todayStr();
  const list = entries
    .filter((e) => e.date === today)
    .sort((a, b) => b.id.localeCompare(a.id));
  renderLedger(document.getElementById('todayLedger'), list, false, 'Belum ada catatan hari ini. Tambahkan di atas.');
}

function populateMonthSelect() {
  const set = new Set(entries.map((e) => e.date.slice(0, 7)));
  set.add(todayStr().slice(0, 7));
  const months = Array.from(set).sort().reverse();
  if (!months.includes(selectedMonth)) selectedMonth = months[0];

  const menu = document.getElementById('monthMenu');
  menu.innerHTML = '';
  for (const m of months) {
    const opt = document.createElement('div');
    opt.className = `dropdown-option${m === selectedMonth ? ' selected' : ''}`;
    opt.textContent = monthLabel(m);
    opt.setAttribute('role', 'option');
    opt.tabIndex = 0;
    const choose = () => {
      selectedMonth = m;
      document.getElementById('monthTriggerText').textContent = monthLabel(m);
      populateMonthSelect();
      renderRekap();
      if (openDropdown) closeDropdown(openDropdown);
    };
    opt.addEventListener('click', choose);
    opt.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    menu.appendChild(opt);
  }
  document.getElementById('monthTriggerText').textContent = monthLabel(selectedMonth);
}

function renderRekap() {
  const monthEntries = entries
    .filter((e) => e.date.slice(0, 7) === selectedMonth)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));

  let out = 0, income = 0;
  const catMap = {};
  const dayMap = {};

  for (const e of monthEntries) {
    const amt = Number(e.amount);
    if (e.type === 'out') {
      out += amt;
      catMap[e.category] = (catMap[e.category] || 0) + amt;
      const day = e.date.slice(8, 10);
      dayMap[day] = (dayMap[day] || 0) + amt;
    } else {
      income += amt;
    }
  }

  document.getElementById('sumIncome').textContent = rupiah(income);
  document.getElementById('sumOut').textContent = rupiah(out);
  document.getElementById('sumSaldo').textContent = rupiah(income - out);
  document.getElementById('monthLabelText').textContent = monthLabel(selectedMonth);

  // Daily chart
  const chartData = Object.entries(dayMap).sort((a, b) => Number(a[0]) - Number(b[0]));
  const chartWrap = document.getElementById('chartWrap');
  const chartEl = document.getElementById('chart');
  chartEl.innerHTML = '';
  if (chartData.length > 0) {
    chartWrap.hidden = false;
    const max = Math.max(...chartData.map((d) => d[1]));
    for (const [day, amount] of chartData) {
      const wrap = document.createElement('div');
      wrap.className = 'chart-bar-wrap';
      wrap.title = `${day}: ${rupiah(amount)}`;
      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      bar.style.height = `${Math.max((amount / max) * 100, 2)}%`;
      const label = document.createElement('span');
      label.className = 'chart-bar-label';
      label.textContent = day;
      wrap.appendChild(bar);
      wrap.appendChild(label);
      chartEl.appendChild(wrap);
    }
  } else {
    chartWrap.hidden = true;
  }

  // Category breakdown
  const catData = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const catWrap = document.getElementById('categoryWrap');
  const catEl = document.getElementById('categoryBars');
  catEl.innerHTML = '';
  if (catData.length > 0) {
    catWrap.hidden = false;
    const max = catData[0][1];
    for (const [category, amount] of catData) {
      const row = document.createElement('div');
      const labelRow = document.createElement('div');
      labelRow.className = 'category-row-label';
      labelRow.innerHTML = `<span>${category}</span><span class="mono">${rupiah(amount)}</span>`;
      const track = document.createElement('div');
      track.className = 'category-track';
      const fill = document.createElement('div');
      fill.className = 'category-fill';
      fill.style.width = `${(amount / max) * 100}%`;
      track.appendChild(fill);
      row.appendChild(labelRow);
      row.appendChild(track);
      catEl.appendChild(row);
    }
  } else {
    catWrap.hidden = true;
  }

  renderLedger(document.getElementById('monthLedger'), monthEntries, true, 'Tidak ada catatan pada bulan ini.');
}

function renderLedger(container, list, showDate, emptyText) {
  container.innerHTML = '';
  if (list.length === 0) {
    const p = document.createElement('div');
    p.className = 'ledger-empty';
    p.textContent = emptyText;
    container.appendChild(p);
    return;
  }
  for (const e of list) {
    const row = document.createElement('div');
    row.className = 'ledger-row';

    const main = document.createElement('div');
    main.className = 'ledger-main';
    main.innerHTML = `<span class="ledger-cat">${e.category}</span>${e.note ? `<span class="ledger-note">· ${e.note}</span>` : ''}` +
      (showDate ? `<span class="ledger-date">${new Date(e.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>` : '');

    const amount = document.createElement('span');
    amount.className = `ledger-amount ${e.type === 'out' ? 'col-out' : 'col-in'}`;
    amount.textContent = `${e.type === 'out' ? '-' : '+'}${rupiah(e.amount)}`;

    const delBtn = document.createElement('button');
    delBtn.className = 'ledger-del';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => handleDelete(e.id));

    row.appendChild(main);
    row.appendChild(amount);
    row.appendChild(delBtn);
    container.appendChild(row);
  }
}

init();
