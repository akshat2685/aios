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
        // Mock implementation
        return 'Analysis complete: No critical errors found. Suggestion: add DeletionPolicy to stateful resources.';
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
      execute: async ({ resources }) => {
        logger.info(`Estimating AWS costs for: ${resources.join(', ')}`);
        // Mock implementation
        return `Estimated monthly cost for [${resources.join(', ')}] is $45.20. Note: This is a rough estimation.`;
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
        return 'IAM Policy check: Policy looks valid. Warning: Contains "Action": "*" which violates least privilege principle.';
      }
    }
  ];
}
