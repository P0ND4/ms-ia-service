import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GuardrailEvaluation,
  GuardrailInput,
  GuardrailOutput,
  IGuardrailPolicy,
} from 'src/contexts/ia/domain/ports';

@Injectable()
export class DefaultGuardrailPolicy implements IGuardrailPolicy {
  constructor(private readonly configService: ConfigService) {}

  async evaluateInput(input: GuardrailInput): Promise<GuardrailEvaluation> {
    const content = [input.goal, JSON.stringify(input.context ?? {})].join(' ');
    const blockedWords = this.getBlockedWords('IA_GUARDRAIL_INPUT_BLOCKLIST');
    const reasons = this.findMatches(content, blockedWords);

    return {
      allowed: reasons.length === 0,
      reasons,
      policyVersion: 'v2-default-guardrail',
    };
  }

  async evaluateOutput(input: GuardrailOutput): Promise<GuardrailEvaluation> {
    const content = [input.response].join(' ');
    const blockedWords = this.getBlockedWords('IA_GUARDRAIL_OUTPUT_BLOCKLIST');
    const reasons = this.findMatches(content, blockedWords);

    return {
      allowed: reasons.length === 0,
      reasons,
      policyVersion: 'v2-default-guardrail',
    };
  }

  private getBlockedWords(configKey: string): string[] {
    const raw = this.configService.get<string>(configKey) ?? '';
    return raw
      .split(',')
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word.length > 0);
  }

  private findMatches(content: string, blockedWords: string[]): string[] {
    const normalized = content.toLowerCase();
    return blockedWords.filter((word) => normalized.includes(word));
  }
}
