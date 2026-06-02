import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname, join} from 'node:path';
import type {SearchResult} from '../providers/types.js';

export const DEFAULT_PLAYLIST_NAME = 'favorites';

export type PlaylistTrack = SearchResult & {
	addedAt: string;
};

export type PlaylistStore = {
	playlists: Record<string, PlaylistTrack[]>;
};

export function getPlaylistStorePath(): string {
	const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
	return join(configHome, 'shellwave', 'playlists.json');
}

export function readPlaylistStore(): PlaylistStore {
	const path = getPlaylistStorePath();

	if (!existsSync(path)) {
		return {playlists: {}};
	}

	try {
		const store = JSON.parse(readFileSync(path, 'utf8')) as PlaylistStore;
		return {
			playlists: store.playlists ?? {}
		};
	} catch (error) {
		throw new Error(error instanceof Error ? `Could not read playlists: ${error.message}` : 'Could not read playlists.');
	}
}

export function writePlaylistStore(store: PlaylistStore): void {
	const path = getPlaylistStorePath();
	mkdirSync(dirname(path), {recursive: true});
	writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`);
}

export function listPlaylistNames(): string[] {
	return Object.keys(readPlaylistStore().playlists).sort((first, second) => first.localeCompare(second));
}

export function getPlaylist(name: string): PlaylistTrack[] {
	return readPlaylistStore().playlists[name] ?? [];
}

export function createPlaylist(name: string): boolean {
	const store = readPlaylistStore();

	if (store.playlists[name]) {
		return false;
	}

	store.playlists[name] = [];
	writePlaylistStore(store);
	return true;
}

export function deletePlaylist(name: string): boolean {
	const store = readPlaylistStore();

	if (!store.playlists[name]) {
		return false;
	}

	delete store.playlists[name];
	writePlaylistStore(store);
	return true;
}

export function addTrackToPlaylist(name: string, track: SearchResult): {added: boolean; track: PlaylistTrack} {
	const store = readPlaylistStore();
	const playlist = store.playlists[name] ?? [];
	const existingTrack = playlist.find((item) => item.source === track.source && item.id === track.id);

	if (existingTrack) {
		return {added: false, track: existingTrack};
	}

	const playlistTrack: PlaylistTrack = {
		...track,
		addedAt: new Date().toISOString()
	};

	store.playlists[name] = [...playlist, playlistTrack];
	writePlaylistStore(store);
	return {added: true, track: playlistTrack};
}

export function removeTrackFromPlaylist(name: string, idOrPosition: string): PlaylistTrack | undefined {
	const store = readPlaylistStore();
	const playlist = store.playlists[name];

	if (!playlist) {
		return undefined;
	}

	const position = Number.parseInt(idOrPosition, 10);
	const index = Number.isNaN(position) ? playlist.findIndex((track) => track.id === idOrPosition) : position - 1;

	if (index < 0 || index >= playlist.length) {
		return undefined;
	}

	const [removedTrack] = playlist.splice(index, 1);
	store.playlists[name] = playlist;
	writePlaylistStore(store);
	return removedTrack;
}
