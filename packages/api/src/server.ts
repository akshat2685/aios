import express from 'express';
import cors from 'cors';
import { CoreLogger } from '@aios/core';

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
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', version: '0.1.0' });
    });

    this.app.post('/api/chat', (req, res) => {
      // Placeholder for routing chat to agents
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
    this.app.listen(this.port, () => {
      this.logger.info(`AIOS API Server listening on port ${this.port}`);
    });
  }
}
