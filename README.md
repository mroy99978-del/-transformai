# TransformAI Cloud Starter v2

Architecture selected: **iPhone web app + cloud AI**, with face swap first, then outfit/full-body transformation.

## Included
- Mobile-first Safari UI in `public/index.html`
- Express backend in `server.js`
- Server-side provider calls using `@fal-ai/client`
- Photo face-edit mode using `fal-ai/hy-wu-edit`
- Uploaded video person-swap mode using `fal-ai/pixverse/swap`
- Outfit try-on mode using `google/virtual-try-on`
- Full-body style-edit prompt using `fal-ai/hy-wu-edit`
- `GET /api/health` provider configuration status

## Setup (requires a developer or hosting service)
1. Install Node.js 20 or newer.
2. In this folder, run `npm install`.
3. Create a fal.ai account and obtain an API key from the provider.
4. Set the key as a **server environment variable** named `FAL_KEY`. Never paste it into `index.html` or share it in public chat.
5. Run `npm start`.
6. Deploy this Node app to a host that supports Node.js and HTTPS. Open the HTTPS site in iPhone Safari.

## Important limitations
- The face-swap/photo and full-body modes use a prompt-based image editing model; quality and whether the face is replaced exactly can vary. It is not a dedicated deterministic face-swap model.
- Video mode uses a provider's video person-swap model. It is asynchronous, not a real-time live camera filter.
- The camera is currently a local preview only. True live face tracking/transformation requires a low-latency streaming architecture (for example WebRTC/WebSocket frames plus a real-time model), which is not implemented here.
- Provider models, terms, availability, prices, and safety rules can change. Review the current model pages and provider policy before deployment.
- Uploaded files are sent to the selected AI provider. Review its retention/privacy terms. Do not use real people’s faces without permission and consent.

## Official model documentation
- fal.ai HY-WU Edit: https://fal.ai/models/fal-ai/hy-wu-edit/api
- fal.ai PixVerse Swap: https://fal.ai/models/fal-ai/pixverse/swap/api
- Google Virtual Try-On via fal.ai: https://fal.ai/models/google/virtual-try-on/api

## Production checklist
Add authentication, request rate limiting, cost controls, abuse prevention, upload validation beyond MIME type, secure deletion/retention rules, user data disclosures, and job-status handling before public release.
