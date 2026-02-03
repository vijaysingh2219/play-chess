# Play Chess

**Play Chess** is a simple and modern way to play chess online with friends. It’s fast, real-time, and works right in your browser—no installs, no hassle.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Real-Time Multiplayer** — Play against friends or other players online with smooth, real-time gameplay powered by Socket.IO
- **Elo Ranking System** — Compete and climb the ranks with a dynamic Elo-based rating system
- **Player Stats** — Track your wins, losses, and performance metrics to improve your game
- **Interactive Chessboard** — Responsive and intuitive board with drag-and-drop piece movement
- **Game History** — Review and analyze your moves after each game
- **Move Replay** — Watch a replay of your game moves to learn and improve
- **Friend System** — Send, accept, and manage friend requests. Track pending requests and view your friends list
- **Challenge Friends** — Instantly invite your friends to a real-time match directly from your friends list
- **Sound Effects** — Auditory feedback for moves, captures, checks, and checkmates
- **Cross-Browser Compatibility** — Play effortlessly on any modern web browser

### Membership (Pro)

Support the project and unlock advanced features with a Pro membership:

- **Challenge Feature** — Directly challenge other players and friends to matches
- **Pro Badge** — Show off your status with a unique Pro badge next to your profile
- **Early Access** — Be the first to try out upcoming features and updates

> Upgrade to Pro anytime from the Membership page.

## Overview

This is a full-stack monorepo built with [Turborepo](https://turborepo.org/), combining a Next.js frontend, Express backend, and shared packages into one cohesive development experience.

### Applications

- **apps/web** — Next.js 15 app with Turbopack, authentication, and modern UI
- **apps/api** — Express server with Socket.IO for real-time gameplay
- **apps/email** — React Email templates with hot reload preview
- **apps/studio** — Prisma Studio for database management

### Shared Packages

| Package                   | Description                                         |
| ------------------------- | --------------------------------------------------- |
| **@workspace/auth**       | Better Auth setup with session management and OAuth |
| **@workspace/chess**      | Chess game logic and utilities                      |
| **@workspace/db**         | Prisma schema and database client for PostgreSQL    |
| **@workspace/ui**         | shadcn/ui components with Tailwind CSS              |
| **@workspace/email**      | React Email templates and Resend integration        |
| **@workspace/payments**   | Stripe integration for Pro memberships              |
| **@workspace/utils**      | Shared utilities and TypeScript types               |
| **@workspace/rate-limit** | API rate limiting utilities                         |

### Configuration Packages

- **eslint-config** — Unified linting rules for all workspaces
- **prettier-config** — Consistent code formatting
- **typescript-config** — Shared TypeScript compiler options
- **jest-presets** — Testing configuration for Node and React

### Built With

[Next.js](https://nextjs.org/) · [Express](https://expressjs.com/) · [Socket.IO](https://socket.io/) · [shadcn/ui](https://ui.shadcn.com/) · [Tailwind CSS](https://tailwindcss.com/) · [Turborepo](https://turbo.build/) · [TypeScript](https://www.typescriptlang.org/) · [pnpm](https://pnpm.io/) · [Prisma](https://www.prisma.io/) · [PostgreSQL](https://www.postgresql.org/) · [Better Auth](https://www.better-auth.com/) · [Stripe](https://stripe.com/) · [React Email](https://react.email/) · [Resend](https://resend.com/) · [Docker](https://www.docker.com/)

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL database

### Installation (Local)

1. Clone the repository:

   ```bash
   git clone https://github.com/vijaysingh2219/chess.git
   cd chess
   ```

2. Copy all example environment files and fill in the required values:

   ```bash
   # Linux/macOS
   find . -name ".env.example" -exec sh -c 'cp "$0" "${0%.example}"' {} \;
   ```

   Then open the copied `.env` files in each folder and fill in the required values.

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Generate Prisma client and run migrations:

   ```bash
   cd packages/db
   pnpm db:generate
   pnpm db:migrate
   cd ../..
   ```

5. Start the development server:

   ```bash
   pnpm dev
   ```

6. Open your browser and visit `http://localhost:3000`

### Installation (Docker)

If you prefer Docker, you can run Play Chess without installing Node.js or pnpm.

1. Copy all example environment files and fill in the required values (see step 2 above)

2. Build and run containers:

   ```bash
   docker compose up -d --build
   ```

3. Verify containers are running:

   ```bash
   docker ps
   ```

4. Open your browser:
   - **Web** → `http://localhost:3000`
   - **API** → `http://localhost:4000`

5. To stop the containers:

   ```bash
   docker compose down
   ```

## Structure

```plaintext
play-chess/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── api/          # Express + Socket.IO server
│   ├── email/        # Email template preview
│   └── studio/       # Prisma Studio
├── packages/
│   ├── auth/         # Authentication logic
│   ├── chess/        # Chess game logic
│   ├── db/           # Prisma schema & client
│   ├── email/        # Email templates
│   ├── payments/     # Stripe integration
│   ├── rate-limit/   # API rate limiting
│   ├── ui/           # Shared UI components
│   └── utils/        # Shared utilities
└── turbo.json
```

## Available Scripts

- `pnpm dev` — Start development servers
- `pnpm build` — Build all packages
- `pnpm lint` — Run ESLint
- `pnpm format` — Format code with Prettier
- `pnpm test` — Run tests
- `pnpm docker:prod` — Start production Docker containers

### Database Commands (run from packages/db)

- `pnpm db:generate` — Generate Prisma client
- `pnpm db:migrate` — Run database migrations
- `pnpm db:studio` — Open Prisma Studio

## Documentation

- [Web App Documentation](apps/web/README.md) — Next.js application
- [API Documentation](apps/api/README.md) — Express server
- [UI Components Guide](packages/ui/README.md) — shadcn/ui components

## License

This project is licensed under the [MIT License](LICENSE).
