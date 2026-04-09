import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;
let page: Page | null = null;
let isInitializing = false;

const LINKEDIN_LOGIN_URL = 'https://www.linkedin.com/login';
const LINKEDIN_JOBS_URL = 'https://www.linkedin.com/jobs/';

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
            page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
            
            // Set extra headers to appear more like a real browser
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            });
        }

        return { browser, page };
    } catch (error) {
        isInitializing = false;
        throw error;
    }
}

export async function loginLinkedIn(username: string, password: string): Promise<boolean> {
    let loginPage: Page | null = null;
    try {
        const { browser } = await initBrowser();
        
        // Create a fresh page for login
        loginPage = await browser.newPage();
        await loginPage.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        
        console.log('Navigating to LinkedIn login page...');
        
        await loginPage.goto(LINKEDIN_LOGIN_URL, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });
        
        console.log('Waiting for login form...');
        await loginPage.waitForSelector('#username', { timeout: 10000 });
        
        // Add random delays to appear more human
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

        // Enter credentials
        console.log('Entering credentials...');
        await loginPage.type('#username', username, { delay: 50 + Math.random() * 50 });
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
        
        await loginPage.type('#password', password, { delay: 50 + Math.random() * 50 });
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

        // Wait for page to settle
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if login was successful
        const url = loginPage.url();
        const isLoggedIn = url.includes('feed') || url.includes('jobs') || url.includes('mynetwork') || !url.includes('login');

        if (isLoggedIn) {
            console.log('LinkedIn login: SUCCESS');
            // Store the logged-in page
            if (page && !page.isClosed()) {
                await page.close();
            }
            page = loginPage;
            loginPage = null; // Prevent closing
        } else {
            console.log('LinkedIn login: FAILED - Still on login page');
            // Check for error messages
            const errorMsg = await loginPage.evaluate(() => {
                const errorElem = document.querySelector('.form__label--error');
                return errorElem?.textContent || '';
            });
            if (errorMsg) {
                console.log('Login error message:', errorMsg);
            }
        }
        
        return isLoggedIn;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('LinkedIn login error:', message);
        return false;
    } finally {
        // Close the login page if login failed
        if (loginPage && !loginPage.isClosed()) {
            await loginPage.close().catch(() => {});
        }
    }
}

export async function fetchLinkedInJobs(limit: number = 10): Promise<any[]> {
    try {
        const { page } = await initBrowser();
        
        if (!page || page.isClosed()) {
            throw new Error('Page is not available');
        }
        
        console.log('Fetching LinkedIn jobs...');
        
        await page.goto('https://www.linkedin.com/jobs/search/?keywords=software%20engineer', 
                       { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Scroll to load more jobs
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const jobs = await page.evaluate((maxJobs) => {
            const jobElements = document.querySelectorAll('.job-card-container, .jobs-search-results__list-item');
            const jobList: any[] = [];

            for (let i = 0; i < Math.min(jobElements.length, maxJobs); i++) {
                const job = jobElements[i];
                const titleElem = job.querySelector('.job-card-list__title, .job-card-container__link');
                const companyElem = job.querySelector('.job-card-container__company-name, .job-card-container__primary-description');
                const locationElem = job.querySelector('.job-card-container__metadata-item');
                const linkElem = job.querySelector('a.job-card-list__title, a.job-card-container__link');

                jobList.push({
                    title: titleElem?.textContent?.trim() || '',
                    company: companyElem?.textContent?.trim() || '',
                    location: locationElem?.textContent?.trim() || '',
                    url: linkElem?.getAttribute('href')?.split('?')[0] || ''
                });
            }

            return jobList;
        }, limit);

        console.log(`Fetched ${jobs.length} jobs from LinkedIn`);
        return jobs;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error fetching LinkedIn jobs:', message);
        return [];
    }
}

export async function extractLinkedInJobDescription(jobUrl: string): Promise<string> {
    try {
        const { page } = await initBrowser();
        
        if (!page || page.isClosed()) {
            throw new Error('Page is not available');
        }
        
        console.log('Extracting job description from:', jobUrl);
        
        await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Click "Show more" button if present
        try {
            const showMoreButton = await page.$('button.show-more-less-html__button');
            if (showMoreButton) {
                await showMoreButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (e) {
            // Show more button might not exist
        }

        const description = await page.evaluate(() => {
            const descElem = document.querySelector('.jobs-description') || 
                           document.querySelector('.description__text') ||
                           document.querySelector('.show-more-less-html__markup');
            return descElem?.textContent?.trim() || '';
        });

        console.log('Extracted description length:', description.length);
        return description;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error extracting LinkedIn job description:', message);
        return '';
    }
}

export async function applyLinkedInJob(jobUrl: string, resumePath: string): Promise<boolean> {
    try {
        const { page } = await initBrowser();
        
        if (!page || page.isClosed()) {
            throw new Error('Page is not available');
        }
        
        console.log('Applying to LinkedIn job:', jobUrl);
        
        await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Click Easy Apply button
        const easyApplyButton = await page.$('button.jobs-apply-button');
        if (easyApplyButton) {
            await easyApplyButton.click();
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Upload resume if requested
            const fileInput = await page.$('input[type="file"]');
            if (fileInput && resumePath) {
                await fileInput.uploadFile(resumePath);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Fill any required fields (this is simplified)
            // In production, you'd need to handle various form fields

            // Click submit
            const submitButton = await page.$('button[aria-label="Submit application"]');
            if (submitButton) {
                await submitButton.click();
                await new Promise(resolve => setTimeout(resolve, 3000));
                console.log('LinkedIn application submitted successfully');
                return true;
            }
        }

        console.log('Could not complete LinkedIn application (might not be Easy Apply)');
        return false;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error applying to LinkedIn job:', message);
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
