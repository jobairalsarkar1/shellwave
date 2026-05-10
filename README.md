# shellwave

A terminal-first audio companion for developers.

`shellwave` starts with a compliant YouTube search flow using the official YouTube Data API. The official API returns video metadata, not playable audio streams, so YouTube results are shown as discoverable tracks with a clear handoff instead of using an unofficial extractor.

## Install

```bash
npm install -g shellwave
```

## Usage

```bash
YOUTUBE_API_KEY=your_key shellwave lofi coding music
```

or:

```bash
shellwave search "lofi coding music"
```

## YouTube Search

Create a YouTube Data API key in Google Cloud, then expose it as:

```bash
export YOUTUBE_API_KEY=your_key
```

PowerShell:

```powershell
$env:YOUTUBE_API_KEY="your_key"
```

## Roadmap

- Official YouTube search picker
- Local file playback
- Queue and history
- Favorites
- Pluggable playback backends
