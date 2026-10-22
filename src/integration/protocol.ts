export const GAME_ID = 'memorama-simplex';
export const GAME_URL = 'https://israeltiburcio-ai.github.io/memorama-simplex/';
export const GAME_ORIGIN = new URL(GAME_URL).origin;
export const PROTOCOL = 'optilab-game';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface GameResult {
  completed: true;
  matchedPairs: number;
  totalPairs: number;
  attempts: number;
  errors: number;
  elapsedMs: number;
  accuracy: number;
}
export interface SavedGameResult extends GameResult {
  gameId: typeof GAME_ID;
  runId: string;
  date: string;
}
type Envelope = { protocol: typeof PROTOCOL; version: 1; gameId: typeof GAME_ID; session: string };
export type GameMessage = Envelope & (
  { type: 'game:ready' } |
  { type: 'game:started'; runId: string } |
  { type: 'game:completed'; runId: string; result: GameResult }
);
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function keys(value: object, expected: string[]) {
  return Object.keys(value).sort().join(',') === expected.sort().join(',');
}
export function validResult(value: unknown): value is GameResult {
  if (!record(value) || !keys(value, ['completed','matchedPairs','totalPairs','attempts','errors','elapsedMs','accuracy'])) return false;
  const { completed, matchedPairs, totalPairs, attempts, errors, elapsedMs, accuracy } = value;
  return completed === true && totalPairs === 8 && matchedPairs === 8 &&
    typeof attempts === 'number' && Number.isSafeInteger(attempts) && attempts >= 8 && attempts <= 100000 &&
    typeof errors === 'number' && Number.isSafeInteger(errors) && errors === attempts - 8 &&
    typeof elapsedMs === 'number' && Number.isSafeInteger(elapsedMs) && elapsedMs >= 0 && elapsedMs <= 604800000 &&
    typeof accuracy === 'number' && accuracy === Math.round(8 / attempts * 100);
}
export function parseMessage(value: unknown, session: string): GameMessage | null {
  if (!record(value) || value.protocol !== PROTOCOL || value.version !== 1 || value.gameId !== GAME_ID || value.session !== session) return null;
  const base = ['protocol','version','gameId','session','type'];
  if (value.type === 'game:ready' && keys(value, base)) return value as GameMessage;
  if (typeof value.runId !== 'string' || !uuid.test(value.runId)) return null;
  if (value.type === 'game:started' && keys(value, [...base,'runId'])) return value as GameMessage;
  if (value.type === 'game:completed' && keys(value, [...base,'runId','result']) && validResult(value.result)) return value as GameMessage;
  return null;
}
export function savedResults(value: unknown): SavedGameResult[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((v): v is SavedGameResult => {
    if (!record(v) || v.gameId !== GAME_ID || typeof v.runId !== 'string' || !uuid.test(v.runId) ||
        typeof v.date !== 'string' || !Number.isFinite(Date.parse(v.date))) return false;
    const {gameId: _game, runId, date: _date, ...result} = v;
    if (!validResult(result) || seen.has(runId)) return false;
    seen.add(runId);
    return true;
  }).slice(-50);
}
