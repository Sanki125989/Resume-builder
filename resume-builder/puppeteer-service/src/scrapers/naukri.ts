import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;
let page: Page | null = null;
let isInitializing = false;

const NAUKRI_LOGIN_URL = 'https://www.naukri.com/nlogin/login';
const NAUKRI_JOBS_URL = 'https://www.naukri.com/';

async function initBrowser(): Promise<{ browser: Browser; page: Page }> {
    // If already initializing, wait for it to complete
    while (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
        // Close and recreate if browser is disconnected
        if (browser && !browser.isConnected()) {
            console.log('Browser disconnected, recreating...');
            await closeBrowser();
        }

        if (!browser) {
            isInitializing = true;
            console.log('Launching new browser instance...');
            browser = await puppeteer.launch({
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
            page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        }

        return { browser, page };
    } catch (error) {
        isInitializing = false;
        throw error;
    }
}

export async function loginNaukri(username: string, password: string): Promise<boolean> {
    let loginPage: Page | null = null;
    try {
        const { browser } = await initBrowser();
        
        // Create a fresh page for login
        loginPage = await browser.newPage();
        await loginPage.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        
        console.log('Navigating to Naukri login page...');
        
        await loginPage.goto(NAUKRI_LOGIN_URL, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });
        
        console.log('Waiting for login form...');
        await loginPage.waitForSelector('#usernameField', { timeout: 10000 });
        
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

        // Enter credentials
        console.log('Entering credentials...');
        await loginPage.type('#usernameField', username, { delay: 50 + Math.random() * 50 });
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
        
        await loginPage.type('#passwordField', password, { delay: 50 + Math.random() * 50 });
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
        
        // Click login button
        console.log('Clicking login button...');
        await Promise.all([
            loginPage.click('button[type="submit"]'),
            loginPage.waitForNavigation({ 
                waitUntil: 'domcontentloaded', 
                timeout: 60000 
            }).catch(err => {
                console.log('Navigation timeout (this might be ok if already logged in):', err.message);
            })
        ]);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if login was successful
        const url = loginPage.url();
        const isLoggedIn = !url.includes('login') && !url.includes('error');
        
        if (isLoggedIn) {
            console.log('Naukri login: SUCCESS');
            if (page && !page.isClosed()) {
                await page.close();
            }
            page = loginPage;
            loginPage = null;
        } else {
            console.log('Naukri login: FAILED');
        }
        
        return isLoggedIn;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Naukri login error:', message);
        return false;
    } finally {
        if (loginPage && !loginPage.isClosed()) {
            await loginPage.close().catch(() => {});
        }
    }
}

export async function fetchNaukriJobs(limit: number = 10): Promise<any[]> {
    try {
        const { page } = await initBrowser();
        
        if (!page || page.isClosed()) {
            throw new Error('Page is not available');
        }
        
        console.log('Fetching Naukri jobs...');
        
        await page.goto('https://www.naukri.com/software-engineer-jobs', { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });
        await new Promise(resolve => setTimeout(resolve, 3000));

        const jobs = await page.evaluate((maxJobs) => {
            const jobElements = document.querySelectorAll('.jobTuple, .srp-jobtuple-wrapper');
            const jobList: any[] = [];

            for (let i = 0; i < Math.min(jobElements.length, maxJobs); i++) {
                const job = jobElements[i];
                const titleElem = job.querySelector('.title, .jobTuple-title');
                const companyElem = job.querySelector('.companyInfo, .jobTuple-companyName');
                const locationElem = job.querySelector('.locWdth, .jobTuple-location');
                const linkElem = job.querySelector('a.title, a.jobTuple-title');

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
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error fetching Naukri jobs:', message);
        return [];
    }
}

export async function extractNaukriJobDescription(jobUrl: string): Promise<string> {
    try {
        const { page } = await initBrowser();
        
        if (!page || page.isClosed()) {
            throw new Error('Page is not available');
        }
        
        console.log('Extracting job description from:', jobUrl);
        
        await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const description = await page.evaluate(() => {
            const descElem = document.querySelector('.job-description') || 
                           document.querySelector('.jd-desc') ||
                           document.querySelector('.description');
            return descElem?.textContent?.trim() || '';
        });

        console.log('Extracted description length:', description.length);
        return description;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error extracting Naukri job description:', message);
        return '';
    }
}

export async function applyNaukriJob(jobUrl: string, resumePath: string): Promise<boolean> {
    try {
        const { page } = await initBrowser();
        
        if (!page || page.isClosed()) {
            throw new Error('Page is not available');
        }
        
        console.log('Applying to Naukri job:', jobUrl);
        
        await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Click apply button
        const applyButton = await page.$('button.apply-button, .btn-apply, #apply-button');
        if (applyButton) {
            await applyButton.click();
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Upload resume if file input is available
            const fileInput = await page.$('input[type="file"]');
            if (fileInput && resumePath) {
                await fileInput.uploadFile(resumePath);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Click submit
            const submitButton = await page.$('button[type="submit"], .submit-application');
            if (submitButton) {
                await submitButton.click();
                await new Promise(resolve => setTimeout(resolve, 3000));
                console.log('Naukri application submitted successfully');
                return true;
            }
        }

        console.log('Could not complete Naukri application');
        return false;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error applying to Naukri job:', message);
        return false;
    }
}

export async function closeBrowser() {
    try {
        if (page && !page.isClosed()) {
            await page.close();
            page = null;
        }
        if (browser && browser.isConnected()) {
            await browser.close();
            browser = null;
        }
        console.log('Browser closed successfully');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error closing browser:', message);
    }
}
