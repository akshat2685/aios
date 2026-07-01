import { AgentTool } from '@aios/types';

import { SkillManager } from '../skill-manager';

export function getSkillReadTool(skillManager: SkillManager): AgentTool {
  return {
    name: 'skill:read',
    description: 'Read the instructions and documentation for an installed agent skill.',
    parameters: {
      type: 'object',
      properties: {
        skillId: { type: 'string', description: 'The ID (folder name) of the skill to read (e.g., "find-skills")' }
      },
      required: ['skillId']
    },
    execute: async (args: { skillId: string }) => {
      const skill = skillManager.getSkill(args.skillId);
      
      if (!skill) {
        return {
          success: false,
          data: `Skill '${args.skillId}' not found. Are you sure it is installed?`
        };
      }

      if (!skill.instructions) {
        return {
          success: false,
          data: `Skill '${args.skillId}' has no instructions in its SKILL.md.`
        };
      }

      return {
        success: true,
        data: `--- SKILL: ${skill.name} ---\n\n${skill.instructions}`
      };
    }
  };
}
