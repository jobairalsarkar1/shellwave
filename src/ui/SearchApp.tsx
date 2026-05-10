import React, {useEffect, useMemo, useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import {YouTubeOfficialPlayer} from '../player/youtubeOfficialPlayer.js';
import type {PlaybackSession} from '../player/types.js';
import type {SearchResult} from '../providers/types.js';
import {YouTubeSearchProvider} from '../providers/youtube.js';
import {formatDate} from '../lib/format.js';

type Props = {
	query: string;
};

type ScreenState =
	| {status: 'loading'}
	| {status: 'ready'; results: SearchResult[]; selectedIndex: number}
	| {status: 'selected'; results: SearchResult[]; selectedIndex: number; session: PlaybackSession}
	| {status: 'error'; message: string};

export function SearchApp({query}: Props): React.ReactElement {
	const [state, setState] = useState<ScreenState>({status: 'loading'});
	const provider = useMemo(() => {
		try {
			return new YouTubeSearchProvider();
		} catch (error) {
			setState({status: 'error', message: error instanceof Error ? error.message : String(error)});
			return undefined;
		}
	}, []);

	useEffect(() => {
		let cancelled = false;

		async function search(): Promise<void> {
			if (!provider) {
				return;
			}

			try {
				const results = await provider.search(query);

				if (!cancelled) {
					setState({status: 'ready', results, selectedIndex: 0});
				}
			} catch (error) {
				if (!cancelled) {
					setState({status: 'error', message: error instanceof Error ? error.message : String(error)});
				}
			}
		}

		void search();

		return () => {
			cancelled = true;
		};
	}, [provider, query]);

	return (
		<Box flexDirection="column" gap={1}>
			{process.stdin.isTTY && <InputControls state={state} setState={setState} />}
			<Header query={query} />
			{state.status === 'loading' && <Text color="cyan">Searching YouTube...</Text>}
			{state.status === 'error' && <ErrorMessage message={state.message} />}
			{state.status === 'ready' && <Results results={state.results} selectedIndex={state.selectedIndex} />}
			{state.status === 'selected' && (
				<>
					<Results results={state.results} selectedIndex={state.selectedIndex} />
					<PlayerPanel session={state.session} />
				</>
			)}
			<Footer />
		</Box>
	);
}

function InputControls({
	state,
	setState
}: {
	state: ScreenState;
	setState: React.Dispatch<React.SetStateAction<ScreenState>>;
}): null {
	const {exit} = useApp();

	useInput((input, key) => {
		if (input === 'q' || key.escape) {
			exit();
			return;
		}

		if (state.status !== 'ready' && state.status !== 'selected') {
			return;
		}

		if (key.upArrow) {
			setState({
				...state,
				selectedIndex: Math.max(0, state.selectedIndex - 1)
			});
			return;
		}

		if (key.downArrow) {
			setState({
				...state,
				selectedIndex: Math.min(state.results.length - 1, state.selectedIndex + 1)
			});
			return;
		}

		if (key.return && state.status === 'ready') {
			const track = state.results[state.selectedIndex];

			if (!track) {
				return;
			}

			void new YouTubeOfficialPlayer().play(track).then((session) => {
				setState({...state, status: 'selected', session});
			});
		}
	});

	return null;
}

function Header({query}: Props): React.ReactElement {
	return (
		<Box flexDirection="column">
			<Text bold color="cyan">
				shellwave
			</Text>
			<Text>
				Search: <Text color="yellow">{query}</Text>
			</Text>
		</Box>
	);
}

function Results({results, selectedIndex}: {results: SearchResult[]; selectedIndex: number}): React.ReactElement {
	if (results.length === 0) {
		return <Text color="yellow">No videos found.</Text>;
	}

	return (
		<Box flexDirection="column">
			{results.map((result, index) => {
				const isSelected = index === selectedIndex;

				return (
					<Text key={result.id} color={isSelected ? 'cyan' : undefined}>
						{isSelected ? '>' : ' '} {result.title} <Text dimColor>by {result.channelTitle} · {formatDate(result.publishedAt)}</Text>
					</Text>
				);
			})}
		</Box>
	);
}

function PlayerPanel({session}: {session: PlaybackSession}): React.ReactElement {
	return (
		<Box borderStyle="round" borderColor="yellow" paddingX={1} flexDirection="column">
			<Text color="yellow">Playback</Text>
			{session.message.split('\n').map((line) => (
				<Text key={line}>{line}</Text>
			))}
		</Box>
	);
}

function ErrorMessage({message}: {message: string}): React.ReactElement {
	return (
		<Box flexDirection="column">
			<Text color="red">Error: {message}</Text>
			<Text dimColor>Set YOUTUBE_API_KEY to use official YouTube search.</Text>
		</Box>
	);
}

function Footer(): React.ReactElement {
	return <Text dimColor>Arrow keys choose · Enter select · q quit</Text>;
}
