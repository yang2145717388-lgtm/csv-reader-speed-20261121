// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
// Same answers as readCsv, byte for byte, on every input; written for speed:
// - unquoted fields: two indexOf scans find the next delimiter (',' / LF),
//   the field is a slice, never built a character at a time; a stray CR
//   inside the slice is found with one bounded indexOf and handled on the
//   spot (no per-field regex match allocation);
// - quoted fields: indexOf jumps to the closing quote; the content is a slice
//   unless it holds doubled quotes or line breaks (then one targeted pass);
// - no per-character loop on the common path.
const CRLF_RE = /[\r\n]/;

// ended: 0 = comma, 1 = line break, 2 = end of text.
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = 0;
  let line = 1;
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  // Unquoted field starting at pos, appending onto `value`.
  // Returns { value, ended, added }; ended 0 comma, 1 line break, 2 end.
  // `added` counts the characters kept during this call (stray CRs are dropped).
  // Delimiters are found with indexOf (no per-field regex match allocation).
  function readUnquoted(value) {
    let added = 0;
    while (pos < len) {
      const cComma = text.indexOf(',', pos);
      const cLF = text.indexOf('\n', pos);
      let end = len;
      let kind = 2;
      if (cComma !== -1 && cComma < end) {
        end = cComma;
        kind = 0;
      }
      if (cLF !== -1 && cLF < end) {
        end = cLF;
        kind = 1;
      }
      const seg = text.slice(pos, end);
      const cr = seg.indexOf('\r');
      if (cr === -1) {
        if (end > pos) {
          value += seg;
          added += end - pos;
        }
        if (kind === 2) {
          pos = len;
          return { value, ended: 2, added };
        }
        if (kind === 0) {
          pos = end + 1;
          return { value, ended: 0, added };
        }
        pos = end + 1;
        line += 1;
        return { value, ended: 1, added };
      }
      if (cr === seg.length - 1 && kind === 1) {
        // CRLF: the CR sits right before the LF.
        if (cr > 0) {
          value += seg.slice(0, cr);
          added += cr;
        }
        pos = end + 1;
        line += 1;
        return { value, ended: 1, added };
      }
      // Stray CR outside quotes: dropped, error recorded, field goes on.
      if (cr > 0) {
        value += seg.slice(0, cr);
        added += cr;
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      pos = pos + cr + 1;
    }
    return { value, ended: 2, added };
  }

  // Quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    // Find the closing quote: the next '"' not followed by another '"'.
    // Track whether any doubled quote was seen on the way (hasDD).
    let q = pos;
    let closed = false;
    let hasDD = false;
    while (true) {
      q = text.indexOf('"', q);
      if (q === -1) break;
      if (text.charCodeAt(q + 1) === 34) {
        hasDD = true;
        q += 2;
        continue;
      }
      closed = true;
      break;
    }
    if (!closed) {
      // The quote never closes: literal character, text after it re-read unquoted.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      return readUnquoted('"');
    }
    const content = text.slice(pos, q);
    let value;
    if (!CRLF_RE.test(content)) {
      value = hasDD ? content.replaceAll('""', '"') : content;
    } else {
      // Normalise CRLF and lone CR to LF, counting each line break once.
      let out = '';
      let start = 0;
      let lineInc = 0;
      for (let i = 0; i < content.length; i++) {
        const ch = content.charCodeAt(i);
        if (ch === 13) {
          out += content.slice(start, i) + '\n';
          lineInc++;
          if (content.charCodeAt(i + 1) === 10) i++;
          start = i + 1;
        } else if (ch === 10) {
          lineInc++;
        }
      }
      out += content.slice(start);
      value = hasDD ? out.replaceAll('""', '"') : out;
      line += lineInc;
    }
    pos = q + 1;
    if (pos >= len) return { value, ended: 2 };
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      return { value, ended: 0 };
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      return { value, ended: 1 };
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return { value, ended: 1 };
    }
    // What follows the closing quote is appended as it stands.
    const junk = readUnquoted(value);
    if (junk.added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return junk;
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    // Fast path: a record with no quote and no stray CR is one split.
    // Find its line end; if no '"' falls before it, the line is complete.
    const nl = text.indexOf('\n', pos);
    const segEnd = nl === -1 ? len : nl;
    const qPos = text.indexOf('"', pos);
    if (qPos === -1 || qPos >= segEnd) {
      const seg = text.slice(pos, segEnd);
      const cr = seg.indexOf('\r');
      let fields = null;
      let recEnd = 2;
      let nextPos = len;
      if (cr === -1) {
        fields = seg.split(',');
        if (nl !== -1) {
          recEnd = 1;
          nextPos = nl + 1;
        }
      } else if (cr === seg.length - 1 && nl !== -1) {
        // Trailing CR right before the LF: a CRLF line ending.
        fields = seg.slice(0, -1).split(',');
        recEnd = 1;
        nextPos = nl + 1;
      }
      if (fields !== null) {
        recordLine = line;
        recordRow = header && columns === null ? null : rows.length;
        if (width < 0) width = fields.length;
        if (header && columns === null) {
          columns = fields;
        } else {
          if (fields.length < width) {
            errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
            while (fields.length < width) fields.push('');
          } else if (fields.length > width) {
            errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
          }
          rows.push(fields);
        }
        if (recEnd === 1) line += 1;
        pos = nextPos;
        continue;
      }
      // A stray CR sits in the record: fall through to the slow path.
    }

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === 0);

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
