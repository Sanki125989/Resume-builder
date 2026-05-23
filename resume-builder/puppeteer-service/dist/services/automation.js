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
const puppeteer_1 = __importDefault(require("puppeteer"));
class AutomationService {
    constructor() {
        this.browser = null;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.browser = yield puppeteer_1.default.launch({ headless: true });
        });
    }
    loginToNaukri(username, password) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.browser) {
                throw new Error('Browser not initialized. Call init() first.');
            }
            const page = yield this.browser.newPage();
            yield page.goto('https://www.naukri.com/nlogin/login');
            yield page.type('input[name="username"]', username);
            yield page.type('input[name="password"]', password);
            yield Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation(),
            ]);
            return page;
        });
    }
    loginToLinkedIn(username, password) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.browser) {
                throw new Error('Browser not initialized. Call init() first.');
            }
            const page = yield this.browser.newPage();
            yield page.goto('https://www.linkedin.com/login');
            yield page.type('input[name="session_key"]', username);
            yield page.type('input[name="session_password"]', password);
            yield Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation(),
            ]);
            return page;
        });
    }
    extractJobDescription(page) {
        return __awaiter(this, void 0, void 0, function* () {
            // Implement logic to extract job description from the page
            const jobDescription = yield page.evaluate(() => {
                const descriptionElement = document.querySelector('.job-description');
                return descriptionElement ? descriptionElement.innerText : '';
            });
            return jobDescription;
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.browser) {
                yield this.browser.close();
                this.browser = null;
            }
        });
    }
}
exports.default = new AutomationService();
