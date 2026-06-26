const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cron = require('node-cron');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 💽 DATABASE PERSISTENCE SETUP
const fs = require('fs');
const path = require('path');
const REMINDERS_FILE = path.join(__dirname, 'reminders.json');

let reminders = [];
try {
    if (fs.existsSync(REMINDERS_FILE)) {
        reminders = JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf8'));
        console.log(`Loaded ${reminders.length} reminders from file.`);
    }
} catch (err) {
    console.error("Failed to load reminders from file:", err);
}

function saveReminders() {
    try {
        fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
    } catch (err) {
        console.error("Failed to save reminders to file:", err);
    }
}

// 🟢 WHATSAPP CLIENT SETUP & STATE MANAGEMENT
let whatsappState = 'CONNECTING'; // Initial state since initialize() runs immediately
let qrCodeData = null;
let clientInfo = null;

const whatsapp = new Client({
    authStrategy: new LocalAuth(), // Session storage
    puppeteer: { 
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

// Terminal and State management for QR code
whatsapp.on('qr', (qr) => {
    console.log('👇 SCAN THIS QR CODE WITH YOUR WHATSAPP TO LINK REMINDERLY:');
    qrcode.generate(qr, { small: true });
    whatsappState = 'QR_CODE';
    qrCodeData = qr;
});

// WhatsApp client ready
whatsapp.on('ready', () => {
    console.log('✅ WhatsApp Web Client is READY and connected!');
    whatsappState = 'CONNECTED';
    qrCodeData = null;
    clientInfo = {
        pushname: whatsapp.info.pushname,
        wid: whatsapp.info.wid
    };
});

whatsapp.on('authenticated', () => {
    console.log('✅ WhatsApp Authenticated!');
    whatsappState = 'CONNECTED';
});

whatsapp.on('auth_failure', (msg) => {
    console.error('❌ WhatsApp Authentication Failure:', msg);
    whatsappState = 'DISCONNECTED';
    qrCodeData = null;
    clientInfo = null;
});

whatsapp.on('disconnected', async (reason) => {
    console.log('❌ WhatsApp Client disconnected:', reason);
    whatsappState = 'DISCONNECTED';
    qrCodeData = null;
    clientInfo = null;
    
    // Attempt re-initialization
    try {
        console.log('Re-initializing WhatsApp client...');
        whatsappState = 'CONNECTING';
        await whatsapp.initialize();
    } catch (e) {
        console.error("Failed to re-initialize WhatsApp client:", e);
        whatsappState = 'DISCONNECTED';
    }
});

// 🔄 MESSAGE LOOP (listens to all messages including self-messages)
whatsapp.on('message_create', async (msg) => {
    const incomingMsg = msg.body.trim().toLowerCase();
    
    const parts = incomingMsg.split(' ');
    const action = parts[0];
    const id = parts[1];

    if (action === 'done' || action === 'delete') {
        const reminderIndex = reminders.findIndex(r => r.id === id);

        if (reminderIndex !== -1) {
            if (action === 'done') {
                reminders[reminderIndex].status = 'Done';
                await msg.reply(`✅ Task "${reminders[reminderIndex].title}" has been marked as COMPLETED!`);
                saveReminders();
            } else if (action === 'delete') {
                await msg.reply(`❌ Task "${reminders[reminderIndex].title}" has been DELETED successfully.`);
                reminders = reminders.filter(r => r.id !== id);
                saveReminders();
            }
        } else {
            // Only reply if it was a user instruction (avoiding self-reply loops if bot sends something)
            // But we reply to make sure they know they entered an invalid ID
            if (msg.fromMe) {
                // If it's a self-message, send a reply to themselves
                await whatsapp.sendMessage(msg.to, "⚠️ Invalid ID or Task not found.");
            } else {
                await msg.reply("⚠️ Invalid ID or Task not found.");
            }
        }
    }
});

// Initialize WhatsApp
whatsapp.initialize();


// 🌐 EXPRESS API ENDPOINTS & STATIC SHARING
app.use(express.static('public'));

app.get('/api/whatsapp/status', (req, res) => {
    res.json({
        state: whatsappState,
        qr: qrCodeData,
        info: clientInfo
    });
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
    try {
        console.log("Request to disconnect WhatsApp received.");
        if (whatsappState === 'CONNECTED' || whatsappState === 'QR_CODE') {
            await whatsapp.logout();
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Failed to disconnect WhatsApp:", err);
        whatsappState = 'DISCONNECTED';
        qrCodeData = null;
        clientInfo = null;
        res.status(500).json({ error: "Failed to disconnect WhatsApp", details: err.message });
    }
});

app.get('/api/reminders', (req, res) => {
    res.json(reminders);
});

app.post('/api/reminders', (req, res) => {
    const { title, type, datetime } = req.body;
    const newReminder = {
        id: Math.floor(1000 + Math.random() * 9000).toString(), // Short 4-digit ID for easy typing on phone
        title,
        type,
        datetime,
        status: 'Pending',
        notified: false
    };
    reminders.push(newReminder);
    saveReminders();
    res.status(201).json(newReminder);
});

app.delete('/api/reminders/:id', (req, res) => {
    reminders = reminders.filter(r => r.id !== req.params.id);
    saveReminders();
    res.json({ success: true });
});

app.put('/api/reminders/:id/complete', (req, res) => {
    const reminderIndex = reminders.findIndex(r => r.id === req.params.id);
    if (reminderIndex !== -1) {
        reminders[reminderIndex].status = 'Done';
        saveReminders();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Reminder not found" });
    }
});


// ⏱️ CRON JOB (Checks every minute)
cron.schedule('* * * * *', () => {
    const now = new Date();
    let updated = false;
    
    reminders.forEach(async (r) => {
        const reminderTime = new Date(r.datetime);
        
        if (reminderTime <= now && !r.notified && r.status === 'Pending') {
            r.notified = true;
            updated = true;
            
            const msgBody = `🔔 *Reminderly Alert!*\n\n*What:* ${r.title}\n*Type:* ${r.type}\n\n👉 Reply *done ${r.id}* to complete.\n👉 Reply *delete ${r.id}* to remove.`;
            
            try {
                // Yeh aapko aapke hi number par (Self-message) notification bhej dega
                const info = whatsapp.info;
                await whatsapp.sendMessage(info.wid._serialized, msgBody);
                console.log(`Notification sent for: ${r.title}`);
                saveReminders();
            } catch (err) {
                console.error("Failed to send WhatsApp message:", err);
            }
        }
    });
});

app.listen(3000, () => console.log('🚀 Reminderly Server running on port 3000'));