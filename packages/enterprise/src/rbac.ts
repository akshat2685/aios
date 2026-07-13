import { CoreLogger } from '@aios/core';

export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  DEVELOPER = 'DEVELOPER',
  REVIEWER = 'REVIEWER',
  VIEWER = 'VIEWER'
}

export enum Permission {
  // Org level
  MANAGE_ORG = 'MANAGE_ORG',
  
  // Team level
  MANAGE_TEAMS = 'MANAGE_TEAMS',
  VIEW_TEAMS = 'VIEW_TEAMS',
  
  // Project level
  MANAGE_PROJECTS = 'MANAGE_PROJECTS',
  VIEW_PROJECTS = 'VIEW_PROJECTS',
  
  // Agent level
  MANAGE_AGENTS = 'MANAGE_AGENTS',
  VIEW_AGENTS = 'VIEW_AGENTS',
  EXECUTE_AGENTS = 'EXECUTE_AGENTS',
  
  // Workspace level
  READ_WORKSPACE = 'READ_WORKSPACE',
  WRITE_WORKSPACE = 'WRITE_WORKSPACE',
  EXECUTE_TOOL = 'EXECUTE_TOOL'
}

export class RBACManager {
  private logger: CoreLogger;
  private rolePermissions: Map<Role, Set<Permission>> = new Map();

  constructor(logger: CoreLogger) {
    this.logger = logger;
    this.setupDefaultRoles();
  }

  private setupDefaultRoles() {
    this.rolePermissions.set(Role.OWNER, new Set(Object.values(Permission)));
    
    this.rolePermissions.set(Role.ADMIN, new Set([
      Permission.MANAGE_TEAMS, Permission.VIEW_TEAMS,
      Permission.MANAGE_PROJECTS, Permission.VIEW_PROJECTS,
      Permission.MANAGE_AGENTS, Permission.VIEW_AGENTS, Permission.EXECUTE_AGENTS,
      Permission.READ_WORKSPACE, Permission.WRITE_WORKSPACE, Permission.EXECUTE_TOOL
    ]));

    this.rolePermissions.set(Role.DEVELOPER, new Set([
      Permission.VIEW_TEAMS,
      Permission.MANAGE_PROJECTS, Permission.VIEW_PROJECTS,
      Permission.MANAGE_AGENTS, Permission.VIEW_AGENTS, Permission.EXECUTE_AGENTS,
      Permission.READ_WORKSPACE, Permission.WRITE_WORKSPACE, Permission.EXECUTE_TOOL
    ]));

    this.rolePermissions.set(Role.REVIEWER, new Set([
      Permission.VIEW_TEAMS,
      Permission.VIEW_PROJECTS,
      Permission.VIEW_AGENTS,
      Permission.READ_WORKSPACE
    ]));
    
    this.rolePermissions.set(Role.VIEWER, new Set([
      Permission.VIEW_TEAMS,
      Permission.VIEW_PROJECTS,
      Permission.VIEW_AGENTS,
      Permission.READ_WORKSPACE
    ]));
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

/**
 * Express/Connect style middleware for checking a specific permission.
 */
export const requirePermission = (rbacManager: RBACManager, permission: Permission) => {
  return (req: any, res: any, next: any) => {
    try {
      const userRole = req.user?.role as Role;
      if (!userRole) {
        return res.status(401).json({ error: 'Unauthorized: No role provided' });
      }

      rbacManager.authorize(userRole, permission);
      next();
    } catch (error: any) {
      return res.status(403).json({ error: error.message });
    }
  };
};

/**
 * Express/Connect style middleware for requiring one of several roles.
 */
export const requireRole = (allowedRoles: Role[]) => {
  return (req: any, res: any, next: any) => {
    const userRole = req.user?.role as Role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: `Forbidden: Role ${userRole} is not allowed` });
    }
    next();
  };
};
