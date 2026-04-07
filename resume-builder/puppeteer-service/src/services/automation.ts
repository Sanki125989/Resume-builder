import puppeteer, { Page } from 'puppeteer';

class AutomationService {
    private browser: puppeteer.Browser | null = null;

    async init() {
        this.browser = await puppeteer.launch({ headless: true });
    }

    async loginToNaukri(username: string, password: string): Promise<Page> {
        if (!this.browser) {
            throw new Error('Browser not initialized. Call init() first.');
        }
        const page = await this.browser.newPage();
        await page.goto('https://www.naukri.com/nlogin/login');
        await page.type('input[name="username"]', username);
        await page.type('input[name="password"]', password);
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation(),
        ]);
        return page;
    }

    async loginToLinkedIn(username: string, password: string): Promise<Page> {
        if (!this.browser) {
            throw new Error('Browser not initialized. Call init() first.');
        }
        const page = await this.browser.newPage();
        await page.goto('https://www.linkedin.com/login');
        await page.type('input[name="session_key"]', username);
        await page.type('input[name="session_password"]', password);
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation(),
        ]);
        return page;
    }

    async extractJobDescription(page: Page): Promise<string> {
        // Implement logic to extract job description from the page
        const jobDescription = await page.evaluate(() => {
            const descriptionElement = document.querySelector('.job-description');
            return descriptionElement ? descriptionElement.innerText : '';
        });
        return jobDescription;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

export default new AutomationService();