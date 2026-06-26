const API_BASE = window.location.origin;
const REMINDERS_URL  = `${API_BASE}/api/reminders`;
const WA_STATUS_URL  = `${API_BASE}/api/whatsapp/status`;
const WA_DISC_URL    = `${API_BASE}/api/whatsapp/disconnect`;

let currentTab    = 'active';
let lastQrData    = null;
let qrCodeInst    = null;

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  fetchReminders();
  startPolling();

  // View navigation
  document.getElementById('btn-show-form').addEventListener('click', ()  => showView('form'));
  document.getElementById('btn-show-list').addEventListener('click', ()  => showView('list'));
  document.getElementById('btn-cancel-form').addEventListener('click', () => showView('list'));

  // Tabs
  document.getElementById('tab-active').addEventListener('click',    e => switchTab('active',    e.currentTarget));
  document.getElementById('tab-completed').addEventListener('click', e => switchTab('completed', e.currentTarget));

  // Form submit
  document.getElementById('reminder-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Setting…';

    const res = await fetch(REMINDERS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:    document.getElementById('title').value,
        type:     document.getElementById('type').value,
        datetime: document.getElementById('datetime').value
      })
    });

    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Set Reminder`;

    if (res.ok) {
      e.target.reset();
      showView('list');
      fetchReminders();
    }
  });

  // WhatsApp buttons
  document.getElementById('btn-disconnect-wa').addEventListener('click', disconnectWA);
  document.getElementById('btn-initialize-wa').addEventListener('click', reconnectWA);
});

/* ============================================================
   VIEW SWITCHING
   ============================================================ */
function showView(v) {
  const listEl    = document.getElementById('view-list');
  const formEl    = document.getElementById('view-form');
  const addBtn    = document.getElementById('btn-show-form');
  const backBtn   = document.getElementById('btn-show-list');
  const pageTitle = document.getElementById('page-title');
  const pageSub   = document.getElementById('page-sub');

  if (v === 'form') {
    listEl.classList.add('hidden');
    formEl.classList.remove('hidden');
    addBtn.classList.add('hidden');
    backBtn.classList.remove('hidden');
    pageTitle.textContent = 'New Reminder';
    pageSub.textContent   = 'Fill in the details below';
  } else {
    formEl.classList.add('hidden');
    listEl.classList.remove('hidden');
    backBtn.classList.add('hidden');
    addBtn.classList.remove('hidden');
    pageTitle.textContent = 'Your Reminders';
    pageSub.textContent   = 'All your upcoming scheduled alerts';
    fetchReminders();
  }
}

/* ============================================================
   TABS
   ============================================================ */
function switchTab(tab, el) {
  currentTab = tab;
  document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  fetchReminders();
}

/* ============================================================
   REMINDERS
   ============================================================ */
async function fetchReminders() {
  try {
    const res      = await fetch(REMINDERS_URL);
    const all      = await res.json();
    const filtered = all.filter(r => r.status === (currentTab === 'completed' ? 'Done' : 'Pending'));
    renderReminders(filtered);
  } catch (err) {
    console.error('Error fetching reminders:', err);
  }
}

function renderReminders(list) {
  const grid = document.getElementById('reminders-list');
  grid.innerHTML = '';

  if (list.length === 0) {
    const label = currentTab === 'active' ? 'upcoming' : 'completed';
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${currentTab === 'active' ? '📭' : '✅'}</div>
        <h4>No ${label} reminders</h4>
        <p>${currentTab === 'active' ? 'Click "+ Add Reminder" to schedule your first alert.' : 'Completed reminders will appear here.'}</p>
      </div>`;
    return;
  }

  list.forEach((r, i) => {
    const card = document.createElement('div');
    card.className = `reminder-card${currentTab === 'completed' ? ' completed' : ''}`;
    card.style.animationDelay = `${i * 0.05}s`;

    const dateStr = new Date(r.datetime).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const emoji = { Birthday: '🎂', Meeting: '💼', Event: '🎉', Alert: '🔔' }[r.type] || '🔔';

    card.innerHTML = `
      <div class="card-top">
        <span class="type-badge">${emoji} ${r.type}</span>
        <span class="card-date">⏱ ${dateStr}</span>
      </div>
      <div class="card-title">${r.title}</div>
      ${currentTab === 'active' ? `
        <div class="card-actions">
          <button class="card-btn complete" onclick="completeReminder('${r.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            Mark Done
          </button>
          <button class="card-btn delete" onclick="deleteReminder('${r.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Remove
          </button>
        </div>` : ''}
    `;
    grid.appendChild(card);
  });
}

window.completeReminder = async id => {
  await fetch(`${REMINDERS_URL}/${id}/complete`, { method: 'PUT' });
  fetchReminders();
};
window.deleteReminder = async id => {
  await fetch(`${REMINDERS_URL}/${id}`, { method: 'DELETE' });
  fetchReminders();
};

/* ============================================================
   WHATSAPP STATUS POLLING
   ============================================================ */
function startPolling() {
  poll();
  setInterval(poll, 2500);
}

async function poll() {
  try {
    const res  = await fetch(WA_STATUS_URL);
    const data = await res.json();
    updateWAUI(data.state, data.qr, data.info);
  } catch {
    setChip('disconnected', 'Server Offline');
  }
}

function updateWAUI(state, qr, info) {
  const $ = id => document.getElementById(id);

  ['state-loading','state-qr','state-disconnected','state-connected-view']
    .forEach(id => $(id).classList.add('hidden'));

  if (state === 'CONNECTING') {
    $('state-loading').classList.remove('hidden');
    setChip('connecting', 'Connecting…');
  } else if (state === 'QR_CODE') {
    $('state-qr').classList.remove('hidden');
    setChip('connecting', 'Scan QR Code');
    if (qr && qr !== lastQrData) {
      lastQrData = qr;
      const wrap = $('qrcode');
      wrap.innerHTML = '';
      qrCodeInst = new QRCode(wrap, { text: qr, width: 170, height: 170, colorDark: '#0f1428', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
    }
  } else if (state === 'DISCONNECTED') {
    $('state-disconnected').classList.remove('hidden');
    setChip('disconnected', 'WhatsApp Offline');
    lastQrData = null;
  } else if (state === 'CONNECTED') {
    $('state-connected-view').classList.remove('hidden');
    setChip('connected', 'WhatsApp Active');
    lastQrData = null;
    if (info) {
      $('wa-pushname').textContent = info.pushname || 'Connected';
      $('wa-phone').textContent    = info.wid ? `+${info.wid.user}` : 'WhatsApp Active';
    }
  }
}

function setChip(cls, txt) {
  const chip = document.getElementById('global-status');
  chip.className = `status-chip ${cls}`;
  document.getElementById('global-status-text').textContent = txt;
}

async function disconnectWA() {
  const btn = document.getElementById('btn-disconnect-wa');
  btn.disabled = true; btn.textContent = 'Disconnecting…';
  try { await fetch(WA_DISC_URL, { method: 'POST' }); } catch {}
  btn.disabled = false; btn.textContent = 'Disconnect';
}

async function reconnectWA() {
  const btn = document.getElementById('btn-initialize-wa');
  btn.disabled = true; btn.textContent = 'Connecting…';
  try { await fetch(WA_DISC_URL, { method: 'POST' }); } catch {}
  btn.disabled = false; btn.textContent = 'Connect';
}
