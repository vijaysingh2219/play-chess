import { GameState, MoveData } from '@workspace/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The game-lifecycle methods (endGame/resign/timeout/draw/abort/ready) lean on
// loadGame for state and on Prisma + Redis + the Bull queue for side effects.
// We mock the infra and spy on loadGame per-test so each method's own logic
// (winner selection, ELO, W/D/L counters, cache/queue cleanup) is exercised in
// isolation. calculateEloChanges and chess.js run for real.
const {
  mockSet,
  mockDel,
  mockGet,
  mockZadd,
  mockZrem,
  mockZrangebyscore,
  mockGameUpdate,
  mockUserUpdate,
  mockFindUnique,
  mockFindMany,
  mockMoveFindMany,
  mockQueueAdd,
  mockQueueGetJob,
} = vi.hoisted(() => ({
  mockSet: vi.fn(),
  mockDel: vi.fn(),
  mockGet: vi.fn(),
  mockZadd: vi.fn(),
  mockZrem: vi.fn(),
  mockZrangebyscore: vi.fn(),
  mockGameUpdate: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
  mockMoveFindMany: vi.fn(),
  mockQueueAdd: vi.fn(),
  mockQueueGetJob: vi.fn(),
}));

vi.mock('../../socket/lib/redis', () => ({
  redis: {
    get: mockGet,
    set: mockSet,
    del: mockDel,
    zadd: mockZadd,
    zrem: mockZrem,
    zrangebyscore: mockZrangebyscore,
    scan: vi.fn().mockResolvedValue(['0', []]),
    pipeline: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
    eval: vi.fn(),
  },
  getRedisClient: vi.fn(),
  closeRedis: vi.fn(),
}));

vi.mock('@workspace/db', () => ({
  prisma: {
    move: { create: vi.fn().mockResolvedValue({}), findMany: mockMoveFindMany },
    game: { update: mockGameUpdate, findUnique: mockFindUnique, findMany: mockFindMany },
    user: { update: mockUserUpdate },
  },
}));

vi.mock('../../socket/services/timeouts', () => ({
  gameTimeoutQueue: {
    process: vi.fn(),
    getJob: mockQueueGetJob,
    add: mockQueueAdd,
  },
}));

import { gameService } from '../../socket/services/game';

const player = (id: string, rating: number): GameState['whitePlayer'] => ({
  id,
  name: id,
  username: id,
  image: null,
  rating,
});

function move(san: string): MoveData {
  return {
    moveNumber: 1,
    color: 'w',
    from: '',
    to: '',
    piece: 'p',
    captured: null,
    promotion: null,
    san,
    lan: '',
    fenBefore: '',
    fenAfter: '',
    createdAt: new Date(),
    timeSpent: 0,
    timeLeft: 0,
  };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'game-1',
    whitePlayerId: 'white',
    blackPlayerId: 'black',
    whitePlayer: player('white', 1500),
    blackPlayer: player('black', 1500),
    status: 'ONGOING',
    currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [move('e4'), move('e5')],
    whiteTimeLeft: 60_000,
    blackTimeLeft: 60_000,
    currentTurn: 'w',
    timeControl: '1+0',
    initialTime: 60,
    incrementTime: 0,
    startedAt: Date.now() - 30_000,
    lastMoveAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(null);
  mockSet.mockResolvedValue('OK');
  mockDel.mockResolvedValue(1);
  mockZadd.mockResolvedValue(1);
  mockZrem.mockResolvedValue(1);
  mockZrangebyscore.mockResolvedValue([]);
  mockGameUpdate.mockResolvedValue({});
  mockUserUpdate.mockResolvedValue({});
  mockFindUnique.mockResolvedValue(null);
  mockFindMany.mockResolvedValue([]);
  mockMoveFindMany.mockResolvedValue([]);
  mockQueueAdd.mockResolvedValue(undefined);
  mockQueueGetJob.mockResolvedValue(null);
});

/** A Prisma game row shaped for buildGameStateFromCache/FromDB. */
function dbGameRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-1',
    whitePlayerId: 'white',
    blackPlayerId: 'black',
    whitePlayer: player('white', 1500),
    blackPlayer: player('black', 1500),
    status: 'ONGOING',
    moves: [],
    whiteTimeLeft: 60_000,
    blackTimeLeft: 60_000,
    timeControl: '1+0',
    initialTime: 60,
    incrementTime: 0,
    startedAt: new Date(),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('endGame', () => {
  it('marks the game completed, applies ELO, and clears the cache', async () => {
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(makeGameState());

    const { ratings } = await gameService.endGame('game-1', 'WHITE', 'CHECKMATE');

    // Equal ratings, K=32 (1500 is in the 1500–2000 tier): winner +16, loser −16.
    expect(ratings.whiteChange).toBe(16);
    expect(ratings.blackChange).toBe(-16);
    expect(ratings.whiteNewRating).toBe(1516);
    expect(ratings.blackNewRating).toBe(1484);

    // Game row updated to COMPLETED with winner/reason and a generated PGN.
    const gameUpdate = mockGameUpdate.mock.calls[0]![0];
    expect(gameUpdate.where).toEqual({ id: 'game-1' });
    expect(gameUpdate.data.status).toBe('COMPLETED');
    expect(gameUpdate.data.winner).toBe('WHITE');
    expect(gameUpdate.data.reason).toBe('CHECKMATE');
    expect(gameUpdate.data.pgn).toContain('1. e4 e5');

    // Cache removed once the game is over.
    expect(mockDel).toHaveBeenCalled();
  });

  it('increments the winner/loser W/L counters (not draws)', async () => {
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(makeGameState());

    await gameService.endGame('game-1', 'WHITE', 'CHECKMATE');

    const byId = Object.fromEntries(
      mockUserUpdate.mock.calls.map((c) => [c[0].where.id, c[0].data]),
    );
    expect(byId.white.wins).toEqual({ increment: 1 });
    expect(byId.white.draws).toBeUndefined();
    expect(byId.black.losses).toEqual({ increment: 1 });
  });

  it('increments draw counters for both players on a draw', async () => {
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(makeGameState());

    await gameService.endGame('game-1', 'DRAW', 'STALEMATE');

    const byId = Object.fromEntries(
      mockUserUpdate.mock.calls.map((c) => [c[0].where.id, c[0].data]),
    );
    expect(byId.white.draws).toEqual({ increment: 1 });
    expect(byId.black.draws).toEqual({ increment: 1 });
  });

  it('is a no-op (zero changes) when the game already ended', async () => {
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(makeGameState({ status: 'COMPLETED' }));

    const { ratings } = await gameService.endGame('game-1', 'WHITE', 'CHECKMATE');

    expect(ratings).toEqual({
      whiteChange: 0,
      blackChange: 0,
      whiteNewRating: 1500,
      blackNewRating: 1500,
    });
    expect(mockGameUpdate).not.toHaveBeenCalled();
  });

  it('throws when the game cannot be found', async () => {
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(null);

    await expect(gameService.endGame('game-1', 'WHITE', 'CHECKMATE')).rejects.toThrow(
      'Game not found',
    );
  });
});

describe('resignGame', () => {
  it('awards the win to the opponent of the resigning player', async () => {
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(makeGameState());
    const endGame = vi.spyOn(gameService, 'endGame').mockResolvedValue({
      ratings: { whiteChange: 0, blackChange: 0, whiteNewRating: 1500, blackNewRating: 1500 },
    });

    await gameService.resignGame('game-1', 'white');

    expect(endGame).toHaveBeenCalledWith('game-1', 'BLACK', 'RESIGNATION');
  });

  it('lets black resign to white', async () => {
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(makeGameState());
    const endGame = vi.spyOn(gameService, 'endGame').mockResolvedValue({
      ratings: { whiteChange: 0, blackChange: 0, whiteNewRating: 1500, blackNewRating: 1500 },
    });

    await gameService.resignGame('game-1', 'black');

    expect(endGame).toHaveBeenCalledWith('game-1', 'WHITE', 'RESIGNATION');
  });
});

describe('handleTimeout', () => {
  it('awards the win to the opponent of the timed-out player', async () => {
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(makeGameState());
    const endGame = vi.spyOn(gameService, 'endGame').mockResolvedValue({
      ratings: { whiteChange: 0, blackChange: 0, whiteNewRating: 1500, blackNewRating: 1500 },
    });

    await gameService.handleTimeout('game-1', 'white');

    expect(endGame).toHaveBeenCalledWith('game-1', 'BLACK', 'TIMEOUT');
  });

  it('does nothing when the game is no longer ongoing', async () => {
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(makeGameState({ status: 'COMPLETED' }));
    const endGame = vi.spyOn(gameService, 'endGame');

    const result = await gameService.handleTimeout('game-1', 'white');

    expect(result).toBeUndefined();
    expect(endGame).not.toHaveBeenCalled();
  });
});

describe('acceptDraw', () => {
  it('ends the game as a draw by agreement', async () => {
    const endGame = vi.spyOn(gameService, 'endGame').mockResolvedValue({
      ratings: { whiteChange: 0, blackChange: 0, whiteNewRating: 1500, blackNewRating: 1500 },
    });

    await gameService.acceptDraw('game-1');

    expect(endGame).toHaveBeenCalledWith('game-1', 'DRAW', 'AGREEMENT');
  });
});

describe('abortGame', () => {
  it('marks an ongoing game ABORTED and clears the cache', async () => {
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(makeGameState());

    await gameService.abortGame('game-1');

    expect(mockGameUpdate.mock.calls[0]![0].data.status).toBe('ABORTED');
    expect(mockDel).toHaveBeenCalled();
  });

  it('does nothing when the game is not ongoing', async () => {
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(makeGameState({ status: 'COMPLETED' }));

    await gameService.abortGame('game-1');

    expect(mockGameUpdate).not.toHaveBeenCalled();
  });

  it('throws when the game cannot be found', async () => {
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(null);

    await expect(gameService.abortGame('game-1')).rejects.toThrow('Game not found');
  });
});

describe('markPlayerReady', () => {
  it('does not start the game until both players are ready', async () => {
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(makeGameState());
    // getReadyState: neither ready yet.
    mockGet.mockResolvedValue(JSON.stringify({ whiteReady: false, blackReady: false }));

    const result = await gameService.markPlayerReady('game-1', 'white');

    expect(result.bothReady).toBe(false);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('starts clocks and schedules the first timeout once both are ready', async () => {
    const gameState = makeGameState();
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(gameState);
    // getReadyState returns white already ready; getGameCache (updateGameCache) returns a cache blob.
    mockGet.mockImplementation(async (key: string) => {
      if (key.startsWith('game:ready:')) {
        return JSON.stringify({ whiteReady: true, whiteReadyAt: Date.now() });
      }
      return JSON.stringify({
        gameId: 'game-1',
        whitePlayerId: 'white',
        blackPlayerId: 'black',
        status: 'ONGOING',
        currentFen: gameState.currentFen,
        whiteTimeLeft: 60_000,
        blackTimeLeft: 60_000,
        currentTurn: 'w',
        lastMoveAt: Date.now(),
        incrementTime: 0,
        moveCount: 0,
      });
    });

    const result = await gameService.markPlayerReady('game-1', 'black');

    expect(result.bothReady).toBe(true);
    // White (first to move) gets the timeout job.
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd.mock.calls[0]![1].jobId).toBe('timeout:game-1:white');
    // Ready-state key deleted once the game starts.
    expect(mockDel).toHaveBeenCalled();
  });
});

describe('loadGame (cache hit)', () => {
  const ACTIVE_KEY = 'game:active:game-1';

  it('deducts elapsed time from the side to move', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    mockGet.mockImplementation(async (key: string) =>
      key === ACTIVE_KEY
        ? JSON.stringify({
            gameId: 'game-1',
            whitePlayerId: 'white',
            blackPlayerId: 'black',
            status: 'ONGOING',
            currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            whiteTimeLeft: 60_000,
            blackTimeLeft: 60_000,
            currentTurn: 'w',
            lastMoveAt: now - 5_000, // white has been on the clock 5s
            incrementTime: 0,
            moveCount: 2,
          })
        : null,
    );
    mockFindUnique.mockResolvedValue(dbGameRow());

    const state = await gameService.loadGame('game-1');

    // White (to move) loses the 5s; black is untouched.
    expect(state?.whiteTimeLeft).toBe(55_000);
    expect(state?.blackTimeLeft).toBe(60_000);
  });

  it('skips the elapsed-time deduction when asked not to calculate', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    mockGet.mockImplementation(async (key: string) =>
      key === ACTIVE_KEY
        ? JSON.stringify({
            gameId: 'game-1',
            whitePlayerId: 'white',
            blackPlayerId: 'black',
            status: 'ONGOING',
            currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            whiteTimeLeft: 60_000,
            blackTimeLeft: 60_000,
            currentTurn: 'w',
            lastMoveAt: now - 5_000,
            incrementTime: 0,
            moveCount: 2,
          })
        : null,
    );
    mockFindUnique.mockResolvedValue(dbGameRow());

    const state = await gameService.loadGame('game-1', false);

    expect(state?.whiteTimeLeft).toBe(60_000);
  });

  it('falls back to the database when nothing is cached', async () => {
    mockGet.mockResolvedValue(null); // no cache, no ready state
    mockFindUnique.mockResolvedValue(dbGameRow({ status: 'COMPLETED' }));

    const state = await gameService.loadGame('game-1');

    expect(state?.id).toBe('game-1');
    expect(state?.status).toBe('COMPLETED');
  });

  it('returns null when the game exists nowhere', async () => {
    mockGet.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue(null);

    expect(await gameService.loadGame('game-1')).toBeNull();
  });
});

describe('processTimeoutJob', () => {
  // Private method; reach it directly to exercise the timeout-confirmation logic.
  const run = (job: {
    gameId: string;
    playerId: string;
    color: 'w' | 'b';
    expectedTimeoutAt: number;
  }) =>
    (
      gameService as unknown as { processTimeoutJob: (j: typeof job) => Promise<void> }
    ).processTimeoutJob(job);

  const job = { gameId: 'game-1', playerId: 'white', color: 'w' as const, expectedTimeoutAt: 0 };

  it('confirms the timeout and ends the game when the clock is truly out', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    mockSet.mockResolvedValue('OK'); // acquireLock succeeds
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(
      makeGameState({ currentTurn: 'w', whiteTimeLeft: 1_000, lastMoveAt: now - 5_000 }),
    );
    const handleTimeout = vi.spyOn(gameService, 'handleTimeout').mockResolvedValue(undefined);

    await run(job);

    expect(handleTimeout).toHaveBeenCalledWith('game-1', 'white');
    expect(mockDel).toHaveBeenCalled(); // lock released
  });

  it('reschedules instead of ending when time was extended', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    mockSet.mockResolvedValue('OK');
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(
      makeGameState({ currentTurn: 'w', whiteTimeLeft: 30_000, lastMoveAt: now - 1_000 }),
    );
    const handleTimeout = vi.spyOn(gameService, 'handleTimeout').mockResolvedValue(undefined);

    await run(job);

    expect(handleTimeout).not.toHaveBeenCalled();
    expect(mockQueueAdd).toHaveBeenCalled(); // rescheduled
  });

  it('does nothing when the player has already moved', async () => {
    mockSet.mockResolvedValue('OK');
    vi.spyOn(gameService, 'loadGame').mockResolvedValue(makeGameState({ currentTurn: 'b' }));
    const handleTimeout = vi.spyOn(gameService, 'handleTimeout').mockResolvedValue(undefined);

    await run(job);

    expect(handleTimeout).not.toHaveBeenCalled();
  });

  it('retries later when the game is locked by a concurrent move', async () => {
    mockSet.mockResolvedValue(null); // acquireLock fails
    const loadGame = vi.spyOn(gameService, 'loadGame');

    await run(job);

    expect(loadGame).not.toHaveBeenCalled();
    expect(mockQueueAdd).toHaveBeenCalled(); // rescheduled with short delay
  });
});

describe('timeout index bookkeeping', () => {
  const svc = gameService as unknown as {
    scheduleTimeoutJob: (
      gameId: string,
      playerId: string,
      color: 'w' | 'b',
      timeLeft: number,
    ) => Promise<void>;
    cancelTimeoutJob: (gameId: string, playerId: string) => Promise<void>;
  };

  it('scheduleTimeoutJob indexes the flag-fall time before adding the Bull job', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await svc.scheduleTimeoutJob('game-1', 'white', 'w', 30_000);

    expect(mockZadd).toHaveBeenCalledWith('game:timeout-index', now + 30_000, 'game-1:white:w');
    expect(mockZadd.mock.invocationCallOrder[0]).toBeLessThan(
      mockQueueAdd.mock.invocationCallOrder[0]!,
    );
  });

  it('cancelTimeoutJob removes both color variants from the index', async () => {
    await svc.cancelTimeoutJob('game-1', 'white');

    expect(mockZrem).toHaveBeenCalledWith('game:timeout-index', 'game-1:white:w', 'game-1:white:b');
  });
});

describe('sweepExpiredTimeouts', () => {
  const sweep = () =>
    (
      gameService as unknown as { sweepExpiredTimeouts: () => Promise<void> }
    ).sweepExpiredTimeouts();

  // processTimeoutJob is private; spy through a structural cast.
  const spyProcessTimeoutJob = () =>
    vi
      .spyOn(
        gameService as unknown as { processTimeoutJob: (job: unknown) => Promise<void> },
        'processTimeoutJob',
      )
      .mockResolvedValue(undefined);

  it('claims each expired entry and processes it as a timeout job', async () => {
    mockZrangebyscore.mockResolvedValue(['game-1:white:w', '1700000000000']);
    const processTimeoutJob = spyProcessTimeoutJob();

    await sweep();

    expect(mockZrangebyscore).toHaveBeenCalledWith(
      'game:timeout-index',
      '-inf',
      expect.any(Number),
      'WITHSCORES',
    );
    expect(mockZrem).toHaveBeenCalledWith('game:timeout-index', 'game-1:white:w');
    expect(processTimeoutJob).toHaveBeenCalledWith({
      gameId: 'game-1',
      playerId: 'white',
      color: 'w',
      expectedTimeoutAt: 1_700_000_000_000,
    });
  });

  it('skips entries already claimed by another instance', async () => {
    mockZrangebyscore.mockResolvedValue(['game-1:white:w', '1700000000000']);
    mockZrem.mockResolvedValue(0); // someone else swept it first
    const processTimeoutJob = spyProcessTimeoutJob();

    await sweep();

    expect(processTimeoutJob).not.toHaveBeenCalled();
  });

  it('does nothing when no timeouts have expired', async () => {
    mockZrangebyscore.mockResolvedValue([]);
    const processTimeoutJob = spyProcessTimeoutJob();

    await sweep();

    expect(mockZrem).not.toHaveBeenCalled();
    expect(processTimeoutJob).not.toHaveBeenCalled();
  });

  it('drops malformed index entries without processing them', async () => {
    mockZrangebyscore.mockResolvedValue(['garbage', '1700000000000']);
    const processTimeoutJob = spyProcessTimeoutJob();

    await sweep();

    expect(mockZrem).toHaveBeenCalledWith('game:timeout-index', 'garbage'); // still claimed/removed
    expect(processTimeoutJob).not.toHaveBeenCalled();
  });
});

describe('recoverActiveGames', () => {
  const now = 1_700_000_000_000;

  // Back get/set with a store so the rebuild-then-read cycle in recovery works.
  let store: Record<string, string>;

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    store = {};
    mockGet.mockImplementation(async (key: string) => store[key] ?? null);
    mockSet.mockImplementation(async (key: string, value: string) => {
      store[key] = value;
      return 'OK';
    });
  });

  it('rebuilds a lost cache from the DB and reschedules the timeout', async () => {
    mockFindMany.mockResolvedValue([
      dbGameRow({ startedAt: new Date(now - 10_000) }), // white on move, 10s elapsed of 60s
    ]);

    await gameService.recoverActiveGames();

    expect(store['game:active:game-1']).toBeDefined(); // cache rebuilt
    expect(mockZadd).toHaveBeenCalledWith('game:timeout-index', now + 50_000, 'game-1:white:w');
    expect(mockQueueAdd).toHaveBeenCalled(); // Bull job rescheduled
  });

  it('skips games still waiting for both players to ready up', async () => {
    mockFindMany.mockResolvedValue([dbGameRow()]);
    store['game:ready:game-1'] = JSON.stringify({ whiteReady: true, blackReady: false });

    await gameService.recoverActiveGames();

    expect(mockZadd).not.toHaveBeenCalled();
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('hands an already-expired game to the sweep instead of ending it directly', async () => {
    mockFindMany.mockResolvedValue([
      dbGameRow({ startedAt: new Date(now - 120_000) }), // 120s elapsed of a 60s budget
    ]);
    const handleTimeout = vi.spyOn(gameService, 'handleTimeout').mockResolvedValue(undefined);

    await gameService.recoverActiveGames();

    // Recovery runs on every instance; ending games is the sweep's job
    // (claim + lock). It only indexes the past flag-fall time.
    expect(handleTimeout).not.toHaveBeenCalled();
    expect(mockQueueAdd).not.toHaveBeenCalled();
    expect(mockZadd).toHaveBeenCalledWith('game:timeout-index', now - 60_000, 'game-1:white:w');
  });

  it('trusts a surviving cache over the stale DB row', async () => {
    mockFindMany.mockResolvedValue([dbGameRow()]); // DB thinks white on move
    store['game:active:game-1'] = JSON.stringify({
      gameId: 'game-1',
      whitePlayerId: 'white',
      blackPlayerId: 'black',
      status: 'ONGOING',
      currentFen: 'irrelevant',
      whiteTimeLeft: 60_000,
      blackTimeLeft: 40_000,
      currentTurn: 'b', // cache knows black is on move
      lastMoveAt: now - 10_000,
      incrementTime: 0,
      moveCount: 3,
    });

    await gameService.recoverActiveGames();

    expect(mockZadd).toHaveBeenCalledWith('game:timeout-index', now + 30_000, 'game-1:black:b');
    expect(mockMoveFindMany).not.toHaveBeenCalled(); // no move hydration when cache survived
  });

  it('does nothing when no games are ongoing', async () => {
    mockFindMany.mockResolvedValue([]);

    await gameService.recoverActiveGames();

    expect(mockZadd).not.toHaveBeenCalled();
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });
});
