# Vercel Deployment

The repository includes `vercel.json`, Vite static-output settings, and serverless tRPC entry points under `api/trpc/`. Vercel builds the client into a root `public/` directory and routes OpenAI-compatible provider calls through Vercel Functions.

Create a Vercel project from this repository, use the repository root as the project root, and retain the version-controlled settings. No user provider key should be configured as a Vercel environment variable: visitors submit a key once through the Settings page, and the application keeps it only in a temporary server session.

The temporary key session is process-local. On a cold start or serverless-instance change, the visitor may need to submit the key again. This is intentional so the application does not persist a user’s provider secret.
