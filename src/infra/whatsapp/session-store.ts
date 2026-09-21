import {
  type BotState,
  type BotEvent,
  applyBotEvent,
  initialState,
} from "@/core/bot/state-machine";

const sessions = new Map<string, BotState>();

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

export function _clearAllSessionsForTests(): void {
  sessions.clear();
}
