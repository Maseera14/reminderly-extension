const API_BASE = window.location.origin;
const REMINDERS_URL = `${API_BASE}/api/reminders`;
const WA_STATUS_URL = `${API_BASE}/api/whatsapp/status`;
const WA_DISCONNECT_URL = `${API_BASE}/api/whatsapp/disconnect`;

let currentTab = 'active';
let lastQrData = null;
let qrCodeInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  // Initial Fetches
  fetchReminders();
  startStatusPolling();

  // View switching navigation
  document.getElementById('btn-show-form').addEventListener('click', () => showView('form'));
  document.getElementById('btn-show-list').addEventListener('click', () => showView('list'));

  // Tab switching logic
  document.getElementById('tab-active').addEventListener('click', (e) => {
    switchTab('active', e.target);
  });
  document.getElementById('tab-completed').addEventListener('click', (e) => {
    switchTab('completed', e.target);
  });

  // Form submission
  document.getElementById('reminder-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('title').value;
    const type = document.getElementById('type').value;
    const datetime = document.getElementById('datetime').value;

    const response = await fetch(REMINDERS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type, datetime })
    });

    if (response.ok) {
      document.getElementById('reminder-form').reset();
      showView('list'); // Automatically transition back to reminders list
      fetchReminders();
    }
  });

  // WhatsApp Button listeners
  document.getElementById('btn-disconnect-wa').addEventListener('click', disconnectWhatsApp);
  document.getElementById('btn-initialize-wa').addEventListener('click', reconnectWhatsApp);
});

function showView(viewName) {
  const listView = document.getElementById('view-list');
  const formView = document.getElementById('view-form');
  if (viewName === 'form') {
    listView.classList.add('hidden');
    formView.classList.remove('hidden');
  } else {
    formView.classList.add('hidden');
    listView.classList.remove('hidden');
  }
}

function switchTab(tab, element) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  element.classList.add('active');
  fetchReminders();
}

async function fetchReminders() {
  try {
    const response = await fetch(REMINDERS_URL);
    const reminders = await response.json();
    
    const listContainer = document.getElementById('reminders-list');
    listContainer.innerHTML = '';

    // Filter based on tab
    const filtered = reminders.filter(r => r.status === (currentTab === 'completed' ? 'Done' : 'Pending'));

    if (filtered.length === 0) {
      const tabLabel = currentTab === 'active' ? 'upcoming' : 'completed';
      listContainer.innerHTML = `
        <div style="text-align:center; padding: 40px 20px; color: var(--text-muted);">
          <p style="font-size: 14px;">No ${tabLabel} reminders found.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(r => {
      const card = document.createElement('div');
      card.className = `reminder-card ${currentTab === 'completed' ? 'completed' : ''}`;
      
      const dateStr = new Date(r.datetime).toLocaleString();
      
      card.innerHTML = `
        <div class="card-details">
          <h4>${r.title}</h4>
          <div class="card-meta">
            <span class="badge-type">${getTypeEmoji(r.type)} ${r.type}</span>
            <span>⏱️ ${dateStr}</span>
          </div>
        </div>
        <div class="card-actions">
          ${currentTab === 'active' ? `
            <button class="complete-btn" onclick="completeReminder('${r.id}')" title="Mark as Completed">✔️</button>
            <button class="delete-btn" onclick="deleteReminder('${r.id}')" title="Delete Reminder">❌</button>
          ` : ''}
        </div>
      `;
      listContainer.appendChild(card);
    });
  } catch (err) {
    console.error("Backend server error fetching reminders:", err);
  }
}

function getTypeEmoji(type) {
  switch (type) {
    case 'Birthday': return '🎂';
    case 'Meeting': return '💼';
    case 'Event': return '🎉';
    default: return '🔔';
  }
}

// Global scope delete helper
window.deleteReminder = async function(id) {
  await fetch(`${REMINDERS_URL}/${id}`, { method: 'DELETE' });
  fetchReminders();
};

window.completeReminder = async function(id) {
  await fetch(`${REMINDERS_URL}/${id}/complete`, { method: 'PUT' });
  fetchReminders();
};

/* -------------------------------------------------------------
 * WHATSAPP CLIENT STATUS POLLING & LOGIC
 * ------------------------------------------------------------- */
function startStatusPolling() {
  // Poll immediately and then every 2.5 seconds
  pollStatus();
  setInterval(pollStatus, 2500);
}

async function pollStatus() {
  try {
    const response = await fetch(WA_STATUS_URL);
    const data = await response.json();
    
    updateWAUI(data.state, data.qr, data.info);
  } catch (err) {
    console.error("Error polling WhatsApp status:", err);
    updateGlobalStatus('disconnected', 'Server Offline');
  }
}

function updateWAUI(state, qr, info) {
  const loadingView = document.getElementById('state-loading');
  const disconnectedView = document.getElementById('state-disconnected');
  const qrView = document.getElementById('state-qr');
  const connectedView = document.getElementById('state-connected-view');
  
  // Hide all state views by default
  const views = [loadingView, disconnectedView, qrView, connectedView];
  views.forEach(v => v.classList.add('hidden'));

  // Update Global Header Status & View Panel
  if (state === 'CONNECTING') {
    updateGlobalStatus('connecting', 'Connecting...');
    loadingView.classList.remove('hidden');
    lastQrData = null; // Clear QR cache
  } 
  else if (state === 'DISCONNECTED') {
    updateGlobalStatus('disconnected', 'WhatsApp Offline');
    disconnectedView.classList.remove('hidden');
    lastQrData = null; // Clear QR cache
  } 
  else if (state === 'QR_CODE') {
    updateGlobalStatus('connecting', 'Waiting for scan...');
    qrView.classList.remove('hidden');
    
    if (qr && qr !== lastQrData) {
      lastQrData = qr;
      renderQRCode(qr);
    }
  } 
  else if (state === 'CONNECTED') {
    updateGlobalStatus('connected', 'WhatsApp Active');
    connectedView.classList.remove('hidden');
    lastQrData = null;
    
    if (info) {
      document.getElementById('wa-pushname').textContent = info.pushname || 'Connected User';
      document.getElementById('wa-phone').textContent = info.wid ? `+${info.wid.user}` : 'WhatsApp Active';
    }
  }
}

function updateGlobalStatus(className, text) {
  const pill = document.getElementById('global-status');
  const statusText = document.getElementById('global-status-text');
  
  pill.className = `status-pill status-${className}`;
  statusText.textContent = text;
}

function renderQRCode(qrText) {
  const container = document.getElementById('qrcode');
  container.innerHTML = ''; // Clear previous QR
  
  qrCodeInstance = new QRCode(container, {
    text: qrText,
    width: 200,
    height: 200,
    colorDark : "#0f172a",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.H
  });
}

async function disconnectWhatsApp() {
  const btn = document.getElementById('btn-disconnect-wa');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Disconnecting...';
  
  try {
    await fetch(WA_DISCONNECT_URL, { method: 'POST' });
  } catch (err) {
    console.error("Error disconnecting WhatsApp:", err);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function reconnectWhatsApp() {
  const btn = document.getElementById('btn-initialize-wa');
  btn.disabled = true;
  btn.textContent = 'Connecting...';
  
  try {
    // Triggers disconnect check or initializes client
    await fetch(WA_DISCONNECT_URL, { method: 'POST' });
  } catch (err) {
    console.error("Error triggering reconnection:", err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Connect WhatsApp';
  }
}
