import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';

function globalSetup(config: FullConfig): void {
  console.log('🔧 E2E Global Setup: Initializing test database...');
  
  const backendPath = path.resolve(__dirname, '..', 'backend');
  const scriptPath = path.join(backendPath, 'init_e2e_db.py');
  const dbPath = path.join(backendPath, 'test.db');
  const absoluteDbUrl = `sqlite:///${dbPath}`;
  
  // Use python3 on Unix systems, python on Windows
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  
  try {
    // Quote scriptPath to handle spaces in paths
    execSync(`${pythonCmd} "${scriptPath}"`, {
      cwd: backendPath,
      stdio: 'inherit',
      env: {
        ...process.env,
        TESTING: 'false',
        BACKEND_DATABASE_URL: absoluteDbUrl,
        BACKEND_JWT_SECRET: process.env.BACKEND_JWT_SECRET || 'e2e-test-secret',
        BACKEND_ADMIN_EMAIL: process.env.BACKEND_ADMIN_EMAIL || 'e2e@test.local',
        BACKEND_ADMIN_PASSWORD: process.env.BACKEND_ADMIN_PASSWORD || 'e2e-test-password',
      },
    });
    console.log('✅ E2E test database initialized');
  } catch (error) {
    console.error('❌ Failed to initialize E2E database:', error);
    throw error;
  }
}

export default globalSetup;
