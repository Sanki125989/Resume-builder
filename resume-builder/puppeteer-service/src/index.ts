import express from 'express';
import puppeteer from 'puppeteer';
import { scrapeRecommendedJob, uploadResumeToNaukriAndLogout } from './scrapers/naukri';
import { automateLinkedInEasyApply } from './scrapers/linkedin';

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

/**
 * Compile HTML content to a PDF file using Puppeteer
 * Body: { html: "...", outputPath: "..." }
 * Returns: { success: boolean, outputPath: "..." }
 */
app.post('/api/naukri/html-to-pdf', async (req, res) => {
    let pdfBrowser = null;
    try {
        const { html, outputPath } = req.body;
        if (!html || !outputPath) {
            return res.status(400).json({ error: 'html and outputPath are required' });
        }

        console.log('[/api/naukri/html-to-pdf] Launching browser to print PDF...');
        pdfBrowser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const pdfPage = await pdfBrowser.newPage();
        await pdfPage.setContent(html, { waitUntil: 'domcontentloaded' });

        await pdfPage.pdf({
            path: outputPath,
            format: 'letter',
            margin: {
                top: '0.6in',
                bottom: '0.6in',
                left: '0.6in',
                right: '0.6in'
            },
            printBackground: true
        });

        console.log('[/api/naukri/html-to-pdf] PDF generated successfully at:', outputPath);
        res.json({ success: true, outputPath });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[/api/naukri/html-to-pdf] error:', message);
        res.status(500).json({ error: 'Failed to generate PDF from HTML', message });
    } finally {
        if (pdfBrowser) {
            await pdfBrowser.close().catch(() => {});
        }
    }
});

/**
 * Automate LinkedIn Easy Apply applications
 * Body: { username, password, resumePath, limit }
 * Returns: { success: boolean, results: [...] }
 */
app.post('/api/linkedin/easy-apply', async (req, res) => {
    try {
        const { username, password, resumePath, limit } = req.body;
        if (!username || !password || !resumePath) {
            return res.status(400).json({ error: 'username, password, and resumePath are required' });
        }
        console.log('[/api/linkedin/easy-apply] Initiating Easy Apply application automation...');
        const results = await automateLinkedInEasyApply(username, password, resumePath, limit || 5);
        res.json({ success: true, results });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[/api/linkedin/easy-apply] error:', message);
        res.status(500).json({ error: 'LinkedIn Easy Apply automation failed', message });
    }
});

app.listen(PORT, () => {
    console.log(`Puppeteer service running on port ${PORT}`);
});
