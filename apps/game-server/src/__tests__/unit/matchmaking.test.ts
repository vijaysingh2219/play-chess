import { AuthenticatedSocket, QueueEntry } from '@workspace/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Redis, Prisma, and the game service so the queue logic can run offline.
const {
  mockEval,
  mockSet,
  mockHgetall,
  mockHget,
  mockHset,
  mockHdel,
  mockZadd,
  mockZrem,
  mockZrange,
  mockGameFindFirst,
  mockCreateGame,
} = vi.hoisted(() => ({
  mockEval: vi.fn(),
  mockSet: vi.fn(),
  mockHgetall: vi.fn().mockResolvedValue({}),
  mockHget: vi.fn(),
  mockHset: vi.fn(),
  mockHdel: vi.fn(),
  mockZadd: vi.fn(),
  mockZrem: vi.fn(),
  mockZrange: vi.fn(),
  mockGameFindFirst: vi.fn(),
  mockCreateGame: vi.fn(),
}));

vi.mock('../../socket/lib/redis', () => ({
  redis: {
    eval: mockEval,
    set: mockSet,
    hgetall: mockHgetall,
    hget: mockHget,
    hset: mockHset,
    hdel: mockHdel,
    zadd: mockZadd,
    zrem: mockZrem,
    zrange: mockZrange,
  },
  getRedisClient: vi.fn(),
  closeRedis: vi.fn(),
}));

vi.mock('@workspace/db', () => ({
  prisma: { game: { findFirst: mockGameFindFirst } },
}));

vi.mock('../../socket/services/game', () => ({
  gameService: { createGame: mockCreateGame },
}));

import { matchmakingService } from '../../socket/services/matchmaking';

// Redis keys (private in the service).
const QUEUE_KEY = 'matchmaking:queue';
const QUEUE_INDEX_KEY = 'matchmaking:queue:index';
const LOCK_KEY = 'matchmaking:matcher:lock';

let userCounter = 0;

/** A QueueEntry with defaults; override what the test cares about. */
function makeEntry(overrides: Partial<QueueEntry> = {}): QueueEntry {
  userCounter += 1;
  return {
    userId: `user-${userCounter}`,
    username: `player-${userCounter}`,
    rating: 1500,
    image: null,
    timeControl: '10+0',
    ratingRange: 100, // INITIAL_RATING_RANGE
    joinedAt: new Date(), // just joined → no time-based expansion
    socketId: `socket-${userCounter}`,
    ...overrides,
  };
}

/** A QueueEntry that joined `seconds` ago (for range expansion). */
function joinedSecondsAgo(seconds: number, overrides: Partial<QueueEntry> = {}): QueueEntry {
  return makeEntry({ joinedAt: new Date(Date.now() - seconds * 1000), ...overrides });
}

/** Minimal socket stub for queue-join tests. */
function fakeSocket(data: Partial<AuthenticatedSocket['data']> = {}): AuthenticatedSocket {
  return {
    id: 'socket-abc',
    data: { userId: 'user-1', username: 'player-1', rating: 1500, image: null, ...data },
  } as unknown as AuthenticatedSocket;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('computeMatches', () => {
  it('returns no matches for an empty queue', () => {
    expect(matchmakingService.computeMatches([])).toEqual([]);
  });

  it('returns no matches for a single player', () => {
    expect(matchmakingService.computeMatches([makeEntry()])).toEqual([]);
  });

  it('pairs two players within rating range', () => {
    const a = makeEntry({ rating: 1500 });
    const b = makeEntry({ rating: 1550 }); // diff 50 <= range 100

    const matches = matchmakingService.computeMatches([a, b]);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ player: a, opponent: b });
  });

  it('does not pair players outside the rating range', () => {
    const a = makeEntry({ rating: 1500 });
    const b = makeEntry({ rating: 1900 }); // diff 400 > range 100 for freshly-joined

    expect(matchmakingService.computeMatches([a, b])).toEqual([]);
  });

  it('picks the closest-rated opponent, not the first eligible one', () => {
    const player = makeEntry({ rating: 1500 });
    const far = makeEntry({ rating: 1580 }); // diff 80
    const near = makeEntry({ rating: 1510 }); // diff 10 → should win

    const matches = matchmakingService.computeMatches([player, far, near]);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ player, opponent: near });
  });

  it('never pairs a player twice and leaves the odd one out unmatched', () => {
    const a = makeEntry({ rating: 1500 });
    const b = makeEntry({ rating: 1500 });
    const c = makeEntry({ rating: 1500 });

    const matches = matchmakingService.computeMatches([a, b, c]);

    expect(matches).toHaveLength(1);

    const pairedIds = new Set([matches[0]!.player.userId, matches[0]!.opponent.userId]);
    expect(pairedIds.size).toBe(2); // no self-pair
    const leftover = [a, b, c].filter((e) => !pairedIds.has(e.userId));
    expect(leftover).toHaveLength(1);
  });

  it('matches the oldest player first (fairness)', () => {
    // Entries arrive oldest-first (the service sorts before calling).
    const oldest = makeEntry({ rating: 1500 });
    const middle = makeEntry({ rating: 1510 });
    const newest = makeEntry({ rating: 1505 });

    const matches = matchmakingService.computeMatches([oldest, middle, newest]);

    expect(matches).toHaveLength(1);
    // Oldest is paired with its closest opponent (1505, diff 5).
    expect(matches[0]).toMatchObject({ player: oldest, opponent: newest });
  });

  it('expands the rating range the longer a player waits', () => {
    // diff 300: too far at first, fits after ~15s of waiting (100 + 15*20 = 400).
    const a = joinedSecondsAgo(15, { rating: 1500 });
    const b = joinedSecondsAgo(15, { rating: 1800 });

    const matches = matchmakingService.computeMatches([a, b]);

    expect(matches).toHaveLength(1);
  });

  it('never expands beyond the maximum rating range', () => {
    // diff 500 > max range (400) — never matches, however long they wait.
    const a = joinedSecondsAgo(600, { rating: 1500 });
    const b = joinedSecondsAgo(600, { rating: 2000 });

    expect(matchmakingService.computeMatches([a, b])).toEqual([]);
  });

  it('requires the diff to fit BOTH players ranges, not just one', () => {
    // diff 300 fits the veteran's wide range but not the newcomer's — so no match.
    const veteran = joinedSecondsAgo(100, { rating: 1500 }); // range capped at 400
    const newcomer = makeEntry({ rating: 1800 }); // range 100

    expect(matchmakingService.computeMatches([veteran, newcomer])).toEqual([]);
  });

  it('produces multiple pairs in one pass when enough players are eligible', () => {
    const a = makeEntry({ rating: 1500 });
    const b = makeEntry({ rating: 1510 });
    const c = makeEntry({ rating: 1520 });
    const d = makeEntry({ rating: 1530 });

    const matches = matchmakingService.computeMatches([a, b, c, d]);

    expect(matches).toHaveLength(2);
    const paired = new Set(matches.flatMap((m) => [m.player.userId, m.opponent.userId]));
    expect(paired.size).toBe(4); // everyone paired, no overlaps
  });
});

describe('claimPair', () => {
  it('runs the claim script against the right keys/args and returns true on success', async () => {
    mockEval.mockResolvedValue(1);

    const claimed = await matchmakingService.claimPair('white-1', 'black-1', '10+0');

    expect(claimed).toBe(true);
    expect(mockEval).toHaveBeenCalledTimes(1);
    const [script, numKeys, queueKey, indexKey, playerId, opponentId] = mockEval.mock.calls[0]!;
    expect(script).toContain('HEXISTS');
    expect(numKeys).toBe(2);
    expect(queueKey).toBe(QUEUE_KEY);
    expect(indexKey).toBe(`${QUEUE_INDEX_KEY}:10+0`);
    expect(playerId).toBe('white-1');
    expect(opponentId).toBe('black-1');
  });

  it('returns false when the pair was already claimed by someone else', async () => {
    mockEval.mockResolvedValue(0);

    await expect(matchmakingService.claimPair('white-1', 'black-1', '10+0')).resolves.toBe(false);
  });
});

describe('matchmaker leader lock', () => {
  it('acquires the lock with NX + PX semantics and reports leadership', async () => {
    mockSet.mockResolvedValue('OK');

    const acquired = await matchmakingService.acquireMatchmakerLock('instance-a', 5000);

    expect(acquired).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(LOCK_KEY, 'instance-a', 'PX', 5000, 'NX');
  });

  it('reports non-leadership when the lock is already held', async () => {
    mockSet.mockResolvedValue(null);

    await expect(matchmakingService.acquireMatchmakerLock('instance-b', 5000)).resolves.toBe(false);
  });

  it('releases the lock only via the owner-checked script', async () => {
    mockEval.mockResolvedValue(1);

    await matchmakingService.releaseMatchmakerLock('instance-a');

    expect(mockEval).toHaveBeenCalledTimes(1);
    const [script, numKeys, lockKey, instanceId] = mockEval.mock.calls[0]!;
    expect(script).toContain('GET');
    expect(numKeys).toBe(1);
    expect(lockKey).toBe(LOCK_KEY);
    expect(instanceId).toBe('instance-a');
  });
});

describe('addToQueue', () => {
  it('rejects a player who is already queued', async () => {
    mockHget.mockResolvedValue(JSON.stringify(makeEntry({ userId: 'user-1' })));

    await expect(matchmakingService.addToQueue(fakeSocket(), '10+0')).rejects.toThrow(
      'Already in matchmaking queue',
    );
    expect(mockHset).not.toHaveBeenCalled();
  });

  it('rejects a player who is already in an active game', async () => {
    mockHget.mockResolvedValue(null);
    mockGameFindFirst.mockResolvedValue({ id: 'game-1' });

    await expect(matchmakingService.addToQueue(fakeSocket(), '10+0')).rejects.toThrow(
      'Cannot join queue while in an active game',
    );
    expect(mockHset).not.toHaveBeenCalled();
  });

  it('writes the entry to the hash and the time-control index on success', async () => {
    mockHget.mockResolvedValue(null);
    mockGameFindFirst.mockResolvedValue(null);

    await matchmakingService.addToQueue(fakeSocket({ userId: 'user-1' }), '5+0');

    expect(mockHset).toHaveBeenCalledWith(QUEUE_KEY, 'user-1', expect.any(String));
    const [, , serialized] = mockHset.mock.calls[0]!;
    expect(JSON.parse(serialized as string)).toMatchObject({
      userId: 'user-1',
      timeControl: '5+0',
    });
    expect(mockZadd).toHaveBeenCalledWith(`${QUEUE_INDEX_KEY}:5+0`, expect.any(Number), 'user-1');
  });
});

describe('removeFromQueue', () => {
  it('returns false and touches nothing when the player is not queued', async () => {
    mockHget.mockResolvedValue(null);

    await expect(matchmakingService.removeFromQueue('ghost')).resolves.toBe(false);
    expect(mockHdel).not.toHaveBeenCalled();
    expect(mockZrem).not.toHaveBeenCalled();
  });

  it('removes from both the hash and the time-control index when queued', async () => {
    mockHget.mockResolvedValue(
      JSON.stringify(makeEntry({ userId: 'user-1', timeControl: '10+0' })),
    );

    await expect(matchmakingService.removeFromQueue('user-1')).resolves.toBe(true);
    expect(mockHdel).toHaveBeenCalledWith(QUEUE_KEY, 'user-1');
    expect(mockZrem).toHaveBeenCalledWith(`${QUEUE_INDEX_KEY}:10+0`, 'user-1');
  });
});

describe('getQueueGroupedByTimeControl', () => {
  it('groups entries by time control and sorts each group oldest-first', async () => {
    mockHgetall.mockResolvedValue({
      a: JSON.stringify(makeEntry({ userId: 'a', timeControl: '10+0', joinedAt: new Date(2000) })),
      b: JSON.stringify(makeEntry({ userId: 'b', timeControl: '5+0', joinedAt: new Date(1000) })),
      c: JSON.stringify(makeEntry({ userId: 'c', timeControl: '10+0', joinedAt: new Date(1000) })),
    });

    const groups = await matchmakingService.getQueueGroupedByTimeControl();

    expect([...groups.keys()].sort()).toEqual(['10+0', '5+0']);
    // c (t=1000) is older than a (t=2000).
    expect(groups.get('10+0')!.map((e) => e.userId)).toEqual(['c', 'a']);
    expect(groups.get('5+0')!.map((e) => e.userId)).toEqual(['b']);
  });

  it('returns an empty map for an empty queue', async () => {
    mockHgetall.mockResolvedValue({});
    expect((await matchmakingService.getQueueGroupedByTimeControl()).size).toBe(0);
  });
});

describe('getQueueStatus', () => {
  it('returns null when the player is not in the queue', async () => {
    mockHget.mockResolvedValue(null);
    await expect(matchmakingService.getQueueStatus('ghost')).resolves.toBeNull();
  });

  it('computes 1-based position, wait estimate, and queue size', async () => {
    mockHget.mockResolvedValue(JSON.stringify(makeEntry({ userId: 'me', timeControl: '10+0' })));
    // WITHSCORES → alternating [member, score, ...], oldest first.
    mockZrange.mockResolvedValue(['first', '1000', 'me', '2000']);

    const status = await matchmakingService.getQueueStatus('me');

    expect(status).toEqual({ position: 2, estimatedWaitTime: 30, playersInQueue: 2 });
    expect(mockZrange).toHaveBeenCalledWith(`${QUEUE_INDEX_KEY}:10+0`, 0, -1, 'WITHSCORES');
  });
});

describe('cleanup', () => {
  it('removes entries that have waited past the max wait time', async () => {
    const stale = makeEntry({
      userId: 'stale',
      timeControl: '10+0',
      joinedAt: new Date(Date.now() - 200_000), // > 120s max wait
    });
    const fresh = makeEntry({ userId: 'fresh', joinedAt: new Date() });

    mockHgetall.mockResolvedValue({
      stale: JSON.stringify(stale),
      fresh: JSON.stringify(fresh),
    });
    // removeFromQueue re-reads the entry to find its time control.
    mockHget.mockResolvedValue(JSON.stringify(stale));

    await matchmakingService.cleanup();

    expect(mockHdel).toHaveBeenCalledWith(QUEUE_KEY, 'stale');
    expect(mockHdel).not.toHaveBeenCalledWith(QUEUE_KEY, 'fresh');
  });
});

describe('getQueueStats', () => {
  it('aggregates total players and time-control distribution', async () => {
    mockHgetall.mockResolvedValue({
      a: JSON.stringify(makeEntry({ userId: 'a', timeControl: '10+0' })),
      b: JSON.stringify(makeEntry({ userId: 'b', timeControl: '10+0' })),
      c: JSON.stringify(makeEntry({ userId: 'c', timeControl: '5+0' })),
    });

    const stats = await matchmakingService.getQueueStats();

    expect(stats.totalPlayers).toBe(3);
    expect(stats.timeControlDistribution).toEqual({ '10+0': 2, '5+0': 1 });
    expect(stats.averageWaitTime).toBeGreaterThanOrEqual(0);
  });
});

describe('createMatchedGame', () => {
  it('creates the game and assigns colors from the coin flip', async () => {
    const flip = vi.spyOn(Math, 'random').mockReturnValue(0.3); // < 0.5 → player1 white
    mockCreateGame.mockResolvedValue('game-xyz');

    const p1 = makeEntry({ userId: 'p1', rating: 1600, timeControl: '10+0' });
    const p2 = makeEntry({ userId: 'p2', rating: 1500, timeControl: '10+0' });

    const result = await matchmakingService.createMatchedGame(p1, p2);

    expect(result).toEqual({ gameId: 'game-xyz', whitePlayerId: 'p1', blackPlayerId: 'p2' });
    expect(mockCreateGame).toHaveBeenCalledTimes(1);
    // White's starting elo is player1's rating given the flip.
    expect(mockCreateGame).toHaveBeenCalledWith(
      'p1',
      'p2',
      '10+0',
      expect.any(Number),
      expect.any(Number),
      1600,
      1500,
      'QUICK_MATCH',
      true,
    );

    flip.mockRestore();
  });
});
