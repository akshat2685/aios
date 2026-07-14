import { describe, it, expect, vi } from 'vitest';
import { getAwsTools } from '../aws-tools';

describe('AWS Tools', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  } as any;

  it('should analyze cloudformation templates', async () => {
    const tools = getAwsTools(mockLogger);
    const analyzeTool = tools.find(t => t.name === 'aws:analyze_cloudformation');
    expect(analyzeTool).toBeDefined();

    const goodTemplate = JSON.stringify({ Resources: { MyBucket: { Type: 'AWS::S3::Bucket', DeletionPolicy: 'Retain' } } });
    const resGood = await analyzeTool!.execute({ templateContent: goodTemplate });
    expect(resGood).toContain('No critical errors found');

    const badTemplate = JSON.stringify({
      Resources: {
        MyRole: { Type: 'AWS::IAM::Role', Properties: { Policies: [{ PolicyDocument: { Statement: [{ Effect: "Allow", Action: "*" }] } }] } }
      }
    });
    const resBad = await analyzeTool!.execute({ templateContent: badTemplate });
    expect(resBad).toContain('Analysis complete with findings:');
    expect(resBad).toContain('Suggestion: add DeletionPolicy');
  });

  it('should estimate costs', async () => {
    const tools = getAwsTools(mockLogger);
    const costTool = tools.find(t => t.name === 'aws:estimate_cost');
    expect(costTool).toBeDefined();

    const res = await costTool!.execute({ resources: ['t3.micro EC2', 'rds instance'] });
    expect(res).toContain('Estimated monthly cost');
    expect(res).toContain('7.50');
    expect(res).toContain('15.00');
  });

  it('should check IAM policies', async () => {
    const tools = getAwsTools(mockLogger);
    const iamTool = tools.find(t => t.name === 'aws:check_iam_policy');
    expect(iamTool).toBeDefined();

    const goodPolicy = JSON.stringify({ Statement: [{ Effect: 'Allow', Action: 's3:GetObject', Resource: 'arn:aws:s3:::bucket/*' }] });
    const resGood = await iamTool!.execute({ policyJson: goodPolicy });
    expect(resGood).toContain('Policy looks valid and secure');

    const badPolicy = JSON.stringify({ Statement: [{ Effect: 'Allow', Action: '*', Resource: '*' }] });
    const resBad = await iamTool!.execute({ policyJson: badPolicy });
    expect(resBad).toContain('violates least privilege principle');

    const invalidJson = "this is not json";
    const resInvalid = await iamTool!.execute({ policyJson: invalidJson });
    expect(resInvalid).toContain('Invalid JSON format');
  });
});
