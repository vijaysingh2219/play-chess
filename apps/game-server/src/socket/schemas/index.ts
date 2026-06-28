// Game schemas
export { GameIdSchema, JoinGameSchema, MakeMoveSchema } from './game.schema';
export type { GameIdPayload, JoinGamePayload, MakeMovePayload } from './game.schema';

// Matchmaking schemas
export { FindMatchSchema } from './matchmaking.schema';
export type { FindMatchPayload } from './matchmaking.schema';

// Challenge schemas
export { ChallengeCreateSchema, ChallengeResponseSchema } from './challenge.schema';
export type { ChallengeCreatePayload, ChallengeResponsePayload } from './challenge.schema';

// Connection schemas
export { EmptySchema, PingCheckSchema } from './connection.schema';
export type { PingCheckPayload } from './connection.schema';
