# gif.sccl.cc

minimal GIF maker - client-side encoding, no tracking.

[![health](https://status.sccl.cc/api/v1/endpoints/apps_gif-sccl-api/health/badge.svg)](https://status.sccl.cc/endpoints/apps_gif-sccl-api)
[![uptime 1h](https://status.sccl.cc/api/v1/endpoints/apps_gif-sccl-api/uptimes/1h/badge.svg)](https://status.sccl.cc/endpoints/apps_gif-sccl-api)
[![uptime 24h](https://status.sccl.cc/api/v1/endpoints/apps_gif-sccl-api/uptimes/24h/badge.svg)](https://status.sccl.cc/endpoints/apps_gif-sccl-api)
[![uptime 7d](https://status.sccl.cc/api/v1/endpoints/apps_gif-sccl-api/uptimes/7d/badge.svg)](https://status.sccl.cc/endpoints/apps_gif-sccl-api)

- input: video (mp4, webm, mov, avi) or images (png, jpg, webp) - drag, click, or paste
- output: webp by default (libwebp wasm), gif selectable ([gif.js](https://github.com/jnordberg/gif.js)) - all client-side, no server cpu
- trim: set start/end for video, visual crop with draggable handles
- links: direct links to .webp / .gif
- gallery: public gallery with copy URL, click-to-open, tags
- privacy: no server-side frame processing; files uploaded only after encoding if u want it (cf turnstile captcha for anonymous uploads)

## stack

- site: [gif.sccl.cc](https://gif.sccl.cc)
- static: [Zine SSG](https://zine-ssg.io)
- encoder: for webp's - `webp-wasm.wasm`, for gif's - `gif.js`
- api: self-hosted Node.js HTTP server in a Docker/OCI container on a [NixOS](https://nixos.org/) box behind the `sccl.*` facade
- db: postgres on the same host (`/var/gifs` for files, pgsql for metadata)
- deploy: фorgejo ci ([git.sccl.cc/scclie/gif.sccl](https://git.sccl.cc/scclie/gif.sccl)) builds the site and the api image
- auth: discord oauth
- monitoring: [status.sccl.cc](https://status.sccl.cc), i also grab some metrics in prometheus-grafana
