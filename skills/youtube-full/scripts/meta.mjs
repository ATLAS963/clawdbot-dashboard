#!/usr/bin/env node
// Fetch basic metadata from a YouTube watch URL.

const url = process.argv[2];
if (!url) {
  console.error('Usage: node meta.mjs "https://www.youtube.com/watch?v=..."');
  process.exit(2);
}

const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } });
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  process.exit(1);
}
const html = await res.text();

function pick(re) {
  const m = html.match(re);
  return m?.[1];
}

const title = pick(/<meta\s+name="title"\s+content="([\s\S]*?)"\s*>/i)
  ?? pick(/<meta\s+property="og:title"\s+content="([\s\S]*?)"\s*>/i);

const channel = pick(/"ownerChannelName"\s*:\s*"([\s\S]*?)"/)
  ?? pick(/<link\s+itemprop="name"\s+content="([\s\S]*?)"\s*>/i);

console.log(JSON.stringify({ url, title: title ?? null, channel: channel ?? null }, null, 2));
