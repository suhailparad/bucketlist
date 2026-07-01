# Bucketlist PWA

An installable Express application for collecting life goals in themed buckets.

## Run locally

```bash
npm install
npm start
```

Set the environment variables in your shell (Node does not automatically load `.env`), then open `http://localhost:3000`:

```bash
export MONGODB_URI="mongodb://127.0.0.1:27017/bucketlist"
export SESSION_SECRET="replace-with-a-long-random-secret"
npm start
```

Data is stored in MongoDB across `users`, `buckets`, `tasks`, and `sessions` collections. Passwords are hashed with Node's built-in `scrypt`; session cookies are HTTP-only and signed. In production, use a strong `SESSION_SECRET`, an authenticated MongoDB connection string, and HTTPS.
