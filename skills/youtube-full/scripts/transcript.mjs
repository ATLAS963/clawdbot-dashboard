#!/usr/bin/env node
// Best-effort transcript fetcher from YouTube caption tracks.
// Usage:
//   node transcript.mjs "https://www.youtube.com/watch?v=..." --lang en --out /tmp/t.txt

import fs from 'node:fs';

const args = process.argv.slice(2);
const url = args[0];
if (!url) {
  console.error('Usage: node transcript.mjs <youtube-url> [--lang en] [--out path]');
  process.exit(2);
}

function argValue(flag, def = null) {
  const i = args.indexOf(flag);
  if (i === -1) return def;
  return args[i + 1] ?? def;
}

const langPref = argValue('--lang', null);
const outPath = argValue('--out', null);

const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } });
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  process.exit(1);
}
const html = await res.text();

// Extract ytInitialPlayerResponse JSON.
// Common patterns: var ytInitialPlayerResponse = {...}; or "ytInitialPlayerResponse":{...}
let jsonText = null;
{
  const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\})\s*;\s*var\s+meta/i);
  if (m) jsonText = m[1];
}
if (!jsonText) {
  const m = html.match(/"ytInitialPlayerResponse"\s*:\s*(\{[\s\S]*?\})\s*,\s*"ytInitialData"/);
  if (m) jsonText = m[1];
}
if (!jsonText) {
  console.error('Could not find ytInitialPlayerResponse in page. Video may be restricted or markup changed.');
  process.exit(1);
}

let player;
try {
  player = JSON.parse(jsonText);
} catch (e) {
  console.error('Failed to parse ytInitialPlayerResponse JSON.');
  process.exit(1);
}

const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
  console.error('No caption tracks found for this video.');
  process.exit(1);
}

function normalizeLang(code) {
  return (code || '').toLowerCase();
}

let chosen = null;
if (langPref) {
  const want = normalizeLang(langPref);
  chosen = tracks.find(t => normalizeLang(t.languageCode) === want)
    ?? tracks.find(t => normalizeLang(t.vssId)?.includes('.' + want))
    ?? tracks.find(t => normalizeLang(t.vssId)?.includes(want));
}
if (!chosen) {
  // Prefer English if present, else first.
  chosen = tracks.find(t => normalizeLang(t.languageCode).startsWith('en')) ?? tracks[0];
}

const trackUrl = chosen.baseUrl;
if (!trackUrl) {
  console.error('Chosen caption track has no baseUrl.');
  process.exit(1);
}

// Request timedtext in XML, then strip tags.
const capRes = await fetch(trackUrl, { headers: { 'user-agent': 'Mozilla/5.0' } });
if (!capRes.ok) {
  console.error(`Caption HTTP ${capRes.status}`);
  process.exit(1);
}
const xml = await capRes.text();

// Very simple XML extraction: pull text nodes inside <text>...</text>
const lines = [];
const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
let m;
while ((m = re.exec(xml)) !== null) {
  const raw = m[1]
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n/g, ' ');
  // Remove any leftover tags.
  const cleaned = raw.replace(/<[^>]+>/g, '').trim();
  if (cleaned) lines.push(cleaned);
}

if (lines.length === 0) {
  console.error('Captions fetched, but transcript was empty after parsing.');
  process.exit(1);
}

const transcript = lines.join('\n');

if (outPath) {
  fs.writeFileSync(outPath, transcript, 'utf8');
  process.stdout.write(outPath + '\n');
} else {
  process.stdout.write(transcript + '\n');
}
