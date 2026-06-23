import { Client } from '@notionhq/client';
import type { Lead } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Lead → Notion CRM page.
//
// ⚠️  The PROPERTY NAMES below must match the live CRM database exactly (Notion
//     matches by name, case-sensitive). They are confirmed against the real
//     schema in Phase 3 (inspected via the Notion connector). Adjust the keys in
//     `buildProperties` if the CRM uses different names; nothing else changes.
// ─────────────────────────────────────────────────────────────────────────────

function richText(content: string) {
  return { rich_text: [{ text: { content: content.slice(0, 2000) } }] };
}

function buildProperties(lead: Lead): Record<string, unknown> {
  const { contact, project, estimate, meta } = lead;
  const name = `${contact.firstName} ${contact.lastName}`.trim() || 'New lead';

  const props: Record<string, unknown> = {
    // Title property — almost always called "Name".
    Name: { title: [{ text: { content: name } }] },

    'First Name': richText(contact.firstName),
    'Last Name': richText(contact.lastName),
    Email: { email: contact.email || null },
    Phone: { phone_number: contact.phone || null },
    Location: richText(contact.zip),
    Rooms: richText(project.roomLabels.join(', ')),

    'Lead Source': { select: { name: 'Website (Preview)' } },
    Status: { select: { name: 'New Lead' } },
  };

  if (project.tierLabel) props['Service Type'] = { select: { name: project.tierLabel } };
  if (project.budgetLabel) props['Budget'] = richText(project.budgetLabel);
  if (estimate.pmTotal != null) props['Preliminary Estimate'] = { number: estimate.pmTotal };
  if (estimate.constructionRangeFormatted) {
    props['Construction Range'] = richText(estimate.constructionRangeFormatted);
  }
  if (meta.utm && Object.keys(meta.utm).length) {
    props['UTM Source'] = richText(
      Object.entries(meta.utm)
        .map(([k, v]) => `${k}=${v}`)
        .join(', '),
    );
  }

  return props;
}

export interface NotionResult {
  ok: boolean;
  pageId?: string;
  url?: string;
  error?: string;
}

export async function createCrmLead(lead: Lead): Promise<NotionResult> {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!apiKey || !databaseId) return { ok: false, error: 'notion_not_configured' };

  try {
    const notion = new Client({ auth: apiKey });
    const page = (await notion.pages.create({
      parent: { database_id: databaseId },
      properties: buildProperties(lead) as never,
    })) as { id: string; url?: string };

    return { ok: true, pageId: page.id, url: page.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Notion create failed:', message);
    return { ok: false, error: message };
  }
}
