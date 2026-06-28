# Express + Socket.IO API Server

This is the API server managed in a Turborepo monorepo setup. It is built with Express and provides a simple RESTful API and Socket.IO server for real-time communication.

## Setup

> [!IMPORTANT]
> Before running the server, ensure you have:
>
> - **Redis**: A Redis instance must be running and accessible. The server requires a valid Redis URL to be configured in the environment variables.
>
> You can start the Redis service using Docker Compose:
>
> ```bash
> docker compose -f docker-compose.prod.yml up redis
> ```
>
> This will start Redis at `redis://localhost:6379`.

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Then, update the variables in your `.env` file

### 3. Running the Server

To start the server in development mode, run:

```bash
pnpm dev
```

For production, build the server and then start it:

```bash
pnpm build
pnpm start
```

The server will be running at `http://localhost:4000` (or the port you specified in the `.env` file).

### 4. API Endpoints

- `GET /api/health`: Check the health of the API server.

## Middleware

- **Helmet**: For setting various HTTP headers for security.
- **Morgan**: For logging HTTP requests.
- **Body Parsers**: To parse JSON and URL-encoded request bodies.
- **Credentials**: Whitelists origins and sets `Access-Control-Allow-Credentials` for allowed requests.
- **CORS**: Configured to allow requests from specified origins.
- **Error Handling**: Centralized error handling middleware.

## License

This project is licensed under the MIT License. See the [LICENSE](../../LICENSE) file for details.
