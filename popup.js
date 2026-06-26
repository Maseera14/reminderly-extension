const SERVER_URL = 'http://localhost:3000/api/reminders';
let currentTab = 'active';

document.addEventListener('DOMContentLoaded', () => {
  fetchReminders();

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

    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type, datetime })
    });

    if (response.ok) {
      document.getElementById('reminder-form').reset();
      fetchReminders();
    }
  });
});

function switchTab(tab, element) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  element.classList.add('active');
  fetchReminders();
}

async function fetchReminders() {
  try {
    const response = await fetch(SERVER_URL);
    const reminders = await response.json();
    
    const listContainer = document.getElementById('reminders-list');
    listContainer.innerHTML = '';

    // Filter based on tab
    const filtered = reminders.filter(r => r.status === (currentTab === 'completed' ? 'Done' : 'Pending'));

    if (filtered.length === 0) {
      listContainer.innerHTML = `<p style="text-align:center; color:#999; font-size:12px;">No ${currentTab} reminders found.</p>`;
      return;
    }

    filtered.forEach(r => {
      const card = document.createElement('div');
      card.className = `card ${currentTab === 'completed' ? 'completed' : ''}`;
      
      const dateStr = new Date(r.datetime).toLocaleString();
      
      card.innerHTML = `
        <div class="card-info">
          <h4>${r.title}</h4>
          <span>${r.type} • ${dateStr}</span>
        </div>
        <div class="card-actions">
          ${currentTab === 'active' ? `<button onclick="deleteReminder('${r.id}')">❌</button>` : ''}
        </div>
      `;
      listContainer.appendChild(card);
    });
  } catch (err) {
    console.error("Backend server error:", err);
  }
}

// Global scope injection for onclick dynamic buttons
window.deleteReminder = async function(id) {
  await fetch(`${SERVER_URL}/${id}`, { method: 'DELETE' });
  fetchReminders();
}