"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeBrowser = void 0;
const express_1 = __importDefault(require("express"));
const naukri_1 = require("./scrapers/naukri");
const linkedin_1 = require("./scrapers/linkedin");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use(express_1.default.json());
let activeBrowser = null;
exports.activeBrowser = activeBrowser;
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'puppeteer-automation' });
});
// Login endpoint
app.post('/api/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { portal, username, password } = req.body;
        let success = false;
        if (portal === 'naukri') {
            success = yield (0, naukri_1.loginNaukri)(username, password);
        }
        else if (portal === 'linkedin') {
            success = yield (0, linkedin_1.loginLinkedIn)(username, password);
        }
        else {
            return res.status(400).json({ error: 'Invalid portal' });
        }
        res.json({ success, portal });
    }
    catch (error) {
        console.error('Login error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Login failed', message });
    }
}));
// Extract job description
app.post('/api/extract-job', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { jobUrl, portal } = req.body;
        let description = '';
        if (portal === 'naukri') {
            description = yield (0, naukri_1.extractNaukriJobDescription)(jobUrl);
        }
        else if (portal === 'linkedin') {
            description = yield (0, linkedin_1.extractLinkedInJobDescription)(jobUrl);
        }
        else {
            return res.status(400).json({ error: 'Invalid portal' });
        }
        res.json({ description, jobUrl });
    }
    catch (error) {
        console.error('Extract job error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to extract job description', message });
    }
}));
// Fetch jobs
app.get('/api/fetch-jobs', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const portal = req.query.portal;
        const limit = parseInt(req.query.limit) || 10;
        let jobs = [];
        if (portal === 'naukri') {
            jobs = yield (0, naukri_1.fetchNaukriJobs)(limit);
        }
        else if (portal === 'linkedin') {
            jobs = yield (0, linkedin_1.fetchLinkedInJobs)(limit);
        }
        else {
            return res.status(400).json({ error: 'Invalid portal' });
        }
        res.json({ jobs, count: jobs.length, portal });
    }
    catch (error) {
        console.error('Fetch jobs error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to fetch jobs', message });
    }
}));
// Apply to job
app.post('/api/apply', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { portal, jobUrl, resumePath } = req.body;
        let success = false;
        if (portal === 'naukri') {
            success = yield (0, naukri_1.applyNaukriJob)(jobUrl, resumePath);
        }
        else if (portal === 'linkedin') {
            success = yield (0, linkedin_1.applyLinkedInJob)(jobUrl, resumePath);
        }
        else {
            return res.status(400).json({ error: 'Invalid portal' });
        }
        res.json({ success, jobUrl, portal });
    }
    catch (error) {
        console.error('Apply job error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to apply to job', message });
    }
}));
app.listen(PORT, () => {
    console.log(`Puppeteer service running on port ${PORT}`);
});
