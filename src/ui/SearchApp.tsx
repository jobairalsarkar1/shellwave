import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import {youtubePlayer} from '../player/youtubePlayer.js';
import type {PlaybackSession} from '../player/types.js';
import type {SearchResult} from '../providers/types.js';
import {createSearchProvider} from '../providers/createSearchProvider.js';
import type {SearchProvider} from '../providers/types.js';
import {formatDate} from '../lib/format.js';
import {addTrackToPlaylist, createPlaylist, listPlaylistNames} from '../playlists/store.js';

type Props = {
	query: string;
	initialResults?: SearchResult[];
	providerName?: string;
	autoPlay?: boolean;
};

const AUTO_NEXT_DELAY_MS = 1500;

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
	| {status: 'error'; message: string}
	| {
			status: 'selecting-playlist';
			results: SearchResult[];
			selectedIndex: number;
			selectedTrackIndex: number;
			playlistNames: string[];
			playlistIndex: number;
			previousStatus: 'ready' | 'selected';
			playingTrack?: SearchResult;
			session?: PlaybackSession;
			providerName: string;
			isPaused?: boolean;
	  }
	| {
			status: 'creating-playlist';
			results: SearchResult[];
			selectedIndex: number;
			selectedTrackIndex: number;
			playlistName: string;
			previousStatus: 'ready' | 'selected';
			playingTrack?: SearchResult;
			session?: PlaybackSession;
			providerName: string;
			isPaused?: boolean;
	  };

export function SearchApp({query, initialResults, providerName, autoPlay = false}: Props): React.ReactElement {
	const [state, setState] = useState<ScreenState>(() =>
		initialResults ? {status: 'ready', results: initialResults, selectedIndex: 0, providerName: providerName ?? 'playlist'} : {status: 'loading'}
	);
	const [notice, setNotice] = useState<string>();
	const autoNextTimeout = useRef<ReturnType<typeof setTimeout>>();
	const didAutoPlay = useRef(false);
	const provider = useMemo<SearchProvider | undefined>(() => {
		if (initialResults) {
			return undefined;
		}

		try {
			return createSearchProvider();
		} catch (error) {
			setState({status: 'error', message: error instanceof Error ? error.message : String(error)});
			return undefined;
		}
	}, [initialResults]);

	useEffect(() => {
		if (initialResults) {
			return;
		}

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
		if (!autoPlay || didAutoPlay.current || state.status !== 'ready') {
			return;
		}

		const track = state.results[state.selectedIndex];

		if (!track) {
			return;
		}

		didAutoPlay.current = true;
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
			setState((latestState) => {
				if (latestState.status !== 'selected' || latestState.playingTrack.id !== track.id) {
					return latestState;
				}

				return {...latestState, session, isPaused: false};
			});
		});
	}, [autoPlay, state]);

	useEffect(() => {
		return () => {
			if (autoNextTimeout.current) {
				clearTimeout(autoNextTimeout.current);
			}

			youtubePlayer.stop();
		};
	}, []);

	useEffect(() => {
		const unsubscribe = youtubePlayer.onEnd((event) => {
			setState((currentState) => {
				if (currentState.status !== 'selected') {
					return currentState;
				}

				if (!event.completed) {
					return {
						...currentState,
						isPaused: false,
						session: {
							state: 'stopped',
							message: [
								'Playback stopped before the track finished.',
								`Stopped at ${formatDuration(event.elapsedSeconds)} of ${formatDuration(currentState.playingTrack.durationSeconds ?? 0)}.`,
								'Press Enter on a result to play again.'
							].join('\n')
						}
					};
				}

				const nextIndex = currentState.results.findIndex((result) => result.id === currentState.playingTrack.id) + 1;
				const nextTrack = currentState.results[nextIndex];

				if (!nextTrack) {
					return {
						...currentState,
						isPaused: false,
						session: {
							state: 'stopped',
							message: 'Playback finished.'
						}
					};
				}

				if (autoNextTimeout.current) {
					clearTimeout(autoNextTimeout.current);
				}

				autoNextTimeout.current = setTimeout(() => {
					autoNextTimeout.current = undefined;
					void youtubePlayer.play(nextTrack).then((session) => {
						setState((latestState) => {
							if (latestState.status !== 'selected' || latestState.playingTrack.id !== nextTrack.id) {
								return latestState;
							}

							return {
								...latestState,
								selectedIndex: nextIndex,
								playingTrack: nextTrack,
								session,
								isPaused: false
							};
						});
					});
				}, AUTO_NEXT_DELAY_MS);

				return {
					...currentState,
					selectedIndex: nextIndex,
					playingTrack: nextTrack,
					isPaused: false,
					session: {
						state: 'idle',
						message: `Starting next in ${formatDelay(AUTO_NEXT_DELAY_MS)}: ${nextTrack.title}`
					}
				};
			});
		});

		return () => {
			if (autoNextTimeout.current) {
				clearTimeout(autoNextTimeout.current);
				autoNextTimeout.current = undefined;
			}

			unsubscribe();
		};
	}, []);

	return (
		<Box flexDirection="column" gap={1}>
			{process.stdin.isTTY && <InputControls state={state} setState={setState} setNotice={setNotice} />}
			<Header query={query} />
			{notice && <Text color="green">{notice}</Text>}
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
			{state.status === 'selecting-playlist' && (
				<>
					<ProviderBadge name={state.providerName} />
					<Results results={state.results} selectedIndex={state.selectedIndex} />
					<PlaylistSelector playlists={state.playlistNames} selectedIndex={state.playlistIndex} />
					{state.previousStatus === 'selected' && <PlayerPanel session={state.session!} track={state.playingTrack!} isPaused={state.isPaused ?? false} />}
				</>
			)}
			{state.status === 'creating-playlist' && (
				<>
					<ProviderBadge name={state.providerName} />
					<Results results={state.results} selectedIndex={state.selectedIndex} />
					<PlaylistNameInput value={state.playlistName} />
					{state.previousStatus === 'selected' && <PlayerPanel session={state.session!} track={state.playingTrack!} isPaused={state.isPaused ?? false} />}
				</>
			)}
			<Footer />
		</Box>
	);
}

function InputControls({
	state,
	setState,
	setNotice
}: {
	state: ScreenState;
	setState: React.Dispatch<React.SetStateAction<ScreenState>>;
	setNotice: React.Dispatch<React.SetStateAction<string | undefined>>;
}): null {
	const {exit} = useApp();

	useInput((input, key) => {
		if (input === 'q' || key.escape) {
			if (state.status === 'selecting-playlist' || state.status === 'creating-playlist') {
				if (state.previousStatus === 'ready') {
					setState({
						status: 'ready',
						results: state.results,
						selectedIndex: state.selectedIndex,
						providerName: state.providerName
					});
				} else {
					setState({
						status: 'selected',
						results: state.results,
						selectedIndex: state.selectedIndex,
						playingTrack: state.playingTrack!,
						session: state.session!,
						isPaused: state.isPaused!,
						providerName: state.providerName
					});
				}
				return;
			}

			youtubePlayer.stop();
			exit();
			return;
		}

		if (state.status === 'selecting-playlist') {
			if (key.upArrow) {
				setState({
					...state,
					playlistIndex: Math.max(0, state.playlistIndex - 1)
				});
				return;
			}

			if (key.downArrow) {
				setState({
					...state,
					playlistIndex: Math.min(state.playlistNames.length - 1, state.playlistIndex + 1)
				});
				return;
			}

			if (key.return) {
				const selectedPlaylist = state.playlistNames[state.playlistIndex];
				const track = state.results[state.selectedTrackIndex];

				if (selectedPlaylist && track) {
					try {
						const result = addTrackToPlaylist(selectedPlaylist, track);
						setNotice(result.added ? `Added to ${selectedPlaylist}: ${track.title}` : `Already in ${selectedPlaylist}: ${track.title}`);
						if (state.previousStatus === 'ready') {
							setState({
								status: 'ready',
								results: state.results,
								selectedIndex: state.selectedIndex,
								providerName: state.providerName
							});
						} else {
							setState({
								status: 'selected',
								results: state.results,
								selectedIndex: state.selectedIndex,
								playingTrack: state.playingTrack!,
								session: state.session!,
								isPaused: state.isPaused!,
								providerName: state.providerName
							});
						}
					} catch (error) {
						setNotice(error instanceof Error ? error.message : 'Could not add track to playlist.');
					}
				}
				return;
			}

			return;
		}

		if (state.status === 'creating-playlist') {
			if (isBackspaceInput(input, key)) {
				setState({
					...state,
					playlistName: state.playlistName.slice(0, -1)
				});
				return;
			}

			if (input && input.length === 1 && /^[\w-]/.test(input)) {
				setState({
					...state,
					playlistName: state.playlistName + input
				});
				return;
			}

			if (key.return) {
				const playlistName = state.playlistName.trim();

				if (playlistName.length > 0) {
					const track = state.results[state.selectedTrackIndex];

					try {
						createPlaylist(playlistName);
						const result = addTrackToPlaylist(playlistName, track);
						setNotice(`Created ${playlistName} and added: ${track.title}`);
						if (state.previousStatus === 'ready') {
							setState({
								status: 'ready',
								results: state.results,
								selectedIndex: state.selectedIndex,
								providerName: state.providerName
							});
						} else {
							setState({
								status: 'selected',
								results: state.results,
								selectedIndex: state.selectedIndex,
								playingTrack: state.playingTrack!,
								session: state.session!,
								isPaused: state.isPaused!,
								providerName: state.providerName
							});
						}
					} catch (error) {
						setNotice(error instanceof Error ? error.message : 'Could not create playlist.');
					}
				}
				return;
			}

			return;
		}

		if (state.status !== 'ready' && state.status !== 'selected') {
			return;
		}

		if (input === 'a') {
			const track = state.results[state.selectedIndex];

			if (!track) {
				return;
			}

			const playlistNames = listPlaylistNames();

			if (playlistNames.length === 0) {
				setState({
					status: 'creating-playlist',
					results: state.results,
					selectedIndex: state.selectedIndex,
					selectedTrackIndex: state.selectedIndex,
					playlistName: '',
					previousStatus: state.status,
					...(state.status === 'selected' && {
						playingTrack: state.playingTrack,
						session: state.session,
						isPaused: state.isPaused
					}),
					providerName: state.providerName
				});
			} else {
				setState({
					status: 'selecting-playlist',
					results: state.results,
					selectedIndex: state.selectedIndex,
					selectedTrackIndex: state.selectedIndex,
					playlistNames,
					playlistIndex: 0,
					previousStatus: state.status,
					...(state.status === 'selected' && {
						playingTrack: state.playingTrack,
						session: state.session,
						isPaused: state.isPaused
					}),
					providerName: state.providerName
				});
			}

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
	return <Text dimColor>Up/down choose · Enter play · a add to playlist · Left/right seek · Space pause/resume · s stop · q quit</Text>;
}

function isBackspaceInput(input: string, key: {backspace?: boolean; delete?: boolean}): boolean {
	return key.backspace === true || key.delete === true || input === '\u007F' || input === '\b';
}

function PlaylistSelector({playlists, selectedIndex}: {playlists: string[]; selectedIndex: number}): React.ReactElement {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
			<Text color="cyan">Select playlist to add track:</Text>
			{playlists.map((playlist, index) => (
				<Text key={playlist} color={index === selectedIndex ? 'cyan' : undefined}>
					{index === selectedIndex ? '>' : ' '} {playlist}
				</Text>
			))}
			<Text dimColor>Up/down choose · Enter confirm · q cancel</Text>
		</Box>
	);
}

function PlaylistNameInput({value}: {value: string}): React.ReactElement {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
			<Text color="cyan">Create new playlist:</Text>
			<Text>Name: <Text color="yellow">{value}_</Text></Text>
			<Text dimColor>Type name · Backspace edit · Enter confirm · q cancel</Text>
		</Box>
	);
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

function formatDelay(milliseconds: number): string {
	return `${(milliseconds / 1000).toFixed(1)}s`;
}

function capitalize(value: string): string {
	return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
