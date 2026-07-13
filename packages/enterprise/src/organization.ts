export interface Agent {
  id: string;
  name: string;
  projectId: string;
  description?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  teamId: string;
  description?: string;
  agents: Agent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  userId: string;
  roleId: string; // Refers to the Role enum in RBAC
  joinedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  organizationId: string;
  description?: string;
  projects: Project[];
  members: TeamMember[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  teams: Team[];
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}
