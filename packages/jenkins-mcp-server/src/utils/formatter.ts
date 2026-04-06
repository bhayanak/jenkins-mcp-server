const STATUS_EMOJI: Record<string, string> = {
  blue: '✅',
  blue_anime: '🔵',
  red: '🔴',
  red_anime: '🔴',
  yellow: '🟡',
  yellow_anime: '🟡',
  grey: '⚪',
  disabled: '⚫',
  aborted: '⚪',
  notbuilt: '⚪',
};

const HEALTH_EMOJI: [number, string][] = [
  [80, '☀️'],
  [60, '🌤'],
  [40, '⛅'],
  [20, '🌧'],
  [0, '⛈'],
];

export function statusEmoji(color: string): string {
  return STATUS_EMOJI[color] ?? '❓';
}

export function resultEmoji(result: string | null, building: boolean): string {
  if (building) return '🔵';
  switch (result) {
    case 'SUCCESS':
      return '✅';
    case 'FAILURE':
      return '🔴';
    case 'UNSTABLE':
      return '🟡';
    case 'ABORTED':
      return '⚪';
    default:
      return '❓';
  }
}

export function healthEmoji(score: number): string {
  for (const [threshold, emoji] of HEALTH_EMOJI) {
    if (score >= threshold) return emoji;
  }
  return '⛈';
}

export function formatDuration(ms: number): string {
  if (ms < 0) return '–';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 0) return 'just now';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function truncateLog(log: string, tail?: number): string {
  if (!tail) return log;
  const lines = log.split('\n');
  if (lines.length <= tail) return log;
  return `... (${lines.length - tail} lines truncated)\n` + lines.slice(-tail).join('\n');
}

export function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}
