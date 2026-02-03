interface SoundMap {
  capture: HTMLAudioElement | null;
  castling: HTMLAudioElement | null;
  check: HTMLAudioElement | null;
  checkmate: HTMLAudioElement | null;
  gameOver: HTMLAudioElement | null;
  gameStart: HTMLAudioElement | null;
  move: HTMLAudioElement | null;
  stalemate: HTMLAudioElement | null;
  notify: HTMLAudioElement | null;
}

export const SoundManager = {
  sounds: {
    capture: typeof window !== 'undefined' ? new Audio('/assets/sounds/capture.mp3') : null,
    castling: typeof window !== 'undefined' ? new Audio('/assets/sounds/castling.mp3') : null,
    check: typeof window !== 'undefined' ? new Audio('/assets/sounds/check.mp3') : null,
    checkmate: typeof window !== 'undefined' ? new Audio('/assets/sounds/checkmate.mp3') : null,
    gameOver: typeof window !== 'undefined' ? new Audio('/assets/sounds/game-over.mp3') : null,
    gameStart: typeof window !== 'undefined' ? new Audio('/assets/sounds/game-start.mp3') : null,
    move: typeof window !== 'undefined' ? new Audio('/assets/sounds/move.mp3') : null,
    stalemate: typeof window !== 'undefined' ? new Audio('/assets/sounds/stalemate.mp3') : null,
    notify: typeof window !== 'undefined' ? new Audio('/assets/sounds/notify.mp3') : null,
  } as SoundMap,
  isMuted: false,

  init(): void {
    if (typeof window === 'undefined') return; // Skip on server-side
    Object.values(this.sounds).forEach((sound) => {
      if (sound) {
        sound.preload = 'auto';
        sound.volume = 0.5; // Default volume (0.0 to 1.0)
      }
    });
  },

  play(soundName: keyof SoundMap): void {
    if (typeof window === 'undefined' || !this.sounds[soundName] || this.isMuted) return;
    const sound = this.sounds[soundName];
    if (sound) {
      sound.currentTime = 0; // Reset to start
      sound.play().catch((error: Error) => {
        console.error(`Error playing sound ${soundName}:`, error);
      });
    }
  },

  unlockAudio(): void {
    if (typeof window === 'undefined' || this.isMuted) return;

    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      source.disconnect();
    } catch (error) {
      console.error('Error unlocking audio context:', error);
    }
  },

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('isMuted', this.isMuted.toString());
    }
  },

  loadMuteState(): void {
    if (typeof window !== 'undefined') {
      this.isMuted = localStorage.getItem('isMuted') === 'true';
    }
  },
};
