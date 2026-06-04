# 星盘指引 · Cosmic Guide

Personal weekly astrology app — auto-updates every Sunday via GitHub Actions + Claude API.

## Setup (one time, 5 minutes)

### 1. Add your Anthropic API key as a GitHub Secret
1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `ANTHROPIC_API_KEY`
4. Value: your API key (starts with `sk-ant-...`)
5. Click **Add secret**

### 2. Enable GitHub Pages
1. Go to **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `root`
4. Save

### 3. Trigger first run manually
1. Go to **Actions** tab
2. Click **Weekly Cosmic Guide Update**
3. Click **Run workflow** → **Run workflow**
4. Wait ~30 seconds → your `index.html` is updated!

### 4. Install on iPhone
1. Open `https://yourusername.github.io/your-repo-name` in Safari
2. Tap **Share ↑** → **Add to Home Screen**
3. Done 🌙

## How it works
- Every **Sunday at 8:00 AM Beijing time**, GitHub Actions runs `generate.js`
- The script calls Claude API with your birth chart data
- Claude generates fresh, personalized weekly guidance as JSON
- The script builds a complete `index.html` and commits it
- Your app is instantly updated — just open it

## Manual update
Go to **Actions** → **Weekly Cosmic Guide Update** → **Run workflow** anytime.

## Files
- `generate.js` — the generator (your birth data lives here)
- `.github/workflows/weekly-update.yml` — the Sunday schedule
- `index.html` — generated each week (do not edit manually)
