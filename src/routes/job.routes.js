import express from 'express';
import { ScheduledJob, JobLog } from '../services/db.service.js';
import { initScheduler } from '../services/worker.service.js';
import { isAdmin } from '../services/auth.service.js';

const router = express.Router();

// Alle Job-Routen sind nur für Admins zugänglich
router.use(isAdmin);

router.get('/', async (req, res) => {
    try {
        const jobs = await ScheduledJob.find().sort({ createdAt: -1 });
        res.json(jobs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
    try {
        const job = new ScheduledJob(req.body);
        await job.save();
        initScheduler(); 
        res.json({ success: true, job });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
    try {
        await ScheduledJob.findByIdAndUpdate(req.params.id, req.body);
        initScheduler(); 
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await ScheduledJob.findByIdAndDelete(req.params.id);
        initScheduler(); 
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/logs/recent', async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const logs = await JobLog.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await JobLog.countDocuments();
        
        res.json({
            logs,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/run', async (req, res) => {
    try {
        const { triggerJobManually } = await import('../services/worker.service.js');
        await triggerJobManually(req.params.id);
        res.json({ success: true, message: 'Job manuell gestartet.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/run-debug', async (req, res) => {
    try {
        const debugTarget = req.body?.targetJid || req.body?.number;
        if (!debugTarget) return res.status(400).json({ error: 'Bitte eine Debug-Zielnummer/Zielgruppe angeben.' });
        const { triggerJobManually } = await import('../services/worker.service.js');
        await triggerJobManually(req.params.id, { overrideTargetJid: debugTarget });
        res.json({ success: true, message: `Debug-Lauf an ${debugTarget} gestartet.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
