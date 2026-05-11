# shellwave

A terminal-first YouTube audio player for developers.

Search from your terminal, pick a result with the keyboard, and play audio without opening a browser.

## Install

```bash
npm install -g shellwave
```

If global npm installs fail with a permissions error, see [Install Troubleshooting](#install-troubleshooting).

## Requirements

Search works out of the box. Playback needs:

- `ffplay`, included with FFmpeg
- `yt-dlp`, used to resolve YouTube audio URLs

Ubuntu/Debian:

```bash
sudo apt install ffmpeg
sudo apt install pipx
pipx install yt-dlp
```

If your shell cannot find `yt-dlp`, add `~/.local/bin` to your path.

fish:

```bash
fish_add_path ~/.local/bin
```

Bash/Zsh:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Alternative pip install:

```bash
sudo apt install python3-pip
python3 -m pip install --user -U yt-dlp
```

If Ubuntu blocks pip with an externally managed environment warning, use the `pipx` method above.

macOS:

```bash
brew install ffmpeg yt-dlp
```

Windows:

```powershell
winget install Gyan.FFmpeg
winget install yt-dlp.yt-dlp
```

Check your setup:

```bash
shellwave doctor
```

## Usage

Search and play:

```bash
shellwave lofi coding music
```

or:

```bash
shellwave search "lofi coding music"
```

Check playback dependencies:

```bash
shellwave doctor
```

Controls:

```text
Up/down      choose a search result
Enter        play selected result
Left/right   seek backward/forward
Space        pause/resume
s            stop and return to results
q            quit
```

When a track ends, shellwave automatically starts the next result from the current search list.

## Install Troubleshooting

### EACCES during global install

If `npm install -g shellwave` fails with an error like:

```text
EACCES: permission denied, mkdir '/usr/local/lib/node_modules/shellwave'
```

your npm global install directory is owned by root. Check it with:

```bash
npm config get prefix
```

If it prints `/usr/local`, prefer a user-owned npm prefix:

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
```

fish:

```bash
fish_add_path ~/.npm-global/bin
```

Bash/Zsh:

```bash
export PATH="$HOME/.npm-global/bin:$PATH"
```

Then install again:

```bash
npm install -g shellwave
```

For a longer-term Node setup, use a user-owned version manager such as `nvm`, `fnm`, or `volta`.

## Search Providers

By default, `shellwave` uses a bundled no-key YouTube search provider. You do not need a YouTube API key for normal use.

Force the default no-key provider:

```bash
SHELLWAVE_SEARCH_PROVIDER=youtubei shellwave lofi coding music
```

Use the official YouTube Data API for search metadata:

```bash
export YOUTUBE_API_KEY=your_key
SHELLWAVE_SEARCH_PROVIDER=youtube-api shellwave lofi coding music
```

PowerShell:

```powershell
$env:YOUTUBE_API_KEY="your_key"
$env:SHELLWAVE_SEARCH_PROVIDER="youtube-api"
shellwave lofi coding music
```

Use `yt-dlp` for search:

```bash
SHELLWAVE_SEARCH_PROVIDER=yt-dlp shellwave lofi coding music
```

## Troubleshooting

If playback fails with a YouTube extraction error, update `yt-dlp`:

```bash
pipx upgrade yt-dlp
```

If playback starts but you hear no sound, verify your system audio works with `ffplay` and that your terminal session has access to your audio server.

## Local Development

```bash
npm install
npm run build
npm link
shellwave ektaara
```

Run checks:

```bash
npm run typecheck
npm --cache .npm-cache pack --dry-run
```

## Roadmap

- Local file playback
- Queue and history
- Favorites
- Config file
- Pluggable playback backends
