import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import React from 'react';
import {render} from 'ink';
import type {SearchResult} from '../providers/types.js';
import {
	addTrackToPlaylist,
	createPlaylist,
	deletePlaylist,
	getPlaylist,
	getPlaylistStorePath,
	listPlaylistNames,
	removeTrackFromPlaylist
} from '../playlists/store.js';
import {SearchApp} from '../ui/SearchApp.js';

const execFileAsync = promisify(execFile);

type YtDlpVideo = {
	id?: string;
	title?: string;
	channel?: string;
	channel_id?: string;
	uploader?: string;
	upload_date?: string;
	webpage_url?: string;
	original_url?: string;
	description?: string;
	thumbnail?: string;
	duration?: number;
};

export async function runPlaylistListCommand(): Promise<void> {
	const names = listPlaylistNames();

	if (names.length === 0) {
		console.log('No playlists yet.');
		console.log('Create one with: shellwave playlist create favorites');
		return;
	}

	for (const name of names) {
		console.log(`${name} (${getPlaylist(name).length})`);
	}
}

export async function runPlaylistCreateCommand(name: string): Promise<void> {
	const created = createPlaylist(name);
	console.log(created ? `Created playlist: ${name}` : `Playlist already exists: ${name}`);
}

export async function runPlaylistShowCommand(name: string): Promise<void> {
	const tracks = getPlaylist(name);

	if (tracks.length === 0) {
		console.log(`Playlist is empty: ${name}`);
		console.log(`Storage: ${getPlaylistStorePath()}`);
		return;
	}

	tracks.forEach((track, index) => {
		console.log(`${index + 1}. ${track.title} by ${track.channelTitle}`);
		console.log(`   ${track.url}`);
	});
}

export async function runPlaylistAddCommand(name: string, url: string): Promise<void> {
	const track = await resolveTrackFromUrl(url);
	const result = addTrackToPlaylist(name, track);
	console.log(result.added ? `Added to ${name}: ${result.track.title}` : `Already in ${name}: ${result.track.title}`);
}

export async function runPlaylistPlayCommand(name: string): Promise<void> {
	const tracks = getPlaylist(name);

	if (tracks.length === 0) {
		console.log(`Playlist is empty: ${name}`);
		return;
	}

	render(<SearchApp query={`playlist ${name}`} initialResults={tracks} providerName={`playlist: ${name}`} autoPlay />);
}

export async function runPlaylistRemoveCommand(name: string, idOrPosition: string): Promise<void> {
	const removedTrack = removeTrackFromPlaylist(name, idOrPosition);
	console.log(removedTrack ? `Removed from ${name}: ${removedTrack.title}` : `No matching track found in ${name}: ${idOrPosition}`);
}

export async function runPlaylistDeleteCommand(name: string): Promise<void> {
	const deleted = deletePlaylist(name);
	console.log(deleted ? `Deleted playlist: ${name}` : `Playlist does not exist: ${name}`);
}

async function resolveTrackFromUrl(url: string): Promise<SearchResult> {
	try {
		const {stdout} = await execFileAsync('yt-dlp', ['--dump-json', '--no-playlist', url], {
			maxBuffer: 1024 * 1024 * 5,
			timeout: 30_000,
			windowsHide: true
		});
		const video = JSON.parse(stdout) as YtDlpVideo;
		const id = video.id ?? getVideoIdFromUrl(url);

		if (!id) {
			throw new Error('yt-dlp did not return a video id.');
		}

		return {
			id,
			source: 'youtube',
			title: video.title ?? 'Untitled video',
			channelTitle: video.channel ?? video.uploader ?? video.channel_id ?? 'Unknown channel',
			publishedAt: formatUploadDate(video.upload_date),
			url: video.webpage_url ?? video.original_url ?? url,
			durationSeconds: video.duration,
			thumbnailUrl: video.thumbnail,
			description: video.description
		};
	} catch (error) {
		throw new Error(error instanceof Error ? `Could not add URL to playlist: ${error.message}` : 'Could not add URL to playlist.');
	}
}

function getVideoIdFromUrl(value: string): string | undefined {
	try {
		const url = new URL(value);

		if (url.hostname === 'youtu.be') {
			return url.pathname.split('/').filter(Boolean)[0];
		}

		return url.searchParams.get('v') ?? undefined;
	} catch {
		return undefined;
	}
}

function formatUploadDate(value: string | undefined): string {
	if (!value || !/^\d{8}$/.test(value)) {
		return '';
	}

	return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}
