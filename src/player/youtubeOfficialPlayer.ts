import type {SearchResult} from '../providers/types.js';
import type {PlaybackSession, Player} from './types.js';

export class YouTubeOfficialPlayer implements Player {
	async play(track: SearchResult): Promise<PlaybackSession> {
		return {
			state: 'unavailable',
			message: [
				`Selected: ${track.title}`,
				'The official YouTube Data API does not provide terminal-playable audio streams.',
				`Open URL: ${track.url}`
			].join('\n')
		};
	}
}
