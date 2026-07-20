# Game Server Architecture

Realtime chess backend: a single Express + Socket.IO process (sharing one HTTP
port) that runs **multi-instance** in production. **Redis** is the coordination
layer (Socket.IO adapter, game cache, distributed locks, Bull queues, matchmaking
queue) and **Postgres (via Prisma)** is the durable source of truth.

The diagrams below are grouped from the outside in: topology first, then the
socket lifecycle, then the four subsystems where the real complexity lives -
matchmaking, the game/move hot path, the clock/timeout system, and crash
recovery.

- [Game Server Architecture](#game-server-architecture)
  - [1. System context \& deployment](#1-system-context--deployment)
  - [2. Socket connection \& auth lifecycle](#2-socket-connection--auth-lifecycle)
  - [3. Matchmaking flow](#3-matchmaking-flow)
  - [4. Game lifecycle state machine](#4-game-lifecycle-state-machine)
  - [5. Make-a-move hot path](#5-make-a-move-hot-path)
  - [6. Clock \& timeout architecture](#6-clock--timeout-architecture)
  - [7. Crash \& startup recovery](#7-crash--startup-recovery)
  - [8. Data \& caching model](#8-data--caching-model)

---

## 1. System context & deployment

Clients hold a Socket.IO connection to one instance behind the load balancer. The
Redis **adapter** pub/sub is what makes a broadcast on instance A reach a socket
connected to instance B - which is why Redis is mandatory in production
([socket-server.ts](apps/game-server/src/socket/socket-server.ts) throws if it is unreachable
when `NODE_ENV=production`).

```mermaid
flowchart TB
    subgraph clients[Clients]
        web[Web app / browser<br/>Socket.IO client]
    end

    lb[Load balancer<br/>sticky sessions]

    subgraph fleet[Game-server fleet]
        i1[Instance 1<br/>Express + Socket.IO]
        i2[Instance 2<br/>Express + Socket.IO]
        iN[Instance N ...]
    end

    subgraph redis[Redis]
        adapter[(Socket.IO adapter<br/>pub/sub)]
        cache[(Game cache · locks<br/>ready state · timeout index)]
        queues[(Bull queues<br/>game-timeout · challenge-expiration)]
        mmq[(Matchmaking queue<br/>+ leader lock)]
    end

    pg[(Postgres / Prisma<br/>User · Game · Move · Challenge)]

    web -->|WebSocket / polling| lb
    lb --> i1 & i2 & iN

    i1 & i2 & iN <-->|cross-instance broadcast| adapter
    i1 & i2 & iN <--> cache
    i1 & i2 & iN <--> queues
    i1 & i2 & iN <--> mmq
    i1 & i2 & iN <-->|durable reads/writes| pg
```

**Durability split:** anything in Redis is ephemeral and reconstructable; the
cache carries a `game:active:*` TTL of 2 hours. Postgres is authoritative and is
what [`recoverActiveGames()`](apps/game-server/src/socket/services/game.ts) reconciles from on
startup (see [Section 7](#7-crash--startup-recovery)).

---

## 2. Socket connection & auth lifecycle

Every connection passes through `authMiddleware` before any handler is wired up.
Handlers are registered by feature module in
[socket-server.ts](apps/game-server/src/socket/socket-server.ts).

```mermaid
sequenceDiagram
    participant C as Client
    participant IO as Socket.IO server
    participant Auth as authMiddleware
    participant H as Feature handlers
    participant R as Redis (rooms/presence)

    C->>IO: connect (handshake + credentials)
    IO->>Auth: io.use(authMiddleware)
    alt invalid / missing auth
        Auth-->>C: connect_error (reject)
    else authenticated
        Auth->>Auth: attach socket.data<br/>(userId, username, rating, image, log)
        Auth-->>IO: next()
        IO->>H: connection event
        Note over H: setup Connection / Matchmaking /<br/>Game / Challenge / Presence handlers
        H->>R: join per-user room (getUserRoomId)
        H-->>C: connected / initial state
    end

    Note over C,R: on disconnect →<br/>remove from matchmaking queue,<br/>update presence
```

The per-user room (`getUserRoomId(userId)`) is how server-side events -
`MATCH_FOUND`, `CHALLENGE_EXPIRED`, etc. - are addressed to a specific player
regardless of which instance they landed on.

---

## 3. Matchmaking flow

One centralized loop ticks every second on each instance, but only the instance
holding the Redis **leader lock** actually runs a matching pass, so the fleet
does not duplicate work or double-emit `QUEUE_STATUS`. The atomic `claimPair`
Lua script is the ultimate safety net if two matchers ever overlap.
Source: [handlers/matchmaking.ts](apps/game-server/src/socket/handlers/matchmaking.ts),
[services/matchmaking.ts](apps/game-server/src/socket/services/matchmaking.ts).

```mermaid
sequenceDiagram
    participant P as Player socket
    participant MMH as Matchmaking handler
    participant MM as MatchmakingService
    participant R as Redis
    participant Tick as Matchmaker tick (1s)
    participant GS as GameService

    P->>MMH: FIND_MATCH [timeControl, ratingRange]
    MMH->>MM: validate eligibility + addToQueue
    MM->>R: HSET queue · ZADD queue:index:tc
    MMH-->>P: QUEUE_STATUS (initial)

    loop every 1s on each instance
        Tick->>MM: acquireMatchmakerLock(instanceId, 5s)
        alt not leader
            MM-->>Tick: false → skip tick
        else leader
            Tick->>MM: getQueueGroupedByTimeControl()
            MM->>R: HGETALL queue
            Tick->>MM: computeMatches(entries)
            Note over MM: greedy pair, oldest-first,<br/>rating range expands with wait time
            loop each candidate pair
                Tick->>MM: claimPair(a, b, tc)
                MM->>R: EVAL atomic claim<br/>(HDEL + ZREM iff both present)
                alt claim won
                    Tick->>GS: createMatchedGame → createGame
                    GS->>R: cache game + ready state (paused)
                    Tick->>P: MATCH_FOUND (per player, own color)
                else lost to concurrent matcher
                    Note over Tick: skip pair
                end
            end
            Tick->>P: QUEUE_STATUS (refresh still-waiting)
            Tick->>MM: releaseMatchmakerLock(instanceId)
        end
    end
```

A separate 30s interval runs `cleanup()` to evict entries older than the 2-minute
max wait.

---

## 4. Game lifecycle state machine

A game is created with clocks **paused** and only starts ticking once both
players signal ready - or the ready-watchdog force-starts it after 30s (which
penalizes the slow loader). Source: [services/game.ts](apps/game-server/src/socket/services/game.ts).

```mermaid
stateDiagram-v2
    [*] --> Created: createGame() (clocks PAUSED, ready state set)

    Created --> WaitingForReady: markPlayerReady() (one side)
    WaitingForReady --> Ongoing: both ready → start clock at last readyAt
    Created --> Ongoing: both ready
    WaitingForReady --> Ongoing: ready watchdog force-start after 30s

    Ongoing --> Ongoing: makeMove()

    Ongoing --> Completed: checkmate / stalemate / draw / resignation / timeout
    Ongoing --> Aborted: abortGame()

    Completed --> [*]: persist result & clear cache
    Aborted --> [*]: clear cache & cancel timeouts
```

On any terminal transition, `endGame()` writes the result + PGN, applies ELO
changes, increments W/D/L counters (for the leaderboard), cancels pending timeout
jobs, and removes the Redis cache.

---

## 5. Make-a-move hot path

The most latency-sensitive and most subtle path. Two Redis pipelines bracket the
work (one to lock+load, one to write+unlock), chess.js validates, clocks are
lag-compensated, and DB writes are fired **off the response path**.
Source: [services/game.ts `makeMove()`](apps/game-server/src/socket/services/game.ts).

```mermaid
sequenceDiagram
    participant C as Client
    participant GH as Game handler
    participant GS as GameService.makeMove
    participant R as Redis
    participant Chess as chess.js
    participant PG as Postgres (async)
    participant TQ as Timeout queue

    C->>GH: MAKE_MOVE { gameId, from, to, promotion? }
    GH->>GS: makeMove(...)
    GS->>R: pipeline: SET lock NX EX10 · GET cache · GET ready
    alt lock not acquired
        GS-->>C: error "Game is locked"
    else locked
        GS->>GS: guards (both ready? ONGOING? your turn?)
        GS->>Chess: new Chess(fen).move({from,to,promotion})
        alt illegal move
            GS-->>C: error "Invalid move" (lock released in finally)
        else legal
            GS->>GS: lag-compensated clock math<br/>(elapsed − grace + increment)
            GS-)PG: saveMoveToDatabase() (fire-and-forget)
            GS-)PG: updateGameTimes() (fire-and-forget)
            GS->>Chess: check end conditions (mate/stalemate/draw)
            alt game ended
                GS->>GS: endGame() → ELO, result, clear cache
                GS-)TQ: cancel timeout job
            else continues
                GS-)TQ: cancel my timeout · schedule opponent timeout
            end
            GS->>R: pipeline: SET cache EX7200 · DEL lock
            GS-->>GH: { moveData, gameState, gameEndInfo? }
            GH->>C: broadcast MOVE_MADE / GAME_OVER to game room
        end
    end
```

Key design points:

- **Lock TTL is 10s** - a crashed handler self-heals; the lock is also deleted in
  a `finally` on every error path.
- **DB writes never block the move response** - the Redis cache is the realtime
  source of truth; Postgres catches up asynchronously.
- **Timeout (re)scheduling is fire-and-forget housekeeping** - `processTimeoutJob`
  re-validates under its own lock, so a lost scheduling call is corrected by the
  sweep ([Section 6](#6-clock--timeout-architecture)).

---

## 6. Clock & timeout architecture

Flag-fall is enforced by **three overlapping mechanisms** that all funnel through
one re-validating `processTimeoutJob` (which runs under the game lock). No single
mechanism is trusted on its own.

```mermaid
flowchart TB
    subgraph schedule[On each move / game start]
        sched[scheduleTimeoutJob<br/>playerId, color, timeLeft]
    end

    sched -->|ZADD score = flag-fall time| idx[(game:timeout-index<br/>sorted set)]
    sched -->|add delayed job| bull[(Bull game-timeout queue<br/>delay = timeLeft − 500ms)]

    bull -->|job fires| proc[[processTimeoutJob]]
    sweep[Fallback sweep<br/>every 5s] -->|ZRANGEBYSCORE −inf..now| idx
    idx -->|expired members| sweep
    sweep -->|ZREM = atomic claim| proc

    proc --> lock{acquire game lock?}
    lock -->|no| resched[reschedule +500ms]
    lock -->|yes| reload[reload game state<br/>source of truth]
    reload --> check{still their turn<br/>& time ≤ 0?}
    check -->|yes| flag[handleTimeout → endGame<br/>winner = opponent]
    check -->|no, extended| resched2[reschedule at actual timeLeft]
    check -->|game gone| noop[drop]
```

Why three layers:

- **Bull delayed job** - the primary, precise trigger.
- **`game:timeout-index` sorted set** - lets any instance find an overdue flag
  even if the Bull job was never added or got dropped. The **`ZREM` acts as an
  atomic claim** so exactly one instance processes each expiry.
- **5s fallback sweep** - `O(expired)`: only entries past their score are
  returned, so healthy games cost nothing per tick.

`processTimeoutJob` always **re-checks actual game state** before flagging, so
races with an in-flight move (which extends the clock via increment) resolve
correctly - it reschedules instead of ending the game.

---

## 7. Crash & startup recovery

Runs on **every** instance at boot, so it must be idempotent and must never end a
game directly (ending is only race-safe behind the sweep's `ZREM` claim + game
lock). Covers total Redis loss. Source:
[`recoverActiveGames()`](apps/game-server/src/socket/services/game.ts).

```mermaid
flowchart TB
    start[Instance startup] --> load[Postgres: find games WHERE status = ONGOING]
    load --> loop{for each ongoing game}

    loop --> ready{waiting for ready?}
    ready -->|yes| skip[skip - watchdog owns this phase]
    ready -->|no| cache{cache in Redis?}

    cache -->|hit| calc["compute time left =<br/>budget − (now − lastMoveAt)"]
    cache -->|miss| rebuild[rebuild cache from DB<br/>+ replay moves] --> calc

    calc --> expired{time left ≤ 0?}
    expired -->|yes| index[ZADD timeout-index at past<br/>flag-fall time → next sweep ends it once]
    expired -->|no| reschedule[scheduleTimeoutJob<br/>with remaining time]

    index --> loop
    reschedule --> loop
    skip --> loop
    loop -->|done| log[log ongoing / recovered counts]
```

The startup path deliberately **hands already-expired games to the sweep** rather
than calling `endGame` inline - that keeps "end this game" flowing through the
single claim-protected path even across a fleet-wide restart.

A parallel startup step, `cleanupExpiredChallenges()`
([challenge.queue.ts](apps/game-server/src/queues/challenge.queue.ts)), expires any PENDING
challenges whose deadline passed while the server was down and notifies both
parties.

---

## 8. Data & caching model

What lives where, and how the two stores relate. Redis holds hot, ephemeral
coordination state; Postgres holds the durable record.

```mermaid
flowchart LR
    subgraph redisKeys[Redis keys]
        k1["game:active:{id}<br/>ActiveGameCache · TTL 2h"]
        k2["game:lock:{id}<br/>move mutex · TTL 10s"]
        k3["game:ready:{id}<br/>ready state · TTL 60s"]
        k4["game:timeout-index<br/>sorted set (flag-fall)"]
        k5["matchmaking:queue (hash)<br/>+ :index:{tc} (zset)"]
        k6["matchmaking:matcher:lock<br/>leader lock"]
    end

    subgraph pgTables[Postgres tables]
        t1[(User<br/>rating · wins/draws/losses)]
        t2[(Game<br/>status · clocks · result · pgn)]
        t3[(Move<br/>san · fen · timeSpent · timeLeft)]
        t4[(Challenge<br/>status · expiresAt)]
    end

    k1 -.write-through / async.-> t2
    k1 -.async append.-> t3
    k1 -.rebuilt from.-> t2
    endgame[endGame] --> t1 & t2
    k5 -.match created.-> t2
```

Relationships:

- `game:active:{id}` is the realtime truth during play; `Game`/`Move` rows are
  written **asynchronously** off the move path and are what the cache is _rebuilt
  from_ on recovery.
- `endGame` is the one place that writes final `Game` result fields and mutates
  `User` rating + W/D/L counters (denormalized for the leaderboard).
- Everything under `matchmaking:*` and the lock keys is pure coordination state
  with no durable counterpart - safe to lose.
