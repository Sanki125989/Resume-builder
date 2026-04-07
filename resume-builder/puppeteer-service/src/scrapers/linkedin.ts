import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;
let page: Page | null = null;

const LINKEDIN_LOGIN_URL = 'https://www.linkedin.com/login';
const LINKEDIN_JOBS_URL = 'https://www.linkedin.com/jobs/';

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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    }
    return { browser, page };
}

export async function loginLinkedIn(username: string, password: string): Promise<boolean> {
    try {
        const { page } = await initBrowser();
        console.log('Navigating to LinkedIn login page...');
        
        await page.goto(LINKEDIN_LOGIN_URL, { waitUntil: 'networkidle2' });
        await page.waitForTimeout(2000);

        // Enter credentials
        await page.type('#username', username, { delay: 100 });
        await page.type('#password', password, { delay: 100 });
        
        // Click login button
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        
        // Handle potential verification
        await page.waitForTimeout(3000);
        
        // Check if login was successful
        const url = page.url();
        const isLoggedIn = url.includes('feed') || url.includes('jobs');
        
        console.log('LinkedIn login:', isLoggedIn ? 'SUCCESS' : 'FAILED');
        return isLoggedIn;
    } catch (error) {
        console.error('LinkedIn login error:', error);
        return false;
    }
}

export async function fetchLinkedInJobs(limit: number = 10): Promise<any[]> {
    try {
        const { page } = await initBrowser();
        console.log('Fetching LinkedIn jobs...');
        
        await page.goto('https://www.linkedin.com/jobs/search/?keywords=software%20engineer', 
                       { waitUntil: 'networkidle2' });
        await page.waitForTimeout(3000);

        // Scroll to load more jobs
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(2000);

        const jobs = await page.evaluate((maxJobs) => {
            const jobElements = document.querySelectorAll('.job-card-container');
            const jobList: any[] = [];

            for (let i = 0; i < Math.min(jobElements.length, maxJobs); i++) {
                const job = jobElements[i];
                const titleElem = job.querySelector('.job-card-list__title');
                const companyElem = job.querySelector('.job-card-container__company-name');
                const locationElem = job.querySelector('.job-card-container__metadata-item');
                const linkElem = job.querySelector('a.job-card-list__title');

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
        console.error('Error fetching LinkedIn jobs:', error);
        return [];
    }
}

export async function extractLinkedInJobDescription(jobUrl: string): Promise<string> {
    try {
        const { page } = await initBrowser();
        console.log('Extracting job description from:', jobUrl);
        
        await page.goto(jobUrl, { waitUntil: 'networkidle2' });
        await page.waitForTimeout(3000);

        // Click "Show more" button if present
        try {
            const showMoreButton = await page.$('button.show-more-less-html__button');
            if (showMoreButton) {
                await showMoreButton.click();
                await page.waitForTimeout(1000);
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
        console.error('Error extracting LinkedIn job description:', error);
        return '';
    }
}

export async function applyLinkedInJob(jobUrl: string, resumePath: string): Promise<boolean> {
    try {
        const { page } = await initBrowser();
        console.log('Applying to LinkedIn job:', jobUrl);
        
        await page.goto(jobUrl, { waitUntil: 'networkidle2' });
        await page.waitForTimeout(2000);

        // Click Easy Apply button
        const easyApplyButton = await page.$('button.jobs-apply-button');
        if (easyApplyButton) {
            await easyApplyButton.click();
            await page.waitForTimeout(2000);

            // Upload resume if requested
            const fileInput = await page.$('input[type="file"]');
            if (fileInput && resumePath) {
                await fileInput.uploadFile(resumePath);
                await page.waitForTimeout(2000);
            }

            // Fill any required fields (this is simplified)
            // In production, you'd need to handle various form fields

            // Click submit
            const submitButton = await page.$('button[aria-label="Submit application"]');
            if (submitButton) {
                await submitButton.click();
                await page.waitForTimeout(3000);
                console.log('LinkedIn application submitted successfully');
                return true;
            }
        }

        console.log('Could not complete LinkedIn application (might not be Easy Apply)');
        return false;
    } catch (error) {
        console.error('Error applying to LinkedIn job:', error);
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
