import {Readable} from 'node:stream';
import type {ReadableStream as NodeReadableStream} from 'node:stream/web';
import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import {Innertube} from 'youtubei.js';
import type {SearchResult} from '../providers/types.js';
import type {PlaybackSession, Player} from './types.js';

class YouTubePlayer implements Player {
	#process?: ChildProcess;

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

		try {
			const youtube = await Innertube.create();
			const audio = await youtube.download(track.id, {
				type: 'audio',
				quality: 'best',
				format: 'any'
			});

			const playerProcess = spawn('ffplay', ['-nodisp', '-autoexit', '-loglevel', 'error', '-i', 'pipe:0'], {
				stdio: ['pipe', 'ignore', 'pipe'],
				windowsHide: true
			});

			this.#process = playerProcess;
			Readable.fromWeb(audio as unknown as NodeReadableStream).pipe(playerProcess.stdin);

			playerProcess.once('exit', () => {
				this.#process = undefined;
			});

			return {
				state: 'playing',
				message: [`Now playing: ${track.title}`, 'Press q to quit shellwave and stop playback.'].join('\n')
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
		if (!this.#process || this.#process.killed) {
			return;
		}

		this.#process.kill();
		this.#process = undefined;
	}
}

function hasCommand(command: string): boolean {
	const result = spawnSync(command, ['-version'], {
		stdio: 'ignore',
		windowsHide: true
	});

	return !result.error;
}

export const youtubePlayer = new YouTubePlayer();
