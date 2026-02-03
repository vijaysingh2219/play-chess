# Play Chess

Full-stack application with Next.js frontend, Express backend, authentication and PostgreSQL database

Built with [build-elevate](https://github.com/vijaysingh2219/build-elevate) - A production-grade full-stack starter.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![downloads](https://img.shields.io/npm/dy/build-elevate)](https://www.npmjs.com/package/build-elevate)
[![npm](https://img.shields.io/npm/v/build-elevate)](https://www.npmjs.com/package/build-elevate)

## Overview

[build-elevate](https://github.com/vijaysingh2219/build-elevate) is a full-stack monorepo starter that gets you from idea to production faster. Built with [Turborepo](https://turborepo.org/), it combines a Next.js frontend, Express backend, and shared packages into one cohesive development experience.

Perfect for SaaS applications, web platforms, or any project that needs authentication, database integration, and a professional UI out of the box.

### Why build-elevate?

- **Ready to Ship** — Pre-configured authentication, database, email, and UI components
- **Developer Experience** — Hot reload, type safety, and monorepo benefits from day one
- **Modular Design** — Shared packages make code reuse effortless across frontend and backend
- **Security First** — Better Auth integration with session management and OAuth providers
- **Production Ready** — Docker setup, CI/CD workflows, and deployment best practices included

## Features

### Applications

- **apps/web** — Next.js 16 app with Turbopack, authentication, and modern UI
- **apps/api** — Express server with RESTful API endpoints and health monitoring
- **apps/email** — React Email templates with hot reload preview
- **apps/studio** — Prisma Studio for database management

### Shared Packages

| Package                   | Description                                         |
| ------------------------- | --------------------------------------------------- |
| **@workspace/auth**       | Better Auth setup with session management and OAuth |
| **@workspace/db**         | Prisma schema and database client for PostgreSQL    |
| **@workspace/ui**         | shadcn/ui components with Tailwind CSS              |
| **@workspace/email**      | React Email templates and Resend integration        |
| **@workspace/utils**      | Shared utilities and TypeScript types               |
| **@workspace/rate-limit** | API rate limiting utilities                         |

### Configuration Packages

- **eslint-config** — Unified linting rules for all workspaces
- **prettier-config** — Consistent code formatting
- **typescript-config** — Shared TypeScript compiler options
- **jest-presets** — Testing configuration for Node and React

### Built With

[Express](https://expressjs.com/) · [Next.js 16](https://nextjs.org/) · [shadcn/ui](https://ui.shadcn.com/) · [Tailwind CSS](https://tailwindcss.com/) · [Turborepo](https://turbo.build/) · [TypeScript](https://www.typescriptlang.org/) · [pnpm](https://pnpm.io/) · [ESLint](https://eslint.org/) · [Prettier](https://prettier.io/) · [Jest](https://jestjs.io/) · [GitHub Actions](https://github.com/features/actions) · [Prisma](https://www.prisma.io/) · [PostgreSQL](https://www.postgresql.org/) · [Better Auth](https://www.better-auth.com/) · [React Email](https://react.email/) · [Resend](https://resend.com/) · [Tanstack Query](https://tanstack.com/query/latest) · [Docker](https://www.docker.com/)

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL database

### Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment variables:
   - Copy `.env.example` files to `.env.local` or `.env` in respective packages
   - Update database connection strings and API keys

3. Generate Prisma client and run migrations:

```bash
cd packages/db
pnpm db:generate
pnpm db:migrate
cd ../..
```

4. Start development server:

```bash
pnpm dev
```

## Structure

```plaintext
play-chess/
├── apps/
│   ├── web/
│   ├── api/
│   ├── email/
│   └── studio/
├── packages/
│   ├── auth/
│   ├── db/
│   ├── email/
│   ├── rate-limit/
│   ├── ui/
│   └── utils/
└── turbo.json
```

## Available Scripts

- `pnpm dev` - Start development servers
- `pnpm build` - Build all packages
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier
- `pnpm test` - Run tests

### Database Commands (run from packages/db)

- `pnpm db:generate` - Generate Prisma client
- `pnpm db:migrate` - Run database migrations

## Docker Deployment

Production-ready Docker setup with docker-compose:

```bash
pnpm docker:prod
```

This spins up:

- **Web app** → `localhost:3000`
- **API server** → `localhost:4000`
- **PostgreSQL** → `localhost:5432`

Features:

- Multi-stage builds for minimal image size
- Non-root user execution for security
- Turbo pruning for optimized workspace dependencies

## Documentation

- [Web App Documentation](apps/web/README.md) - Next.js application
- [API Documentation](apps/api/README.md) - Express server
- [UI Components Guide](packages/ui/README.md) - shadcn/ui components

## License

MIT License. See the [LICENSE](LICENSE) file for details.
