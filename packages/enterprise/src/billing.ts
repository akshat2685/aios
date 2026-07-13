export class BillingSystem {
  private userQuotas: Map<string, number> = new Map();
  private userTokens: Map<string, number> = new Map();

  constructor() {
    // Mock data for enterprise users
    this.userQuotas.set('valid-api-key-1', 10000);
    this.userQuotas.set('enterprise-key-premium', 1000000);
    
    this.userTokens.set('valid-api-key-1', 0);
    this.userTokens.set('enterprise-key-premium', 0);
  }

  public validateApiKey(apiKey: string): boolean {
    return this.userQuotas.has(apiKey);
  }

  public checkQuota(apiKey: string, requiredTokens: number): boolean {
    const quota = this.userQuotas.get(apiKey) || 0;
    const used = this.userTokens.get(apiKey) || 0;
    return (used + requiredTokens) <= quota;
  }

  public trackUsage(apiKey: string, tokens: number): void {
    if (this.validateApiKey(apiKey)) {
      const current = this.userTokens.get(apiKey) || 0;
      this.userTokens.set(apiKey, current + tokens);
      console.log(`[Billing System] Tracked ${tokens} tokens for ${apiKey}. Total used: ${current + tokens}`);
    }
  }
}

export const billingSystem = new BillingSystem();
