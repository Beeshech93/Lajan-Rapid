const STORAGE_KEY = "lajanrapid:notification-sound-enabled";
let audioContext: AudioContext | null = null;

export function isNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Storage may be unavailable in private or restricted browsing modes.
  }
}

/** Short, quiet digital ding. Call only for a newly received in-app notification. */
export function playNotificationDing(): void {
  if (typeof window === "undefined" || !isNotificationSoundEnabled()) return;

  try {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;

    audioContext ??= new AudioContextConstructor();
    const context = audioContext;
    const play = () => {
      if (context.state !== "running") return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1046.5, now);
      oscillator.frequency.exponentialRampToValueAtTime(1318.5, now + 0.045);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.23);
    };

    if (context.state === "suspended") {
      // Browsers require a user gesture before audio can start. The settings switch
      // previews the sound in that gesture and resumes this shared context.
      void context.resume().then(play).catch(() => {});
      return;
    }
    play();
  } catch {
    // Audio is an enhancement; a blocked or unsupported sound must not break notifications.
  }
}
