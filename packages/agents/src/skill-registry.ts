import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { CoreLogger } from '@aios/core';

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  path: string;
  instructions?: string;
}

export class SkillRegistry {
  private skills: Map<string, AgentSkill> = new Map();
  private logger: CoreLogger;
  private workspacePath: string;

  constructor(logger: CoreLogger, workspacePath: string) {
    this.logger = logger;
    this.workspacePath = workspacePath;
  }

  /**
   * Scans the workspace for installed skills (under .agents/skills and packages/skills)
   */
  async discoverSkills(): Promise<void> {
    const locations = [
      path.join(this.workspacePath, '.agents', 'skills'),
      path.join(this.workspacePath, 'packages', 'skills')
    ];

    for (const skillsDir of locations) {
      try {
        const exists = await fs.access(skillsDir).then(() => true).catch(() => false);
        if (!exists) {
          this.logger.info(`Skills directory not found at ${skillsDir}, skipping.`);
          continue;
        }

        const entries = await fs.readdir(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            await this.loadSkill(path.join(skillsDir, entry.name), entry.name);
          }
        }
        
        this.logger.info(`Loaded skills from ${skillsDir}. Total skills so far: ${this.skills.size}`);
      } catch (error) {
        this.logger.error(`Error discovering skills in ${skillsDir}: ${error}`);
      }
    }
  }

  private async loadSkill(skillPath: string, skillId: string): Promise<void> {
    const skillFile = path.join(skillPath, 'SKILL.md');
    try {
      const exists = await fs.access(skillFile).then(() => true).catch(() => false);
      if (!exists) return;

      const content = await fs.readFile(skillFile, 'utf-8');
      const parsed = matter(content);
      
      const name = parsed.data.name || skillId;
      const description = parsed.data.description || 'No description provided.';
      
      this.skills.set(skillId, {
        id: skillId,
        name,
        description,
        path: skillPath,
        instructions: parsed.content // The actual markdown body
      });
      
      this.logger.info(`Loaded skill: ${name} (${skillId})`);
    } catch (error) {
      this.logger.error(`Failed to load skill at ${skillPath}: ${error}`);
    }
  }

  public getSkills(): AgentSkill[] {
    return Array.from(this.skills.values());
  }

  public getSkill(id: string): AgentSkill | undefined {
    return this.skills.get(id);
  }
}
