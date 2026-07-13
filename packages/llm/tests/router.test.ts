import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMRouter } from '../src/router';

describe('LLMRouter', () => {
    let router: any;
    let mockConfig: any;
    let mockSecurity: any;
    let mockLogger: any;

    beforeEach(() => {
        mockConfig = {
            providers: {
                ollama: { baseUrl: 'http://localhost:11434' },
                openai: {},
            },
            routingProfile: 'BALANCED',
            cloudMode: 'local',
            routingMode: 'automatic'
        };
        mockSecurity = { getSecret: vi.fn() };
        mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
        
        (global as any).TelemetryEngine = {
            getInstance: vi.fn(() => ({
                logCircuit: vi.fn(),
                logSystem: vi.fn(),
                logRequest: vi.fn(),
                logError: vi.fn(),
                logCache: vi.fn()
            }))
        };
        
        router = new LLMRouter(mockConfig as any, mockSecurity as any, mockLogger as any);
    });

    it('should select local model when cloudMode is local', () => {
        const request: any = { prompt: 'Hello', taskType: 'GENERAL_CHAT' };
        
        vi.spyOn(router as any, 'selectBestModel').mockReturnValue({
            providerId: 'ollama',
            model: 'llama3',
            decision: {}
        });

        const best = router.resolveTask(request);
        expect(best.providerId).toBe('ollama');
    });

    it('should trigger fallback when primary provider is unavailable', () => {
        const request: any = { prompt: 'Hello', taskType: 'GENERAL_CHAT' };
        
        vi.spyOn(router as any, 'selectBestModel').mockReturnValue({
            providerId: 'openai',
            model: 'gpt-4o',
            decision: {}
        });
        
        const best = router.resolveTask(request);
        expect(best.providerId).toBe('openai');
    });
});
