---
name: youtube-full
description: Fetch YouTube video metadata + transcript (no yt-dlp) and prepare summaries/notes.
---

# YouTube Full

## What this skill does
- Extracts **title/channel** and **captions/transcript** from a YouTube URL.
- Works without `yt-dlp` (pure Node fetch + parsing). 
- If captions are not available for the video, it fails cleanly and tells you.

## Commands

### 1) Get transcript
```bash
node {baseDir}/scripts/transcript.mjs "https://www.youtube.com/watch?v=VIDEO_ID" --lang en --out /tmp/transcript.txt
```

### 2) Get metadata (title/channel)
```bash
node {baseDir}/scripts/meta.mjs "https://www.youtube.com/watch?v=VIDEO_ID"
```

## Typical flow (recommended)
1) Run `meta.mjs` (sanity check URL)
2) Run `transcript.mjs`
3) Paste transcript back to Atlas for:
   - summary
   - key ideas
   - content outline
   - action items

## Notes / limitations
- Captions depend on the video: some have none, some are auto-generated, some are region/age restricted.
- This script is best-effort; YouTube markup changes sometimes.

## Safety
- Do not use this skill to download copyrighted media.
- Prefer transcripts/captions only.
