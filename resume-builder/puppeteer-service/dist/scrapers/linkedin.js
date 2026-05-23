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
exports.loginLinkedIn = loginLinkedIn;
exports.fetchLinkedInJobs = fetchLinkedInJobs;
exports.extractLinkedInJobDescription = extractLinkedInJobDescription;
exports.applyLinkedInJob = applyLinkedInJob;
exports.closeBrowser = closeBrowser;
const puppeteer_1 = __importDefault(require("puppeteer"));
let browser = null;
let page = null;
let isInitializing = false;
const LINKEDIN_LOGIN_URL = 'https://www.linkedin.com/login';
const LINKEDIN_JOBS_URL = 'https://www.linkedin.com/jobs/';
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
                    headless: false, // Set to true for production
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
                // Set extra headers to appear more like a real browser
                yield page.setExtraHTTPHeaders({
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                });
            }
            return { browser, page };
        }
        catch (error) {
            isInitializing = false;
            throw error;
        }
    });
}
function loginLinkedIn(username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        let loginPage = null;
        try {
            const { browser } = yield initBrowser();
            // Create a fresh page for login
            loginPage = yield browser.newPage();
            yield loginPage.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
            console.log('Navigating to LinkedIn login page...');
            yield loginPage.goto(LINKEDIN_LOGIN_URL, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            console.log('Waiting for login form...');
            yield loginPage.waitForSelector('#username', { timeout: 10000 });
            // Add random delays to appear more human
            yield new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
            // Enter credentials
            console.log('Entering credentials...');
            yield loginPage.type('#username', username, { delay: 50 + Math.random() * 50 });
            yield new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
            yield loginPage.type('#password', password, { delay: 50 + Math.random() * 50 });
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
            // Wait for page to settle
            yield new Promise(resolve => setTimeout(resolve, 3000));
            // Check if login was successful
            const url = loginPage.url();
            const isLoggedIn = url.includes('feed') || url.includes('jobs') || url.includes('mynetwork') || !url.includes('login');
            if (isLoggedIn) {
                console.log('LinkedIn login: SUCCESS');
                // Store the logged-in page
                if (page && !page.isClosed()) {
                    yield page.close();
                }
                page = loginPage;
                loginPage = null; // Prevent closing
            }
            else {
                console.log('LinkedIn login: FAILED - Still on login page');
                // Check for error messages
                const errorMsg = yield loginPage.evaluate(() => {
                    const errorElem = document.querySelector('.form__label--error');
                    return (errorElem === null || errorElem === void 0 ? void 0 : errorElem.textContent) || '';
                });
                if (errorMsg) {
                    console.log('Login error message:', errorMsg);
                }
            }
            return isLoggedIn;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('LinkedIn login error:', message);
            return false;
        }
        finally {
            // Close the login page if login failed
            if (loginPage && !loginPage.isClosed()) {
                yield loginPage.close().catch(() => { });
            }
        }
    });
}
function fetchLinkedInJobs() {
    return __awaiter(this, arguments, void 0, function* (limit = 10) {
        try {
            const { page } = yield initBrowser();
            if (!page || page.isClosed()) {
                throw new Error('Page is not available');
            }
            console.log('Fetching LinkedIn jobs...');
            yield page.goto('https://www.linkedin.com/jobs/search/?keywords=software%20engineer', { waitUntil: 'domcontentloaded', timeout: 60000 });
            yield new Promise(resolve => setTimeout(resolve, 3000));
            // Scroll to load more jobs
            yield page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            yield new Promise(resolve => setTimeout(resolve, 2000));
            const jobs = yield page.evaluate((maxJobs) => {
                var _a, _b, _c, _d;
                const jobElements = document.querySelectorAll('.job-card-container, .jobs-search-results__list-item');
                const jobList = [];
                for (let i = 0; i < Math.min(jobElements.length, maxJobs); i++) {
                    const job = jobElements[i];
                    const titleElem = job.querySelector('.job-card-list__title, .job-card-container__link');
                    const companyElem = job.querySelector('.job-card-container__company-name, .job-card-container__primary-description');
                    const locationElem = job.querySelector('.job-card-container__metadata-item');
                    const linkElem = job.querySelector('a.job-card-list__title, a.job-card-container__link');
                    jobList.push({
                        title: ((_a = titleElem === null || titleElem === void 0 ? void 0 : titleElem.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '',
                        company: ((_b = companyElem === null || companyElem === void 0 ? void 0 : companyElem.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || '',
                        location: ((_c = locationElem === null || locationElem === void 0 ? void 0 : locationElem.textContent) === null || _c === void 0 ? void 0 : _c.trim()) || '',
                        url: ((_d = linkElem === null || linkElem === void 0 ? void 0 : linkElem.getAttribute('href')) === null || _d === void 0 ? void 0 : _d.split('?')[0]) || ''
                    });
                }
                return jobList;
            }, limit);
            console.log(`Fetched ${jobs.length} jobs from LinkedIn`);
            return jobs;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error fetching LinkedIn jobs:', message);
            return [];
        }
    });
}
function extractLinkedInJobDescription(jobUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { page } = yield initBrowser();
            if (!page || page.isClosed()) {
                throw new Error('Page is not available');
            }
            console.log('Extracting job description from:', jobUrl);
            yield page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            yield new Promise(resolve => setTimeout(resolve, 3000));
            // Click "Show more" button if present
            try {
                const showMoreButton = yield page.$('button.show-more-less-html__button');
                if (showMoreButton) {
                    yield showMoreButton.click();
                    yield new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            catch (e) {
                // Show more button might not exist
            }
            const description = yield page.evaluate(() => {
                var _a;
                const descElem = document.querySelector('.jobs-description') ||
                    document.querySelector('.description__text') ||
                    document.querySelector('.show-more-less-html__markup');
                return ((_a = descElem === null || descElem === void 0 ? void 0 : descElem.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
            });
            console.log('Extracted description length:', description.length);
            return description;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error extracting LinkedIn job description:', message);
            return '';
        }
    });
}
function applyLinkedInJob(jobUrl, resumePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { page } = yield initBrowser();
            if (!page || page.isClosed()) {
                throw new Error('Page is not available');
            }
            console.log('Applying to LinkedIn job:', jobUrl);
            yield page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            yield new Promise(resolve => setTimeout(resolve, 2000));
            // Click Easy Apply button
            const easyApplyButton = yield page.$('button.jobs-apply-button');
            if (easyApplyButton) {
                yield easyApplyButton.click();
                yield new Promise(resolve => setTimeout(resolve, 2000));
                // Upload resume if requested
                const fileInput = yield page.$('input[type="file"]');
                if (fileInput && resumePath) {
                    yield fileInput.uploadFile(resumePath);
                    yield new Promise(resolve => setTimeout(resolve, 2000));
                }
                // Fill any required fields (this is simplified)
                // In production, you'd need to handle various form fields
                // Click submit
                const submitButton = yield page.$('button[aria-label="Submit application"]');
                if (submitButton) {
                    yield submitButton.click();
                    yield new Promise(resolve => setTimeout(resolve, 3000));
                    console.log('LinkedIn application submitted successfully');
                    return true;
                }
            }
            console.log('Could not complete LinkedIn application (might not be Easy Apply)');
            return false;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error applying to LinkedIn job:', message);
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
