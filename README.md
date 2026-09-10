# gif.sccl.cc

minimal GIF maker - client-side encoding, no tracking.

- **input**: video (mp4, webm, mov, avi) or images (png, jpg, webp) - drag, click, or paste
- **trim**: set start/end for video, visual crop with draggable handles
- **auto-settings**: fps=10 for video, fps=1 for images, width adapts to source
- **gallery**: public gallery with copy URL, click-to-open, admin delete/show-all
- **privacy**: no server-side frame processing; files uploaded only after encoding (cloudflare tracking for anon users (capcha (sry)))

- **site**: [gif.sccl.cc](https://gif.sccl.cc)
- **stack**: [Zine SSG](https://zine-ssg.io) + Cloudflare Pages (Workers, D1, KV)
- **gif encoder**: [gif.js](https://github.com/jnordberg/gif.js) (client-side, no server CPU)
- **auth**: discord OAuth (first user becomes admin)
- **storage**: pgsql


## development

```bash
npm run dev    # serve with live reload
npm run build  # zine release build
```
