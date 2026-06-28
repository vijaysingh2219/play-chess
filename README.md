# Play Chess

**Play Chess** is a simple and modern way to play chess online with friends. It’s fast, real-time, and works right in your browser—no installs, no hassle.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[**▶ Watch Demo**](https://www.youtube.com/watch?v=rusrUAPiNm4)

Built with [build-elevate](https://github.com/vijaysingh2219/build-elevate) - A production-grade full-stack starter.

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
- **apps/game-server** — Express server with Socket.IO for real-time gameplay
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

## Built With

[Express](https://expressjs.com/) · [Next.js 16](https://nextjs.org/) · [Socket.IO](https://socket.io/) · [shadcn/ui](https://ui.shadcn.com/) · [Tailwind CSS](https://tailwindcss.com/) · [Turborepo](https://turbo.build/) · [TypeScript](https://www.typescriptlang.org/) · [pnpm](https://pnpm.io/) · [ESLint](https://eslint.org/) · [Prettier](https://prettier.io/) · [Vitest](https://vitest.dev/) · [GitHub Actions](https://github.com/features/actions) · [Prisma](https://www.prisma.io/) · [PostgreSQL](https://www.postgresql.org/) · [Better Auth](https://www.better-auth.com/) · [Stripe](https://stripe.com/) · [React Email](https://react.email/) · [Resend](https://resend.com/) · [Tanstack Query](https://tanstack.com/query/latest) · [Docker](https://www.docker.com/)

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL database

### Setup

#### 1. Install dependencies

```bash
pnpm install
```

#### 2. Configure environment variables

- Copy `.env.example` files to `.env.local` or `.env` in respective packages
- Update database connection strings and API keys

#### 3. Generate Prisma client and run migrations

```bash
cd packages/db
pnpm db:generate
pnpm db:migrate
cd ../..
```

#### 4. Start development server

```bash
pnpm dev
```

## Available Scripts

- `pnpm dev` - Start development servers
- `pnpm build` - Build all packages
- `pnpm check-types` - Check TypeScript types
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm format` - Format code with Prettier
- `pnpm format:path` - Format specific files with Prettier (e.g. `pnpm format:path src/index.ts`)
- `pnpm format:check` - Check code formatting with Prettier
- `pnpm test` - Run tests
- `pnpm prepare` - Prepare Husky git hooks
- `pnpm docker:dev` - Run with Docker (development)
- `pnpm docker:prod` - Run with Docker (production)
- `pnpm k8s:deploy` - Build, push, and deploy to Kubernetes
- `pnpm k8s:verify` - Verify the Kubernetes deployment

### Database Commands (run from packages/db)

- `pnpm db:generate` - Generate Prisma client
- `pnpm db:migrate` - Run database migrations

## Structure

```plaintext
play-chess/
├── apps/
│   ├── web/
│   ├── game-server/
│   ├── email/
│   └── studio/
├── packages/
│   ├── auth/
│   ├── chess/
│   ├── db/
│   ├── email/
│   ├── payments/
│   ├── vitest-presets/
│   ├── prettier-config/
│   ├── rate-limit/
│   ├── typescript-config/
│   ├── ui/
│   ├── utils/
└── turbo.json
```

## Docker Deployment

Production-ready Docker setup with docker-compose:

Development:

```bash
pnpm docker:dev
```

Production:

```bash
pnpm docker:prod
```

- **Web app** → `localhost:3000`
- **API server** → `localhost:4000`
- **PostgreSQL** → `localhost:5432`

Features:

- Multi-stage builds for minimal image size
- Non-root user execution for security
- Turbo pruning for optimized workspace dependencies

## Kubernetes Deployment

Deploy to any Kubernetes cluster using the manifests in `k8s/` and the deploy script:

```bash
# Set your Docker Hub username in deploy.sh and k8s/*-deployment.yml, then:
pnpm k8s:deploy
```

After deploying, verify the rollout:

```bash
pnpm k8s:verify
```

See [Kubernetes docs](https://build-elevate.vercel.app/docs/deployment/kubernetes) for the full guide.

## Documentation

- [Web App Documentation](apps/web/README.md) - Next.js application
- [UI Components Guide](packages/ui/README.md) - shadcn/ui components
- [Game Server Documentation](apps/game-server/README.md) - Express server

## License

This project is licensed under the [MIT License](LICENSE).
