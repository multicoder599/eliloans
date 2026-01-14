const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// --- 1. MIDDLEWARE ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 2. CONFIGURATION ---
const APP_URL = "https://mloans.onrender.com"; 
const MEGAPAY_API_KEY = "MGPYnUBdYDty"; 

// --- TELEGRAM CONFIG ---
const TELEGRAM_BOT_TOKEN = "8305012784:AAH_kLIiqQ1sJ5vIlYOKHK985j26_kE1ubQ"; // Put your token from BotFather here
const TELEGRAM_CHAT_ID = "8355316248";     // Put your Chat ID from userinfobot here

const transactionMemory = {};

app.get('/', (res) => res.send("🚀 MegaPay Gateway is Online and Ready."));

// --- HELPER: SEND TELEGRAM NOTIFICATION ---
const sendTelegramAlert = async (ref, amount, phone) => {
    const message = `
✅ *NEW PAYMENT CONFIRMED*
━━━━━━━━━━━━━━━
💰 *Amount:* Ksh ${amount}
📞 *Phone:* ${phone}
🆔 *Ref:* ${ref}
⏰ *Time:* ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}
━━━━━━━━━━━━━━━
_Starlink/Loan system processing..._`;

    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: "Markdown"
        });
        console.log("📤 Telegram notification sent.");
    } catch (error) {
        console.error("❌ Telegram Notification Error:", error.message);
    }
};

// --- 3. STK INITIATION ---
app.post('/api/deposit/stk', async (req, res) => {
    try {
        const { phone, amount } = req.body;
        if (!phone || !amount) return res.status(400).json({ error: "Details missing" });

        let formattedPhone = phone.startsWith('0') ? '254' + phone.substring(1) : phone;
        if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.substring(1);

        const uniqueRef = "REF-" + Date.now();

        const payload = {
            api_key: MEGAPAY_API_KEY,
            amount: amount,
            msisdn: formattedPhone,
            email: "kipkoechkim60@gmail.com",
            callback_url: `${APP_URL}/webhook`,
            description: "Processing Fee",
            reference: uniqueRef
        };

        console.log(`📡 Sending STK for ${formattedPhone}...`);
        await axios.post('https://megapay.co.ke/backend/v1/initiatestk', payload, { timeout: 20000 });
        
        res.status(200).json({ status: "Sent", reference: uniqueRef });
    } catch (error) { 
        console.error("❌ STK Failed:", error.message);
        res.status(500).json({ error: "Gateway error" }); 
    }
});

// --- 4. WEBHOOK (CONFIRMATION & TELEGRAM TRIGGER) ---
app.post('/webhook', async (req, res) => {
    res.status(200).send("OK"); 
    
    const data = req.body;
    console.log("📩 Webhook Received:", JSON.stringify(data));

    const isSuccess = data.ResponseCode == 0 || data.ResultCode == 0 || data.status === "success";
    const ref = data.TransactionReference || data.reference || data.Reference || data.BillRefNumber;

    if (isSuccess && ref) {
        // Save to memory so the frontend can see it
        transactionMemory[ref] = { 
            paid: true, 
            amount: data.TransactionAmount || data.amount,
            phone: data.Msisdn || "M-PESA User",
            time: new Date().toISOString()
        };

        console.log(`✅ PAYMENT CONFIRMED: ${ref}`);

        // TRIGGER TELEGRAM ALERT
        await sendTelegramAlert(
            ref, 
            data.TransactionAmount || data.amount || "Check App", 
            data.Msisdn || "Unknown"
        );

        // Auto-delete after 30 mins
        setTimeout(() => { delete transactionMemory[ref]; }, 1800000);
    } else {
        console.log(`⚠️ Payment failed or no reference found.`);
    }
});

// --- 5. STATUS CHECK ---
app.get('/api/payment/status', (req, res) => {
    const { reference } = req.query;
    const payment = transactionMemory[reference];
    
    if (payment && payment.paid) {
        res.json({ paid: true });
    } else {
        res.json({ paid: false });
    }
});

// --- 6. START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server Live on Port ${PORT}`);
});