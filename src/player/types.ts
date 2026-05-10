import type {SearchResult} from '../providers/types.js';

export type PlaybackState = 'idle' | 'unavailable' | 'playing' | 'paused' | 'stopped';

export type PlaybackSession = {
	state: PlaybackState;
	message: string;
};

export interface Player {
	play(track: SearchResult): Promise<PlaybackSession>;
}
