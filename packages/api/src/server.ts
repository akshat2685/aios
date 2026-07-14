import express from 'express';
import cors from 'cors';
import { CoreLogger } from '@aios/core';
import crypto from 'crypto';

// Generate a runtime secret for secure IPC if not provided in env
export const IPC_SECRET = process.env.AIOS_IPC_SECRET || crypto.randomBytes(32).toString('hex');
process.env.AIOS_IPC_SECRET = IPC_SECRET; // Ensure it's available globally

const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers['authorization'] || req.headers['x-ipc-token'];
  const expectedToken = `Bearer ${IPC_SECRET}`;
  
  if (!token || typeof token !== 'string' || token.length !== expectedToken.length) {
    return res.status(401).json({ error: 'Unauthorized: Invalid IPC token' });
  }
  
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);
  
  if (!crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid IPC token' });
  }
  
  next();
};

export class APIServer {
  private app: express.Application;
  private logger: CoreLogger;
  private port: number;

  constructor(logger: CoreLogger, port: number = 3000) {
    this.logger = logger;
    this.port = port;
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    
    // Secure IPC and local endpoints
    this.app.use(authMiddleware);
    
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', version: '0.1.0' });
    });

    this.app.post('/api/chat', (req, res) => {
      res.json({ response: 'Chat received.' });
    });

    this.app.get('/api/memory', (req, res) => {
      res.json({ data: [] });
    });

    this.app.get('/api/workflow', (req, res) => {
      res.json({ workflows: [] });
    });

    this.app.get('/api/workspace', (req, res) => {
      res.json({ activeWorkspace: null });
    });

    this.app.get('/api/router', (req, res) => {
      res.json({ status: 'online' });
    });
  }

  public start() {
    // Bind exclusively to localhost for security
    this.app.listen(this.port, '127.0.0.1', () => {
      this.logger.info(`AIOS API Server listening securely on 127.0.0.1:${this.port}`);
      this.logger.info(`IPC Token initialized for internal communications.`);
    });
  }
}
