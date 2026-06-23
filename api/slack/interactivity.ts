import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Lead } from '../lib/types.js';
import { LEAD_EVENT_TYPE } from '../lib/types.js';
import { verifySlackSignature, updateViaResponseUrl } from '../lib/slack.js';
import { createCrmLead } from '../lib/notion.js';

// Slack signature verification requires the EXACT raw request body, so we turn
// off Vercel's automatic body parser and read the stream ourselves.
export const config = { api: { bodyParser: false } };

function readRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const rawBody = await readRawBody(req);

  // 1. Authenticate the request came from Slack.
  const ok = verifySlackSignature(
    rawBody,
    req.headers['x-slack-signature'] as string | undefined,
    req.headers['x-slack-request-timestamp'] as string | undefined,
    process.env.SLACK_SIGNING_SECRET,
  );
  if (!ok) return res.status(401).end();

  // 2. Slack sends interactivity as urlencoded `payload=<json>`.
  const params = new URLSearchParams(rawBody);
  const payloadRaw = params.get('payload');
  if (!payloadRaw) return res.status(400).end();

  let payload: any;
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    return res.status(400).end();
  }

  if (payload.type !== 'block_actions') return res.status(200).end();

  const action = (payload.actions || [])[0];
  if (!action || action.action_id !== 'push_to_notion') return res.status(200).end();

  const responseUrl: string | undefined = payload.response_url;
  const clickedBy: string = payload.user?.username || payload.user?.name || 'someone';

  // 3. Recover the structured lead from the message metadata.
  const meta = payload.message?.metadata;
  const lead: Lead | undefined =
    meta?.event_type === LEAD_EVENT_TYPE ? (meta.event_payload as Lead) : undefined;

  if (!lead) {
    if (responseUrl) {
      await updateViaResponseUrl(responseUrl, {
        replace_original: false,
        response_type: 'ephemeral',
        text: '⚠️ Could not read the lead data from this message. Add it to Notion manually.',
      });
    }
    return res.status(200).end();
  }

  // 4. Create the CRM record, then rewrite the message to reflect the result.
  const result = await createCrmLead(lead);
  const originalBlocks = (payload.message?.blocks || []).filter(
    (b: any) => b.block_id !== 'lead_actions',
  );
  const name = `${lead.contact.firstName} ${lead.contact.lastName}`.trim();

  if (responseUrl) {
    const statusBlock = result.ok
      ? {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text:
                `✅ Added to Notion CRM by @${clickedBy}` +
                (result.url ? ` · <${result.url}|Open record>` : ''),
            },
          ],
        }
      : {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `⚠️ @${clickedBy} tried to add *${name}* but Notion errored: ${result.error}. Button left active to retry.`,
            },
          ],
        };

    await updateViaResponseUrl(responseUrl, {
      replace_original: true,
      text: result.ok ? `Lead added to CRM: ${name}` : `Notion error for ${name}`,
      // On failure keep the action button so it can be retried.
      blocks: result.ok
        ? [...originalBlocks, statusBlock]
        : [...payload.message.blocks, statusBlock],
    });
  }

  return res.status(200).end();
}
