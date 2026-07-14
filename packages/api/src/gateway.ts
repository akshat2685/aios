import express, { Request, Response, NextFunction } from 'express';
import { billingSystem } from '../../enterprise/src/billing';

const app = express();
app.use(express.json());

// Mock rate limiting storage (in-memory)
const rateLimits: Map<string, { count: number, resetTime: number }> = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;

// Periodic cleanup to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimits.entries()) {
    if (now >= value.resetTime) {
      rateLimits.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

// Middleware: Enforces Rate Limits
function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    res.status(401).json({ error: 'Missing x-api-key header' });
    return;
  }

  const now = Date.now();
  const userRate = rateLimits.get(apiKey);

  if (userRate && now < userRate.resetTime) {
    if (userRate.count >= MAX_REQUESTS_PER_WINDOW) {
      res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
      return;
    }
    userRate.count++;
  } else {
    rateLimits.set(apiKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
  }

  next();
}

// Middleware: Validates API Keys and Checks Billing Quotas
function authAndQuotaManager(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!billingSystem.validateApiKey(apiKey)) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  // Estimate required tokens (mock logic: 10 tokens per request)
  const estimatedTokens = 10;
  
  if (!billingSystem.checkQuota(apiKey, estimatedTokens)) {
    res.status(402).json({ error: 'Billing quota exceeded' });
    return;
  }

  // Attach estimated tokens to request for tracking after processing
  (req as any).estimatedTokens = estimatedTokens;

  next();
}

import { InputValidator } from '../../security/src/input-validation';

// Middleware: Validate Payload
function payloadValidator(req: Request, res: Response, next: NextFunction): void {
  const payloadStr = JSON.stringify(req.body);
  if (!InputValidator.validateNoScripts(payloadStr)) {
    res.status(400).json({ error: 'Invalid payload: Contains forbidden script elements' });
    return;
  }
  next();
}

// Secure ingress routing mechanism
export const gatewayRouter = express.Router();

gatewayRouter.use(rateLimiter);
gatewayRouter.use(authAndQuotaManager);
gatewayRouter.use(payloadValidator);

// Route external traffic to the orchestrator
gatewayRouter.post('/orchestrator/v1/execute', (req: Request, res: Response) => {
  const apiKey = req.headers['x-api-key'] as string;
  const tokens = (req as any).estimatedTokens;
  const payload = req.body;

  console.log('[Gateway Router] Routing external traffic to orchestrator with payload:', payload);

  // Track token usage after successful processing
  billingSystem.trackUsage(apiKey, tokens);

  res.json({
    status: 'success',
    message: 'Task successfully routed and submitted to orchestrator.',
    tokensUsed: tokens
  });
});

app.use('/api', gatewayRouter);

// Start the server (for testing purposes)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[Enterprise API Gateway] Listening on port ${PORT}`);
  });
}

export default app;
