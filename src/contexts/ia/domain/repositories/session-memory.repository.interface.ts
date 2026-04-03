export type SessionMemoryRole = 'system' | 'user' | 'assistant' | 'tool';

export interface SessionMemoryTurn {
  role: SessionMemoryRole;
  content: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface AppendSessionMemoryInput {
  tenantId: string;
  sessionId: string;
  turn: SessionMemoryTurn;
}

export abstract class ISessionMemoryRepository {
  abstract getRecentTurns(
    tenantId: string,
    sessionId: string,
    limit: number,
  ): Promise<SessionMemoryTurn[]>;

  abstract appendTurn(input: AppendSessionMemoryInput): Promise<void>;
}
