---
name: humanizer
description: Rewrite text to sound more natural and human while preserving meaning and intent.
---

# Humanizer

## What this skill does

Turns stiff, "AI-sounding" text into natural, readable language.

Constraints:
- Preserve **meaning**, **facts**, and **numbers**.
- Do **not** add new claims.
- Keep the **same intent** (inform / persuade / ask / decline).
- Match the requested tone (or infer from context): neutral, direct, friendly, confident.
- Remove filler and corporate boilerplate.
- Keep formatting usable for chat (short lines, bullets when needed).

## When to use

Use when the user asks to:
- humanize / make it sound natural
- rewrite for clarity
- remove "AI tone"

## How to use (prompt pattern)

Ask for:
1) Target audience (who will read it)
2) Channel (Telegram, email, landing page, LinkedIn, etc.)
3) Tone (direct/friendly/confident)
4) Length constraint (short/medium/long)

Then produce:
- Version A (recommended)
- Version B (tighter / more direct)
- Optional: 3 alternative subject lines / opening lines (if email/post)

## Safety

If the user provides sensitive info (tokens, passwords, private data), warn them and propose redaction before rewriting.
