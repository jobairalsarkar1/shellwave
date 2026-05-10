#!/usr/bin/env node
import {Command} from 'commander';
import {runSearchCommand} from './commands/search.js';

const program = new Command();

program
	.name('shellwave')
	.description('A terminal-first audio companion for developers.')
	.version('0.1.0')
	.argument('[query...]', 'Search YouTube using the official YouTube Data API')
	.action(async (query: string[]) => {
		if (query.length === 0) {
			program.help();
			return;
		}

		await runSearchCommand(query.join(' '));
	});

program
	.command('search')
	.description('Search YouTube using the official YouTube Data API')
	.argument('<query...>', 'Search terms')
	.action(async (query: string[]) => {
		await runSearchCommand(query.join(' '));
	});

await program.parseAsync(process.argv);
