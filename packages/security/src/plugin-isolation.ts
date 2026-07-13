export class PluginSandbox {
  private allowedModules: Set<string>;
  private networkAllowed: boolean;
  
  constructor(config: { allowedModules?: string[], networkAllowed?: boolean } = {}) {
    this.allowedModules = new Set(config.allowedModules || []);
    this.networkAllowed = config.networkAllowed || false;
  }

  public validateImport(moduleName: string): boolean {
    if (['fs', 'child_process', 'os', 'net', 'http', 'https'].includes(moduleName) && !this.allowedModules.has(moduleName)) {
      return false;
    }
    return true;
  }

  public canMakeNetworkRequest(url: string): boolean {
    return this.networkAllowed;
  }
}
