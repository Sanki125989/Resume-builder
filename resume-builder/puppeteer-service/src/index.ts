import express from 'express';
import { scrapeRecommendedJob, uploadResumeToNaukriAndLogout } from './scrapers/naukri';

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'puppeteer-automation' });
});

/**
 * Login to Naukri → Recommended Jobs → Applies tab → 1st job
 * Returns: { jobDescription, keySkills[] }
 */
app.post('/api/naukri/scrape-job', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'username and password are required' });
        }
        const result = await scrapeRecommendedJob(username, password);
        res.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[/api/naukri/scrape-job]', message);
        res.status(500).json({ error: 'Failed to scrape recommended job', message });
    }
});

/**
 * Upload PDF to Naukri profile section and logout
 * Body: { resumePath: "/absolute/path/to/Sanket_Resume_DD_MM_YYYY.pdf" }
 * Returns: { success: boolean }
 */
app.post('/api/naukri/upload-resume', async (req, res) => {
    try {
        const { resumePath } = req.body;
        if (!resumePath) {
            return res.status(400).json({ error: 'resumePath is required' });
        }
        const success = await uploadResumeToNaukriAndLogout(resumePath);
        res.json({ success });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[/api/naukri/upload-resume]', message);
        res.status(500).json({ error: 'Failed to upload resume', message });
    }
});

app.listen(PORT, () => {
    console.log(`Puppeteer service running on port ${PORT}`);
});
