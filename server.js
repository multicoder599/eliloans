const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// --- 1. MIDDLEWARE ---
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 2. NEW ACCOUNT CONFIGURATION ---
const APP_URL = "https://mloans.onrender.com"; 
const MEGAPAY_API_KEY = "MGPYzVWZq4SG"; // <--- PUT NEW KEY HERE

// Temporary memory (resets if server restarts)
const transactionMemory = {};

app.get('/', (req, res) => res.send("MegaPay Gateway: Online"));

// --- 3. STK INITIATION ---
app.post('/api/deposit/stk', async (req, res) => {
    const { phone, amount } = req.body;
    let formattedPhone = phone.startsWith('0') ? '254' + phone.substring(1) : phone;
    const uniqueRef = "LOAN-" + Date.now();

    const payload = {
        api_key: MGPYzVWZq4SG,
        amount: amount,
        msisdn: formattedPhone,
        email: "newtonmulti@gmail.com",
        callback_url: `${APP_URL}/webhook`,
        description: "Loan Fee",
        reference: uniqueRef
    };

    try {
        console.log(`🚀 Requesting STK for ${formattedPhone} (New Account)`);
        await axios.post('https://megapay.co.ke/backend/v1/initiatestk', payload);
        res.status(200).json({ status: "Sent", reference: uniqueRef });
    } catch (error) { 
        console.error("STK Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Gateway error" }); 
    }
});

// --- 4. WEBHOOK (The "Listener") ---
app.post('/webhook', (req, res) => {
    res.status(200).send("OK"); // Tell MegaPay we got it
    const data = req.body;
    console.log("📩 Webhook Data:", JSON.stringify(data));

    // MegaPay sends ResultCode 0 for success
    const isSuccess = data.ResultCode == 0 || data.ResponseCode == 0 || data.status === "success";
    const ref = data.reference || data.Reference;

    if (isSuccess && ref) {
        transactionMemory[ref] = { paid: true, amount: data.amount || data.TransactionAmount };
        console.log(`✅ Payment verified for Ref: ${ref}`);
    }
});

// --- 5. POLLING STATUS ---
app.get('/api/payment/status', (req, res) => {
    const { reference } = req.query;
    const payment = transactionMemory[reference];
    res.json({ paid: !!(payment && payment.paid) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server active on port ${PORT}`));