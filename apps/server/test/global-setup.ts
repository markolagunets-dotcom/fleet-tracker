import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const serverRoot = resolve(__dirname, '..');

/** A throwaway database per run, migrated from scratch. */
export default function globalSetup(): void {
  rmSync(resolve(serverRoot, 'test.db'), { force: true });

  execSync('npx prisma migrate deploy', {
    cwd: serverRoot,
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}
