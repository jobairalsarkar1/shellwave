export type TrackSource = 'youtube';

export type SearchResult = {
	id: string;
	source: TrackSource;
	title: string;
	channelTitle: string;
	publishedAt: string;
	url: string;
	thumbnailUrl?: string;
	description?: string;
};

export interface SearchProvider {
	search(query: string): Promise<SearchResult[]>;
}
