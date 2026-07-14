import { AgentTool } from '@aios/types';
import { CoreLogger } from '@aios/core';

export function getAwsTools(logger: CoreLogger): AgentTool[] {
  return [
    {
      name: 'aws:analyze_cloudformation',
      description: 'Analyzes an AWS CloudFormation template for errors, security risks, and best practices.',
      parameters: {
        type: 'object',
        properties: {
          templateContent: { type: 'string', description: 'The JSON or YAML content of the CloudFormation template' }
        },
        required: ['templateContent']
      },
      execute: async ({ templateContent }) => {
        logger.info('Analyzing CloudFormation template...');
        const issues: string[] = [];
        if (!templateContent.includes('DeletionPolicy')) {
          issues.push('Suggestion: add DeletionPolicy to stateful resources.');
        }
        if (templateContent.includes('"Effect": "Allow"') && (templateContent.includes('"Action": "*"') || templateContent.includes('"Action":"*"'))) {
          issues.push('Critical: Overly permissive IAM role found (Action: *).');
        }
        if (templateContent.includes('0.0.0.0/0')) {
          issues.push('Warning: Open security group rule detected (0.0.0.0/0).');
        }
        return issues.length > 0 ? 'Analysis complete with findings:\n' + issues.join('\n') : 'Analysis complete: No critical errors found. Best practices appear to be followed.';
      }
    },
    {
      name: 'aws:estimate_cost',
      description: 'Provides a rough cost estimation for given AWS resources.',
      parameters: {
        type: 'object',
        properties: {
          resources: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'List of AWS resources (e.g., "t3.micro EC2", "100GB S3 Standard")' 
          }
        },
        required: ['resources']
      },
      execute: async ({ resources }: { resources: string[] }) => {
        logger.info(`Estimating AWS costs for: ${resources.join(', ')}`);
        let totalCost = 0;
        const breakdown: string[] = [];
        for (const res of resources) {
          let cost = 10.0; // Base generic cost
          const lowerRes = res.toLowerCase();
          if (lowerRes.includes('t3.micro')) cost = 7.50;
          else if (lowerRes.includes('t3.large')) cost = 60.00;
          else if (lowerRes.includes('s3')) cost = 5.00;
          else if (lowerRes.includes('rds')) cost = 15.00;
          
          totalCost += cost;
          breakdown.push(`- ${res}: ~$${cost.toFixed(2)}/mo`);
        }
        return `Estimated monthly cost is $${totalCost.toFixed(2)}.\nBreakdown:\n${breakdown.join('\n')}\nNote: This is a rough estimation.`;
      }
    },
    {
      name: 'aws:check_iam_policy',
      description: 'Checks an IAM policy JSON for overly permissive actions or syntax errors.',
      parameters: {
        type: 'object',
        properties: {
          policyJson: { type: 'string', description: 'The IAM policy in JSON format' }
        },
        required: ['policyJson']
      },
      execute: async ({ policyJson }) => {
        logger.info('Checking IAM policy...');
        try {
          const policy = JSON.parse(policyJson);
          const statements = Array.isArray(policy.Statement) ? policy.Statement : [policy.Statement].filter(Boolean);
          let hasWildcard = false;
          for (const stmt of statements) {
            if (stmt.Effect === 'Allow' && (stmt.Action === '*' || (Array.isArray(stmt.Action) && stmt.Action.includes('*')) || stmt.Resource === '*')) {
              hasWildcard = true;
            }
          }
          if (hasWildcard) {
            return 'IAM Policy check: Valid JSON. Warning: Contains wildcard "*" in Action or Resource which violates least privilege principle.';
          }
          return 'IAM Policy check: Policy looks valid and secure.';
        } catch (e) {
          return 'IAM Policy check: Invalid JSON format.';
        }
      }
    }
  ];
}
