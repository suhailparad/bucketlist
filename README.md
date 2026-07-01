# Bucketlist PWA

An installable Express application for collecting life goals in themed buckets.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`. For production, set a strong `SESSION_SECRET` environment variable and serve over HTTPS.

Data is stored in `data/store.json`. Passwords are hashed with Node's built-in `scrypt`; session cookies are HTTP-only and signed.
