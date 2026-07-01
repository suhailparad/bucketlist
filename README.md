# Bucketlist PWA

An installable MERN application for collecting life goals in themed buckets. React and Vite power the frontend; Express, Node.js, and MongoDB power the API.

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

Start both the React development server and Express API:

```bash
npm run dev
```

Open `http://localhost:5173`. Vite forwards `/api` requests to Express on port `3000`.

## Production

```bash
npm run build
npm start
```

The React production build is generated in `dist/` and served by Express at `http://localhost:3000`.

Alternatively, environment variables can be set directly in your shell:

```bash
export MONGODB_URI="mongodb://127.0.0.1:27017/bucketlist"
export SESSION_SECRET="replace-with-a-long-random-secret"
npm start
```

Data is stored in MongoDB across `users`, `buckets`, `tasks`, and `sessions` collections. Passwords are hashed with Node's built-in `scrypt`; session cookies are HTTP-only and signed. In production, use a strong `SESSION_SECRET`, an authenticated MongoDB connection string, and HTTPS.
