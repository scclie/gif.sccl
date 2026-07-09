# gif.sccl.cc

Minimal GIF maker - client-side encoding, no tracking.

- **Input**: video (mp4, webm, mov, avi) or images (png, jpg, webp) - drag, click, or paste
- **Trim**: set start/end for video, visual crop with draggable handles
- **Auto-settings**: fps=10 for video, fps=1 for images, width adapts to source
- **Gallery**: public gallery with copy URL, click-to-open, admin delete/show-all
- **Privacy**: no server-side frame processing; files uploaded only after encoding

- **Site**: [gif.sccl.cc](https://gif.sccl.cc)
- **Stack**: [Zine SSG](https://zine-ssg.io) + Cloudflare Pages (Workers, D1, KV)
- **GIF encoder**: [gif.js](https://github.com/jnordberg/gif.js) (client-side, no server CPU)
- **Auth**: Discord OAuth (first user becomes admin)
- **Storage**: [Catbox.moe](https://catbox.moe) (anonymous, 20MB/git)

## Setup

### 1. Discord Application
- https://discord.com/developers/applications -> New Application -> OAuth2
- Redirect: `https://gif.sccl.cc/api/auth/callback`
- Copy **Client ID** + **Client Secret**

### 2. GitHub Secrets
Repository -> Settings -> Secrets and variables -> Actions:

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | API token (KV:Edit, D1:Edit, Pages:Edit) |
| `CF_ACCOUNT_ID` | Cloudflare Account ID (bottom-right of dashboard) |
| `DISCORD_CLIENT_ID` | From Discord Developer Portal |
| `DISCORD_CLIENT_SECRET` | From Discord Developer Portal |
| `CATBOX_USERHASH` | Your catbox.moe userhash (required - catbox blocks Cloudflare Workers IPs) |

### 3. Catbox userhash
- Register at [catbox.moe](https://catbox.moe) -> Profile -> copy userhash
- Add as `CATBOX_USERHASH` in GitHub Secrets

### 4. Push to deploy
Push to `main` - GitHub Actions builds with Zine, creates KV + D1, applies migrations, sets bindings + secrets, and deploys to Cloudflare Pages.

## Development

```bash
npm run dev    # serve with live reload
npm run build  # zine release build
```
