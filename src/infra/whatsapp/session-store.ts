import {
  type BotState,
  type BotEvent,
  applyBotEvent,
  initialState,
} from "@/core/bot/state-machine";

const sessions = new Map<string, BotState>();
const locks = new Map<string, Promise<unknown>>();

export function getSession(phone: string): BotState {
  return sessions.get(phone) ?? initialState();
}

export function setSession(phone: string, state: BotState): void {
  sessions.set(phone, state);
}

export function applyEvent(phone: string, event: BotEvent): BotState {
  const next = applyBotEvent(getSession(phone), event);
  setSession(phone, next);
  return next;
}

export function resetSession(phone: string): void {
  sessions.delete(phone);
}

/**
 * Serialize an async operation per phone. Two concurrent webhooks for the
 * same phone queue instead of interleaving their session reads/writes with
 * DB and network awaits.
 *
 * In-process only. Multi-instance deploys need a DB-backed lock (Redis or
 * SELECT FOR UPDATE on a bot_sessions table).
 */
export function withPhoneLock<T>(
  phone: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(phone) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  locks.set(
    phone,
    next.catch(() => undefined),
  );
  return next;
}

export function _clearAllSessionsForTests(): void {
  sessions.clear();
  locks.clear();
}
