#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Command} from 'commander';
import updateNotifier from 'update-notifier';
import {runDoctorCommand} from './commands/doctor.js';
import {
	runPlaylistAddCommand,
	runPlaylistCreateCommand,
	runPlaylistDeleteCommand,
	runPlaylistListCommand,
	runPlaylistPlayCommand,
	runPlaylistRemoveCommand,
	runPlaylistShowCommand
} from './commands/playlist.js';
import {runSearchCommand} from './commands/search.js';

const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as {name: string; version: string};
updateNotifier({pkg: packageJson}).notify();
const program = new Command();

program
	.name('shellwave')
	.description('A terminal-first audio companion for developers.')
	.version(packageJson.version)
	.argument('[query...]', 'Search YouTube')
	.action(async (query: string[]) => {
		if (query.length === 0) {
			program.help();
			return;
		}

		await runSearchCommand(query.join(' '));
	});

program
	.command('search')
	.description('Search YouTube')
	.argument('<query...>', 'Search terms')
	.action(async (query: string[]) => {
		await runSearchCommand(query.join(' '));
	});

program
	.command('doctor')
	.description('Check shellwave playback dependencies and install hints')
	.action(async () => {
		await runDoctorCommand();
	});

const playlistCommand = program.command('playlist').alias('pl').description('Manage local playlists');

playlistCommand
	.command('list')
	.description('List playlists')
	.action(async () => {
		await runPlaylistListCommand();
	});

playlistCommand
	.command('create')
	.description('Create a playlist')
	.argument('<name>', 'Playlist name')
	.action(async (name: string) => {
		await runPlaylistCreateCommand(name);
	});

playlistCommand
	.command('show')
	.description('Show playlist tracks')
	.argument('<name>', 'Playlist name')
	.action(async (name: string) => {
		await runPlaylistShowCommand(name);
	});

playlistCommand
	.command('add')
	.description('Add a YouTube URL to a playlist')
	.argument('<name>', 'Playlist name')
	.argument('<url>', 'YouTube URL')
	.action(async (name: string, url: string) => {
		await runPlaylistAddCommand(name, url);
	});

playlistCommand
	.command('play')
	.description('Play a playlist')
	.argument('<name>', 'Playlist name')
	.action(async (name: string) => {
		await runPlaylistPlayCommand(name);
	});

playlistCommand
	.command('remove')
	.description('Remove a track from a playlist by position or video id')
	.argument('<name>', 'Playlist name')
	.argument('<id-or-position>', 'Track number or video id')
	.action(async (name: string, idOrPosition: string) => {
		await runPlaylistRemoveCommand(name, idOrPosition);
	});

playlistCommand
	.command('delete')
	.description('Delete a playlist')
	.argument('<name>', 'Playlist name')
	.action(async (name: string) => {
		await runPlaylistDeleteCommand(name);
	});

await program.parseAsync(process.argv);
