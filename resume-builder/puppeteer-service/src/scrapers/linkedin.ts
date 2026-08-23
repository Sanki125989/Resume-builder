import puppeteer, { Browser, Page } from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';

let browser: Browser | null = null;
let page: Page | null = null;
let isInitializing = false;

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to make HTTP POST requests returning parsed JSON.
 */
function postJson(url: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
        try {
            const u = new URL(url);
            const postData = JSON.stringify(data);
            
            const options = {
                hostname: u.hostname,
                port: u.port || undefined,
                path: u.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.setEncoding('utf-8');
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${body}`));
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.write(postData);
            req.end();
        } catch (err) {
            reject(err);
        }
    });
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

    // 2. Navigate to the jobs search page, then apply the "Easy Apply" filter by clicking
    // the actual pill in the top filter bar (rather than only relying on a hand-built
    // f_AL=true URL param), so the filter is exercised the same way a real user applies it.
    console.log('[linkedin-jobs] Navigating to jobs search page...');
    await p.goto('https://www.linkedin.com/jobs/search/', { waitUntil: 'load', timeout: 60000 });
    await delay(3000);

    console.log('[linkedin-jobs] Applying "Easy Apply" filter from the top filter bar...');
    const easyApplyFilterPill = await p.$('#searchFilter_applyWithLinkedin');
    if (easyApplyFilterPill) {
        await easyApplyFilterPill.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await delay(500);
        await easyApplyFilterPill.click();
        await delay(3000);
    } else {
        console.log('[linkedin-jobs] Easy Apply filter pill not found in header bar. Falling back to direct URL param.');
    }

    // Traverse back to the URL to confirm the filter actually took effect (LinkedIn reflects
    // it as f_AL=true); fall back to navigating there directly if the click didn't stick.
    if (!p.url().includes('f_AL=true')) {
        console.log('[linkedin-jobs] URL does not reflect Easy Apply filter yet. Navigating directly as a fallback.');
        await p.goto('https://www.linkedin.com/jobs/search/?f_AL=true', { waitUntil: 'load', timeout: 60000 });
    } else {
        console.log('[linkedin-jobs] Easy Apply filter confirmed in URL:', p.url());
    }

    // LinkedIn nests several elements per job whose class contains "job-card-container"
    // (the link, metadata wrapper, footer wrapper, ...), so matching on that substring
    // pulls in many non-card elements per real job. The <li> list item is the one
    // reliable one-per-job container.
    const cardSelector = 'li.scaffold-layout__list-item';
    try {
        console.log('[linkedin-jobs] Waiting for job search result cards to render...');
        await p.waitForSelector(cardSelector, { timeout: 15000 });
    } catch (e) {
        console.log('[linkedin-jobs] No job cards rendered. Page might be loading slowly or filters yielded 0 results.');
    }
    await delay(3000);

    console.log('[linkedin-jobs] Starting job applications processing...');
    let appliedCount = 0;
    let cardIndex = 0;
    // A LinkedIn search results page renders ~25 cards; scale the attempt cap to the
    // requested limit so a large targetLimit isn't cut short after only 15 cards.
    const maxAttempts = Math.max(targetLimit + 5, 30);

    while (appliedCount < targetLimit && cardIndex < maxAttempts) {
        console.log(`[linkedin-jobs] Attempting card index ${cardIndex}...`);
        
        // Scroll the list container to bring the card into view and trigger lazy loading
        await p.evaluate((idx) => {
            const listContainer = document.querySelector('.jobs-search-results-list, .scaffold-layout__list');
            if (listContainer) {
                listContainer.scrollTop = idx * 120;
            }
        }, cardIndex);
        await delay(1000);

        // Re-query the cards to get fresh element handles
        const cards = await p.$$(cardSelector);
        if (cardIndex >= cards.length) {
            console.log(`[linkedin-jobs] Reached end of visible cards list (found ${cards.length} cards, index ${cardIndex}).`);
            break;
        }

        const cardEl = cards[cardIndex];
        
        // Check if it's a valid job card (contains job title)
        const isJobCard = await p.evaluate((el) => {
            const titleEl = el.querySelector('a.job-card-list__title--link, a[href*="/jobs/view/"], a.job-card-list__title, [class*="job-title"]');
            return titleEl !== null;
        }, cardEl);

        if (!isJobCard) {
            console.log(`[linkedin-jobs] Element at index ${cardIndex} is not a valid job card. Skipping.`);
            cardIndex++;
            continue;
        }

        let jobTitle = 'Unknown Role';
        let companyName = 'Unknown Company';
        try {
            const cardInfo = await p.evaluate((el) => {
                const titleEl = el.querySelector('a.job-card-list__title--link, a[href*="/jobs/view/"], a.job-card-list__title, [class*="job-title"]');
                const companyEl = el.querySelector('.artdeco-entity-lockup__subtitle, .job-card-container__company-name, .job-card-list__subtitle, [class*="company-name"]');
                // The title anchor's aria-label carries the clean full title; innerText would
                // double up since LinkedIn renders both an aria-hidden and a visually-hidden span.
                const title = titleEl
                    ? (titleEl.getAttribute('aria-label') || (titleEl as HTMLElement).innerText).trim()
                    : 'Unknown Role';
                return {
                    title,
                    company: companyEl ? (companyEl as HTMLElement).innerText.trim() : 'Unknown Company'
                };
            }, cardEl);
            jobTitle = cardInfo.title;
            companyName = cardInfo.company;
        } catch (e) {
            console.warn(`[linkedin-jobs] Error extracting card info:`, e);
        }

        console.log(`[linkedin-jobs] Clicking job card #${cardIndex}: ${jobTitle} at ${companyName}`);
        
        try {
            // Scroll the card itself into view and click
            await p.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), cardEl);
            await delay(1000);
            await cardEl.click();
            await delay(3000); // Wait for details pane to load
        } catch (clickErr) {
            console.error(`[linkedin-jobs] Failed to click card at index ${cardIndex}:`, clickErr);
            cardIndex++;
            continue;
        }

        // Extract job title and description from the details pane to ensure accuracy
        let jobDescription = '';
        try {
            const details = await p.evaluate(() => {
                const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title, [class*="job-title"]');
                const descEl = document.querySelector('.jobs-description__container, .jobs-description, [class*="description"]');
                return {
                    title: titleEl ? (titleEl as HTMLElement).innerText.trim() : '',
                    description: descEl ? (descEl as HTMLElement).innerText.trim() : ''
                };
            });
            if (details.title) {
                jobTitle = details.title;
            }
            jobDescription = details.description;
        } catch (e) {
            console.warn('[linkedin-jobs] Error extracting job details from details pane:', e);
        }

        // Real-Time Resume Tailoring: call Spring Boot backend
        let currentPdfPath = pdfPath;
        if (jobDescription) {
            console.log(`[linkedin-jobs] Requesting tailored resume compilation from backend for: ${jobTitle}`);
            try {
                const tailorRes = await postJson('http://localhost:8085/api/linkedin/tailor-resume', {
                    jobTitle,
                    jobDescription
                });
                if (tailorRes && tailorRes.success && tailorRes.pdfPath) {
                    currentPdfPath = tailorRes.pdfPath;
                    console.log(`[linkedin-jobs] Tailored resume compiled successfully at: ${currentPdfPath}`);
                } else {
                    console.warn('[linkedin-jobs] Backend failed to compile tailored resume. Using default resume.');
                }
            } catch (tailorErr) {
                console.error('[linkedin-jobs] Error calling tailoring endpoint. Using default resume:', tailorErr);
            }
        } else {
            console.warn('[linkedin-jobs] Job description is empty. Using default resume.');
        }

        // Look for "Easy Apply" button on the details panel
        let easyApplyBtn = await p.$('.jobs-apply-button, button.jobs-apply-button, [class*="apply-button"]');
        if (!easyApplyBtn) {
            // Fallback: look for any button that contains the text "Easy Apply"
            const buttons = await p.$$('button');
            for (const btn of buttons) {
                const text = await p.evaluate(el => el.innerText, btn);
                if (text && text.trim().toLowerCase() === 'easy apply') {
                    easyApplyBtn = btn;
                    break;
                }
            }
        }

        if (!easyApplyBtn) {
            console.log(`[linkedin-jobs] 'Easy Apply' button not found for: ${jobTitle} at ${companyName} (might be already applied or redirects externally).`);
            results.push({ jobTitle, company: companyName, status: 'skipped', error: 'Easy Apply button not found' });
            cardIndex++;
            continue;
        }

        // Click the Easy Apply button
        console.log('[linkedin-jobs] Clicking Easy Apply...');
        try {
            await easyApplyBtn.click();
            await delay(2000);
        } catch (clickErr) {
            console.error('[linkedin-jobs] Failed to click Easy Apply button:', clickErr);
            cardIndex++;
            continue;
        }

        // Wait for modal dialog to open
        const modalSelector = '[role="dialog"], .jobs-easy-apply-modal';
        try {
            await p.waitForSelector(modalSelector, { timeout: 8000 });
        } catch (e) {
            console.log(`[linkedin-jobs] Modal dialog did not appear for ${jobTitle}. Skipping.`);
            results.push({ jobTitle, company: companyName, status: 'skipped', error: 'Modal did not appear' });
            cardIndex++;
            continue;
        }
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
            const submitTextBtn = await findButtonByText(p, 'Submit application') || await findButtonByText(p, 'Submit');
            const finalSubmitBtn = submitBtn || submitTextBtn;

            if (finalSubmitBtn) {
                console.log('[easy-apply] Submit button detected! Submitting application...');
                
                // Answer any final page questions if present
                await fillFormFields(p, currentPdfPath);
                await delay(1000);

                // Scroll down the modal content to ensure all fields are visible/interacted with
                await p.evaluate(() => {
                    const modalContent = document.querySelector('.jobs-easy-apply-modal__content, .jobs-easy-apply-modal, [role="dialog"]');
                    if (modalContent) {
                        modalContent.scrollTop = modalContent.scrollHeight;
                    }
                    window.scrollTo(0, document.body.scrollHeight);
                });
                await delay(1500);

                // Click Submit
                console.log('[easy-apply] Clicking Submit...');
                await finalSubmitBtn.click();
                await delay(4000); // Wait for submission progress

                // Check if submission succeeded
                let submitSuccess = false;
                for (let attempt = 0; attempt < 8; attempt++) {
                    await delay(500);
                    const isSuccessPage = await p.evaluate(() => {
                        const text = document.body.innerText.toLowerCase();
                        return text.includes('application sent') || text.includes('applied successfully') || text.includes('success');
                    });
                    if (isSuccessPage) {
                        submitSuccess = true;
                        break;
                    }
                }

                if (submitSuccess) {
                    console.log(`[easy-apply] SUCCESS: Applied to ${jobTitle} at ${companyName}!`);
                    results.push({ jobTitle, company: companyName, status: 'applied' });
                    appliedCount++;
                    
                    // Close the confirmation dialog
                    const closeConfirmationBtn = await p.$('button[aria-label*="Dismiss"], button[class*="dismiss"], button[class*="close"]');
                    if (closeConfirmationBtn) {
                        await closeConfirmationBtn.click();
                        await delay(1500);
                    } else {
                        await p.keyboard.press('Escape');
                        await delay(1000);
                    }
                } else {
                    console.warn('[easy-apply] Submission confirmation not detected. Checking if stuck or failed...');
                    const hasError = await p.evaluate(() => {
                        return document.querySelector('.artdeco-inline-feedback--error, [data-test-form-element-error-messages]') !== null;
                    });
                    if (hasError) {
                        console.error('[easy-apply] Submission failed due to validation errors on review page.');
                        failed = true;
                    } else {
                        // Check if submit button is still there
                        const isSubmitBtnStillThere = await p.$('button[aria-label*="Submit"], button[data-easy-apply-submit-button]');
                        if (!isSubmitBtnStillThere) {
                            console.log('[easy-apply] Submit button disappeared, assuming success.');
                            results.push({ jobTitle, company: companyName, status: 'applied' });
                            appliedCount++;
                        } else {
                            console.error('[easy-apply] Submit button still present and no success confirmation.');
                            failed = true;
                        }
                    }
                }
                break; // Exit the steps loop
            }

            // Check for Next / Review / Continue button to proceed to the next screen
            const nextBtn = await p.$('button[aria-label*="Next"], button[aria-label*="Review"], button[aria-label*="Continue"], button[data-easy-apply-next-button]');
            const nextTextBtn = await findButtonByText(p, 'Next');
            const reviewTextBtn = await findButtonByText(p, 'Review');
            const continueTextBtn = await findButtonByText(p, 'Continue');
            const nextStepTextBtn = await findButtonByText(p, 'Next step');
            const proceedBtn = nextBtn || nextTextBtn || reviewTextBtn || continueTextBtn || nextStepTextBtn;

            if (proceedBtn) {
                // Record current modal text before clicking
                const previousText = await p.evaluate(() => {
                    const modal = document.querySelector('[role="dialog"], .jobs-easy-apply-modal');
                    return modal ? (modal as HTMLElement).innerText : '';
                });

                // Answer form questions on this screen
                console.log('[easy-apply] Filling form fields for this step...');
                await fillFormFields(p, currentPdfPath);
                await delay(1000);

                // Click next step
                console.log('[easy-apply] Clicking proceed button...');
                await proceedBtn.click();
                
                // Wait and check if the modal updated
                let transitionSuccess = false;
                for (let attempt = 0; attempt < 10; attempt++) {
                    await delay(500);
                    const currentModal = await p.$('[role="dialog"], .jobs-easy-apply-modal');
                    if (!currentModal) {
                        // Modal disappeared, which is a state change (e.g. submitted or closed)
                        transitionSuccess = true;
                        break;
                    }
                    const currentText = await p.evaluate(el => (el as HTMLElement).innerText, currentModal);
                    if (currentText !== previousText) {
                        // Text changed, let's check for errors
                        const hasError = await p.evaluate(() => {
                            return document.querySelector('.artdeco-inline-feedback--error, [data-test-form-element-error-messages]') !== null;
                        });
                        if (hasError) {
                            console.log('[easy-apply] Validation error detected after clicking proceed.');
                            break; // Keep transitionSuccess as false
                        }
                        transitionSuccess = true;
                        break;
                    }
                }

                if (!transitionSuccess) {
                    console.warn('[easy-apply] Stuck on same page after clicking proceed (unresolved validation errors). Skipping job.');
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
            } else {
                // Try Escape key if dismiss button not found
                await p.keyboard.press('Escape');
                await delay(1000);
            }
            
            results.push({ 
                jobTitle, 
                company: companyName, 
                status: skipped ? 'skipped' : 'failed',
                error: skipped ? 'Stuck on form validation' : 'Form processing failed'
            });
        }

        // Increment card index to move to next card
        cardIndex++;

        // Stagger applications slightly to avoid rate limit flags
        await delay(5000 + Math.random() * 5000);
    }

    await closeBrowser();
    return results;
}

/**
 * Helper to locate buttons by their text content.
 */
async function findButtonByText(page: Page, text: string) {
    try {
        const buttons = await page.$$('button');
        for (const btn of buttons) {
            try {
                const btnText = await page.evaluate(el => (el as HTMLElement).innerText, btn);
                if (btnText && btnText.toLowerCase().includes(text.toLowerCase())) {
                    return btn;
                }
            } catch (e) {
                // Ignore errors for individual buttons (e.g. if detached)
            }
        }
    } catch (e) {
        console.error(`[linkedin-jobs] Error finding button by text: ${text}`, e);
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
        await delay(3000); // Wait for upload completion to be safe
    }

    // 2. Handle Radio Buttons, Checkboxes, and Select Dropdowns (via page.evaluate)
    await page.evaluate(() => {
        // Handle Radio Buttons (Yes/No questions & Demographics)
        const radioWrappers = document.querySelectorAll('.fb-form-element, [class*="radio-button"]');
        radioWrappers.forEach(wrapper => {
            const labelText = (wrapper.textContent || '').toLowerCase();
            const radios = wrapper.querySelectorAll('input[type="radio"]') as NodeListOf<HTMLInputElement>;
            
            if (radios.length > 0) {
                // Check if any radio in this group is already checked
                const isAnyChecked = Array.from(radios).some(r => r.checked);
                if (isAnyChecked) return;

                // Determine whether to select Yes or No
                let selectYes = true;
                
                // If it asks for sponsorship, sponsorship requirement, visa sponsorship -> click "No"
                if (labelText.includes('sponsor') || labelText.includes('require visa') || labelText.includes('sponsorship')) {
                    selectYes = false;
                }
                
                // If it asks if authorized to work, citizen, completed degree -> click "Yes"
                if (labelText.includes('authorized') || labelText.includes('citizen') || labelText.includes('have you completed')) {
                    selectYes = true;
                }

                let clicked = false;
                radios.forEach(radio => {
                    const valText = (radio.value || '').toLowerCase();
                    const radioLabel = (radio.parentElement?.textContent || '').toLowerCase();
                    
                    if (selectYes && (valText === 'yes' || valText === 'true' || radioLabel.includes('yes') || radioLabel.includes('true'))) {
                        radio.click();
                        clicked = true;
                    } else if (!selectYes && (valText === 'no' || valText === 'false' || radioLabel.includes('no') || radioLabel.includes('false'))) {
                        radio.click();
                        clicked = true;
                    }
                });

                // If we didn't click anything, look for decline/prefer not to say, or default to the first option
                if (!clicked) {
                    let defaultRadio = Array.from(radios).find(radio => {
                        const radioLabel = (radio.parentElement?.textContent || '').toLowerCase();
                        return radioLabel.includes('decline') || radioLabel.includes('prefer not') || radioLabel.includes('wish not') || radioLabel.includes('no answer');
                    });
                    if (!defaultRadio) {
                        defaultRadio = radios[0];
                    }
                    if (defaultRadio) {
                        defaultRadio.click();
                    }
                }
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
            if (select.value === '' || select.selectedIndex === 0 || select.value === undefined) {
                const labelText = (select.parentElement?.textContent || '').toLowerCase();
                const options = Array.from(select.options);
                
                let isSponsorship = labelText.includes('sponsor') || labelText.includes('sponsorship') || labelText.includes('require visa');
                
                let targetOption = options.find(opt => {
                    const text = opt.text.toLowerCase();
                    return isSponsorship ? text === 'no' : text === 'yes';
                });

                if (!targetOption) {
                    targetOption = options.find(opt => {
                        const text = opt.text.toLowerCase();
                        return text.includes('decline') || text.includes('prefer not') || text.includes('wish not') || text.includes('no answer');
                    });
                }

                if (!targetOption) {
                    targetOption = options.find(opt => opt.value !== '');
                }

                if (targetOption) {
                    select.value = targetOption.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
    });

    // 3. Handle Text/Numeric/Textarea Inputs using Puppeteer's native type() to ensure React state updates correctly
    const textInputs = await page.$$('input[type="text"], input[type="number"], textarea');
    for (const input of textInputs) {
        // Check if the input is actually visible and not hidden
        const isVisible = await page.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
        }, input);
        
        if (!isVisible) {
            continue;
        }

        const value = await page.evaluate(el => (el as HTMLInputElement | HTMLTextAreaElement).value, input);
        if (value === '') {
            // Get the context label text
            const labelText = await page.evaluate(el => {
                const container = el.closest('.fb-form-element, [class*="form-element"]') || el.parentElement;
                return container ? (container.textContent || '').toLowerCase() : '';
            }, input);

            let answer = '';
            // Determine answer based on label keywords
            if (labelText.includes('experience') || labelText.includes('years') || labelText.includes('how many')) {
                answer = '4'; // Default to 4 years
            } else if (labelText.includes('salary') || labelText.includes('compensation') || labelText.includes('pay')) {
                answer = '750000'; // Default average salary expectation (INR or other currency)
            } else if (labelText.includes('notice') || labelText.includes('days')) {
                answer = '30'; // 30 days notice period
            } else {
                const type = await page.evaluate(el => el.getAttribute('type'), input);
                answer = type === 'number' ? '4' : 'Yes';
            }

            console.log(`[form-filler] Typing answer "${answer}" for field with label context: "${labelText.substring(0, 80).replace(/\n/g, ' ')}"`);
            
            // Focus and type
            await input.focus();
            
            // Clear existing content just in case
            await page.keyboard.down('Control');
            await page.keyboard.press('A');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');
            
            await input.type(answer, { delay: 50 });
            await delay(300);
        }
    }
}
