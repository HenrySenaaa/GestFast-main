// lib/export.js - Exportação real de relatórios em XLSX e PDF (RF 14), sem dependências externas
const zlib = require('zlib');

// ---------------------------------------------------------------- ZIP / XLSX
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const locais = [], centrais = [];
  let offset = 0;
  for (const f of files) {
    const nome = Buffer.from(f.name, 'utf8');
    const dados = Buffer.from(f.data, 'utf8');
    const comp = zlib.deflateRawSync(dados);
    const crc = crc32(dados);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(dados.length, 22);
    lh.writeUInt16LE(nome.length, 26); lh.writeUInt16LE(0, 28);
    locais.push(lh, nome, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(dados.length, 24);
    ch.writeUInt16LE(nome.length, 28); ch.writeUInt32LE(offset, 42);
    centrais.push(ch, nome);
    offset += lh.length + nome.length + comp.length;
  }
  const cd = Buffer.concat(centrais);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, cd, end]);
}

const xmlEsc = s => String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]))
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function colLetra(i) {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

// estilos: 0 padrão, 1 cabeçalho, 2 moeda, 3 inteiro, 4 decimal, 5 título, 6 negrito
const ESTILO_FMT = { money: 2, int: 3, dec: 4 };

function sheetXml(sheet) {
  const { title, subtitle, columns, rows } = sheet;
  let r = 1;
  const linhas = [];
  const cel = (c, ri, v, s) => typeof v === 'number' && Number.isFinite(v)
    ? `<c r="${colLetra(c)}${ri}" s="${s}"><v>${v}</v></c>`
    : `<c r="${colLetra(c)}${ri}" s="${s === 2 || s === 3 || s === 4 ? 0 : s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v ?? '')}</t></is></c>`;
  if (title) linhas.push(`<row r="${r}">${cel(0, r, title, 5)}</row>`), r++;
  if (subtitle) linhas.push(`<row r="${r}">${cel(0, r, subtitle, 0)}</row>`), r++;
  if (title || subtitle) r++;
  const hdr = r;
  linhas.push(`<row r="${r}">${columns.map((c, i) => cel(i, r, c.label, 1)).join('')}</row>`); r++;
  for (const row of rows) {
    linhas.push(`<row r="${r}">${columns.map((c, i) => cel(i, r, row[i], row.__bold ? 6 : (ESTILO_FMT[c.fmt] || 0))).join('')}</row>`);
    r++;
  }
  const cols = columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 16}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${hdr}" topLeftCell="A${hdr + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${linhas.join('')}</sheetData></worksheet>`;
}

function buildXlsx(sheets) {
  const nomes = sheets.map((s, i) => xmlEsc((s.name || `Planilha${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)));
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00"/><numFmt numFmtId="165" formatCode="#,##0.###"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F2429"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) }))
  ];
  return zip(files);
}

// ---------------------------------------------------------------- PDF
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const base = ch => ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function largura(texto, size, bold) {
  let w = 0;
  for (const ch of base(String(texto))) {
    const c = ch.charCodeAt(0);
    w += (c >= 32 && c <= 126 ? HELV[c - 32] : 556);
  }
  return (w / 1000) * size * (bold ? 1.07 : 1);
}
function cortar(texto, max, size, bold) {
  let t = String(texto ?? '');
  if (largura(t, size, bold) <= max) return t;
  while (t.length > 1 && largura(t + '...', size, bold) > max) t = t.slice(0, -1);
  return t + '...';
}
const pdfStr = s => {
  const b = Buffer.from(String(s).replace(/[^\u0000-\u00ff]/g, '?'), 'latin1');
  let out = '';
  for (const byte of b) {
    const ch = String.fromCharCode(byte);
    out += ch === '(' || ch === ')' || ch === '\\' ? '\\' + ch : (byte < 32 || byte > 126 ? '\\' + byte.toString(8).padStart(3, '0') : ch);
  }
  return out;
};

function buildPdf({ title, subtitle, sections, footer = 'GestFast', landscape = false }) {
  const W = landscape ? 842 : 595, H = landscape ? 595 : 842, M = 36;
  const paginas = [];
  let ops = [], y = 0;
  const nova = () => { if (ops.length) paginas.push(ops.join('\n')); ops = []; y = H - M; };
  const txt = (x, yy, s, size = 9, bold = false, cor = '0 0 0') =>
    ops.push(`BT ${cor} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td (${pdfStr(s)}) Tj ET`);
  const rect = (x, yy, w, h, cor) => ops.push(`${cor} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  nova();
  rect(0, H - 56, W, 56, '0.122 0.141 0.161');
  txt(M, H - 28, 'GEST', 18, true, '1 1 1');
  txt(M + 46, H - 28, 'FAST#', 18, true, '0.976 0.451 0.086');
  txt(M, H - 46, title, 11, false, '0.9 0.9 0.9');
  y = H - 56 - 22;
  if (subtitle) for (const l of [].concat(subtitle)) { txt(M, y, cortar(l, W - 2 * M, 9, false), 9, false, '0.3 0.3 0.3'); y -= 13; }
  y -= 6;
  for (const sec of sections) {
    const usable = W - 2 * M;
    const soma = sec.columns.reduce((a, c) => a + (c.w || 1), 0);
    const cols = sec.columns.map(c => ({ ...c, pw: usable * (c.w || 1) / soma }));
    const cabecalho = () => {
      rect(M, y - 4, usable, 16, '0.122 0.141 0.161');
      let x = M;
      for (const c of cols) {
        const t = cortar(c.label, c.pw - 8, 8, true);
        txt(c.align === 'right' ? x + c.pw - 4 - largura(t, 8, true) : x + 4, y, t, 8, true, '1 1 1');
        x += c.pw;
      }
      y -= 18;
    };
    if (y < 90) nova();
    if (sec.heading) { txt(M, y, sec.heading, 11, true); y -= 16; }
    cabecalho();
    sec.rows.forEach((row, ri) => {
      if (y < M + 30) { nova(); y = H - M; cabecalho(); }
      if (ri % 2 === 0) rect(M, y - 4, usable, 14, '0.955 0.955 0.965');
      let x = M;
      cols.forEach((c, i) => {
        const bold = !!row.__bold;
        const t = cortar(row[i] ?? '', c.pw - 8, 8, bold);
        txt(c.align === 'right' ? x + c.pw - 4 - largura(t, 8, bold) : x + 4, y, t, 8, bold);
        x += c.pw;
      });
      y -= 14;
    });
    if (!sec.rows.length) { txt(M + 4, y, 'Nenhum registro.', 8); y -= 14; }
    y -= 14;
  }
  paginas.push(ops.join('\n'));
  const total = paginas.length;
  const conteudos = paginas.map((p, i) => p + `\nBT 0.4 0.4 0.4 rg /F1 8 Tf ${M} 20 Td (${pdfStr(footer)}) Tj ET\nBT 0.4 0.4 0.4 rg /F1 8 Tf ${W - M - 60} 20 Td (${pdfStr(`Página ${i + 1} de ${total}`)}) Tj ET`);

  const objs = [];
  const add = s => { objs.push(s); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(`<< /Type /Pages /Kids [${paginas.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${total} >>`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  conteudos.forEach((c, i) => {
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
    add(`<< /Length ${Buffer.byteLength(c, 'latin1')} >>\nstream\n${c}\nendstream`);
  });
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

module.exports = { buildXlsx, buildPdf };
