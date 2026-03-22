import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🔧 E2E Global Setup: Initializing test database...');
  
  const backendPath = path.join(__dirname, '..', 'backend');
  const scriptPath = path.join(backendPath, 'init_e2e_db.py');
  
  try {
    execSync(`python ${scriptPath}`, {
      cwd: backendPath,
      stdio: 'inherit',
      env: {
        ...process.env,
        TESTING: 'false',
        BACKEND_DATABASE_URL: 'sqlite:///./test.db',
      },
    });
    console.log('✅ E2E test database initialized');
  } catch (error) {
    console.error('❌ Failed to initialize E2E database:', error);
    throw error;
  }
}

export default globalSetup;
