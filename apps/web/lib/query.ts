export const queryKeys = {
  // User-related
  user: {
    byUsername: (username: string) => ['user', username] as const,
    profile: (params: { id?: string; username?: string }) => ['user', 'profile', params] as const,
  },

  // Friends & Requests
  friends: {
    list: (userId: string) => ['friends', userId] as const,
    status: (userId: string) => ['friends', 'status', userId] as const,
  },
  requests: {
    received: ['requests', 'received'] as const,
    sent: ['requests', 'sent'] as const,
  },
  blocked: {
    list: ['blocked'] as const,
  },

  // Games
  games: {
    byUser: (userId: string, page: number, limit: number) =>
      ['games', userId, page, limit] as const,
  },
  game: {
    byId: (gameId: string) => ['game', gameId] as const,
  },

  // Leaderboard
  leaderboard: (params: { page: number; limit: number }) => ['leaderboard', params] as const,

  // Challenges
  challenges: {
    list: ['challenges'] as const,
  },

  // Search
  search: {
    users: {
      byUsername: (username: string) => ['search', 'users', username] as const,
    },
  },

  // Subscription
  subscription: ['subscription'] as const,
};
