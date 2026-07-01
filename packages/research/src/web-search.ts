import axios from 'axios';
import * as cheerio from 'cheerio';
import { ResearchSource } from '@aios/types';
import { CoreLogger } from '@aios/core';
import qs from 'querystring';

export class WebSearchProvider {
  private logger: CoreLogger;
  private axiosInstance: any;

  constructor(logger: CoreLogger) {
    this.logger = logger;
    this.axiosInstance = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      }
    });
  }

  async search(query: string, maxResults: number = 5): Promise<ResearchSource[]> {
    this.logger.info(`Searching web for: ${query}`);
    const results: ResearchSource[] = [];

    // Method 1: Try DuckDuckGo Lite via form POST
    try {
      this.logger.info('Attempting DuckDuckGo Lite search...');
      const response = await this.axiosInstance.post(
        'https://lite.duckduckgo.com/lite/',
        qs.stringify({ q: query }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://lite.duckduckgo.com/',
          }
        }
      );

      const $ = cheerio.load(response.data);
      
      // Scrape results from the table rows
      $('table').last().find('tr').each((_, el) => {
        if (results.length >= maxResults) return;

        const link = $(el).find('a.result-link');
        if (link.length > 0) {
          let url = link.attr('href') || '';
          const title = link.text().trim();
          
          // Resolve DDG redirects
          if (url.includes('duckduckgo.com/l/?uddg=')) {
            const match = /uddg=([^&]+)/.exec(url);
            if (match) {
              url = decodeURIComponent(match[1]);
            }
          }

          if (url.startsWith('//')) {
            url = 'https:' + url;
          }

          // The next row usually holds the snippet in DDG Lite
          const nextRow = $(el).next();
          const snippet = nextRow.find('.result-snippet').text().trim();

          if (title && url) {
            results.push({
              title,
              url,
              snippet: snippet || '',
              content: '',
              timestamp: Date.now(),
              score: 1.0 - (results.length * 0.1),
            });
          }
        }
      });
    } catch (error: any) {
      this.logger.warn(`DuckDuckGo Lite search failed: ${error.message}. Trying Wikipedia fallback...`);
    }

    // Method 2: Fallback to Wikipedia API if DDG returns 0 results or fails
    if (results.length === 0) {
      try {
        this.logger.info('Attempting Wikipedia OpenSearch API fallback...');
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${maxResults}&namespace=0&format=json`;
        const wikiRes = await this.axiosInstance.get(wikiUrl);
        
        const data = wikiRes.data;
        if (Array.isArray(data) && data.length >= 4) {
          const [, titles, snippets, urls] = data;
          for (let i = 0; i < titles.length; i++) {
            if (results.length >= maxResults) break;
            results.push({
              title: titles[i],
              url: urls[i],
              snippet: snippets[i] || '',
              content: '',
              timestamp: Date.now(),
              score: 0.8 - (results.length * 0.05),
            });
          }
        }
      } catch (wikiError: any) {
        this.logger.error(`Wikipedia fallback search failed: ${wikiError.message}`);
      }
    }

    this.logger.info(`Web search returned ${results.length} results`);
    return results;
  }

  async fetchAndClean(url: string): Promise<{ title: string, content: string }> {
    this.logger.info(`Fetching and cleaning URL: ${url}`);
    try {
      const { data } = await this.axiosInstance.get(url);
      const $ = cheerio.load(data);

      // Remove unwanted noisy elements
      $('script, style, nav, footer, header, iframe, noscript, .ads, #comments, .comments, .sidebar').remove();

      const title = $('title').text().trim() || url;

      // Extract semantic text structures rather than raw body text
      const textBlocks: string[] = [];
      
      // Target headings and paragraphs
      $('h1, h2, h3, p, li').each((_, el) => {
        const text = $(el).text().trim();
        // Ignore headers/menus or extremely short links
        if (text.length > 30) {
          textBlocks.push(text);
        }
      });

      // Join blocks with paragraphs
      const content = textBlocks.join('\n\n') || $('body').text().replace(/\s+/g, ' ').trim();

      return {
        title,
        content: content.substring(0, 15000), // Cap size to avoid LLM context blowup
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch content from ${url}: ${error.message}`);
      throw error;
    }
  }
}