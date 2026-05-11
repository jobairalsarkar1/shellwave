import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);

type CheckStatus = 'pass' | 'warn' | 'fail';

type Check = {
	name: string;
	status: CheckStatus;
	message: string;
	details?: string[];
};

export async function runDoctorCommand(): Promise<void> {
	const checks = await Promise.all([checkNode(), checkNpmPrefix(), checkCommand('ffplay', ['-version']), checkCommand('yt-dlp', ['--version'])]);
	const hasFailures = checks.some((check) => check.status === 'fail');

	console.log('shellwave doctor\n');

	for (const check of checks) {
		console.log(`${icon(check.status)} ${check.name}: ${check.message}`);

		for (const detail of check.details ?? []) {
			console.log(`  ${detail}`);
		}
	}

	console.log('\nPlayback needs both ffplay and yt-dlp.');

	if (hasFailures) {
		console.log('\nSuggested setup:');
		console.log(setupInstructions().map((line) => `  ${line}`).join('\n'));
		process.exitCode = 1;
	}
}

async function checkNode(): Promise<Check> {
	const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);

	if (major >= 20) {
		return {
			name: 'Node.js',
			status: 'pass',
			message: process.version
		};
	}

	return {
		name: 'Node.js',
		status: 'fail',
		message: `${process.version} detected; shellwave requires Node.js >=20.`
	};
}

async function checkNpmPrefix(): Promise<Check> {
	try {
		const {stdout} = await execFileAsync('npm', ['config', 'get', 'prefix'], {
			timeout: 5000,
			windowsHide: true
		});
		const prefix = stdout.trim();

		if (prefix === '/usr/local') {
			return {
				name: 'npm global prefix',
				status: 'warn',
				message: prefix,
				details: ['Global installs may need a user-owned npm prefix on Linux/macOS.', 'See README install troubleshooting if npm install -g fails with EACCES.']
			};
		}

		return {
			name: 'npm global prefix',
			status: 'pass',
			message: prefix || 'not configured'
		};
	} catch {
		return {
			name: 'npm global prefix',
			status: 'warn',
			message: 'Could not read npm global prefix.'
		};
	}
}

async function checkCommand(command: string, args: string[]): Promise<Check> {
	try {
		const {stdout, stderr} = await execFileAsync(command, args, {
			timeout: 5000,
			windowsHide: true
		});
		const firstLine = `${stdout}${stderr}`.split('\n').find(Boolean)?.trim();

		return {
			name: command,
			status: 'pass',
			message: firstLine ?? 'available'
		};
	} catch {
		return {
			name: command,
			status: 'fail',
			message: `${command} was not found on PATH.`
		};
	}
}

function setupInstructions(): string[] {
	if (process.platform === 'darwin') {
		return ['brew install ffmpeg yt-dlp'];
	}

	if (process.platform === 'win32') {
		return ['winget install Gyan.FFmpeg', 'winget install yt-dlp.yt-dlp'];
	}

	return ['sudo apt install ffmpeg', 'sudo apt install pipx', 'pipx install yt-dlp', 'fish_add_path ~/.local/bin   # fish', 'export PATH="$HOME/.local/bin:$PATH"   # bash/zsh'];
}

function icon(status: CheckStatus): string {
	if (status === 'pass') {
		return 'OK';
	}

	if (status === 'warn') {
		return 'WARN';
	}

	return 'FAIL';
}
