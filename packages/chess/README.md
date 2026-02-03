# @workspace/chess

Shared chess logic and utilities for the play-chess platform.

## Overview

This package contains chess-specific types, helper functions, and utilities that are shared between the web app and API server.

## Exports

### Types (`@workspace/chess/types`)

- `GameStatus`, `GameType`, `GameTerminationReason`
- `Winner`, `Color`, `GameResult`
- `Move`, `CapturedPieceSymbol`, `PromotionPiece`
- `GameInitPayload`, `GameMovePayload`, `GameOverPayload`
- `PIECE_VALUES`, `STARTING_FEN`

### Helpers (`@workspace/chess/helpers`)

- `calculateMaterialValue()` - Calculate material value of captured pieces
- `pieceName()` - Get human-readable piece name from symbol
- `formatTerminationReason()` - Format termination reason for display
- `isPromotionMove()` - Check if a move is a pawn promotion
- `getOppositeColor()` - Get the opposite color

### PGN (`@workspace/chess/pgn`)

- `generatePGN()` - Generate PGN string from a game
- `downloadPGN()` - Download a PGN file

## Usage

```typescript
import { Move, Color, STARTING_FEN } from '@workspace/chess';
import { pieceName, formatTerminationReason } from '@workspace/chess/helpers';
import { generatePGN, downloadPGN } from '@workspace/chess/pgn';

// Use types
const color: Color = 'w';

// Use helpers
const name = pieceName('n'); // 'knight'
const reason = formatTerminationReason('CHECKMATE'); // 'checkmate'

// Generate PGN
const pgn = generatePGN(game);
```
