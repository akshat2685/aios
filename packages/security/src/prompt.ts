import * as readline from 'readline';
import { ApprovalRequest, RiskLevel } from '@aios/types';

export async function askApproval(request: ApprovalRequest, risk: RiskLevel): Promise<'allow_once' | 'allow_session' | 'allow_always' | 'deny_once' | 'deny_always' | 'timeout'> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const timeoutMs = 60000; // 60 seconds
    let answered = false;

    const timer = setTimeout(() => {
      if (!answered) {
        answered = true;
        rl.close();
        console.log('\n[Security] Request timed out after 60 seconds. Auto-denying.');
        resolve('timeout');
      }
    }, timeoutMs);

    let expected = 'Unknown';
    if (request.action.includes('shell')) {
      if (request.target.startsWith('npm install')) expected = 'Download and install packages from internet';
      else if (request.target.startsWith('npm run build')) expected = 'Compile project via build scripts';
      else if (request.target.startsWith('git ')) expected = 'Modify version control state';
      else if (request.target.includes('rm ')) expected = 'Delete files/directories (DANGEROUS)';
      else expected = 'Execute arbitrary host commands';
    } else if (request.action.includes('file')) {
      expected = 'Modify local filesystem';
    } else if (request.action.includes('browser')) {
      expected = 'Access internet via browser';
    }

    console.log(`\n================ SECURITY INTERCEPT ================`);
    console.log(`Agent:   ${request.agentId}`);
    console.log(`Action:  ${request.action}`);
    console.log(`Target:  ${request.target}`);
    console.log(`Risk:    ${risk}`);
    if (request.reason) console.log(`Reason:  ${request.reason}`);
    if (request.cwd) console.log(`Cwd:     ${request.cwd}`);
    console.log(`\nExpected Effects:\n- ${expected}`);
    console.log(`====================================================\n`);
    
    console.log(`Approve execution?`);
    console.log(`[1] Allow Once`);
    console.log(`[2] Allow For Session`);
    console.log(`[3] Allow Always`);
    console.log(`[4] Deny Once`);
    console.log(`[5] Deny Always`);

    rl.question('\nSelect option (1-5) [default: 4]: ', (answer) => {
      if (answered) return;
      answered = true;
      clearTimeout(timer);
      rl.close();

      const choice = answer.trim();
      switch (choice) {
        case '1': return resolve('allow_once');
        case '2': return resolve('allow_session');
        case '3': return resolve('allow_always');
        case '4': return resolve('deny_once');
        case '5': return resolve('deny_always');
        default: return resolve('deny_once');
      }
    });
  });
}
