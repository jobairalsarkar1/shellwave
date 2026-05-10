import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import type {SearchResult} from '../providers/types.js';
import type {PlaybackSession, Player} from './types.js';

const execFileAsync = promisify(execFile);
const SEEK_STEP_SECONDS = 10;

class YouTubePlayer implements Player {
	#process?: ChildProcess;
	#streamUrl?: string;
	#startedAt?: number;
	#pausedAt?: number;
	#pausedMs = 0;
	#offsetSeconds = 0;

	async play(track: SearchResult): Promise<PlaybackSession> {
		this.stop();

		if (!hasCommand('ffplay')) {
			return {
				state: 'unavailable',
				message: [
					`Selected: ${track.title}`,
					'Audio playback needs ffplay on your PATH.',
					'Install FFmpeg, then run shellwave again.',
					`Open URL: ${track.url}`
				].join('\n')
			};
		}

		if (!hasCommand('yt-dlp')) {
			return {
				state: 'unavailable',
				message: [
					`Selected: ${track.title}`,
					'Search works without extra tools, but YouTube audio playback needs yt-dlp.',
					'Install yt-dlp, then run shellwave again.',
					`Open URL: ${track.url}`
				].join('\n')
			};
		}

		try {
			this.#streamUrl = await resolveAudioUrl(track.url);
			const startupError = await this.startPlayerAt(0);

			if (startupError) {
				this.stop();

				return {
					state: 'unavailable',
					message: [`Selected: ${track.title}`, startupError, `Open URL: ${track.url}`].join('\n')
				};
			}

			return {
				state: 'playing',
				message: [`Now playing: ${track.title}`, 'Audio stream started.', 'Press q to quit shellwave and stop playback.'].join('\n')
			};
		} catch (error) {
			this.stop();

			return {
				state: 'unavailable',
				message: [
					`Selected: ${track.title}`,
					error instanceof Error ? `Playback failed: ${error.message}` : 'Playback failed.',
					`Open URL: ${track.url}`
				].join('\n')
			};
		}
	}

	stop(): void {
		killProcess(this.#process);
		this.clearState();
	}

	pause(): boolean {
		if (!this.#process || this.#pausedAt) {
			return false;
		}

		signalProcess(this.#process, 'SIGSTOP');
		this.#pausedAt = Date.now();
		return true;
	}

	resume(): boolean {
		if (!this.#process || !this.#pausedAt) {
			return false;
		}

		this.#pausedMs += Date.now() - this.#pausedAt;
		this.#pausedAt = undefined;
		signalProcess(this.#process, 'SIGCONT');
		return true;
	}

	togglePause(): 'playing' | 'paused' | 'unchanged' {
		if (this.#pausedAt) {
			return this.resume() ? 'playing' : 'unchanged';
		}

		return this.pause() ? 'paused' : 'unchanged';
	}

	seekBackward(durationSeconds?: number): boolean {
		return this.seekBy(-SEEK_STEP_SECONDS, durationSeconds);
	}

	seekForward(durationSeconds?: number): boolean {
		return this.seekBy(SEEK_STEP_SECONDS, durationSeconds);
	}

	getElapsedSeconds(): number {
		if (!this.#startedAt) {
			return 0;
		}

		const now = this.#pausedAt ?? Date.now();
		const elapsedSinceStart = Math.max(0, Math.floor((now - this.#startedAt - this.#pausedMs) / 1000));
		return this.#offsetSeconds + elapsedSinceStart;
	}

	async startPlayerAt(offsetSeconds: number): Promise<string | undefined> {
		if (!this.#streamUrl) {
			return 'Playback failed: audio URL was not resolved.';
		}

		killProcess(this.#process);

		const args = ['-nodisp', '-autoexit', '-loglevel', 'warning'];

		if (offsetSeconds > 0) {
			args.push('-ss', String(offsetSeconds));
		}

		args.push('-i', this.#streamUrl);

		const playerProcess = spawn('ffplay', args, {
			detached: process.platform !== 'win32',
			stdio: ['ignore', 'ignore', 'pipe'],
			windowsHide: true
		});

		this.#process = playerProcess;
		this.#startedAt = Date.now();
		this.#pausedAt = undefined;
		this.#pausedMs = 0;
		this.#offsetSeconds = offsetSeconds;

		let stderr = '';

		playerProcess.stderr?.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		playerProcess.once('exit', () => {
			if (this.#process === playerProcess) {
				this.clearState({keepStreamUrl: true});
			}
		});

		return await waitForPlayerStartup(playerProcess, () => stderr);
	}

	seekBy(deltaSeconds: number, durationSeconds?: number): boolean {
		if (!this.#streamUrl || !this.#process) {
			return false;
		}

		const targetSeconds = clamp(this.getElapsedSeconds() + deltaSeconds, 0, durationSeconds);
		void this.startPlayerAt(targetSeconds);
		return true;
	}

	clearState({keepStreamUrl = false}: {keepStreamUrl?: boolean} = {}): void {
		this.#process = undefined;
		this.#startedAt = undefined;
		this.#pausedAt = undefined;
		this.#pausedMs = 0;
		this.#offsetSeconds = 0;

		if (!keepStreamUrl) {
			this.#streamUrl = undefined;
		}
	}
}

async function resolveAudioUrl(url: string): Promise<string> {
	const {stdout} = await execFileAsync('yt-dlp', ['--no-playlist', '--quiet', '--no-warnings', '-f', 'bestaudio', '--get-url', url], {
		maxBuffer: 1024 * 1024,
		timeout: 30_000,
		windowsHide: true
	});
	const audioUrl = stdout
		.split('\n')
		.map((line) => line.trim())
		.find(Boolean);

	if (!audioUrl) {
		throw new Error('yt-dlp did not return a playable audio URL.');
	}

	return audioUrl;
}

function hasCommand(command: string): boolean {
	const result = spawnSync(command, ['-version'], {
		stdio: 'ignore',
		windowsHide: true
	});

	return !result.error;
}

function killProcess(childProcess: ChildProcess | undefined): void {
	if (!childProcess || childProcess.killed) {
		return;
	}

	if (process.platform === 'win32' || !childProcess.pid) {
		childProcess.kill();
		return;
	}

	try {
		process.kill(-childProcess.pid, 'SIGKILL');
	} catch {
		childProcess.kill('SIGKILL');
	}
}

function signalProcess(childProcess: ChildProcess | undefined, signal: NodeJS.Signals): void {
	if (!childProcess || childProcess.killed || !childProcess.pid || process.platform === 'win32') {
		return;
	}

	try {
		process.kill(-childProcess.pid, signal);
	} catch {
		childProcess.kill(signal);
	}
}

async function waitForPlayerStartup(playerProcess: ChildProcess, getStderr: () => string): Promise<string | undefined> {
	return await new Promise((resolve) => {
		const timeout = setTimeout(() => {
			resolve(undefined);
		}, 2500);

		playerProcess.once('exit', (code) => {
			if (code && code !== 0) {
				clearTimeout(timeout);
				resolve(formatStartupError('ffplay stopped before audio could start.', getStderr()));
			}
		});
	});
}

function formatStartupError(summary: string, stderr: string): string {
	const details = stderr
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(-4)
		.join('\n');

	return details ? `${summary}\n${details}` : summary;
}

function clamp(value: number, minimum: number, maximum?: number): number {
	if (maximum === undefined || Number.isNaN(maximum)) {
		return Math.max(minimum, value);
	}

	return Math.min(maximum, Math.max(minimum, value));
}

export const youtubePlayer = new YouTubePlayer();
