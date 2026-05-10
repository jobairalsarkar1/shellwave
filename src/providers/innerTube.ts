import {Innertube} from 'youtubei.js';
import type {SearchProvider, SearchResult} from './types.js';

type InnerTubeVideoNode = {
	type: string;
	video_id?: string;
	title?: {toString(): string};
	description?: string;
	author?: {name?: string};
	published?: {toString(): string};
	best_thumbnail?: {url?: string};
};

export class InnerTubeSearchProvider implements SearchProvider {
	readonly name = 'YouTube no-key search';

	async search(query: string): Promise<SearchResult[]> {
		try {
			const youtube = await Innertube.create();
			const results = await youtube.search(query, {type: 'video'});

			return results.results
				.filter((item) => item.type === 'Video')
				.slice(0, 10)
				.map((item) => {
					const video = item as unknown as InnerTubeVideoNode;
					const id = video.video_id ?? '';

					return {
						id,
						source: 'youtube',
						title: video.title?.toString() ?? 'Untitled video',
						channelTitle: video.author?.name ?? 'Unknown channel',
						publishedAt: video.published?.toString() ?? '',
						url: `https://www.youtube.com/watch?v=${id}`,
						thumbnailUrl: video.best_thumbnail?.url,
						description: video.description
					} satisfies SearchResult;
				});
		} catch (error) {
			throw new Error(error instanceof Error ? `YouTube no-key search failed: ${error.message}` : 'YouTube no-key search failed.');
		}
	}
}
