#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Command} from 'commander';
import updateNotifier from 'update-notifier';
import {runDoctorCommand} from './commands/doctor.js';
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

await program.parseAsync(process.argv);
