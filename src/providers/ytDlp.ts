import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import type {SearchProvider, SearchResult} from './types.js';

const execFileAsync = promisify(execFile);

type YtDlpSearchResult = {
	id?: string;
	title?: string;
	channel?: string;
	channel_id?: string;
	uploader?: string;
	upload_date?: string;
	webpage_url?: string;
	url?: string;
	description?: string;
	thumbnail?: string;
	duration?: number;
};

export class YtDlpSearchProvider implements SearchProvider {
	readonly name = 'yt-dlp';

	async search(query: string): Promise<SearchResult[]> {
		try {
			const {stdout} = await execFileAsync(
				'yt-dlp',
				['--dump-json', '--flat-playlist', `ytsearch10:${query}`],
				{
					maxBuffer: 1024 * 1024 * 5,
					timeout: 30_000,
					windowsHide: true
				}
			);

			return stdout
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean)
				.map((line) => JSON.parse(line) as YtDlpSearchResult)
				.filter((item) => item.id && item.title)
				.map((item) => ({
					id: item.id ?? '',
					source: 'youtube',
					title: item.title ?? 'Untitled video',
					channelTitle: item.channel ?? item.uploader ?? item.channel_id ?? 'Unknown channel',
					publishedAt: formatUploadDate(item.upload_date),
					url: item.webpage_url ?? item.url ?? `https://www.youtube.com/watch?v=${item.id}`,
					durationSeconds: item.duration,
					thumbnailUrl: item.thumbnail,
					description: item.description
				}));
		} catch (error) {
			throw new Error(buildYtDlpError(error));
		}
	}
}

function formatUploadDate(value: string | undefined): string {
	if (!value || !/^\d{8}$/.test(value)) {
		return '';
	}

	return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function buildYtDlpError(error: unknown): string {
	if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
		return [
			'No search backend is ready.',
			'Install yt-dlp for no-key YouTube search, or set YOUTUBE_API_KEY for the official YouTube Data API.',
			'Install: https://github.com/yt-dlp/yt-dlp#installation'
		].join('\n');
	}

	if (error instanceof Error) {
		return `yt-dlp search failed: ${error.message}`;
	}

	return 'yt-dlp search failed.';
}
