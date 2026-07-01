import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);
const qdrantDockerComposePath = path.join(__dirname, '..', '..', 'docker', 'docker-compose.yml');

async function startQdrant() {
  try {
    // Check if Qdrant is already running by trying to connect
    const checkCmd = `docker exec qdrant curl -s http://localhost:6333/api/ready || echo "not ready"`;
    await execAsync(checkCmd);
    console.log('Qdrant is already running');
  } catch (error) {
    console.log('Qdrant not running, starting...');
    const composePath = path.resolve(qdrantDockerComposePath);
    await execAsync(`docker-compose -f ${composePath} up -d`);
    console.log('Qdrant Docker container started');
    
    // Wait a bit for it to initialize
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verify it's ready
    const checkCmd = `docker exec qdrant curl -s http://localhost:6333/api/ready`;
    try {
      await execAsync(checkCmd);
      console.log('Qdrant is ready');
    } catch (error) {
      console.error('Qdrant failed to start properly');
      throw error;
    }
  }
}

startQdrant().catch(console.error);