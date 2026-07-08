import { CoreLogger } from '@aios/core';

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
  GUEST = 'GUEST',
  AGENT = 'AGENT'
}

export enum Permission {
  READ_WORKSPACE = 'READ_WORKSPACE',
  WRITE_WORKSPACE = 'WRITE_WORKSPACE',
  EXECUTE_TOOL = 'EXECUTE_TOOL',
  MANAGE_ROLES = 'MANAGE_ROLES'
}

export class RBACManager {
  private logger: CoreLogger;
  private rolePermissions: Map<Role, Set<Permission>> = new Map();

  constructor(logger: CoreLogger) {
    this.logger = logger;
    this.setupDefaultRoles();
  }

  private setupDefaultRoles() {
    this.rolePermissions.set(Role.ADMIN, new Set(Object.values(Permission)));
    this.rolePermissions.set(Role.USER, new Set([Permission.READ_WORKSPACE, Permission.WRITE_WORKSPACE, Permission.EXECUTE_TOOL]));
    this.rolePermissions.set(Role.AGENT, new Set([Permission.READ_WORKSPACE, Permission.WRITE_WORKSPACE, Permission.EXECUTE_TOOL]));
    this.rolePermissions.set(Role.GUEST, new Set([Permission.READ_WORKSPACE]));
  }

  public hasPermission(role: Role, permission: Permission): boolean {
    const permissions = this.rolePermissions.get(role);
    if (!permissions) return false;
    return permissions.has(permission);
  }

  public authorize(role: Role, permission: Permission) {
    if (!this.hasPermission(role, permission)) {
      this.logger.warn(`Authorization failed: Role ${role} missing permission ${permission}`);
      throw new Error(`Unauthorized: Missing ${permission}`);
    }
  }
}
