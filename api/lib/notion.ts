import { Client } from '@notionhq/client';
import type { Lead } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Lead → Notion CRM page.
//
// Mapped against the real "CRM Database" (data source 2faabc3f-eabf-8069-...),
// the same schema the v0 estimator wrote to. Property names/types below match it
// exactly (Notion matches by name, case-sensitive). NOTION_DATABASE_ID should be
// 2faabc3f-eabf-80f1-a807-ca058df0ce63.
//
// Deliberately NOT set: "Sync to Quo" (leaving it unchecked means the CRM's
// OpenPhone/Quo automation never fires — we dropped that pipeline). Service Type,
// Timeline, and Priority Score are left unset because the v1 form doesn't collect
// the inputs they need. The v1-specific context (scope, budget range, estimate,
// layout, consent) is captured in "Internal Notes".
// ─────────────────────────────────────────────────────────────────────────────

function richText(content: string) {
  return { rich_text: [{ text: { content: content.slice(0, 2000) } }] };
}

function buildProperties(lead: Lead): Record<string, unknown> {
  const { contact, project, estimate, meta } = lead;
  const name = `${contact.firstName} ${contact.lastName}`.trim() || 'New lead';

  // Roll the v1-specific fields the CRM has no dedicated column for into one note.
  const internal = [
    project.tierLabel ? `Scope: ${project.tierLabel}` : null,
    project.budgetLabel ? `Budget: ${project.budgetLabel}` : null,
    estimate.pmTotalFormatted ? `Premodel est: ${estimate.pmTotalFormatted}` : null,
    estimate.constructionRangeFormatted ? `Construction: ${estimate.constructionRangeFormatted}` : null,
    estimate.designFeeRangeFormatted ? `Design fee: ${estimate.designFeeRangeFormatted}` : null,
    `Text consent: ${project.smsConsent ? 'yes' : 'no'}`,
    meta.layout ? `Layout ${meta.layout.toUpperCase()}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const props: Record<string, unknown> = {
    Name: { title: [{ text: { content: name } }] },
    'First Name': richText(contact.firstName),
    'Last Name': richText(contact.lastName),
    Email: { email: contact.email || null },
    Phone: { phone_number: contact.phone || null },
    Location: richText(contact.zip),
    Rooms: richText(project.roomLabels.join(', ')),
    'Lead Source': { select: { name: 'Website Estimator' } },
    'Lead Type': { select: { name: 'Homeowner' } },
    Status: { select: { name: 'New Lead' } },
    'Internal Notes': richText(internal),
  };

  // The Q2 free-text note maps to the CRM's "Questions/Notes" column.
  if (project.note) props['Questions/Notes'] = richText(project.note);

  // Budget column is a dollar number; only set it when the form gave a number
  // (range chips are already captured in Internal Notes via budgetLabel).
  const budgetNum = project.budget != null ? Number(project.budget) : NaN;
  if (Number.isFinite(budgetNum) && budgetNum > 0) props['Budget'] = { number: budgetNum };

  if (estimate.pmTotal != null) props['Preliminary Estimate'] = { number: estimate.pmTotal };

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
