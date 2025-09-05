This is a Next.js (App Router) project that implements a chat UI for generating and iteratively editing logos using Gemini 2.5 Flash Image. All outputs are enforced to exactly 1024×1024 PNG via model hints and sharp post-processing.

## Getting Started

Environment variables:

Create `.env.local` and set:

```
GOOGLE_API_KEY=your_google_ai_studio_api_key
# optional: override model id if your account uses a different name
# GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

Install dependencies and run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open http://localhost:3000 with your browser.

Main files:

- `app/page.tsx` – Chat page
- `components/Chat.tsx` – Client chat UI (SWR)
- `app/api/messages/route.ts` – Route handler for chat (GET, POST)
- `lib/gemini.ts` – Adapter for Gemini image generate/edit (REST)
- `lib/image.ts` – Enforces 1024×1024 PNG with sharp
- `lib/store.ts` – In-memory per-session state (latest image + messages)
- `lib/session.ts` – Cookie-based session ID helper
- `app/api/themes/route.ts` – Lists example theme images from `public/themes`

Notes:

- The server always prefixes calls with a system prompt that locks the model, size, and design guidance.
- If the upstream API cannot strictly enforce size, images are normalized to 1024×1024 PNG.
- Follow-up prompts edit the latest image by passing it back as input to the model.
- Optional user uploads (PNG/JPG) are normalized to 1024×1024 PNG before being used as a base.

Themes (inspiration images)
- Place PNG/JPG/WebP files in `public/themes/`.
- The chat shows these below the messages; click one to select/unselect.
- On submit, the selected theme is used as the base image if you didn’t upload a file. Follow‑up edits continue from the latest generated image.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
