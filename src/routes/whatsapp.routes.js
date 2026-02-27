import express from 'express';
import whatsappService from '../services/whatsapp.service.js';

const router = express.Router();

router.get('/qr', (req, res) => {
  const qr = whatsappService.getQRCode();
  if (!qr) return res.send('<h1>Bereits verbunden oder Initialisierung...</h1>');
  res.send(`<html><body style="display:flex;justify-content:center;align-items:center;height:100vh"><img src="${qr}"></body></html>`);
});

router.get('/status', async (req, res) => {
    const status = await whatsappService.getStatus();
    console.log(`📊 WhatsApp Status API called: ${status.connected ? 'ONLINE' : 'OFFLINE'}`);
    res.json(status);
});

router.post('/start-pairing', async (req, res) => {
    try {
        const status = await whatsappService.startPairing();
        res.json({ success: true, status });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/stop-pairing', async (req, res) => {
    try {
        const status = await whatsappService.stopPairing();
        res.json({ success: true, status });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/groups', async (req, res) => {
    try {
        const groups = await whatsappService.getGroups();
        res.json({ success: true, groups });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/known-numbers', async (req, res) => {
    try {
        const numbers = await whatsappService.getKnownNumbers();
        res.json({ success: true, numbers });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/send-message', async (req, res) => {
  try {
    const { number, message } = req.body;
    const result = await whatsappService.sendMessage(number, message);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/logout', async (req, res) => {

  await whatsappService.logout();

  res.json({ success: true });

});



router.get('/debug-network', async (req, res) => {

    try {

        await whatsappService.checkOutboundConnectivity();

        res.json({ success: true, message: "Diagnose gestartet. Prüfe die System-Logs im Admin-Bereich." });

    } catch (e) {

        res.status(500).json({ success: false, error: e.message });

    }

});



export default router;
