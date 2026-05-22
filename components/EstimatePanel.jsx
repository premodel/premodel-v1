/**
 * EstimatePanel
 *
 * Read-only estimate summary shown after the user completes Step 2
 * (rooms, remodel type, budget) of the Premodel intake form.
 *
 * Props:
 *   rooms        {string[]}  Array of selected room IDs
 *   remodel_type {string}    "cosmetic_pull" | "gut_reconfigure"
 *   budget       {string}    "under_50k" | "50k_100k" | "100k_200k" |
 *                            "200k_400k" | "400k_plus" | "not_sure"
 *   onBookReveal {function}  Called by the "Book your Reveal" CTA in the
 *                            not_sure state. Pass the same handler used
 *                            by the main scheduling button in the form.
 */

import React from 'react';

// ─── Construction cost reference tables ───────────────────────────────────────

const CONSTRUCTION_COSTS = {
  cosmetic_pull: {
    kitchen:        { low: 12000,  high: 90000  },
    primary_bath:   { low: 8000,   high: 95000  },
    secondary_bath: { low: 6000,   high: 50000  },
    living:         { low: 6000,   high: 50000  },
    dining:         { low: 4000,   high: 28000  },
    office:         { low: 3000,   high: 30000  },
    bedroom:        { low: 3000,   high: 25000  },
    entry_mudroom:  { low: 3000,   high: 25000  },
    basement_adu:   { low: 90000,  high: 350000 },
  },
  gut_reconfigure: {
    kitchen:        { low: 90000,  high: 175000 },
    primary_bath:   { low: 95000,  high: 160000 },
    secondary_bath: { low: 50000,  high: 80000  },
    living:         { low: 50000,  high: 100000 },
    dining:         { low: 30000,  high: 65000  },
    office:         { low: 28000,  high: 60000  },
    bedroom:        { low: 22000,  high: 50000  },
    entry_mudroom:  { low: 20000,  high: 45000  },
    basement_adu:   { low: 150000, high: 350000 },
  },
};

const ROOM_LABELS = {
  kitchen:        'Kitchen',
  primary_bath:   'Primary / master bath',
  secondary_bath: 'Secondary bath',
  living:         'Living room',
  dining:         'Dining room',
  office:         'Home office',
  bedroom:        'Bedroom',
  entry_mudroom:  'Entry / mudroom',
  basement_adu:   'Basement ADU',
};

const BUDGET_RANGES = {
  under_50k:   { low: 0,      high: 50000   },
  '50k_100k':  { low: 50000,  high: 100000  },
  '100k_200k': { low: 100000, high: 200000  },
  '200k_400k': { low: 200000, high: 400000  },
  '400k_plus': { low: 400000, high: 9999999 },
  not_sure:    null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundTo(value, nearest) {
  return Math.round(value / nearest) * nearest;
}

function formatMoney(value) {
  if (value >= 1000000) {
    const m = value / 1000000;
    return '$' + (m % 1 === 0 ? m : m.toFixed(1)) + 'm';
  }
  if (value >= 100000) {
    return '$' + Math.round(value / 1000) + 'k';
  }
  return '$' + value.toLocaleString('en-US');
}

function formatRange(low, high) {
  return formatMoney(low) + ' – ' + formatMoney(high);
}

/**
 * Determine budget alignment state.
 * Returns: 'aligned' | 'too_low' | 'has_room' | 'not_sure'
 */
function getBudgetState(constructionLow, constructionHigh, budget) {
  if (budget === 'not_sure' || !BUDGET_RANGES[budget]) return 'not_sure';
  const { low: bLow, high: bHigh } = BUDGET_RANGES[budget];

  // Construction floor exceeds the top of the user's stated budget
  if (constructionLow > bHigh) return 'too_low';

  // Construction ceiling is meaningfully below the floor of the user's budget
  if (bLow > 0 && constructionHigh < bLow * 0.8) return 'has_room';

  return 'aligned';
}

// ─── CSS variable aliases ─────────────────────────────────────────────────────
// Inline styles reference the prototype's custom properties so this component
// inherits light/dark mode automatically from the parent document.

const v = {
  bgPrimary:       'var(--color-background-primary)',
  bgSecondary:     'var(--color-background-secondary)',
  bgWarning:       'var(--color-background-warning)',
  textPrimary:     'var(--color-text-primary)',
  textSecondary:   'var(--color-text-secondary)',
  textTertiary:    'var(--color-text-tertiary)',
  textWarning:     'var(--color-text-warning)',
  borderPrimary:   'var(--color-border-primary)',
  borderSecondary: 'var(--color-border-secondary)',
  borderTertiary:  'var(--color-border-tertiary)',
  brandNavy:       'var(--color-brand-navy)',
  radiusMd:        'var(--border-radius-md)',
  radiusLg:        'var(--border-radius-lg)',
  fontSans:        'var(--font-sans)',
  fontSerif:       '"Iowan Old Style", "Palatino", Georgia, "Times New Roman", serif',
};

// State-specific accent colors (not in the prototype's design tokens)
const STATE_COLORS = {
  aligned: {
    bg:     '#eef6ee',
    border: 'rgba(34, 120, 34, 0.14)',
    icon:   '#2d7a2d',
    label:  '#1e5c1e',
  },
  too_low: {
    bg:     '#faeeda',
    border: 'rgba(133, 79, 11, 0.2)',
    icon:   '#854f0b',
    label:  '#854f0b',
  },
  has_room: {
    bg:     '#eaf2fb',
    border: 'rgba(59, 110, 181, 0.2)',
    icon:   '#3b6eb5',
    label:  '#2a5490',
  },
};

// ─── Icon components ──────────────────────────────────────────────────────────

function CheckCircleIcon({ color, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12 11 15 16 9" />
    </svg>
  );
}

function AlertTriangleIcon({ color, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ArrowUpRightIcon({ color, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

const STATE_ICONS = {
  aligned:  CheckCircleIcon,
  too_low:  AlertTriangleIcon,
  has_room: ArrowUpRightIcon,
};

// ─── Budget comparison section ────────────────────────────────────────────────

const STATE_CONTENT = {
  aligned: {
    label: 'Your budget looks aligned with this scope.',
    subtext: 'The estimated construction cost for your selected rooms falls within the range you described. You’re in the right ballpark to move forward with confidence.',
  },
  too_low: {
    label: 'Your budget may be on the low side for this scope.',
    subtext: 'The estimated construction cost for your selected rooms starts above the budget range you described. This doesn’t mean the project is out of reach — scope adjustments, phasing, or a cosmetic-first approach can bring costs down significantly. This is exactly the kind of conversation a Reveal is designed to start.',
  },
  has_room: {
    label: 'Your budget has room beyond this scope.',
    subtext: 'The estimated construction cost for your selected rooms comes in well below the budget you described. That’s a good position to be in — it leaves room for higher-end finishes, contingency, or expanding the project scope. We can help you think through how to allocate that headroom.',
  },
};

function BudgetComparison({ state, onBookReveal }) {
  // ── Not-sure state ──────────────────────────────────────────────────────────
  if (state === 'not_sure') {
    return (
      <div style={{
        background: '#fdf7ef',
        border: '0.5px solid rgba(133, 79, 11, 0.14)',
        borderRadius: v.radiusLg,
        padding: '20px',
        marginBottom: '28px',
      }}>
        <p style={{
          fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#a0733a', margin: '0 0 10px',
        }}>
          Not sure what to budget?
        </p>
        <h3 style={{
          fontSize: '19px', fontWeight: 500, letterSpacing: '-0.01em',
          lineHeight: 1.2, color: v.textPrimary, margin: '0 0 16px',
        }}>
          That&rsquo;s exactly what we&rsquo;re here for.
        </h3>
        <p style={{ fontSize: '14px', color: v.textSecondary, lineHeight: 1.65, margin: '0 0 12px' }}>
          Most homeowners go into contractor conversations without a realistic number in mind
          &mdash; and contractors have a built-in incentive to grow the scope of your project.
          More work means more revenue for them. Without an independent baseline, it&rsquo;s
          difficult to know whether a bid reflects your actual project or an expanded version of it.
        </p>
        <p style={{ fontSize: '14px', color: v.textSecondary, lineHeight: 1.65, margin: '0 0 12px' }}>
          Premodel helps you establish that baseline before you ever sit down with a contractor.
          We&rsquo;ll help you scope your project, understand what&rsquo;s realistic for your space
          and goals, and walk into those conversations knowing what your remodel should actually
          cost &mdash; not what someone else needs it to cost.
        </p>
        <p style={{
          fontSize: '14px', color: v.textSecondary, lineHeight: 1.65,
          margin: '0 0 20px', fontFamily: v.fontSerif, fontStyle: 'italic',
        }}>
          That&rsquo;s what a Reveal is designed to do.
        </p>
        <button
          onClick={onBookReveal}
          style={{
            width: '100%', padding: '13px',
            background: v.textPrimary, color: v.bgPrimary,
            border: 'none', borderRadius: v.radiusMd,
            fontSize: '14px', fontWeight: 500, fontFamily: v.fontSans,
            cursor: 'pointer', letterSpacing: '-0.01em',
          }}
        >
          Book your Reveal
        </button>
      </div>
    );
  }

  // ── Aligned / too-low / has-room states ─────────────────────────────────────
  const colors  = STATE_COLORS[state];
  const content = STATE_CONTENT[state];
  const Icon    = STATE_ICONS[state];

  return (
    <div style={{
      background: colors.bg,
      border: `0.5px solid ${colors.border}`,
      borderRadius: v.radiusLg,
      padding: '16px',
      marginBottom: '28px',
    }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div style={{ flexShrink: 0, marginTop: '1px' }}>
          <Icon color={colors.icon} />
        </div>
        <p style={{
          fontSize: '14px', fontWeight: 600,
          color: colors.label, margin: 0, lineHeight: 1.3,
        }}>
          {content.label}
        </p>
      </div>
      <p style={{
        fontSize: '13px', color: v.textSecondary,
        margin: '0 0 0 28px', lineHeight: 1.6,
      }}>
        {content.subtext}
      </p>
    </div>
  );
}

// ─── Design fee section ───────────────────────────────────────────────────────

function DesignFees({ constructionLow, constructionHigh }) {
  const designLow  = roundTo(constructionLow  * 0.08, 500);
  const designHigh = roundTo(constructionHigh * 0.10, 500);
  const fullLow    = roundTo(constructionLow  * 0.12, 500);
  const fullHigh   = roundTo(constructionHigh * 0.15, 500);

  const rowStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: '10px 14px',
  };
  const labelStyle = { fontSize: '13px', color: v.textSecondary };
  const priceStyle = { fontSize: '13px', color: v.textPrimary, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', paddingLeft: '12px' };

  return (
    <div>
      <p style={{
        fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: v.textTertiary, margin: '0 0 8px',
      }}>
        Typical full-service design fees
      </p>
      <p style={{ fontSize: '13px', color: v.textSecondary, lineHeight: 1.55, margin: '0 0 14px' }}>
        If you decide to work with a full-service interior designer or design-build firm,
        here&rsquo;s what you&rsquo;d typically expect to pay in the Seattle market &mdash;
        separate from and in addition to construction costs.
      </p>

      <div style={{
        border: `0.5px solid ${v.borderTertiary}`,
        borderRadius: v.radiusMd, overflow: 'hidden', marginBottom: '12px',
      }}>
        <div style={{ ...rowStyle, borderBottom: `0.5px solid ${v.borderTertiary}`, background: v.bgSecondary }}>
          <span style={labelStyle}>Design services</span>
          <span style={priceStyle}>{formatRange(designLow, designHigh)}</span>
        </div>
        <div style={{ ...rowStyle, background: v.bgSecondary }}>
          <span style={labelStyle}>Design + construction admin</span>
          <span style={priceStyle}>{formatRange(fullLow, fullHigh)}</span>
        </div>
      </div>

      <p style={{ fontSize: '11px', color: v.textTertiary, lineHeight: 1.6, margin: '0 0 16px' }}>
        Design fees vary widely based on scope, firm size, and how involved your designer is
        during construction. Some firms charge hourly, others charge a flat fee or a percentage
        of construction. These ranges reflect full-service residential design in the
        Seattle/Eastside market.
      </p>

      {/* Premodel callout */}
      <div style={{
        background: '#fdf7ef',
        border: '0.5px solid rgba(133, 79, 11, 0.12)',
        borderRadius: v.radiusMd,
        padding: '14px 16px',
      }}>
        <p style={{ fontSize: '13px', color: v.textSecondary, lineHeight: 1.65, margin: 0 }}>
          Premodel is not a full-service design firm. Our Reality Check and Reality Check Plus
          services are pre-construction visualization tools &mdash; designed to help you make
          better decisions before you hire a designer or contractor. If your project needs
          full-service design support, we&rsquo;re happy to connect you with vetted designers
          in our network.
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EstimatePanel({ rooms = [], remodel_type = 'cosmetic_pull', budget = 'not_sure', onBookReveal }) {
  const table      = CONSTRUCTION_COSTS[remodel_type] ?? CONSTRUCTION_COSTS.cosmetic_pull;
  const validRooms = rooms.filter(r => !!table[r]);

  if (!validRooms.length) return null;

  // Sum construction cost ranges — no discounts, no anchor logic
  let rawLow = 0, rawHigh = 0;
  validRooms.forEach(r => {
    rawLow  += table[r].low;
    rawHigh += table[r].high;
  });
  const constructionLow  = roundTo(rawLow,  1000);
  const constructionHigh = roundTo(rawHigh, 1000);
  const budgetState      = getBudgetState(constructionLow, constructionHigh, budget);

  const dividerStyle = {
    borderTop: `0.5px solid ${v.borderTertiary}`,
  };

  return (
    <div style={{ fontFamily: v.fontSans, color: v.textPrimary, WebkitFontSmoothing: 'antialiased' }}>

      {/* ── Construction cost panel ──────────────────────────────────────────── */}
      <div style={{
        border: `0.5px solid ${v.borderSecondary}`,
        borderRadius: v.radiusLg,
        overflow: 'hidden',
        marginBottom: '16px',
      }}>

        {/* Header */}
        <div style={{
          padding: '14px 18px 12px',
          background: v.bgSecondary,
          ...dividerStyle,
          borderTop: 'none',
          borderBottom: `0.5px solid ${v.borderTertiary}`,
        }}>
          <p style={{
            fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: v.textTertiary, margin: '0 0 2px',
          }}>
            Estimated construction cost
          </p>
          <p style={{ fontSize: '11px', color: v.textTertiary, margin: 0 }}>
            Seattle / Eastside market, 2026
          </p>
        </div>

        {/* Big number */}
        <div style={{
          padding: '24px 18px 20px',
          textAlign: 'center',
          borderBottom: `0.5px solid ${v.borderTertiary}`,
          background: v.bgPrimary,
        }}>
          <p style={{
            fontSize: '38px', fontWeight: 500, letterSpacing: '-0.03em',
            lineHeight: 1, color: v.textPrimary, margin: 0,
          }}>
            {formatRange(constructionLow, constructionHigh)}
          </p>
        </div>

        {/* Room breakdown */}
        <div style={{ background: v.bgPrimary }}>
          {validRooms.map((room, i) => (
            <div key={room} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: '9px 18px',
              borderBottom: i < validRooms.length - 1
                ? `0.5px solid ${v.borderTertiary}` : 'none',
            }}>
              <span style={{ fontSize: '13px', color: v.textSecondary }}>
                {ROOM_LABELS[room] ?? room}
              </span>
              <span style={{
                fontSize: '13px', color: v.textSecondary,
                fontVariantNumeric: 'tabular-nums', paddingLeft: '12px', whiteSpace: 'nowrap',
              }}>
                {formatRange(table[room].low, table[room].high)}
              </span>
            </div>
          ))}
        </div>

        {/* Total row — only shown when multiple rooms are selected */}
        {validRooms.length > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '11px 18px',
            borderTop: `0.5px solid ${v.borderSecondary}`,
            background: v.bgSecondary,
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: v.textPrimary }}>
              Total
            </span>
            <span style={{
              fontSize: '13px', fontWeight: 600, color: v.textPrimary,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatRange(constructionLow, constructionHigh)}
            </span>
          </div>
        )}

        {/* Caveats */}
        <div style={{
          padding: '12px 18px',
          borderTop: `0.5px solid ${v.borderTertiary}`,
          background: v.bgSecondary,
        }}>
          <p style={{ fontSize: '11px', color: v.textTertiary, lineHeight: 1.65, margin: '0 0 6px' }}>
            These are construction costs only &mdash; what you pay your contractor. They reflect
            typical ranges for the Seattle/Eastside market in 2026 and assume standard conditions.
            Older homes, low ceiling heights, moisture issues, or structural surprises can push
            costs higher. A final estimate requires bids from licensed contractors.
          </p>
          <p style={{ fontSize: '11px', color: v.textTertiary, lineHeight: 1.65, margin: 0 }}>
            Eastside homes (Bellevue, Kirkland, Redmond) typically run 10&ndash;15% above
            Seattle city averages.
          </p>
        </div>
      </div>

      {/* ── Budget comparison ─────────────────────────────────────────────────── */}
      <BudgetComparison
        state={budgetState}
        onBookReveal={onBookReveal}
      />

      {/* ── Design fees ──────────────────────────────────────────────────────── */}
      <DesignFees
        constructionLow={constructionLow}
        constructionHigh={constructionHigh}
      />

    </div>
  );
}

export default EstimatePanel;
