import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Lead } from './lib/types.js';
import { postLeadMessage } from './lib/slack.js';

// Receives a Reveal Form submission and posts it to Slack (with the "Push to
// Notion CRM" button). It does NOT write to Notion — that happens only when
// someone clicks the button (see api/slack/interactivity.ts).

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function coerceLead(body: Record<string, any>): Lead {
  const c = body.contact || {};
  const p = body.project || {};
  const e = body.estimate || {};
  const m = body.meta || {};
  return {
    contact: {
      firstName: str(c.firstName),
      lastName: str(c.lastName),
      email: str(c.email),
      phone: str(c.phone),
      zip: str(c.zip),
    },
    project: {
      rooms: Array.isArray(p.rooms) ? p.rooms.map(str).filter(Boolean) : [],
      roomLabels: Array.isArray(p.roomLabels) ? p.roomLabels.map(str).filter(Boolean) : [],
      tier: p.tier != null ? str(p.tier) : null,
      tierLabel: p.tierLabel != null ? str(p.tierLabel) : null,
      budget: p.budget != null ? str(p.budget) : null,
      budgetLabel: p.budgetLabel != null ? str(p.budgetLabel) : null,
      acknowledged: !!p.acknowledged,
    },
    estimate: {
      pmTotal: typeof e.pmTotal === 'number' ? e.pmTotal : null,
      pmTotalFormatted: e.pmTotalFormatted != null ? str(e.pmTotalFormatted) : null,
      constructionLo: typeof e.constructionLo === 'number' ? e.constructionLo : null,
      constructionHi: typeof e.constructionHi === 'number' ? e.constructionHi : null,
      constructionRangeFormatted:
        e.constructionRangeFormatted != null ? str(e.constructionRangeFormatted) : null,
      designFeeRangeFormatted:
        e.designFeeRangeFormatted != null ? str(e.designFeeRangeFormatted) : null,
    },
    meta: {
      layout: m.layout != null ? str(m.layout) : null,
      pageUrl: m.pageUrl != null ? str(m.pageUrl) : null,
      utm: m.utm && typeof m.utm === 'object' ? m.utm : {},
      submittedAt: m.submittedAt != null ? str(m.submittedAt) : null,
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const body = (typeof req.body === 'string' ? safeJson(req.body) : req.body) || {};
  const lead = coerceLead(body);

  // Minimal validation: a name plus at least one way to reach them.
  if (!lead.contact.firstName || !lead.contact.lastName) {
    return res.status(400).json({ ok: false, error: 'missing_name' });
  }
  if (!lead.contact.email && !lead.contact.phone) {
    return res.status(400).json({ ok: false, error: 'missing_contact' });
  }

  const result = await postLeadMessage(lead);
  if (!result.ok) {
    console.error('intake → Slack failed:', result.error);
    // Surface a soft failure: the lead form should still thank the user, but we
    // log loudly so a misconfiguration is caught fast.
    return res.status(502).json({ ok: false, error: result.error || 'slack_failed' });
  }

  return res.status(200).json({ ok: true });
}

function safeJson(s: string): Record<string, any> | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
