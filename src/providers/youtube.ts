import type {SearchProvider, SearchResult} from './types.js';

type YouTubeSearchResponse = {
	items?: Array<{
		id?: {
			videoId?: string;
		};
		snippet?: {
			title?: string;
			description?: string;
			channelTitle?: string;
			publishedAt?: string;
			thumbnails?: {
				default?: {url?: string};
				medium?: {url?: string};
				high?: {url?: string};
			};
		};
	}>;
	error?: {
		message?: string;
	};
};

export class YouTubeSearchProvider implements SearchProvider {
	readonly #apiKey: string;

	constructor(apiKey = process.env.YOUTUBE_API_KEY) {
		if (!apiKey) {
			throw new Error('Missing YOUTUBE_API_KEY. Create a YouTube Data API key and set it in your environment.');
		}

		this.#apiKey = apiKey;
	}

	async search(query: string): Promise<SearchResult[]> {
		const url = new URL('https://www.googleapis.com/youtube/v3/search');
		url.searchParams.set('part', 'snippet');
		url.searchParams.set('type', 'video');
		url.searchParams.set('maxResults', '10');
		url.searchParams.set('q', query);
		url.searchParams.set('key', this.#apiKey);

		const response = await fetch(url);
		const body = (await response.json()) as YouTubeSearchResponse;

		if (!response.ok) {
			throw new Error(body.error?.message ?? `YouTube search failed with HTTP ${response.status}`);
		}

		return (body.items ?? [])
			.filter((item) => item.id?.videoId && item.snippet?.title)
			.map((item) => {
				const videoId = item.id?.videoId ?? '';
				const snippet = item.snippet ?? {};

				return {
					id: videoId,
					source: 'youtube',
					title: decodeHtml(snippet.title ?? 'Untitled video'),
					channelTitle: decodeHtml(snippet.channelTitle ?? 'Unknown channel'),
					publishedAt: snippet.publishedAt ?? '',
					url: `https://www.youtube.com/watch?v=${videoId}`,
					thumbnailUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
					description: decodeHtml(snippet.description ?? '')
				} satisfies SearchResult;
			});
	}
}

function decodeHtml(value: string): string {
	return value
		.replaceAll('&amp;', '&')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>');
}
