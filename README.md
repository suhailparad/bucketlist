# Bucketlist PWA

An installable Express application for collecting life goals in themed buckets.

## Run locally

```bash
npm install
```

Create a `.env` file in the project root using `.env.example` as the template:

```bash
cp .env.example .env
```

Then update `.env` with your local or MongoDB Atlas values:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/bucketlist
SESSION_SECRET=replace-with-a-long-random-secret
PORT=3000
```

Start the application:

```bash
npm start
```

Alternatively, environment variables can be set directly in your shell:

```bash
export MONGODB_URI="mongodb://127.0.0.1:27017/bucketlist"
export SESSION_SECRET="replace-with-a-long-random-secret"
npm start
```

Data is stored in MongoDB across `users`, `buckets`, `tasks`, and `sessions` collections. Passwords are hashed with Node's built-in `scrypt`; session cookies are HTTP-only and signed. In production, use a strong `SESSION_SECRET`, an authenticated MongoDB connection string, and HTTPS.
