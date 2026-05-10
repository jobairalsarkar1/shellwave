# shellwave

A terminal-first audio companion for developers.

`shellwave` starts with YouTube search in the terminal. By default it uses a bundled no-key YouTube search provider. If you set `YOUTUBE_API_KEY`, it switches to the official YouTube Data API.

The official YouTube Data API returns video metadata, not playable audio streams, so YouTube results are currently shown as discoverable tracks with a clear handoff.

## Install

```bash
npm install -g shellwave
```

## Usage

```bash
shellwave lofi coding music
```

or:

```bash
shellwave search "lofi coding music"
```

## YouTube Search

No API key or external binary is required for the default search flow.

To force the bundled no-key provider:

```bash
SHELLWAVE_SEARCH_PROVIDER=youtubei shellwave lofi coding music
```

To use the official YouTube Data API instead, create a YouTube Data API key in Google Cloud, then expose it as:

```bash
export YOUTUBE_API_KEY=your_key
```

PowerShell:

```powershell
$env:YOUTUBE_API_KEY="your_key"
```

To force official API mode:

```bash
SHELLWAVE_SEARCH_PROVIDER=youtube-api shellwave lofi coding music
```

To force `yt-dlp` mode, install `yt-dlp` and run:

```bash
SHELLWAVE_SEARCH_PROVIDER=yt-dlp shellwave lofi coding music
```

## Playback

Audio playback uses `ffplay`, which ships with FFmpeg. Install FFmpeg and make sure `ffplay` is on your `PATH`.

Ubuntu/Debian:

```bash
sudo apt install ffmpeg
```

macOS:

```bash
brew install ffmpeg
```

Windows:

```powershell
winget install Gyan.FFmpeg
```

## Roadmap

- Official YouTube search picker
- Local file playback
- Queue and history
- Favorites
- Pluggable playback backends
