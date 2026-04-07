import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;
let page: Page | null = null;

const NAUKRI_LOGIN_URL = 'https://www.naukri.com/nlogin/login';
const NAUKRI_JOBS_URL = 'https://www.naukri.com/';

async function initBrowser() {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }
    if (!page) {
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
    }
    return { browser, page };
}

export async function loginNaukri(username: string, password: string): Promise<boolean> {
    try {
        const { page } = await initBrowser();
        console.log('Navigating to Naukri login page...');
        
        await page.goto(NAUKRI_LOGIN_URL, { waitUntil: 'networkidle2' });
        await page.waitForTimeout(2000);

        // Enter credentials
        await page.type('#usernameField', username, { delay: 100 });
        await page.type('#passwordField', password, { delay: 100 });
        
        // Click login button
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        
        // Check if login was successful
        const url = page.url();
        const isLoggedIn = !url.includes('login') && !url.includes('error');
        
        console.log('Naukri login:', isLoggedIn ? 'SUCCESS' : 'FAILED');
        return isLoggedIn;
    } catch (error) {
        console.error('Naukri login error:', error);
        return false;
    }
}

export async function fetchNaukriJobs(limit: number = 10): Promise<any[]> {
    try {
        const { page } = await initBrowser();
        console.log('Fetching Naukri jobs...');
        
        await page.goto('https://www.naukri.com/software-engineer-jobs', { waitUntil: 'networkidle2' });
        await page.waitForTimeout(3000);

        const jobs = await page.evaluate((maxJobs) => {
            const jobElements = document.querySelectorAll('.jobTuple');
            const jobList: any[] = [];

            for (let i = 0; i < Math.min(jobElements.length, maxJobs); i++) {
                const job = jobElements[i];
                const titleElem = job.querySelector('.title');
                const companyElem = job.querySelector('.companyInfo');
                const locationElem = job.querySelector('.locWdth');
                const linkElem = job.querySelector('a.title');

                jobList.push({
                    title: titleElem?.textContent?.trim() || '',
                    company: companyElem?.textContent?.trim() || '',
                    location: locationElem?.textContent?.trim() || '',
                    url: linkElem?.getAttribute('href') || ''
                });
            }

            return jobList;
        }, limit);

        console.log(`Fetched ${jobs.length} jobs from Naukri`);
        return jobs;
    } catch (error) {
        console.error('Error fetching Naukri jobs:', error);
        return [];
    }
}

export async function extractNaukriJobDescription(jobUrl: string): Promise<string> {
    try {
        const { page } = await initBrowser();
        console.log('Extracting job description from:', jobUrl);
        
        await page.goto(jobUrl, { waitUntil: 'networkidle2' });
        await page.waitForTimeout(2000);

        const description = await page.evaluate(() => {
            const descElem = document.querySelector('.job-description') || 
                           document.querySelector('.jd-desc') ||
                           document.querySelector('.description');
            return descElem?.textContent?.trim() || '';
        });

        console.log('Extracted description length:', description.length);
        return description;
    } catch (error) {
        console.error('Error extracting Naukri job description:', error);
        return '';
    }
}

export async function applyNaukriJob(jobUrl: string, resumePath: string): Promise<boolean> {
    try {
        const { page } = await initBrowser();
        console.log('Applying to Naukri job:', jobUrl);
        
        await page.goto(jobUrl, { waitUntil: 'networkidle2' });
        await page.waitForTimeout(2000);

        // Click apply button
        const applyButton = await page.$('button.apply-button, .btn-apply, #apply-button');
        if (applyButton) {
            await applyButton.click();
            await page.waitForTimeout(3000);

            // Upload resume if file input is available
            const fileInput = await page.$('input[type="file"]');
            if (fileInput && resumePath) {
                await fileInput.uploadFile(resumePath);
                await page.waitForTimeout(2000);
            }

            // Click submit
            const submitButton = await page.$('button[type="submit"], .submit-application');
            if (submitButton) {
                await submitButton.click();
                await page.waitForTimeout(3000);
                console.log('Naukri application submitted successfully');
                return true;
            }
        }

        console.log('Could not complete Naukri application');
        return false;
    } catch (error) {
        console.error('Error applying to Naukri job:', error);
        return false;
    }
}

export async function closeBrowser() {
    if (browser) {
        await browser.close();
        browser = null;
        page = null;
    }
}
