import {chmodSync, existsSync} from 'node:fs';

const binPath = 'dist/cli.js';

if (process.platform !== 'win32' && existsSync(binPath)) {
	chmodSync(binPath, 0o755);
}
