# shellwave

A terminal-first audio companion for developers.

`shellwave` starts with YouTube search in the terminal. By default it uses `yt-dlp` for no-key search when available. If you set `YOUTUBE_API_KEY`, it switches to the official YouTube Data API.

The official YouTube Data API returns video metadata, not playable audio streams, so YouTube results are currently shown as discoverable tracks with a clear handoff.

## Install

```bash
npm install -g shellwave
```

For no-key YouTube search, install `yt-dlp`:

```bash
yt-dlp --version
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

No API key is required if `yt-dlp` is installed.

To force `yt-dlp`:

```bash
SHELLWAVE_SEARCH_PROVIDER=yt-dlp shellwave lofi coding music
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

## Roadmap

- Official YouTube search picker
- Local file playback
- Queue and history
- Favorites
- Pluggable playback backends
