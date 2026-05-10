import React, {useEffect, useMemo, useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import {youtubePlayer} from '../player/youtubePlayer.js';
import type {PlaybackSession} from '../player/types.js';
import type {SearchResult} from '../providers/types.js';
import {createSearchProvider} from '../providers/createSearchProvider.js';
import type {SearchProvider} from '../providers/types.js';
import {formatDate} from '../lib/format.js';

type Props = {
	query: string;
};

type ScreenState =
	| {status: 'loading'}
	| {status: 'ready'; results: SearchResult[]; selectedIndex: number; providerName: string}
	| {
			status: 'selected';
			results: SearchResult[];
			selectedIndex: number;
			playingTrack: SearchResult;
			session: PlaybackSession;
			providerName: string;
			isPaused: boolean;
	  }
	| {status: 'error'; message: string};

export function SearchApp({query}: Props): React.ReactElement {
	const [state, setState] = useState<ScreenState>({status: 'loading'});
	const provider = useMemo<SearchProvider | undefined>(() => {
		try {
			return createSearchProvider();
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
					setState({status: 'ready', results, selectedIndex: 0, providerName: provider.name});
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

	useEffect(() => {
		return () => {
			youtubePlayer.stop();
		};
	}, []);

	return (
		<Box flexDirection="column" gap={1}>
			{process.stdin.isTTY && <InputControls state={state} setState={setState} />}
			<Header query={query} />
			{state.status === 'loading' && <Text color="cyan">Searching YouTube...</Text>}
			{state.status === 'error' && <ErrorMessage message={state.message} />}
			{state.status === 'ready' && (
				<>
					<ProviderBadge name={state.providerName} />
					<Results results={state.results} selectedIndex={state.selectedIndex} />
				</>
			)}
			{state.status === 'selected' && (
				<>
					<ProviderBadge name={state.providerName} />
					<Results results={state.results} selectedIndex={state.selectedIndex} />
					<PlayerPanel session={state.session} track={state.playingTrack} isPaused={state.isPaused} />
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
			youtubePlayer.stop();
			exit();
			return;
		}

		if (state.status !== 'ready' && state.status !== 'selected') {
			return;
		}

		if (state.status === 'selected') {
			if (input === 's') {
				youtubePlayer.stop();
				setState({
					...state,
					status: 'ready'
				});
				return;
			}

			if (input === ' ') {
				const nextState = youtubePlayer.togglePause();

				if (nextState !== 'unchanged') {
					setState({...state, isPaused: nextState === 'paused'});
				}

				return;
			}

			if (key.leftArrow) {
				if (youtubePlayer.seekBackward(state.playingTrack.durationSeconds)) {
					setState({...state, isPaused: false});
				}

				return;
			}

			if (key.rightArrow) {
				if (youtubePlayer.seekForward(state.playingTrack.durationSeconds)) {
					setState({...state, isPaused: false});
				}

				return;
			}
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

			setState({
				...state,
				status: 'selected',
				playingTrack: track,
				isPaused: false,
				session: {
					state: 'idle',
					message: `Starting playback: ${track.title}`
				}
			});

			void youtubePlayer.play(track).then((session) => {
				setState({...state, status: 'selected', playingTrack: track, session, isPaused: false});
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

function ProviderBadge({name}: {name: string}): React.ReactElement {
	return <Text dimColor>Search provider: {name}</Text>;
}

function PlayerPanel({
	session,
	track,
	isPaused
}: {
	session: PlaybackSession;
	track: SearchResult | undefined;
	isPaused: boolean;
}): React.ReactElement {
	const [tick, setTick] = useState(0);

	useEffect(() => {
		if (session.state !== 'playing' || isPaused) {
			return;
		}

		const interval = setInterval(() => {
			setTick((value) => value + 1);
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	}, [isPaused, session.state]);

	const elapsedSeconds = youtubePlayer.getElapsedSeconds();
	const durationSeconds = track?.durationSeconds;
	const progress = durationSeconds ? Math.min(1, elapsedSeconds / durationSeconds) : 0;
	const statusLabel = session.state === 'playing' ? (isPaused ? 'Paused' : 'Playing') : capitalize(session.state);
	void tick;

	return (
		<Box borderStyle="round" borderColor="yellow" paddingX={1} flexDirection="column">
			<Text color="yellow">{statusLabel}</Text>
			{session.state === 'playing' && track ? (
				<>
					<Text>{track.title}</Text>
					<Text>
						{formatDuration(elapsedSeconds)} {renderProgress(progress, Boolean(durationSeconds))} {durationSeconds ? formatDuration(durationSeconds) : '--:--'}
					</Text>
					<Text dimColor>Left/right seek · Space pause/resume · s stop · q quit</Text>
				</>
			) : (
				session.message.split('\n').map((line) => <Text key={line}>{line}</Text>)
			)}
		</Box>
	);
}

function ErrorMessage({message}: {message: string}): React.ReactElement {
	return (
		<Box flexDirection="column">
			{message.split('\n').map((line, index) => (
				<Text key={`${line}-${index}`} color={index === 0 ? 'red' : undefined}>
					{index === 0 ? `Error: ${line}` : line}
				</Text>
			))}
		</Box>
	);
}

function Footer(): React.ReactElement {
	return <Text dimColor>Up/down choose · Enter play · Left/right seek · Space pause/resume · s stop · q quit</Text>;
}

function renderProgress(progress: number, hasDuration: boolean): string {
	const width = 24;
	const filled = hasDuration ? Math.round(progress * width) : 0;

	return `${'━'.repeat(filled)}${'─'.repeat(width - filled)}`;
}

function formatDuration(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function capitalize(value: string): string {
	return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
