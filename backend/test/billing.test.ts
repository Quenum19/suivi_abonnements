import { describe, it, expect } from 'vitest';
import { PLANS, planOf, allowedChannelsForPlan } from '../src/services/billing.js';

describe('billing — plans & gating', () => {
  it('résout les plans connus, retombe sur free sinon', () => {
    expect(planOf('pro').id).toBe('pro');
    expect(planOf('team').id).toBe('team');
    expect(planOf('inconnu').id).toBe('free');
  });

  it('free limite les abonnements et n’autorise que l’email', () => {
    expect(PLANS.free.maxSubscriptions).toBe(15);
    expect(allowedChannelsForPlan('free', ['email', 'n8n'])).toEqual(['email']);
  });

  it('pro débloque n8n et l’illimité', () => {
    expect(PLANS.pro.maxSubscriptions).toBe(Infinity);
    expect(allowedChannelsForPlan('pro', ['email', 'n8n'])).toEqual(['email', 'n8n']);
  });
});
