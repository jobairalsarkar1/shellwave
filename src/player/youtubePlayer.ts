import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import type {SearchResult} from '../providers/types.js';
import type {PlaybackSession, Player} from './types.js';

class YouTubePlayer implements Player {
	#process?: ChildProcess;
	#resolverProcess?: ChildProcess;

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
			const resolverProcess = spawn('yt-dlp', ['--no-playlist', '--quiet', '--no-warnings', '-f', 'bestaudio', '-o', '-', track.url], {
				stdio: ['ignore', 'pipe', 'pipe'],
				windowsHide: true
			});
			const playerProcess = spawn('ffplay', ['-nodisp', '-autoexit', '-loglevel', 'warning', '-i', 'pipe:0'], {
				stdio: ['pipe', 'ignore', 'pipe'],
				windowsHide: true
			});

			this.#process = playerProcess;
			this.#resolverProcess = resolverProcess;
			let resolverOutputStarted = false;
			let stderr = '';

			resolverProcess.stdout.once('data', () => {
				resolverOutputStarted = true;
			});

			resolverProcess.stderr.on('data', (chunk: Buffer) => {
				stderr += chunk.toString();
			});

			playerProcess.stderr.on('data', (chunk: Buffer) => {
				stderr += chunk.toString();
			});

			resolverProcess.stdout.pipe(playerProcess.stdin);

			resolverProcess.once('error', () => {
				this.stop();
			});

			playerProcess.once('exit', () => {
				this.clearProcesses();
			});

			const startupError = await waitForStartup(resolverProcess, playerProcess, () => resolverOutputStarted, () => stderr);

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
		if (this.#resolverProcess && !this.#resolverProcess.killed) {
			this.#resolverProcess.kill();
		}

		if (this.#process && !this.#process.killed) {
			this.#process.kill();
		}

		this.clearProcesses();
	}

	clearProcesses(): void {
		this.#process = undefined;
		this.#resolverProcess = undefined;
	}
}

function hasCommand(command: string): boolean {
	const result = spawnSync(command, ['-version'], {
		stdio: 'ignore',
		windowsHide: true
	});

	return !result.error;
}

async function waitForStartup(
	resolverProcess: ChildProcess,
	playerProcess: ChildProcess,
	hasResolverOutput: () => boolean,
	getStderr: () => string
): Promise<string | undefined> {
	return await new Promise((resolve) => {
		const timeout = setTimeout(() => {
			resolve(undefined);
		}, 2500);

		const finish = (message: string | undefined) => {
			clearTimeout(timeout);
			resolve(message);
		};

		resolverProcess.once('exit', (code) => {
			if (code && code !== 0 && !hasResolverOutput()) {
				finish(formatStartupError('yt-dlp failed before producing audio.', getStderr()));
			}
		});

		playerProcess.once('exit', (code) => {
			if (code && code !== 0) {
				finish(formatStartupError('ffplay stopped before audio could start.', getStderr()));
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

export const youtubePlayer = new YouTubePlayer();
