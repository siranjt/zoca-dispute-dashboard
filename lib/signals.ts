import 'server-only';
import type { CommsEvent } from './comms';

export type Signal = {
  id: string;
  label: string;
  /** -3 (refund) … +3 (fight). 0 = neutral. */
  weight: number;
  /** True if the signal fired for this dispute. */
  fired: boolean;
  /** Short evidence snippet shown in the UI / draft. */
  evidence?: string;
};

export type Recommendation = 'FIGHT' | 'REFUND' | 'NEEDS AM CALL';

export type SignalReport = {
  signals: Signal[];
  score: number;
  recommendation: Recommendation;
  rationale: string;
  /** Source of the analysis. */
  source: 'llm' | 'regex';
  llmError?: string;
};

export type ScoreInput = {
  events: CommsEvent[];
  disputeCreatedAt: number; // unix ms
  /** Optional context to give the LLM more grounding. */
  context?: {
    disputeReason?: string;
    disputeAmount?: number;
    disputeCurrency?: string;
    customerName?: string;
    customerEmail?: string;
    bizName?: string;
    accountManager?: string;
    accountStatus?: string;
  };
};

/**
 * Public entry point: tries Claude first, falls back to regex if the API
 * key is missing or the call fails.
 */
export async function scoreDispute(input: ScoreInput): Promise<SignalReport> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const llm = await scoreDisputeLLM(input);
      return llm;
    } catch (e: any) {
      const fallback = scoreDisputeRegex(input);
      return { ...fallback, llmError: e?.message ?? 'LLM call failed' };
    }
  }
  return scoreDisputeRegex(input);
}

// ─────────────────────────────────────────────────────────────
// LLM SCORER
// ─────────────────────────────────────────────────────────────

const SIGNAL_DEFINITIONS: Array<{ id: string; label: string; weight: number; description: string }> = [
  {
    id: 'service_delivered',
    label: 'Service was delivered (team comms exist)',
    weight: 2,
    description:
      'Zoca team has actively communicated with the customer in the 90-day window. ANY outbound work product (status updates, deliverables, training session, response to questions) counts.',
  },
  {
    id: 'comms_volume',
    label: 'High comms volume (≥10 messages)',
    weight: 1,
    description: 'Total comms volume across all channels is at least 10 events in the window.',
  },
  {
    id: 'positive_client',
    label: 'Customer expressed satisfaction',
    weight: 2,
    description:
      'A clear, in-context positive remark from the customer (thanks, satisfaction, excitement about results). Generic pleasantries do not count — it should reflect satisfaction with the service.',
  },
  {
    id: 'training_delivered',
    label: 'Onboarding/training session occurred',
    weight: 1,
    description:
      'Evidence of an onboarding call, kickoff, training session, or walkthrough — whether scheduled, completed, or referenced retroactively.',
  },
  {
    id: 'comms_before_dispute',
    label: 'Communications continued up to dispute date',
    weight: 1,
    description: 'There is at least one comms event in the 14 days leading up to the dispute creation date.',
  },
  {
    id: 'negative_client',
    label: 'Customer raised complaint / refund request',
    weight: -2,
    description:
      'Customer explicitly complained about the service, asked for a refund, threatened to dispute or cancel, or expressed strong dissatisfaction.',
  },
  {
    id: 'refund_already',
    label: 'Refund / credit already discussed',
    weight: -2,
    description:
      'Either the team OR the customer raised the topic of a refund, credit note, or money-back arrangement — even if not yet given.',
  },
  {
    id: 'no_team_contact',
    label: 'No team→client comms in 90 days',
    weight: -3,
    description: 'There are zero outbound communications from the Zoca team in the entire 90-day window.',
  },
];

const SYSTEM_PROMPT = `You are a Stripe-dispute analyst at Zoca, a beauty-and-wellness SaaS.
Your job: score how strong our position is when contesting a chargeback.

You will receive:
- The dispute facts (reason code, amount, date, customer)
- A 90-day communications timeline between Zoca and the customer

You must evaluate exactly the 8 signals listed below and return a JSON object.

STRICT RULES:
- Only fire a signal if the evidence is literally present in the timeline. No "contextual" exceptions.
- Numeric thresholds are exact: "comms_volume" fires ONLY if the timeline shows >=10 events. 9 events = false.
- Do NOT include any score numbers or sums in the rationale. The dashboard computes the score itself.
- Rationale is 2-3 sentences explaining the dispute posture in plain English (e.g. "Customer was actively engaged through April 25 and expressed satisfaction. Strong evidence trail."). No math.

Output ONLY a single JSON object, no prose. A markdown fence is acceptable. Schema:
{
  "signals": [
    { "id": "<signal id>", "fired": <bool>, "evidence": "<one-sentence justification with a date or short quote>" }
  ],
  "rationale": "<2-3 sentence narrative, no numbers>"
}`;

async function scoreDisputeLLM(input: ScoreInput): Promise<SignalReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

  // Cap to the most-recent 80 events to keep the prompt under control.
  // 80 events × ~200 chars ≈ 16K chars ≈ 4K tokens — safe for any model.
  const events = [...input.events].slice(0, 80);
  const oldest = events[events.length - 1]?.createdAt;

  const timeline = events
    .map((e) => {
      const date = new Date(e.createdAt).toISOString().slice(0, 16).replace('T', ' ');
      const side = e.side === 'team' ? 'ZOCA' : e.side === 'client' ? 'CUSTOMER' : '?';
      const body = (e.body || '').replace(/\s+/g, ' ').trim().slice(0, 280);
      const extras = e.extras ? ` (${Object.entries(e.extras).map(([k, v]) => `${k}=${v}`).join(', ')})` : '';
      return `${date} [${e.channel} · ${side}]${extras}: ${body || '(no text)'}`;
    })
    .join('\n');

  const ctx = input.context ?? {};
  const disputeDate = new Date(input.disputeCreatedAt).toISOString().slice(0, 10);
  const oldestDate = oldest ? new Date(oldest).toISOString().slice(0, 10) : 'n/a';

  const definitions = SIGNAL_DEFINITIONS.map(
    (s) => `- ${s.id} (weight ${s.weight >= 0 ? '+' : ''}${s.weight}): ${s.label}\n  ${s.description}`,
  ).join('\n');

  const userMessage = `# Dispute facts
- Reason: ${ctx.disputeReason ?? 'unknown'}
- Amount: ${ctx.disputeAmount != null && ctx.disputeCurrency ? formatMoney(ctx.disputeAmount, ctx.disputeCurrency) : 'unknown'}
- Opened: ${disputeDate}
- Customer: ${ctx.bizName || ctx.customerName || 'unknown'}${ctx.customerEmail ? ` <${ctx.customerEmail}>` : ''}
- Account manager: ${ctx.accountManager ?? 'unknown'}
- Account status: ${ctx.accountStatus ?? 'unknown'}

# Timeline window
${events.length} events from ${oldestDate} → ${disputeDate} (most recent first):

${timeline || '(no comms in the last 90 days)'}

# Signals to evaluate
${definitions}

Return your JSON now.`;

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
    // Don't cache; each dispute is its own request.
    cache: 'no-store',
  });

  if (!apiRes.ok) {
    const errBody = await apiRes.text();
    throw new Error(`Anthropic API ${apiRes.status}: ${errBody.slice(0, 240)}`);
  }

  const res = (await apiRes.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = (res.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text || '')
    .join('\n');

  const json = extractJson(text);
  if (!json) throw new Error(`LLM returned non-JSON output: ${text.slice(0, 200)}`);

  const parsed = JSON.parse(json) as {
    signals: Array<{ id: string; fired: boolean; evidence?: string }>;
    rationale: string;
  };

  const signals: Signal[] = SIGNAL_DEFINITIONS.map((def) => {
    const found = parsed.signals?.find((s) => s.id === def.id);
    return {
      id: def.id,
      label: def.label,
      weight: def.weight,
      fired: !!found?.fired,
      evidence: found?.evidence,
    };
  });

  const score = signals.filter((s) => s.fired).reduce((sum, s) => sum + s.weight, 0);
  const recommendation: Recommendation = score >= 4 ? 'FIGHT' : score <= -2 ? 'REFUND' : 'NEEDS AM CALL';

  return {
    signals,
    score,
    recommendation,
    rationale: parsed.rationale || '(no rationale provided)',
    source: 'llm',
  };
}

function extractJson(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  // Strip ```json fences
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  // Find first { ... last }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return null;
}

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

// ─────────────────────────────────────────────────────────────
// REGEX FALLBACK (used when no Anthropic key or LLM call fails)
// ─────────────────────────────────────────────────────────────

const POSITIVE_RX = /\b(thank(s| you)|amazing|love|great|appreciate|works|finally|awesome|grateful|excited)\b/i;
const NEGATIVE_RX = /\b(refund|cancel|cancell?ation|disput(e|ing)|chargeback|terrible|awful|fraud|scam|never (got|received)|not working|broken|complaint|disappointed|angry|frustrat)\b/i;
const REFUND_RX = /\b(refund(ed)?|credit note|credited back|money back)\b/i;
const TRAINING_RX = /\b(onboard(ing)?|training|kickoff|kick-off|setup call|orientation|walkthrough)\b/i;

export function scoreDisputeRegex(input: ScoreInput): SignalReport {
  const { events, disputeCreatedAt } = input;

  const teamEvents = events.filter((e) => e.side === 'team');
  const clientEvents = events.filter((e) => e.side === 'client');
  const positiveClient = clientEvents.filter((e) => POSITIVE_RX.test(e.body));
  const negativeClient = clientEvents.filter((e) => NEGATIVE_RX.test(e.body));
  const refundMentions = events.filter((e) => REFUND_RX.test(e.body));
  const trainingMentions = events.filter((e) => TRAINING_RX.test(e.body));

  const lastTeamContact = teamEvents[0];
  const beforeDispute = events.filter((e) => e.createdAt < disputeCreatedAt);

  const fires: Record<string, { fired: boolean; evidence?: string }> = {
    service_delivered: {
      fired: teamEvents.length > 0,
      evidence: lastTeamContact
        ? `Most recent Zoca→client comms: ${new Date(lastTeamContact.createdAt).toISOString().slice(0, 10)} via ${lastTeamContact.channel}`
        : 'No team→client communications found in the last 90 days',
    },
    comms_volume: {
      fired: events.length >= 10,
      evidence: `${events.length} total comms events in the last 90 days (${teamEvents.length} from team, ${clientEvents.length} from client)`,
    },
    positive_client: {
      fired: positiveClient.length > 0,
      evidence: positiveClient[0]?.body
        ? `Quote: "${truncate(positiveClient[0].body, 160)}" (${new Date(positiveClient[0].createdAt).toISOString().slice(0, 10)})`
        : 'No positive client messages detected',
    },
    training_delivered: {
      fired: trainingMentions.length > 0,
      evidence: trainingMentions[0]
        ? `Reference: "${truncate(trainingMentions[0].body, 160)}" (${trainingMentions[0].channel})`
        : 'No training/onboarding references found',
    },
    comms_before_dispute: {
      fired:
        beforeDispute.length > 0 &&
        beforeDispute[0].createdAt > disputeCreatedAt - 14 * 24 * 60 * 60 * 1000,
      evidence: beforeDispute[0]
        ? `Last comms before dispute: ${new Date(beforeDispute[0].createdAt).toISOString().slice(0, 10)}`
        : 'No comms in the lead-up to the dispute',
    },
    negative_client: {
      fired: negativeClient.length > 0,
      evidence: negativeClient[0]?.body
        ? `Quote: "${truncate(negativeClient[0].body, 160)}" (${new Date(negativeClient[0].createdAt).toISOString().slice(0, 10)})`
        : 'No complaint / refund language detected',
    },
    refund_already: {
      fired: refundMentions.length > 0,
      evidence: refundMentions[0]
        ? `Reference: "${truncate(refundMentions[0].body, 160)}" (${refundMentions[0].channel})`
        : 'No prior refund/credit discussion',
    },
    no_team_contact: {
      fired: teamEvents.length === 0,
      evidence:
        teamEvents.length === 0
          ? 'No outgoing team comms detected. Hard to argue service delivery without a paper trail.'
          : `Team has ${teamEvents.length} outgoing messages.`,
    },
  };

  const signals: Signal[] = SIGNAL_DEFINITIONS.map((def) => ({
    id: def.id,
    label: def.label,
    weight: def.weight,
    fired: !!fires[def.id]?.fired,
    evidence: fires[def.id]?.evidence,
  }));

  const score = signals.filter((s) => s.fired).reduce((sum, s) => sum + s.weight, 0);

  let recommendation: Recommendation = 'NEEDS AM CALL';
  let rationale = '';
  if (score >= 4) {
    recommendation = 'FIGHT';
    rationale = `Strong evidence trail (score ${score}). Counter the dispute with a Stripe evidence submission.`;
  } else if (score <= -2) {
    recommendation = 'REFUND';
    rationale = `Weak position (score ${score}). Customer signals indicate refunding may be cheaper than fighting.`;
  } else {
    rationale = `Mixed signals (score ${score}). Loop in the AM before responding to Stripe.`;
  }

  return { signals, score, recommendation, rationale, source: 'regex' };
}

function truncate(s: string, n: number) {
  s = (s || '').replace(/\s+/g, ' ').trim();
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
