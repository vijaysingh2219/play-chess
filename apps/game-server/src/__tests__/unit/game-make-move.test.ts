import { ActiveGameCache } from '@workspace/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// makeMove touches Redis (lock + cache read/write), Prisma (async persistence),
// and the Bull timeout queue. We mock all three so the cache-authoritative move
// logic can be exercised without a live server. chess.js runs for real.
//
// makeMove uses two pipelines: an init pipeline (SET NX lock + GET cache + GET
// readyState) and a write pipeline (SET cache + DEL lock). The error path releases
// the lock via a direct redis.del instead.
const {
  mockPipelineSet,
  mockPipelineDel,
  mockPipelineExec,
  mockDel,
  mockMoveCreate,
  mockGameUpdate,
} = vi.hoisted(() => ({
  mockPipelineSet: vi.fn(),
  mockPipelineDel: vi.fn(),
  mockPipelineExec: vi.fn(),
  mockDel: vi.fn(),
  mockMoveCreate: vi.fn(),
  mockGameUpdate: vi.fn(),
}));

vi.mock('../../socket/lib/redis', () => {
  // Plain wrappers record calls but always return the pipeline so chaining
  // survives vi.clearAllMocks() (which would wipe a vi.fn().mockReturnThis()).
  const pipeline = {
    set: (...args: unknown[]) => {
      mockPipelineSet(...args);
      return pipeline;
    },
    get: () => pipeline,
    del: (...args: unknown[]) => {
      mockPipelineDel(...args);
      return pipeline;
    },
    exec: mockPipelineExec,
  };
  return {
    redis: {
      set: vi.fn(),
      del: mockDel,
      pipeline: vi.fn(() => pipeline),
      get: vi.fn(),
      eval: vi.fn(),
      zadd: vi.fn().mockResolvedValue(1),
      zrem: vi.fn().mockResolvedValue(1),
      zrangebyscore: vi.fn().mockResolvedValue([]),
    },
    getRedisClient: vi.fn(),
    closeRedis: vi.fn(),
  };
});

vi.mock('@workspace/db', () => ({
  prisma: {
    move: { create: mockMoveCreate },
    game: { update: mockGameUpdate },
  },
}));

vi.mock('../../socket/services/timeouts', () => ({
  gameTimeoutQueue: {
    process: vi.fn(),
    getJob: vi.fn().mockResolvedValue(null),
    add: vi.fn().mockResolvedValue(undefined),
  },
}));

import { gameService } from '../../socket/services/game';

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

function makeCache(overrides: Partial<ActiveGameCache> = {}): ActiveGameCache {
  return {
    gameId: 'game-1',
    whitePlayerId: 'white',
    blackPlayerId: 'black',
    status: 'ONGOING',
    currentFen: INITIAL_FEN,
    whiteTimeLeft: 60_000,
    blackTimeLeft: 60_000,
    currentTurn: 'w',
    lastMoveAt: Date.now(),
    incrementTime: 5,
    moveCount: 0,
    ...overrides,
  };
}

/**
 * Prime the init pipeline result: [lock SET NX, GET cache, GET readyState].
 * The write pipeline shares the same exec mock but its result is ignored.
 */
function primeRead(
  cache: ActiveGameCache | null,
  ready: unknown = null,
  lockAcquired = true,
): void {
  mockPipelineExec.mockResolvedValue([
    [null, lockAcquired ? 'OK' : null],
    [null, cache ? JSON.stringify(cache) : null],
    [null, ready ? JSON.stringify(ready) : null],
  ]);
}

/** The cache write is the write-pipeline SET: 4 args (key, json, 'EX', ttl); the lock SET has 5 (…'NX'). */
function cacheWrite(): ActiveGameCache | undefined {
  const call = mockPipelineSet.mock.calls.find((c) => c.length === 4 && c[2] === 'EX');
  return call ? (JSON.parse(call[1] as string) as ActiveGameCache) : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDel.mockResolvedValue(1);
  mockMoveCreate.mockResolvedValue({});
  mockGameUpdate.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('makeMove — happy path', () => {
  it('applies a valid move and advances turn/fen', async () => {
    primeRead(makeCache());

    const result = await gameService.makeMove('game-1', 'white', 'e2', 'e4');

    expect(result.moveData.san).toBe('e4');
    expect(result.moveData.moveNumber).toBe(1);
    expect(result.moveData.color).toBe('w');
    expect(result.gameState.currentTurn).toBe('b');
    expect(result.gameState.currentFen).toContain(' b ');
    expect(result.gameEndInfo).toBeUndefined();
  });

  it('writes the cache once with an incremented moveCount and the new position', async () => {
    primeRead(makeCache({ moveCount: 4 }));

    await gameService.makeMove('game-1', 'white', 'e2', 'e4');

    const written = cacheWrite();
    expect(written?.moveCount).toBe(5);
    expect(written?.currentTurn).toBe('b');
    expect(written?.currentFen).toContain(' b ');
  });

  it('persists the move and times to the database (off the response path)', async () => {
    primeRead(makeCache());

    await gameService.makeMove('game-1', 'white', 'e2', 'e4');

    expect(mockMoveCreate).toHaveBeenCalledTimes(1);
    expect(mockGameUpdate).toHaveBeenCalledTimes(1);
  });

  it('releases the lock after the move (via the write pipeline)', async () => {
    primeRead(makeCache());

    await gameService.makeMove('game-1', 'white', 'e2', 'e4');

    expect(mockPipelineDel).toHaveBeenCalled();
  });
});

describe('makeMove — clock accounting', () => {
  it('adds the increment bonus after the first move', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    primeRead(
      makeCache({
        currentFen: AFTER_E4_FEN,
        currentTurn: 'b',
        moveCount: 1,
        lastMoveAt: now - 2000, // 2s spent
        blackTimeLeft: 60_000,
        incrementTime: 5,
      }),
    );

    const result = await gameService.makeMove('game-1', 'black', 'e7', 'e5');

    // spent = 2000 − 100 (lag grace) = 1900; then +5000 increment
    expect(result.moveData.timeLeft).toBe(60_000 - 1900 + 5000);
    expect(result.gameState.blackTimeLeft).toBe(63_100);
  });

  it('does not add the increment on the very first move', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    primeRead(
      makeCache({ moveCount: 0, lastMoveAt: now - 2000, whiteTimeLeft: 60_000, incrementTime: 5 }),
    );

    const result = await gameService.makeMove('game-1', 'white', 'e2', 'e4');

    expect(result.moveData.timeLeft).toBe(60_000 - 1900); // no increment
  });
});

describe('makeMove — rejections', () => {
  it("rejects a move when it isn't the player's turn", async () => {
    primeRead(makeCache({ currentTurn: 'w' }));

    await expect(gameService.makeMove('game-1', 'black', 'e7', 'e5')).rejects.toThrow(
      'Not your turn',
    );
  });

  it('rejects an illegal move', async () => {
    primeRead(makeCache());

    await expect(gameService.makeMove('game-1', 'white', 'e2', 'e5')).rejects.toThrow(
      'Invalid move',
    );
  });

  it('throws when the game is not cached', async () => {
    primeRead(null);

    await expect(gameService.makeMove('game-1', 'white', 'e2', 'e4')).rejects.toThrow(
      'Game not found',
    );
  });

  it('throws when the game is not in progress', async () => {
    primeRead(makeCache({ status: 'COMPLETED' }));

    await expect(gameService.makeMove('game-1', 'white', 'e2', 'e4')).rejects.toThrow(
      'not in progress',
    );
  });

  it('throws while waiting for both players to be ready', async () => {
    primeRead(makeCache(), { whiteReady: true, blackReady: false });

    await expect(gameService.makeMove('game-1', 'white', 'e2', 'e4')).rejects.toThrow(
      'Waiting for both players',
    );
  });

  it('throws when the game is locked by another operation', async () => {
    primeRead(makeCache(), null, false); // SET NX returns null → lock not acquired

    await expect(gameService.makeMove('game-1', 'white', 'e2', 'e4')).rejects.toThrow('locked');
  });

  it('still releases the lock when a move is rejected', async () => {
    primeRead(makeCache());

    await expect(gameService.makeMove('game-1', 'white', 'e2', 'e5')).rejects.toThrow(
      'Invalid move',
    );
    expect(mockDel).toHaveBeenCalled();
  });
});
