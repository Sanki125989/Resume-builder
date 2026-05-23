import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;
let page: Page | null = null;
let isInitializing = false;

const NAUKRI_LOGIN_URL = 'https://www.naukri.com/nlogin/login';

async function initBrowser(): Promise<{ browser: Browser; page: Page }> {
    while (isInitializing) await delay(100);
    try {
        if (browser && !browser.isConnected()) await closeBrowser();
        if (!browser) {
            isInitializing = true;
            browser = await puppeteer.launch({
                headless: false,
                args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
                       '--disable-accelerated-2d-canvas','--disable-gpu','--window-size=1920,1080'],
                defaultViewport: { width: 1920, height: 1080 }
            });
            isInitializing = false;
            console.log('[browser] launched');
        }
        if (!page || page.isClosed()) {
            page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        }
        return { browser, page };
    } catch (e) { isInitializing = false; throw e; }
}

async function loginNaukri(username: string, password: string): Promise<boolean> {
    let loginPage: Page | null = null;
    try {
        const { browser: b } = await initBrowser();
        loginPage = await b.newPage();
        await loginPage.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        console.log('[login] Navigating to Naukri login...');
        await loginPage.goto(NAUKRI_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await loginPage.waitForSelector('#usernameField', { timeout: 15000 });
        await delay(1000);

        await loginPage.type('#usernameField', username, { delay: 60 });
        await delay(500);
        await loginPage.type('#passwordField', password, { delay: 60 });
        await delay(500);

        await Promise.all([
            loginPage.click('button[type="submit"]'),
            loginPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 })
                .catch(() => console.log('[login] nav timeout — continuing'))
        ]);
        await delay(3000);

        const url = loginPage.url();
        const ok  = !url.includes('login') && !url.includes('error');
        if (ok) {
            console.log('[login] SUCCESS');
            if (page && !page.isClosed()) await page.close();
            page = loginPage;
            loginPage = null;
        } else {
            console.log('[login] FAILED — url:', url);
        }
        return ok;
    } catch (e) {
        console.error('[login] error:', msg(e));
        return false;
    } finally {
        if (loginPage && !loginPage.isClosed()) await loginPage.close().catch(() => {});
    }
}

/**
 * 1. Login to Naukri
 * 2. Home → Recommended Jobs → Applies tab → click 1st job
 * 3. Extract job description + key skills
 */
export async function scrapeRecommendedJob(
    username: string,
    password: string
): Promise<{ jobDescription: string; keySkills: string[] }> {
    const ok = await loginNaukri(username, password);
    if (!ok) throw new Error('Naukri login failed');

    const { page: p } = await initBrowser();
    if (!p || p.isClosed()) throw new Error('No active page after login');

    console.log('[scrape] Navigating to Naukri home...');
    await p.goto('https://www.naukri.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(4000);

    // ── Click "Applies" tab in Recommended Jobs section ──────────────────────
    console.log('[scrape] Looking for Applies tab...');
    await p.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll(
            '[class*="tab"], [role="tab"], li[class*="tab"], a[class*="tab"], button[class*="tab"]'
        ));
        const t = tabs.find(el => {
            const txt = el.textContent?.trim().toLowerCase() || '';
            return txt === 'applies' || txt === 'applied' || txt.startsWith('appli');
        });
        if (t) (t as HTMLElement).click();
    });
    await delay(2500);

    // ── Click first job card ──────────────────────────────────────────────────
    console.log('[scrape] Clicking first job card...');
    await p.evaluate(() => {
        const selectors = [
            '.jobcard-wrapper a.title',
            '.job-card a.title',
            '.job-tuple a.title',
            '[class*="job-card"] a[class*="title"]',
            '[class*="jobCard"] a',
            'article a[class*="title"]',
            '.listContainer a.title',
        ];
        for (const sel of selectors) {
            const link = document.querySelector(sel) as HTMLAnchorElement | null;
            if (link?.href) { link.click(); return; }
        }
    });
    await delay(4000);

    // Switch to new tab if job opened in one
    const allPages = (await browser!.pages()).filter(pg => !pg.isClosed());
    const jobPage  = allPages.length > 1 ? allPages[allPages.length - 1] : p;
    await delay(2000);

    // ── Extract job description + key skills ──────────────────────────────────
    console.log('[scrape] Extracting job details...');
    const result = await jobPage.evaluate(() => {
        // Job description
        const jdSelectors = ['.dang-inner-html','.job-desc','[class*="job-desc"]','[class*="description"]','.description'];
        let jobDescription = '';
        for (const sel of jdSelectors) {
            const el = document.querySelector(sel);
            if (el?.textContent && el.textContent.trim().length > 100) {
                jobDescription = el.textContent.trim();
                break;
            }
        }

        // Key skills — Naukri shows them as chips/tags
        const skills: string[] = [];
        const seen = new Set<string>();
        const skillSelectors = [
            '.chip','[class*="chip"]',
            '.key-skill a','[class*="keySkill"] a','[class*="keySkill"] span',
            '[class*="key-skill"] a','.tags li','.skill-block a',
        ];
        for (const sel of skillSelectors) {
            document.querySelectorAll(sel).forEach(el => {
                const text = el.textContent?.trim() || '';
                if (text && text.length < 60 && !seen.has(text)) { seen.add(text); skills.push(text); }
            });
            if (skills.length >= 5) break;
        }

        // Fallback: extract known tech keywords from description
        if (skills.length === 0 && jobDescription) {
            const kwds = ['Java','Python','JavaScript','TypeScript','React','Angular','Vue','Spring Boot',
                'Node.js','MySQL','PostgreSQL','MongoDB','Redis','AWS','Azure','GCP','Docker','Kubernetes',
                'REST API','Microservices','Git','Maven','Gradle','SQL','HTML','CSS','CI/CD','Agile','Scrum'];
            kwds.forEach(kw => {
                if (jobDescription.toLowerCase().includes(kw.toLowerCase())) skills.push(kw);
            });
        }

        return { jobDescription: jobDescription.substring(0, 5000), keySkills: skills.slice(0, 25) };
    });

    console.log(`[scrape] ${result.keySkills.length} skills: ${result.keySkills.join(', ')}`);

    // Close extra tab if opened
    if (allPages.length > 1 && jobPage !== p && !jobPage.isClosed()) {
        await jobPage.close().catch(() => {});
    }
    return result;
}

/**
 * 1. Click profile icon (top right)
 * 2. Click "View & Update Profile"
 * 3. Scroll to Resume section → click "Update resume"
 * 4. Upload PDF
 * 5. Logout
 */
export async function uploadResumeToNaukriAndLogout(resumePath: string): Promise<boolean> {
    try {
        const { page: p } = await initBrowser();
        if (!p || p.isClosed()) throw new Error('No active page');

        console.log('[upload] Navigating to Naukri home...');
        await p.goto('https://www.naukri.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await delay(3000);

        // ── Click profile icon (top right corner) ────────────────────────────
        console.log('[upload] Clicking profile icon...');
        await p.evaluate(() => {
            const selectors = ['.nI-gNb-drawer__icon','[class*="user-avtar"]','.user-name',
                               '[class*="naukri-avatar"]','[class*="profile-icon"]','.view-profile-btn'];
            for (const sel of selectors) {
                const el = document.querySelector(sel) as HTMLElement | null;
                if (el && el.offsetParent !== null) { el.click(); return; }
            }
        });
        await delay(2000);

        // ── Click "View & Update Profile" ────────────────────────────────────
        console.log('[upload] Clicking View & Update Profile...');
        const done = await p.evaluate(() => {
            const link = Array.from(document.querySelectorAll('a, li, span, button')).find(el => {
                const t = el.textContent?.trim() || '';
                return t.includes('View & Update Profile') || t.includes('View Profile');
            });
            if (link) { (link as HTMLElement).click(); return true; }
            return false;
        });
        if (!done) {
            console.log('[upload] Dropdown not found — navigating directly to profile page...');
            await p.goto('https://www.naukri.com/mnjuser/profile', { waitUntil: 'domcontentloaded', timeout: 60000 });
        }
        await delay(4000);

        // ── Scroll to Resume section ──────────────────────────────────────────
        console.log('[upload] Scrolling to Resume section...');
        await p.evaluate(() => {
            const section = document.querySelector('#attachCV, [class*="resume"], [id*="resume"], [class*="attach"]');
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            else window.scrollBy(0, 500);
        });
        await delay(2000);

        // ── Click "Update resume" button ─────────────────────────────────────
        console.log('[upload] Clicking Update resume...');
        await p.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button, a, label, span')).find(el => {
                const t = el.textContent?.trim().toLowerCase() || '';
                return t.includes('update resume') || t.includes('upload resume');
            });
            if (btn) (btn as HTMLElement).click();
        });
        await delay(2000);

        // Make hidden file inputs accessible
        await p.evaluate(() => {
            document.querySelectorAll('input[type="file"]').forEach(inp => {
                const el = inp as HTMLElement;
                el.style.display    = 'block';
                el.style.opacity    = '1';
                el.style.visibility = 'visible';
            });
        });

        // ── Upload the PDF ────────────────────────────────────────────────────
        console.log('[upload] Uploading file:', resumePath);
        const fileInput = await p.$('input[type="file"]');
        if (!fileInput) {
            console.log('[upload] File input not found');
            return false;
        }
        await fileInput.uploadFile(resumePath);
        await delay(3000);

        // Click Save/Submit if visible
        await p.evaluate(() => {
            const saveBtn = Array.from(document.querySelectorAll('button')).find(b => {
                const t = b.textContent?.trim().toLowerCase() || '';
                return t === 'save' || t === 'submit' || t === 'upload' || t === 'ok';
            });
            if (saveBtn) saveBtn.click();
        });
        await delay(3000);
        console.log('[upload] Resume uploaded to Naukri profile');

        // ── Logout ────────────────────────────────────────────────────────────
        await logoutNaukri(p);
        return true;
    } catch (e) {
        console.error('[upload] error:', msg(e));
        return false;
    }
}

async function logoutNaukri(p: Page): Promise<void> {
    try {
        console.log('[logout] Logging out...');
        await p.goto('https://www.naukri.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await delay(2000);

        // Open profile dropdown
        await p.evaluate(() => {
            const selectors = ['.nI-gNb-drawer__icon','[class*="user-avtar"]','.user-name'];
            for (const sel of selectors) {
                const el = document.querySelector(sel) as HTMLElement | null;
                if (el && el.offsetParent !== null) { el.click(); return; }
            }
        });
        await delay(1500);

        // Click Logout
        await p.evaluate(() => {
            const logoutEl = Array.from(document.querySelectorAll('a, button, li, span')).find(el => {
                const t = el.textContent?.trim().toLowerCase() || '';
                return t === 'logout' || t === 'sign out' || t === 'log out';
            });
            if (logoutEl) (logoutEl as HTMLElement).click();
        });
        await delay(2000);
        console.log('[logout] Logged out from Naukri');
    } catch (e) {
        console.log('[logout] error (non-critical):', msg(e));
    } finally {
        await closeBrowser();
    }
}

export async function closeBrowser(): Promise<void> {
    try {
        if (page && !page.isClosed()) { await page.close(); page = null; }
        if (browser && browser.isConnected()) { await browser.close(); browser = null; }
        console.log('[browser] closed');
    } catch (e) {
        console.error('[browser] close error:', msg(e));
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function msg(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}
