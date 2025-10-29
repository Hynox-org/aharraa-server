# Aharraa Server (Initial scaffold)

This repository contains a minimal Node.js (Express) server scaffold that:
- Connects to MongoDB via Mongoose
- Integrates with Supabase Authentication for email/password and Google OAuth (server-side)

Files created:
- `package.json` - manifest and scripts
- `src/index.js` - Express server entry
- `src/config/db.js` - MongoDB connection helper
- `src/config/supabase.js` - Supabase client (server, uses SERVICE_ROLE_KEY)
- `src/routes/auth.js` - Basic auth endpoints (signup, signin, oauth redirect, verify)
- `src/models/User.js` - Minimal user schema to mirror Supabase users in MongoDB
- `.env.example` - Environment variable template

Quick start
1. Copy `.env.example` to `.env` and fill in values (especially `MONGO_URI`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`).
2. Install dependencies:

```powershell
# from project root
npm install
```

3. Start the server in development:

```powershell
npm run dev
```

Endpoints
- `POST /auth/signup` { email, password } -> sign up via Supabase and mirror to MongoDB
- `POST /auth/signin` { email, password } -> sign in via Supabase
- `GET /auth/oauth/google?redirect=` -> returns a URL to redirect the user to start Google OAuth
- `POST /auth/verify` { access_token } -> verify an access token with Supabase

Notes & security
- The server currently expects a Supabase SERVICE_ROLE_KEY for server-side admin operations. This key is highly privileged; don't commit it to source control and keep it in a safe secret store.
- For production, configure HTTPS, proper CORS origins, rate limiting, and secure storage of secrets.

Next steps (suggested)
- Add refresh token handling and cookie/session management for browser clients
- Add proper error mapping and input validation (e.g. using Joi or Zod)
- Implement webhooks to sync user updates from Supabase to MongoDB if needed

