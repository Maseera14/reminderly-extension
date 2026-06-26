# Reminderly 🪸

A premium, responsive Chrome Extension and Web Dashboard designed to schedule, manage, and deliver automated notifications directly to your WhatsApp self-chat.

---

## 🚀 Features

- **🌐 Premium Web Dashboard:** A beautiful dark-mode glassmorphic user interface hosted locally at `http://localhost:3000` to manage your reminders seamlessly.
- **🔌 Chrome Extension Integration:** Click the extension icon to instantly open the Web Dashboard in a new Chrome tab.
- **📲 Live WhatsApp QR Scan:** The WhatsApp connection QR code is rendered directly on the web page. No need to look at terminal logs.
- **💾 Database Persistence:** Reminders are automatically saved to disk (`reminders.json`) to prevent data loss on server restarts.
- **💬 Interactive Self-Chat Commands:** Mark reminders as complete or delete them directly from your phone by replying to your WhatsApp self-chat:
  - `done <4-digit-id>` - Marks task as completed.
  - `delete <4-digit-id>` - Deletes the task from your schedule.
- **⏰ Automatic Triggers:** A background cron job checks every minute and triggers WhatsApp alerts right on time.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, `whatsapp-web.js` (Puppeteer), `node-cron`
- **Frontend:** HTML5, Vanilla CSS (Glassmorphism), JavaScript (ES6+), `qrcode.js` (CDN)
- **Extension:** Chrome Extension Manifest V3 Service Worker

---

## ⚙️ Setup & Installation

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) and [Google Chrome](https://www.google.com/chrome/) installed.

### 2. Clone the Repository
```bash
git clone <your-repository-url>
cd reminderly-extension
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Server
```bash
node server.js
```
The server will start on `http://localhost:3000`.

### 5. Install the Chrome Extension
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** in the top-left.
4. Select the `reminderly-extension` folder.
5. Pin the **Reminderly** extension. Clicking it will now launch the web dashboard!

### 6. Connect WhatsApp & Set Reminders
1. Open `http://localhost:3000` in Chrome (or click the Extension icon).
2. Scan the displayed QR Code with your phone's WhatsApp (Linked Devices).
3. Schedule your first reminder and wait for the magic!
