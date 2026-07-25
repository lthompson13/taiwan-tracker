/**
 * Report generation — Word (.docx) and Excel (.xlsx).
 *
 * buildWordReport(bills)  → Buffer
 * buildExcelReport(bills) → Buffer
 *
 * Each bill object shape:
 * {
 *   billId, billName, status, category, sectors[], term, session,
 *   proposer, latestProgressDate, url,
 *   summary: string | null,
 *   annotation: { stance, priority, note, notifyEnabled },
 *   tags: [{ name }],
 *   hearings: [{ dates[], title, location, url }],
 * }
 */

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, PageBreak, ShadingType,
} = require('docx');
const ExcelJS = require('exceljs');

const NAVY  = '1A3A5C';
const TEAL  = '2A7F8E';
const GRAY  = 'F0F4F8';
const WHITE = 'FFFFFF';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDates(dates) {
  if (!dates || dates.length === 0) return '—';
  const fmt = (d) => {
    const [y, m, day] = d.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m,10)-1]} ${parseInt(day,10)}, ${y}`;
  };
  return dates.map(fmt).join(' – ');
}

function stanceLabel(s) {
  return { support: 'Support', oppose: 'Oppose', monitor: 'Monitor' }[s] || '—';
}
function priorityLabel(p) {
  return { high: 'High', medium: 'Medium', low: 'Low' }[p] || '—';
}

function kv(label, value) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, color: '4A5568' }),
      new TextRun({ text: value || '—', size: 20 }),
    ],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 22,
        color: NAVY,
        allCaps: true,
      }),
    ],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E0', space: 4 },
    },
  });
}

function ruled() {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0', space: 0 },
    },
  });
}

// ---------------------------------------------------------------------------
// Word document
// ---------------------------------------------------------------------------

function buildBillSection(bill, isLast) {
  const paras = [];

  // Bill name heading
  paras.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 100 },
      children: [
        new TextRun({
          text: bill.billName || bill.billId,
          color: NAVY,
          size: 28,
          bold: true,
        }),
      ],
    })
  );

  // Status banner
  if (bill.status) {
    paras.push(
      new Paragraph({
        spacing: { after: 120 },
        shading: { type: ShadingType.SOLID, color: GRAY },
        children: [
          new TextRun({ text: 'Status  ', bold: true, size: 20, color: '718096' }),
          new TextRun({ text: bill.status, size: 20, bold: true, color: NAVY }),
        ],
        indent: { left: 120, right: 120 },
        border: {
          top:    { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E0' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E0' },
          left:   { style: BorderStyle.SINGLE, size: 12, color: TEAL },
          right:  { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E0' },
        },
      })
    );
  }

  // Key facts
  paras.push(sectionHeading('Bill Details'));
  paras.push(kv('Bill ID', bill.billId));
  paras.push(kv('Committee', bill.category));
  paras.push(kv('Term / Session', `Term ${bill.term || '—'} · Session ${bill.session || '—'}`));
  paras.push(kv('Sectors', (bill.sectors || []).join(', ') || '—'));
  paras.push(kv('Proposer', bill.proposer));
  paras.push(kv('Latest Progress', bill.latestProgressDate));
  if (bill.url) {
    paras.push(kv('Source', bill.url));
  }

  // AI Summary
  paras.push(sectionHeading('Why It Matters'));
  paras.push(
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: bill.summary || 'No AI summary available for this bill.',
          size: 20,
          italics: !bill.summary,
          color: bill.summary ? '2D3748' : '718096',
        }),
      ],
    })
  );

  // Annotations
  paras.push(sectionHeading('Your Annotations'));
  paras.push(kv('Stance', stanceLabel(bill.annotation?.stance)));
  paras.push(kv('Priority', priorityLabel(bill.annotation?.priority)));
  paras.push(kv('Tags', (bill.tags || []).map((t) => t.name).join(', ') || '—'));
  if (bill.annotation?.note) {
    paras.push(
      new Paragraph({
        spacing: { before: 60, after: 100 },
        children: [
          new TextRun({ text: 'Note: ', bold: true, size: 20, color: '4A5568' }),
          new TextRun({ text: bill.annotation.note, size: 20, italics: true }),
        ],
      })
    );
  }

  // Hearings
  paras.push(sectionHeading('Hearings'));
  if (bill.hearings && bill.hearings.length > 0) {
    for (const h of bill.hearings) {
      paras.push(
        new Paragraph({
          spacing: { after: 60 },
          bullet: { level: 0 },
          children: [
            new TextRun({ text: fmtDates(h.dates), bold: true, size: 20 }),
            new TextRun({ text: h.title ? `  —  ${h.title}` : '', size: 20, color: '4A5568' }),
            h.location ? new TextRun({ text: `  ·  ${h.location}`, size: 20, color: '718096' }) : new TextRun(''),
          ],
        })
      );
    }
  } else {
    paras.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: 'No hearings on record.', size: 20, italics: true, color: '718096' })],
      })
    );
  }

  // Page break between bills (except last)
  if (!isLast) {
    paras.push(new Paragraph({ children: [new PageBreak()] }));
  }

  return paras;
}

async function buildWordReport(bills) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const coverParas = [
    new Paragraph({
      spacing: { before: 400, after: 120 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'BillScope Taiwan', bold: true, size: 48, color: NAVY })],
    }),
    new Paragraph({
      spacing: { after: 60 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Legislative Bill Report', size: 32, color: TEAL })],
    }),
    new Paragraph({
      spacing: { after: 400 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Generated ${today}  ·  ${bills.length} bill${bills.length !== 1 ? 's' : ''}`, size: 20, color: '718096' })],
    }),
    ruled(),
  ];

  const billSections = bills.flatMap((bill, i) => buildBillSection(bill, i === bills.length - 1));

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    sections: [
      {
        children: [...coverParas, ...billSections],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// Excel workbook
// ---------------------------------------------------------------------------

async function buildExcelReport(bills) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BillScope Taiwan';
  wb.created = new Date();

  // ── Sheet 1: Bills ─────────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Bills', { views: [{ state: 'frozen', ySplit: 1 }] });

  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + NAVY } };
  const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const ALT_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } };

  ws.columns = [
    { header: 'Bill Name',       key: 'billName',     width: 45 },
    { header: 'Status',          key: 'status',       width: 30 },
    { header: 'Committee',       key: 'category',     width: 28 },
    { header: 'Sectors',         key: 'sectors',      width: 30 },
    { header: 'Term',            key: 'term',         width: 8  },
    { header: 'Session',         key: 'session',      width: 10 },
    { header: 'Proposer',        key: 'proposer',     width: 30 },
    { header: 'Latest Progress', key: 'progressDate', width: 18 },
    { header: 'AI Summary',      key: 'summary',      width: 55 },
    { header: 'Stance',          key: 'stance',       width: 12 },
    { header: 'Priority',        key: 'priority',     width: 12 },
    { header: 'Note',            key: 'note',         width: 35 },
    { header: 'Tags',            key: 'tags',         width: 25 },
    { header: 'Bill ID',         key: 'billId',       width: 22 },
    { header: 'Source URL',      key: 'url',          width: 40 },
  ];

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', wrapText: false };
  });
  headerRow.height = 22;

  // Data rows
  bills.forEach((bill, idx) => {
    const row = ws.addRow({
      billName:     bill.billName || bill.billId,
      status:       bill.status || '—',
      category:     bill.category || '—',
      sectors:      (bill.sectors || []).join(', ') || '—',
      term:         bill.term || '—',
      session:      bill.session || '—',
      proposer:     bill.proposer || '—',
      progressDate: bill.latestProgressDate || '—',
      summary:      bill.summary || '',
      stance:       stanceLabel(bill.annotation?.stance),
      priority:     priorityLabel(bill.annotation?.priority),
      note:         bill.annotation?.note || '',
      tags:         (bill.tags || []).map((t) => t.name).join(', ') || '',
      billId:       bill.billId,
      url:          bill.url || '',
    });

    if (idx % 2 === 1) {
      row.eachCell((cell) => { cell.fill = ALT_FILL; });
    }
    row.alignment = { vertical: 'top', wrapText: true };

    // Hyperlink source URL
    if (bill.url) {
      const urlCell = row.getCell('url');
      urlCell.value = { text: bill.url, hyperlink: bill.url };
      urlCell.font = { color: { argb: 'FF' + TEAL }, underline: true };
    }
  });

  // ── Sheet 2: Hearings ──────────────────────────────────────────────────────
  const wh = wb.addWorksheet('Hearings', { views: [{ state: 'frozen', ySplit: 1 }] });

  wh.columns = [
    { header: 'Bill Name',  key: 'billName', width: 45 },
    { header: 'Date(s)',    key: 'dates',    width: 28 },
    { header: 'Title',      key: 'title',    width: 45 },
    { header: 'Location',   key: 'location', width: 22 },
    { header: 'LY Link',    key: 'url',      width: 40 },
  ];

  const hHeaderRow = wh.getRow(1);
  hHeaderRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle' };
  });
  hHeaderRow.height = 22;

  let hIdx = 0;
  for (const bill of bills) {
    if (!bill.hearings || bill.hearings.length === 0) continue;
    for (const h of bill.hearings) {
      const hRow = wh.addRow({
        billName: bill.billName || bill.billId,
        dates:    fmtDates(h.dates),
        title:    h.title || '—',
        location: h.location || '—',
        url:      h.url || '',
      });
      if (hIdx % 2 === 1) {
        hRow.eachCell((cell) => { cell.fill = ALT_FILL; });
      }
      if (h.url) {
        const hUrlCell = hRow.getCell('url');
        hUrlCell.value = { text: h.url, hyperlink: h.url };
        hUrlCell.font = { color: { argb: 'FF' + TEAL }, underline: true };
      }
      hIdx++;
    }
  }

  return wb.xlsx.writeBuffer();
}

module.exports = { buildWordReport, buildExcelReport };
