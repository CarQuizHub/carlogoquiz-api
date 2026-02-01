# Car Logo Quiz API

Backend API for [Car Logo Quiz](https://www.carlogoquiz.com), built on **Cloudflare Workers** with **Durable Objects** for stateful session management and **D1** for brand data.

## 🛠 Tech Stack

- **Runtime:** [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- **Session State:** [Durable Objects](https://developers.cloudflare.com/durable-objects/) (SQLite storage backend)
- **Communication:** [Workers RPC](https://developers.cloudflare.com/workers/runtime-apis/rpc/)
- **Database:** [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
- **Caching:** [Cloudflare KV](https://developers.cloudflare.com/kv/)
- **Media Storage:** [Cloudflare R2](https://developers.cloudflare.com/r2/)
- **Language:** TypeScript
- **Testing:** [Vitest](https://vitest.dev/) + [@cloudflare/vitest-pool-workers](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- **CI/CD:** GitHub Actions + [Wrangler](https://developers.cloudflare.com/workers/wrangler/)

## 🏗 Architecture

```
┌──────────────────┐     RPC      ┌─────────────────────────┐
│  Cloudflare      │─────────── ─▶  Session Durable Object │
│  Worker          │              │  (per-quiz instance)    │
│  (API routing)   │              ├─────────────────────────┤
└────────┬─────────┘              │  • SQLite storage       │
         │                        │  • Session state        │
         │                        │  • Game logic           │
         ▼                        └─────────────────────────┘
┌──────────────────┐
│  D1 Database     │ Brand data
├──────────────────┤
│  KV Namespace    │ Brand cache
├──────────────────┤
│  R2 Bucket       │ Logo images
└──────────────────┘
```

## 📌 Features

- **Stateful quiz sessions** — Each session runs in its own Durable Object with isolated SQLite storage
- **RPC-based communication** — Type-safe method calls between Worker and Durable Objects
- **Randomized questions** — Dynamically generated based on difficulty
- **Score tracking** — Lives, score, and progression persisted per session
- **Brand caching** — KV-backed cache for fast brand lookups

### Local Development

```bash
./startup_local.sh
```
