import React from 'react';
import {render} from 'ink';
import {SearchApp} from '../ui/SearchApp.js';

export async function runSearchCommand(query: string): Promise<void> {
	render(<SearchApp query={query} />);
}
