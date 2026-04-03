export interface GuardrailInput {
  tenantId: string;
  agentId: string;
  goal: string;
  context?: Record<string, unknown>;
}

export interface GuardrailEvaluation {
  allowed: boolean;
  reasons: string[];
  policyVersion: string;
}

export interface GuardrailOutput extends GuardrailInput {
  response: string;
}

export abstract class IGuardrailPolicy {
  abstract evaluateInput(input: GuardrailInput): Promise<GuardrailEvaluation>;
  abstract evaluateOutput(input: GuardrailOutput): Promise<GuardrailEvaluation>;
}
