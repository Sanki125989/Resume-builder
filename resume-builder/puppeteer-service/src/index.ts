import express from 'express';
import { loginNaukri, fetchNaukriJobs, extractNaukriJobDescription, applyNaukriJob } from './scrapers/naukri';
import { loginLinkedIn, fetchLinkedInJobs, extractLinkedInJobDescription, applyLinkedInJob } from './scrapers/linkedin';
import { Browser } from 'puppeteer';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

let activeBrowser: Browser | null = null;

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'puppeteer-automation' });
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { portal, username, password } = req.body;
        let success = false;

        if (portal === 'naukri') {
            success = await loginNaukri(username, password);
        } else if (portal === 'linkedin') {
            success = await loginLinkedIn(username, password);
        } else {
            return res.status(400).json({ error: 'Invalid portal' });
        }

        res.json({ success, portal });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed', message: error.message });
    }
});

// Extract job description
app.post('/api/extract-job', async (req, res) => {
    try {
        const { jobUrl, portal } = req.body;
        let description = '';

        if (portal === 'naukri') {
            description = await extractNaukriJobDescription(jobUrl);
        } else if (portal === 'linkedin') {
            description = await extractLinkedInJobDescription(jobUrl);
        } else {
            return res.status(400).json({ error: 'Invalid portal' });
        }

        res.json({ description, jobUrl });
    } catch (error) {
        console.error('Extract job error:', error);
        res.status(500).json({ error: 'Failed to extract job description', message: error.message });
    }
});

// Fetch jobs
app.get('/api/fetch-jobs', async (req, res) => {
    try {
        const portal = req.query.portal as string;
        const limit = parseInt(req.query.limit as string) || 10;
        let jobs: any[] = [];

        if (portal === 'naukri') {
            jobs = await fetchNaukriJobs(limit);
        } else if (portal === 'linkedin') {
            jobs = await fetchLinkedInJobs(limit);
        } else {
            return res.status(400).json({ error: 'Invalid portal' });
        }

        res.json({ jobs, count: jobs.length, portal });
    } catch (error) {
        console.error('Fetch jobs error:', error);
        res.status(500).json({ error: 'Failed to fetch jobs', message: error.message });
    }
});

// Apply to job
app.post('/api/apply', async (req, res) => {
    try {
        const { portal, jobUrl, resumePath } = req.body;
        let success = false;

        if (portal === 'naukri') {
            success = await applyNaukriJob(jobUrl, resumePath);
        } else if (portal === 'linkedin') {
            success = await applyLinkedInJob(jobUrl, resumePath);
        } else {
            return res.status(400).json({ error: 'Invalid portal' });
        }

        res.json({ success, jobUrl, portal });
    } catch (error) {
        console.error('Apply job error:', error);
        res.status(500).json({ error: 'Failed to apply to job', message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Puppeteer service running on port ${PORT}`);
});

export { activeBrowser };
