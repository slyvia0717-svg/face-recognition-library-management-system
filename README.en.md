# Classical Self-Service Library

A Vue 3 / Express / SQLite library application with a traditional Chinese visual theme, password and face verification, real barcode borrowing, personal returns, and administrator management.

This edition extends an existing project. Original source, artwork and third-party attribution are documented in [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md). See the [Chinese README](README.md) for full instructions.

## Run locally

```sh
npm ci --prefix backend
npm ci --prefix frontend
cd backend
npm run set-password -- admin
npm start
```

There is no default administrator password. In another terminal, from the repository root:

```sh
npm run serve --prefix frontend
```

Open the URL printed by the frontend development server. API requests are proxied to localhost:3000. A fresh SQLite database seeds six demonstration books without real user records.

## Verify

```sh
npm test --prefix backend
npm run build --prefix frontend
```

Install both dependency sets before testing. Tests use temporary databases and public face-model fixtures. Node.js 24 and npm 11 were used to validate this release.

## Features and boundaries

- Password hashing, revocable server sessions and role-based API access.
- Own-account profile editing and server-side encrypted face enrollment.
- Barcode decoding, exact book lookup and explicit borrowing confirmation.
- Transactional inventory updates and idempotent borrowing/returns.
- Book/person/record management and borrowing statistics.
- Responsive Chinese ink-landscape UI with the original panda/cat artwork.

Face verification does not implement liveness detection. Its current distance threshold needs camera-specific evaluation. Runtime databases, keys, dependencies, generated builds and legacy Git history are excluded from this release. Running the full application requires a Node.js backend; static hosting alone is insufficient.
