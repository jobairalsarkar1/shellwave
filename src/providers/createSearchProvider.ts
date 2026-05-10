import type {SearchProvider} from './types.js';
import {InnerTubeSearchProvider} from './innerTube.js';
import {YouTubeSearchProvider} from './youtube.js';
import {YtDlpSearchProvider} from './ytDlp.js';

export function createSearchProvider(): SearchProvider {
	const requestedProvider = process.env.SHELLWAVE_SEARCH_PROVIDER;

	if (requestedProvider === 'youtube-api') {
		return new YouTubeSearchProvider();
	}

	if (requestedProvider === 'yt-dlp') {
		return new YtDlpSearchProvider();
	}

	if (requestedProvider === 'youtubei') {
		return new InnerTubeSearchProvider();
	}

	if (process.env.YOUTUBE_API_KEY) {
		return new YouTubeSearchProvider();
	}

	return new InnerTubeSearchProvider();
}
