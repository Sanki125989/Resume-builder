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
                headless: false, // Set to false to easily see the Easy Apply forms and step in if needed
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
            return false;
        }
    } catch (e) {
        console.error('[linkedin-login] error:', e);
        return false;
    }
}

export interface EasyApplyResult {
    jobTitle: string;
    company: string;
    status: 'applied' | 'skipped' | 'failed';
    error?: string;
}

/**
 * Automates LinkedIn Easy Apply applications.
 */
export async function automateLinkedInEasyApply(
    username: string,
    password: string,
    pdfPath: string,
    targetLimit: number = 5
): Promise<EasyApplyResult[]> {
    const results: EasyApplyResult[] = [];

    if (!fs.existsSync(pdfPath)) {
        throw new Error(`Local resume PDF not found at: ${pdfPath}`);
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
        const currentUrl = p.url();
        if (currentUrl.includes('/feed') || currentUrl.includes('/jobs') || currentUrl.includes('/search')) {
            verifyLoggedIn = true;
        }
    }
    
    if (!verifyLoggedIn) {
        throw new Error('LinkedIn authentication failed. Please check the browser window to resolve any CAPTCHA or 2FA prompts manually.');
    }
    console.log('[linkedin-outreach] Successfully verified logged-in session.');

    // 2. Navigate to recommended jobs filtered by Easy Apply (f_AL=true)
    const searchUrl = 'https://www.linkedin.com/jobs/search/?f_AL=true';
    console.log('[linkedin-jobs] Navigating to Easy Apply jobs search page...');
    await p.goto(searchUrl, { waitUntil: 'load', timeout: 60000 });

    try {
        console.log('[linkedin-jobs] Waiting for job search result cards to render...');
        await p.waitForSelector('.scaffold-layout__list-item, [class*="job-card-container"]', { timeout: 15000 });
    } catch (e) {
        console.log('[linkedin-jobs] No job cards rendered. Page might be loading slowly or filters yielded 0 results.');
    }
    await delay(3000);

    // Extract list item job IDs or selectors
    const jobListings = await p.evaluate(() => {
        const items = document.querySelectorAll('.scaffold-layout__list-item, [data-occluded-card-urn], [class*="job-card-container"]');
        const list: { jobId: string; selector: string }[] = [];
        
        items.forEach((item, index) => {
            const urn = item.getAttribute('data-occluded-card-urn') || item.getAttribute('data-job-id') || '';
            const titleEl = item.querySelector('[class*="job-title"], a.job-card-list__title');
            if (titleEl) {
                list.push({
                    jobId: urn || `index-${index}`,
                    selector: `.scaffold-layout__list-item:nth-child(${index + 1}), [class*="job-card-container"]:nth-child(${index + 1})`
                });
            }
        });
        return list;
    });

    console.log(`[linkedin-jobs] Scraped ${jobListings.length} job cards on current page. Starting applications...`);
    let appliedCount = 0;

    for (const listing of jobListings) {
        if (appliedCount >= targetLimit) {
            console.log(`[linkedin-jobs] Reached target application limit of ${targetLimit}. Finishing.`);
            break;
        }

        let jobTitle = 'Unknown Role';
        let companyName = 'Unknown Company';

        try {
            // Click on job card on the left panel to load details on the right panel
            console.log(`[linkedin-jobs] Clicking job card: ${listing.selector}`);
            const cardEl = await p.$(listing.selector);
            if (cardEl) {
                await cardEl.click();
                await delay(2500); // Wait for details pane to load
            } else {
                continue;
            }

            // Extract job title and company from the details panel
            const jobInfo = await p.evaluate(() => {
                const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title, [class*="job-title"]');
                const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name, [class*="company-name"]');
                return {
                    title: titleEl ? (titleEl as HTMLElement).innerText.trim() : 'Unknown Role',
                    company: companyEl ? (companyEl as HTMLElement).innerText.trim() : 'Unknown Company'
                };
            });
            jobTitle = jobInfo.title;
            companyName = jobInfo.company;
            console.log(`[linkedin-jobs] Inspecting: ${jobTitle} at ${companyName}`);

            // Look for "Easy Apply" button on the details panel
            // Button is usually within artdeco-button class or contains "Easy Apply" text
            let easyApplyBtn = await p.$('.jobs-apply-button, button.jobs-apply-button');
            if (!easyApplyBtn) {
                // Fallback: look for any button that contains the text "Easy Apply"
                const buttons = await p.$$('button');
                for (const btn of buttons) {
                    const text = await p.evaluate(el => el.innerText, btn);
                    if (text && text.trim() === 'Easy Apply') {
                        easyApplyBtn = btn;
                        break;
                    }
                }
            }

            if (!easyApplyBtn) {
                console.log(`[linkedin-jobs] 'Easy Apply' button not found for this role (might be already applied or redirects externally). Skipping.`);
                results.push({ jobTitle, company: companyName, status: 'skipped', error: 'Easy Apply button not found' });
                continue;
            }

            // Click the Easy Apply button
            console.log('[linkedin-jobs] Clicking Easy Apply...');
            await easyApplyBtn.click();
            await delay(2000);

            // Wait for modal dialog to open
            const modalSelector = '[role="dialog"], .jobs-easy-apply-modal';
            await p.waitForSelector(modalSelector, { timeout: 8000 });
            await delay(1000);

            // Process application steps
            let stepNum = 1;
            let skipped = false;
            let failed = false;

            while (true) {
                console.log(`[easy-apply] Processing step ${stepNum}...`);
                await delay(1000);

                // Check if we are on the final submit screen
                const submitBtn = await p.$('button[aria-label*="Submit"], button[data-easy-apply-submit-button]');
                const submitTextBtn = await findButtonByText(p, 'Submit application');
                const finalSubmitBtn = submitBtn || submitTextBtn;

                if (finalSubmitBtn) {
                    console.log('[easy-apply] Submit button detected! Submitting application...');
                    
                    // Answer any final page questions if present
                    await fillFormFields(p, pdfPath);
                    await delay(1000);

                    // Click Submit
                    await finalSubmitBtn.click();
                    await delay(4000); // Wait for submission progress

                    // Wait for the "Application sent" confirmation dialog close button
                    const closeConfirmationBtn = await p.$('button[aria-label*="Dismiss"], button[class*="dismiss"], button[class*="close"]');
                    if (closeConfirmationBtn) {
                        await closeConfirmationBtn.click();
                        await delay(1500);
                    } else {
                        // Press escape key as fallback to dismiss dialog
                        await p.keyboard.press('Escape');
                        await delay(1000);
                    }

                    console.log(`[easy-apply] SUCCESS: Applied to ${jobTitle} at ${companyName}!`);
                    results.push({ jobTitle, company: companyName, status: 'applied' });
                    appliedCount++;
                    break; // Application successful, exit the steps loop
                }

                // Check for Next / Review button to proceed to the next screen
                const nextBtn = await p.$('button[aria-label*="Next"], button[aria-label*="Review"], button[data-easy-apply-next-button]');
                const nextTextBtn = await findButtonByText(p, 'Next');
                const reviewTextBtn = await findButtonByText(p, 'Review');
                const proceedBtn = nextBtn || nextTextBtn || reviewTextBtn;

                if (proceedBtn) {
                    // Record current URL/state to check if we get stuck
                    const previousUrl = p.url();
                    const previousState = await p.evaluate(() => document.body.innerHTML.length);

                    // Answer form questions on this screen
                    console.log('[easy-apply] Filling form fields for this step...');
                    await fillFormFields(p, pdfPath);
                    await delay(1000);

                    // Click next step
                    console.log('[easy-apply] Clicking proceed button...');
                    await proceedBtn.click();
                    await delay(2500);

                    // Check if we got stuck (Next was clicked, but we didn't advance due to validation errors we couldn't solve)
                    const currentState = await p.evaluate(() => document.body.innerHTML.length);
                    if (p.url() === previousUrl && Math.abs(currentState - previousState) < 100) {
                        console.warn('[easy-apply] Stuck on same page after clicking Next (unresolved validation errors). Skipping job.');
                        skipped = true;
                        break;
                    }

                    stepNum++;
                } else {
                    console.warn('[easy-apply] No next/submit button found. Skipping this job.');
                    failed = true;
                    break;
                }
            }

            // If skipped or failed, we must close the open modal cleanly to proceed to the next card
            if (skipped || failed) {
                console.log('[easy-apply] Closing modal dialog and discarding application...');
                const dismissBtn = await p.$('button[aria-label="Dismiss"], button[class*="dismiss"]');
                if (dismissBtn) {
                    await dismissBtn.click();
                    await delay(1000);
                    
                    // Click the "Discard" button on the confirm popup
                    const discardConfirmBtn = await p.$('button[data-control-name="discard_application_confirm_btn"]');
                    const discardTextBtn = await findButtonByText(p, 'Discard');
                    const finalDiscardBtn = discardConfirmBtn || discardTextBtn;
                    
                    if (finalDiscardBtn) {
                        await finalDiscardBtn.click();
                        await delay(1000);
                    }
                }
                
                results.push({ 
                    jobTitle, 
                    company: companyName, 
                    status: skipped ? 'skipped' : 'failed',
                    error: skipped ? 'Stuck on form validation' : 'Form processing failed'
                });
            }

            // Stagger applications slightly to avoid rate limit flags
            await delay(5000 + Math.random() * 5000);

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[linkedin-jobs] Error applying to ${jobTitle}:`, errMsg);
            results.push({ jobTitle, company: companyName, status: 'failed', error: errMsg });

            // Force close modal in case of crash
            try {
                await p.keyboard.press('Escape');
                await delay(1000);
            } catch (e) {}
        }
    }

    await closeBrowser();
    return results;
}

/**
 * Helper to locate buttons by their text content.
 */
async function findButtonByText(page: Page, text: string) {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
        const btnText = await page.evaluate(el => el.innerText, btn);
        if (btnText && btnText.toLowerCase().includes(text.toLowerCase())) {
            return btn;
        }
    }
    return null;
}

/**
 * Automates answering of text, checkbox, radio and select inputs in the Easy Apply modal.
 */
async function fillFormFields(page: Page, pdfPath: string) {
    // 1. Upload Resume if required on this page
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
        console.log('[form-filler] Resume file input detected. Uploading PDF...');
        await fileInput.uploadFile(pdfPath);
        await delay(2000); // Wait for upload completion
    }

    // 2. Process all input elements on page
    await page.evaluate(() => {
        // Handle Radio Buttons (Yes/No questions)
        const radioWrappers = document.querySelectorAll('.fb-form-element, [class*="radio-button"]');
        radioWrappers.forEach(wrapper => {
            const labelText = (wrapper.textContent || '').toLowerCase();
            const radios = wrapper.querySelectorAll('input[type="radio"]') as NodeListOf<HTMLInputElement>;
            
            if (radios.length > 0) {
                // Determine whether to select Yes or No
                let selectYes = true;
                
                // If it asks for sponsorship, sponsorship requirement, visa sponsorship -> click "No" (we don't require visa sponsor)
                if (labelText.includes('sponsor') || labelText.includes('require visa') || labelText.includes('sponsorship')) {
                    selectYes = false;
                }
                
                // If it asks if authorized to work, citizen, completed degree -> click "Yes"
                if (labelText.includes('authorized') || labelText.includes('citizen') || labelText.includes('have you completed')) {
                    selectYes = true;
                }

                radios.forEach(radio => {
                    const valText = (radio.value || '').toLowerCase();
                    const radioLabel = (radio.parentElement?.textContent || '').toLowerCase();
                    
                    if (selectYes && (valText === 'yes' || valText === 'true' || radioLabel.includes('yes') || radioLabel.includes('true'))) {
                        radio.click();
                    } else if (!selectYes && (valText === 'no' || valText === 'false' || radioLabel.includes('no') || radioLabel.includes('false'))) {
                        radio.click();
                    }
                });
            }
        });

        // Handle Checkboxes
        const checkboxes = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        checkboxes.forEach(cb => {
            if (!cb.checked) {
                cb.click();
            }
        });

        // Handle Dropdowns (Select tags)
        const selects = document.querySelectorAll('select') as NodeListOf<HTMLSelectElement>;
        selects.forEach(select => {
            if (select.value === '' || select.selectedIndex === 0) {
                const labelText = (select.parentElement?.textContent || '').toLowerCase();
                let chosenVal = '';
                
                // Inspect options
                const options = Array.from(select.options);
                
                // Check for Yes/No in options
                let isSponsorship = labelText.includes('sponsor') || labelText.includes('sponsorship') || labelText.includes('require visa');
                
                let targetOption = options.find(opt => {
                    const text = opt.text.toLowerCase();
                    return isSponsorship ? text === 'no' : text === 'yes';
                });

                if (!targetOption) {
                    // Fallback to first non-empty option
                    targetOption = options.find(opt => opt.value !== '');
                }

                if (targetOption) {
                    select.value = targetOption.value;
                    // Trigger change event so page React/Angular handlers notice the update
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });

        // Handle Text Inputs (Numeric & string)
        const textInputs = document.querySelectorAll('input[type="text"], input[type="number"], textarea') as NodeListOf<HTMLInputElement | HTMLTextAreaElement>;
        textInputs.forEach(input => {
            if (input.value === '') {
                const labelText = (input.parentElement?.textContent || '').toLowerCase();
                let answer = '';

                // Check for experience questions
                if (labelText.includes('experience') || labelText.includes('years') || labelText.includes('how many')) {
                    answer = '4'; // Set to 4 years of experience (user has 4+ years)
                } else if (labelText.includes('salary') || labelText.includes('compensation') || labelText.includes('pay')) {
                    answer = '750000'; // Default average salary expectation in INR or leave blank
                } else if (labelText.includes('notice') || labelText.includes('days')) {
                    answer = '30'; // 30 days notice period
                } else {
                    // Default fallback answers
                    answer = input.getAttribute('type') === 'number' ? '4' : 'Yes';
                }

                input.value = answer;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    });
}
