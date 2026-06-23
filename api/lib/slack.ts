import crypto from 'node:crypto';
import type { Lead } from './types.js';
import { LEAD_EVENT_TYPE } from './types.js';

const SLACK_API = 'https://slack.com/api';

// ── Signature verification ───────────────────────────────────────────────────
// Slack signs every interactivity request. We recompute the HMAC over the EXACT
// raw request body and compare. Reject anything older than 5 minutes (replay).
export function verifySlackSignature(
  rawBody: string,
  signature: string | undefined,
  timestamp: string | undefined,
  signingSecret: string | undefined,
): boolean {
  if (!signature || !timestamp || !signingSecret) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const expected =
    'v0=' + crypto.createHmac('sha256', signingSecret).update(base).digest('hex');

  // Lengths must match before timingSafeEqual, or it throws.
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ── Lead → Block Kit message ─────────────────────────────────────────────────
function field(label: string, value: string) {
  return { type: 'mrkdwn', text: `*${label}:*\n${value || 'n/a'}` };
}

export function buildLeadBlocks(lead: Lead) {
  const { contact, project, estimate, meta } = lead;
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  const rooms = project.roomLabels.length ? project.roomLabels.join(', ') : 'n/a';
  const contactLines = [
    contact.email ? `📧 ${contact.email}` : null,
    contact.phone ? `📱 ${contact.phone}` : null,
    contact.zip ? `📍 ${contact.zip}` : null,
  ]
    .filter(Boolean)
    .join('   ');

  const sourceBits: string[] = [];
  if (meta.utm && Object.keys(meta.utm).length) {
    sourceBits.push(
      Object.entries(meta.utm)
        .map(([k, v]) => `${k}=${v}`)
        .join(' · '),
    );
  }

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🏠 New Reveal request', emoji: true },
    },
    {
      type: 'section',
      fields: [
        field('Name', name),
        field('Timeline / budget', project.budgetLabel || 'Not specified'),
      ],
    },
    { type: 'section', text: { type: 'mrkdwn', text: contactLines || '_No contact details_' } },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        field('Rooms', rooms),
        field('Scope', project.tierLabel || 'n/a'),
        field('Premodel estimate', estimate.pmTotalFormatted || 'n/a'),
        field('Construction range', estimate.constructionRangeFormatted || 'n/a'),
      ],
    },
    ...(project.note
      ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Note:*\n${project.note}` } }]
      : []),
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text:
            `Submitted ${formatTimestamp(meta.submittedAt)}` +
            (sourceBits.length ? ` · ${sourceBits.join(' · ')}` : '') +
            ` · texts: ${project.smsConsent ? '✓ opted in' : '✗ not opted in'}`,
        },
      ],
    },
    {
      type: 'actions',
      block_id: 'lead_actions',
      elements: [
        {
          type: 'button',
          action_id: 'push_to_notion',
          style: 'primary',
          text: { type: 'plain_text', text: '➕ Push to Notion CRM', emoji: true },
          // Confirmation guards against accidental double-adds.
          confirm: {
            title: { type: 'plain_text', text: 'Add to Notion CRM?' },
            text: { type: 'mrkdwn', text: `Create a CRM record for *${name || 'this lead'}*?` },
            confirm: { type: 'plain_text', text: 'Add lead' },
            deny: { type: 'plain_text', text: 'Cancel' },
          },
        },
      ],
    },
  ];
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'just now';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'just now';
  return d.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// ── Slack Web API calls ──────────────────────────────────────────────────────
export async function postLeadMessage(lead: Lead): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_LEADS_CHANNEL;
  if (!token || !channel) {
    return { ok: false, error: 'slack_not_configured' };
  }

  const name = `${lead.contact.firstName} ${lead.contact.lastName}`.trim();
  const res = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel,
      text: `New Reveal request from ${name || 'a homeowner'}`, // notification fallback
      blocks: buildLeadBlocks(lead),
      // The full structured lead rides along as message metadata so the button
      // handler can recreate the Notion record without any external store.
      metadata: { event_type: LEAD_EVENT_TYPE, event_payload: lead },
    }),
  });

  const data = (await res.json()) as { ok: boolean; error?: string };
  return data.ok ? { ok: true } : { ok: false, error: data.error };
}

// Update an already-posted message (used after the button click) via response_url.
export async function updateViaResponseUrl(responseUrl: string, body: unknown): Promise<void> {
  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
