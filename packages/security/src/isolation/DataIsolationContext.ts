/**
 * DataIsolationContext for multi-tenant boundaries.
 * Ensures that data access is restricted to the current tenant.
 */
export class DataIsolationContext {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Validates if the current context can access the provided resource.
   */
  canAccessResource(resourceTenantId: string): boolean {
    return this.tenantId === resourceTenantId;
  }

  /**
   * Injects tenant boundaries into database queries.
   */
  applyTenantFilter(query: any): any {
    return { ...query, tenantId: this.tenantId };
  }
}
