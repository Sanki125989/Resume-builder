import puppeteer, { Browser, Page } from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

let browser: Browser | null = null;
let page: Page | null = null;
let isInitializing = false;

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function closeBrowser(): Promise<void> {
    try {
        if (browser) {
            await browser.close();
        }
    } catch (e) {
        console.error('[linkedin-browser] error closing browser:', e);
    } finally {
        browser = null;
        page = null;
    }
}

async function initBrowser(): Promise<{ browser: Browser; page: Page }> {
    while (isInitializing) await delay(100);
    try {
        if (browser && !browser.isConnected()) await closeBrowser();
        if (!browser) {
            isInitializing = true;
            // Persistent user data dir to store cookies and stay logged in (bypasses 2FA on repeat runs)
            const userDataDir = path.join(__dirname, '../../../.chrome-session-linkedin');
            console.log('[linkedin-browser] Using userDataDir:', userDataDir);
            
            browser = await puppeteer.launch({
                headless: false, // Set to false to easily see and resolve login/2FA challenges manually
                userDataDir,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled',
                    '--window-size=1200,800'
                ],
                defaultViewport: { width: 1200, height: 800 }
            });
            isInitializing = false;
            console.log('[linkedin-browser] launched');
        }
        if (!page || page.isClosed()) {
            page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        }
        return { browser, page };
    } catch (e) {
        isInitializing = false;
        throw e;
    }
}

async function loginLinkedIn(username: string, password: string): Promise<boolean> {
    try {
        const { page: p } = await initBrowser();
        
        console.log('[linkedin-login] Navigating to LinkedIn home...');
        await p.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await delay(3000);

        // Check if we are already logged in via session cookie
        const isLoggedIn = await p.evaluate(() => {
            return document.querySelector('#global-nav') !== null;
        });

        if (isLoggedIn) {
            console.log('[linkedin-login] Already logged in via persistent session.');
            return true;
        }

        console.log('[linkedin-login] Session not found. Initiating login flow...');
        await p.goto('https://www.linkedin.com/login', { waitUntil: 'load', timeout: 60000 });
        
        // If we got auto-redirected to feed/home, we are already logged in
        if (p.url().includes('/feed') || (await p.$('#global-nav')) !== null) {
            console.log('[linkedin-login] Auto-redirected to feed. Already logged in.');
            return true;
        }
        
        await p.waitForSelector('#username', { timeout: 15000 });
        await delay(1000);

        await p.type('#username', username, { delay: 100 });
        await delay(500);
        await p.type('#password', password, { delay: 100 });
        await delay(500);

        await Promise.all([
            p.click('button[type="submit"]'),
            p.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {
                console.log('[linkedin-login] Navigation timeout after submit - checking URL');
            })
        ]);
        
        // Wait a bit to let any 2FA challenge load
        await delay(5000);

        const currentUrl = p.url();
        const success = await p.evaluate(() => {
            return document.querySelector('#global-nav') !== null;
        });

        if (success) {
            console.log('[linkedin-login] SUCCESS');
            return true;
        } else {
            console.log('[linkedin-login] FAILED or waiting for manual intervention. Current URL:', currentUrl);
            // We return false, but user can complete 2FA in the opened browser window
            return false;
        }
    } catch (e) {
        console.error('[linkedin-login] error:', e);
        return false;
    }
}

export interface OutreachResult {
    name: string;
    title: string;
    profileUrl: string;
    status: 'sent' | 'skipped_already_sent' | 'failed';
    error?: string;
}

export async function messageExistingRecruiters(
    username: string,
    password: string,
    pdfPath: string,
    messageTemplate: string,
    dailyLimit: number = 5
): Promise<OutreachResult[]> {
    const results: OutreachResult[] = [];

    if (!fs.existsSync(pdfPath)) {
        throw new Error(`Local PDF file not found at: ${pdfPath}`);
    }

    // 1. Log in (or restore session)
    const loggedIn = await loginLinkedIn(username, password);
    
    const { page: p } = await initBrowser();
    
    // Final verification of login state: Wait for the navigation bar to render completely
    console.log('[linkedin-outreach] Verifying login session state...');
    let verifyLoggedIn = false;
    try {
        await p.waitForSelector('#global-nav', { timeout: 20000 });
        verifyLoggedIn = true;
    } catch (e) {
        // Fallback: Check if URL indicates a logged-in state
        const currentUrl = p.url();
        if (currentUrl.includes('/feed') || currentUrl.includes('/search') || currentUrl.includes('/in/')) {
            verifyLoggedIn = true;
        }
    }
    
    if (!verifyLoggedIn) {
        throw new Error('LinkedIn authentication failed. Please verify your credentials and check the browser window to resolve any CAPTCHA or 2FA prompts manually.');
    }
    
    console.log('[linkedin-outreach] Successfully verified logged-in session. Starting recruiter search...');

    // 2. Search 1st-degree connections matching recruiters
    const searchKeyword = encodeURIComponent('Talent Acquisition OR Recruiter');
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${searchKeyword}&network=%5B%22F%22%5D`;
    
    console.log('[linkedin-outreach] Navigating to search URL:', searchUrl);
    await p.goto(searchUrl, { waitUntil: 'load', timeout: 60000 });
    
    // Wait for result cards to render dynamically (with a fallback if there are no results)
    try {
        console.log('[linkedin-outreach] Waiting for search results to load...');
        await p.waitForSelector('.reusable-search__result-container, li[class*="search-result"], [data-chameleon-result-id]', { timeout: 10000 });
    } catch (e) {
        console.log('[linkedin-outreach] No search result cards loaded in 10s. Your search query might have returned 0 results.');
    }
    await delay(2000);

    // Extract recruiter cards from the search page
    const recruiters = await p.evaluate(() => {
        let cards = document.querySelectorAll('.reusable-search__result-container');
        if (cards.length === 0) {
            cards = document.querySelectorAll('li[class*="search-result"], .search-result-card, .search-results__list > li, [data-chameleon-result-id]');
        }
        
        const items: { name: string; profileUrl: string; title: string }[] = [];
        
        cards.forEach(card => {
            // Find Title/Name Element
            let titleElement = card.querySelector('.entity-result__title-text a') as HTMLAnchorElement;
            if (!titleElement) {
                const anchors = Array.from(card.querySelectorAll('a'));
                titleElement = anchors.find(a => a.href && a.href.includes('/in/')) as HTMLAnchorElement;
            }
            
            // Find Subtitle/Description (Optional)
            const descElement = card.querySelector('.entity-result__primary-subtitle, [class*="subtitle"], [class*="description"]') as HTMLDivElement;
            
            // Find Message Button (Robust lookup)
            const interactiveElements = Array.from(card.querySelectorAll('button, a'));
            const messageBtn = interactiveElements.find(el => {
                const text = el.textContent ? el.textContent.trim().toLowerCase() : '';
                const aria = el.getAttribute('aria-label') ? el.getAttribute('aria-label')!.toLowerCase() : '';
                const href = el.getAttribute('href') ? el.getAttribute('href')!.toLowerCase() : '';
                
                return text === 'message' || 
                       aria.startsWith('message') || 
                       aria.includes('message') ||
                       href.includes('/messaging') ||
                       href.includes('/message');
            });
            
            // Target the recruiter if we have their profile URL and they are connectable/messageable
            if (titleElement && titleElement.href && messageBtn) {
                const name = titleElement.innerText.split('\n')[0].trim();
                const profileUrl = titleElement.href.split('?')[0]; // strip query params
                const title = descElement ? descElement.innerText.trim() : 'Recruiter';
                items.push({ name, profileUrl, title });
            }
        });
        return items;
    });

    console.log(`[linkedin-outreach] Found ${recruiters.length} target connections matching filters.`);

    // 3. Loop and message
    for (const target of recruiters.slice(0, dailyLimit)) {
        try {
            console.log(`[linkedin-outreach] Processing connection: ${target.name} | ${target.title}`);
            await p.goto(target.profileUrl, { waitUntil: 'load', timeout: 60000 });
            await delay(4000 + Math.random() * 3000); // Wait for profile page elements

            // Look for the primary "Message" button on the profile page
            let messageBtn = await p.$('button.pvs-profile-actions__action[aria-label*="Message"]');
            
            if (!messageBtn) {
                // If it's not immediately visible, search for buttons containing "Message" in text or aria-label
                const buttons = await p.$$('button');
                for (const btn of buttons) {
                    const label = await p.evaluate(el => el.getAttribute('aria-label') || el.innerText, btn);
                    if (label && label.toLowerCase().includes('message')) {
                        messageBtn = btn;
                        break;
                    }
                }
            }

            if (!messageBtn) {
                throw new Error('Could not find Message button on profile page');
            }

            console.log('[linkedin-outreach] Clicking Message button...');
            await messageBtn.click();
            await delay(3000);

            // Check if chat overlay bubble opened
            const chatSelector = '.msg-convo-wrapper, [class*="msg-overlay-conversation-bubble"]';
            await p.waitForSelector(chatSelector, { timeout: 10000 });

            // AVOID DUPLICATE MESSAGING:
            // Check if there is already an exchange of messages (e.g. message list has elements)
            const conversationExists = await p.evaluate(() => {
                const listItems = document.querySelectorAll('.msg-s-event-listitem, [class*="msg-s-event-listitem"]');
                return listItems.length > 0;
            });

            if (conversationExists) {
                console.log(`[linkedin-outreach] Skipping ${target.name} because a conversation history exists.`);
                results.push({ ...target, status: 'skipped_already_sent' });
                
                // Close the open chat box
                const closeBtn = await p.$('.msg-overlay-bubble-header__control--close-btn, button[class*="close-btn"]');
                if (closeBtn) await closeBtn.click();
                await delay(1000);
                continue;
            }

            // Fill message text
            const personalizedMsg = messageTemplate.replace('{{NAME}}', target.name.split(' ')[0]);
            
            // Wait for text input area
            const inputSelector = '.msg-form__contenteditable[contenteditable="true"], div[contenteditable="true"]';
            await p.waitForSelector(inputSelector, { timeout: 5000 });
            await p.focus(inputSelector);
            await delay(500);

            console.log('[linkedin-outreach] Typing message...');
            await p.keyboard.type(personalizedMsg, { delay: 30 });
            await delay(1500);

            // Upload PDF file
            console.log('[linkedin-outreach] Attaching resume file:', pdfPath);
            const fileInputSelector = 'input[type="file"][name="file"], input[type="file"]';
            const fileInput = await p.$(fileInputSelector);
            if (!fileInput) {
                throw new Error('File input field not found in chat box');
            }
            await fileInput.uploadFile(pdfPath);

            // Wait for file upload progress indicator to complete
            console.log('[linkedin-outreach] Waiting for file attachment to finish uploading...');
            await p.waitForSelector('.msg-form__attachment-uploading-state, [class*="uploading-state"]', { hidden: true, timeout: 30000 });
            await delay(2000);

            // Click Send button
            const sendBtnSelector = 'button.msg-form__send-button, button[type="submit"]';
            const sendBtn = await p.$(sendBtnSelector);
            if (!sendBtn) {
                throw new Error('Send button not found');
            }

            console.log('[linkedin-outreach] Clicking Send...');
            await sendBtn.click();
            await delay(3000);

            console.log(`[linkedin-outreach] SUCCESS: Sent message & resume to ${target.name}`);
            results.push({ ...target, status: 'sent' });

            // Close chat bubble
            const closeBtn = await p.$('.msg-overlay-bubble-header__control--close-btn, button[class*="close-btn"]');
            if (closeBtn) await closeBtn.click();
            await delay(1000);

            // Sleep between candidates (anti-scraping delay)
            const sleepTime = 12000 + Math.random() * 8000;
            console.log(`[linkedin-outreach] Sleeping for ${Math.round(sleepTime / 1000)}s...`);
            await delay(sleepTime);

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[linkedin-outreach] Error messaging ${target.name}:`, errMsg);
            results.push({ ...target, status: 'failed', error: errMsg });

            // Try closing the chat window in case of errors so the next attempt isn't blocked
            try {
                const closeBtn = await p.$('.msg-overlay-bubble-header__control--close-btn, button[class*="close-btn"]');
                if (closeBtn) await closeBtn.click();
            } catch (e) {}
            await delay(3000);
        }
    }

    // Keep browser active/running (since we closed chat boxes) or close it cleanly
    await closeBrowser();

    return results;
}
