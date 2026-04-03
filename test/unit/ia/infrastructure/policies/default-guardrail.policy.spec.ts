import { ConfigService } from '@nestjs/config';
import { DefaultGuardrailPolicy } from 'src/contexts/ia/infrastructure/policies/default-guardrail.policy';

describe('DefaultGuardrailPolicy', () => {
  const configServiceMock = {
    get: jest.fn(),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows clean input when no blocked words match', async () => {
    (configServiceMock.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'IA_GUARDRAIL_INPUT_BLOCKLIST') {
        return 'credit card,password';
      }
      if (key === 'IA_GUARDRAIL_OUTPUT_BLOCKLIST') {
        return 'ssn,cvv';
      }
      return '';
    });

    const policy = new DefaultGuardrailPolicy(configServiceMock);
    const evaluation = await policy.evaluateInput({
      tenantId: 'acme',
      agentId: 'ops',
      goal: 'Necesito un resumen del ticket',
      context: { region: 'mx' },
    });

    expect(evaluation.allowed).toBe(true);
    expect(evaluation.reasons).toEqual([]);
    expect(evaluation.policyVersion).toBe('v2-default-guardrail');
  });

  it('blocks input and output when blocked words are present', async () => {
    (configServiceMock.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'IA_GUARDRAIL_INPUT_BLOCKLIST') {
        return 'credit card,password';
      }
      if (key === 'IA_GUARDRAIL_OUTPUT_BLOCKLIST') {
        return 'ssn,cvv';
      }
      return '';
    });

    const policy = new DefaultGuardrailPolicy(configServiceMock);

    const inputEvaluation = await policy.evaluateInput({
      tenantId: 'acme',
      agentId: 'ops',
      goal: 'Mi password se filtro',
      context: { risk: true },
    });

    const outputEvaluation = await policy.evaluateOutput({
      tenantId: 'acme',
      agentId: 'ops',
      goal: 'x',
      context: {},
      response: 'El ssn aparece en esta salida',
    });

    expect(inputEvaluation.allowed).toBe(false);
    expect(inputEvaluation.reasons).toContain('password');

    expect(outputEvaluation.allowed).toBe(false);
    expect(outputEvaluation.reasons).toContain('ssn');
  });
});
