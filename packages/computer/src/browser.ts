import puppeteer from 'puppeteer-core';
import { CoreLogger } from '@aios/core';

export class BrowserController {
  private logger: CoreLogger;
  private browser: any = null;
  
  constructor(logger: CoreLogger) {
    this.logger = logger;
  }

  async init(executablePath?: string) {
    if (this.browser) return;
    
    // Fallback paths for common OS
    const defaultPath = process.platform === 'win32' 
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : '/usr/bin/google-chrome';

    try {
      this.browser = await puppeteer.launch({
        executablePath: executablePath || defaultPath,
        headless: false,
      });
      this.logger.info('Browser controller initialized');
    } catch (e: any) {
      this.logger.error(`Failed to launch browser: ${e.message}`);
    }
  }

  async goto(url: string): Promise<string> {
    if (!this.browser) {
      await this.init();
    }
    if (!this.browser) return 'Browser unavailable';

    const page = await this.browser.newPage();
    await page.goto(url);
    const content = await page.content();
    this.logger.info(`Navigated to ${url}`);
    
    // Cleanup page to save memory for basic goto
    await page.close();
    
    // We could extract meaningful text instead of raw HTML here
    return content.substring(0, 5000); 
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.info('Browser controller closed');
    }
  }
}
