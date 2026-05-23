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
exports.loginNaukri = loginNaukri;
exports.fetchNaukriJobs = fetchNaukriJobs;
exports.extractNaukriJobDescription = extractNaukriJobDescription;
exports.applyNaukriJob = applyNaukriJob;
exports.closeBrowser = closeBrowser;
const puppeteer_1 = __importDefault(require("puppeteer"));
let browser = null;
let page = null;
let isInitializing = false;
const NAUKRI_LOGIN_URL = 'https://www.naukri.com/nlogin/login';
const NAUKRI_JOBS_URL = 'https://www.naukri.com/';
function initBrowser() {
    return __awaiter(this, void 0, void 0, function* () {
        // If already initializing, wait for it to complete
        while (isInitializing) {
            yield new Promise(resolve => setTimeout(resolve, 100));
        }
        try {
            // Close and recreate if browser is disconnected
            if (browser && !browser.isConnected()) {
                console.log('Browser disconnected, recreating...');
                yield closeBrowser();
            }
            if (!browser) {
                isInitializing = true;
                console.log('Launching new browser instance...');
                browser = yield puppeteer_1.default.launch({
                    headless: false,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--window-size=1920,1080'
                    ],
                    defaultViewport: {
                        width: 1920,
                        height: 1080
                    }
                });
                isInitializing = false;
                console.log('Browser launched successfully');
            }
            if (!page || page.isClosed()) {
                console.log('Creating new page...');
                page = yield browser.newPage();
                yield page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
            }
            return { browser, page };
        }
        catch (error) {
            isInitializing = false;
            throw error;
        }
    });
}
function loginNaukri(username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        let loginPage = null;
        try {
            const { browser } = yield initBrowser();
            // Create a fresh page for login
            loginPage = yield browser.newPage();
            yield loginPage.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
            console.log('Navigating to Naukri login page...');
            yield loginPage.goto(NAUKRI_LOGIN_URL, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            console.log('Waiting for login form...');
            yield loginPage.waitForSelector('#usernameField', { timeout: 10000 });
            yield new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
            // Enter credentials
            console.log('Entering credentials...');
            yield loginPage.type('#usernameField', username, { delay: 50 + Math.random() * 50 });
            yield new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
            yield loginPage.type('#passwordField', password, { delay: 50 + Math.random() * 50 });
            yield new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
            // Click login button
            console.log('Clicking login button...');
            yield Promise.all([
                loginPage.click('button[type="submit"]'),
                loginPage.waitForNavigation({
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                }).catch(err => {
                    console.log('Navigation timeout (this might be ok if already logged in):', err.message);
                })
            ]);
            yield new Promise(resolve => setTimeout(resolve, 3000));
            // Check if login was successful
            const url = loginPage.url();
            const isLoggedIn = !url.includes('login') && !url.includes('error');
            if (isLoggedIn) {
                console.log('Naukri login: SUCCESS');
                if (page && !page.isClosed()) {
                    yield page.close();
                }
                page = loginPage;
                loginPage = null;
            }
            else {
                console.log('Naukri login: FAILED');
            }
            return isLoggedIn;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Naukri login error:', message);
            return false;
        }
        finally {
            if (loginPage && !loginPage.isClosed()) {
                yield loginPage.close().catch(() => { });
            }
        }
    });
}
function fetchNaukriJobs() {
    return __awaiter(this, arguments, void 0, function* (limit = 10) {
        try {
            const { page } = yield initBrowser();
            if (!page || page.isClosed()) {
                throw new Error('Page is not available');
            }
            console.log('Fetching Naukri jobs...');
            yield page.goto('https://www.naukri.com/software-engineer-jobs', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            yield new Promise(resolve => setTimeout(resolve, 3000));
            const jobs = yield page.evaluate((maxJobs) => {
                var _a, _b, _c;
                const jobElements = document.querySelectorAll('.jobTuple, .srp-jobtuple-wrapper');
                const jobList = [];
                for (let i = 0; i < Math.min(jobElements.length, maxJobs); i++) {
                    const job = jobElements[i];
                    const titleElem = job.querySelector('.title, .jobTuple-title');
                    const companyElem = job.querySelector('.companyInfo, .jobTuple-companyName');
                    const locationElem = job.querySelector('.locWdth, .jobTuple-location');
                    const linkElem = job.querySelector('a.title, a.jobTuple-title');
                    jobList.push({
                        title: ((_a = titleElem === null || titleElem === void 0 ? void 0 : titleElem.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '',
                        company: ((_b = companyElem === null || companyElem === void 0 ? void 0 : companyElem.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || '',
                        location: ((_c = locationElem === null || locationElem === void 0 ? void 0 : locationElem.textContent) === null || _c === void 0 ? void 0 : _c.trim()) || '',
                        url: (linkElem === null || linkElem === void 0 ? void 0 : linkElem.getAttribute('href')) || ''
                    });
                }
                return jobList;
            }, limit);
            console.log(`Fetched ${jobs.length} jobs from Naukri`);
            return jobs;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error fetching Naukri jobs:', message);
            return [];
        }
    });
}
function extractNaukriJobDescription(jobUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { page } = yield initBrowser();
            if (!page || page.isClosed()) {
                throw new Error('Page is not available');
            }
            console.log('Extracting job description from:', jobUrl);
            yield page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            yield new Promise(resolve => setTimeout(resolve, 2000));
            const description = yield page.evaluate(() => {
                var _a;
                const descElem = document.querySelector('.job-description') ||
                    document.querySelector('.jd-desc') ||
                    document.querySelector('.description');
                return ((_a = descElem === null || descElem === void 0 ? void 0 : descElem.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
            });
            console.log('Extracted description length:', description.length);
            return description;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error extracting Naukri job description:', message);
            return '';
        }
    });
}
function applyNaukriJob(jobUrl, resumePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { page } = yield initBrowser();
            if (!page || page.isClosed()) {
                throw new Error('Page is not available');
            }
            console.log('Applying to Naukri job:', jobUrl);
            yield page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            yield new Promise(resolve => setTimeout(resolve, 2000));
            // Click apply button
            const applyButton = yield page.$('button.apply-button, .btn-apply, #apply-button');
            if (applyButton) {
                yield applyButton.click();
                yield new Promise(resolve => setTimeout(resolve, 3000));
                // Upload resume if file input is available
                const fileInput = yield page.$('input[type="file"]');
                if (fileInput && resumePath) {
                    yield fileInput.uploadFile(resumePath);
                    yield new Promise(resolve => setTimeout(resolve, 2000));
                }
                // Click submit
                const submitButton = yield page.$('button[type="submit"], .submit-application');
                if (submitButton) {
                    yield submitButton.click();
                    yield new Promise(resolve => setTimeout(resolve, 3000));
                    console.log('Naukri application submitted successfully');
                    return true;
                }
            }
            console.log('Could not complete Naukri application');
            return false;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error applying to Naukri job:', message);
            return false;
        }
    });
}
function closeBrowser() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (page && !page.isClosed()) {
                yield page.close();
                page = null;
            }
            if (browser && browser.isConnected()) {
                yield browser.close();
                browser = null;
            }
            console.log('Browser closed successfully');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error closing browser:', message);
        }
    });
}
