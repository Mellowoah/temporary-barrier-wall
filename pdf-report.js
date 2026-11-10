/* Offline photo report for the Temporary Barrier Wall check.
   No network. Standard fonts only. JPEG pages are letter size (612 x 792).
   Limits: at most MAX_PHOTOS pages, and each JPEG must be <= MAX_JPEG_BYTES
   (the app compresses anything larger before calling this). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBWPdf = api;
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this), function () {
  "use strict";
  var MAX_PHOTOS = 40;
  var MAX_JPEG_BYTES = 400000;
  var PAGE_W = 612;
  var PAGE_H = 792;
  /* Helvetica widths, glyph units of 1000, characters 32..126. */
  var WIDTHS = [
    278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
    1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,
    667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
    333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
    556,556,333,500,278,556,500,722,500,500,500,334,260,334,584
  ];

  function latin1(s) {
    var a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255;
    return a;
  }
  function concat(parts) {
    var n = 0, i, o = 0, out;
    for (i = 0; i < parts.length; i++) n += parts[i].length;
    out = new Uint8Array(n);
    for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }
  function n2(x) {
    var v = Math.round(x * 100) / 100;
    if (v === 0) v = 0;
    return String(v);
  }
  function pad10(n) {
    var s = String(n);
    while (s.length < 10) s = "0" + s;
    return s;
  }
  function pdfStr(s) {
    var map = {"\u2014": "-", "\u2013": "-", "\u2018": "'", "\u2019": "'", "\u201C": "\"", "\u201D": "\"", "\u2026": "..."};
    s = String(s == null ? "" : s).replace(/[^\x09\x0A\x0D\x20-\x7E]/g, function (ch) { return map[ch] || "?"; });
    return "(" + s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)") + ")";
  }
  function textWidth(s, size, bold) {
    var w = 0, i, c, u;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      u = (c >= 32 && c <= 126) ? WIDTHS[c - 32] : 556;
      w += u;
    }
    return (w / 1000) * size * (bold ? 1.08 : 1);
  }
  function wrapText(text, size, bold, maxW) {
    var words = String(text == null ? "" : text).split(/\s+/);
    var lines = [], cur = "", w, trial, buf, i, ch, next;
    function takeLong(word) {
      buf = "";
      for (i = 0; i < word.length; i++) {
        ch = word.charAt(i);
        next = buf + ch;
        if (buf && textWidth(next, size, bold) > maxW) { lines.push(buf); buf = ch; }
        else buf = next;
      }
      return buf;
    }
    for (w = 0; w < words.length; w++) {
      if (!words[w]) continue;
      trial = cur ? cur + " " + words[w] : words[w];
      if (textWidth(words[w], size, bold) > maxW && (!cur || textWidth(trial, size, bold) > maxW)) {
        if (cur) { lines.push(cur); cur = ""; }
        cur = takeLong(words[w]);
      } else if (cur && textWidth(trial, size, bold) > maxW) {
        lines.push(cur);
        cur = words[w];
      } else cur = trial;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function sectionLine(section) {
    var s = String(section == null ? "" : section).replace(/\s+/g, " ").trim();
    if (!s) return "Section -";
    if (/^section\b/i.test(s)) return s;
    return "Section " + s;
  }
  function metaLine(dateText, name) {
    return "Date: " + (dateText ? String(dateText) : "-") + "  |  Name: " + (name ? String(name) : "-");
  }
  function photoCaption(index, staText) {
    var n = String(index + 1);
    var sta = String(staText == null || staText === "" ? "Sta -" : staText).trim();
    if (n.length < 2) n = "0" + n;
    if (sta.indexOf("Sta") !== 0) sta = "Sta " + sta;
    return "Photo " + n + " | " + sta;
  }
  function pdfFilename(section, date) {
    var s = String(section == null ? "" : section).trim().toLowerCase();
    s = s.replace(/^section[\s._-]*/i, "");
    s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!s) s = "section";
    if (s.length > 48) s = s.slice(0, 48).replace(/-+$/g, "");
    var d = String(date == null ? "" : date).trim().replace(/[^0-9A-Za-z-]+/g, "");
    if (!d) d = "undated";
    return "barrier-wall-check-" + s + "-" + d + ".pdf";
  }
  function asBytes(jpeg) {
    if (!jpeg) return null;
    if (jpeg instanceof Uint8Array) return jpeg.length ? jpeg : null;
    if (typeof jpeg === "string") return null;
    if (jpeg.buffer && typeof jpeg.length === "number") return jpeg.length ? new Uint8Array(jpeg.buffer, jpeg.byteOffset || 0, jpeg.length) : null;
    return null;
  }
  /* Baseline / progressive JPEG size. Returns null if the bytes are not a JPEG. */
  function jpegInfo(jpeg) {
    var b = asBytes(jpeg);
    if (!b || b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return null;
    var i = 2, marker, len, h, w, comp;
    while (i + 1 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      marker = b[i + 1];
      while (marker === 0xFF && i + 2 < b.length) { i++; marker = b[i + 1]; }
      if (marker === 0xD9 || marker === 0xDA) break;
      if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
      if (i + 3 >= b.length) return null;
      len = (b[i + 2] << 8) + b[i + 3];
      if (len < 2 || i + 2 + len > b.length) return null;
      if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) || (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
        if (len < 8) return null;
        h = (b[i + 5] << 8) + b[i + 6];
        w = (b[i + 7] << 8) + b[i + 8];
        comp = b[i + 9];
        if (!w || !h || !comp) return null;
        return {width: w, height: h, components: comp};
      }
      i += 2 + len;
    }
    return null;
  }
  function colorSpace(comp) {
    if (comp === 1) return "DeviceGray";
    if (comp === 4) return "DeviceCMYK";
    return "DeviceRGB";
  }
  function pagesFromFails(fails, opts) {
    opts = opts || {};
    var list = Array.isArray(fails) ? fails : [];
    var max = opts.maxPages > 0 ? opts.maxPages : MAX_PHOTOS;
    var truncated = list.length > max;
    var used = list.slice(0, max);
    var sec = sectionLine(opts.section);
    var meta = metaLine(opts.dateText, opts.name);
    var pages = used.map(function (f, i) {
      f = f || {};
      var bits = [];
      if (f.unitText) bits.push(String(f.unitText));
      if (f.defectsText) bits.push(String(f.defectsText));
      if (f.sizeText) bits.push(String(f.sizeText));
      if (f.locText) bits.push(String(f.locText));
      var details = [];
      if (bits.length) details.push(bits.join(" | "));
      if (f.priority) details.push("PRIORITY - base unstable / rocking / shifted");
      if (f.note) details.push("Note: " + String(f.note));
      var jpeg = asBytes(f.jpeg);
      if (jpeg && jpeg.length > MAX_JPEG_BYTES) {
        jpeg = null;
        details.push("Photo was too large to embed.");
      }
      if (jpeg && !jpegInfo(jpeg)) {
        jpeg = null;
        details.push("Photo could not be read.");
      }
      return {
        title: "TEMPORARY BARRIER WALL CHECK",
        sectionLine: sec,
        meta: meta,
        caption: photoCaption(i, f.staText),
        details: details,
        jpeg: jpeg
      };
    });
    return {pages: pages, truncated: truncated, omitted: truncated ? list.length - max : 0};
  }

  function drawText(cmds, text, size, bold, x, y, color) {
    cmds.push("BT " + color + " " + (bold ? "/F2" : "/F1") + " " + n2(size) + " Tf 1 0 0 1 " + n2(x) + " " + n2(y) + " Tm " + pdfStr(text) + " Tj ET");
  }
  function drawCentered(cmds, text, size, bold, y, color) {
    drawText(cmds, text, size, bold, (PAGE_W - textWidth(text, size, bold)) / 2, y, color);
  }
  function pageContent(spec, pageNo, pageCount, imageName, info) {
    var M = 40;
    var maxW = PAGE_W - M * 2;
    var title = spec.title || "TEMPORARY BARRIER WALL CHECK";
    var sectionLines = wrapText(spec.sectionLine || "Section -", 14, true, maxW).slice(0, 3);
    var metaLines = wrapText(spec.meta || "", 11, false, maxW).slice(0, 2);
    var captionLines = wrapText(spec.caption || "", 13, true, maxW).slice(0, 2);
    var detailLines = [];
    var details = spec.details || [];
    var di, parts, pi, pri;
    for (di = 0; di < details.length && detailLines.length < 4; di++) {
      pri = String(details[di]).indexOf("PRIORITY") === 0;
      parts = wrapText(details[di], 10, false, maxW);
      for (pi = 0; pi < parts.length && detailLines.length < 4; pi++) {
        if (parts[pi]) detailLines.push({text: parts[pi], priority: pri});
      }
    }
    var captionLead = 16, detailLead = 13;
    var textH = captionLines.length * captionLead + detailLines.length * detailLead + 8;
    var y = 718;
    var sectionLead = 17;
    var afterSection = y - (sectionLines.length - 1) * sectionLead;
    var metaY = afterSection - 18;
    var afterMeta = metaY - Math.max(0, metaLines.length - 1) * 14;
    var photoTop = afterMeta - 14;
    var photoFloor = 40 + textH;
    var boxW = maxW, boxH = Math.max(160, photoTop - photoFloor);
    var cmds = [];
    cmds.push("0 0 0 rg");
    cmds.push("0 742 " + PAGE_W + " 50 re f");
    cmds.push("1 0.702 0 rg");
    cmds.push("0 734 " + PAGE_W + " 8 re f");
    drawCentered(cmds, title, 15, true, 760, "1 1 1 rg");
    var s;
    for (s = 0; s < sectionLines.length; s++) drawCentered(cmds, sectionLines[s], 14, true, y - s * sectionLead, "0 0 0 rg");
    for (s = 0; s < metaLines.length; s++) drawCentered(cmds, metaLines[s], 11, false, metaY - s * 14, "0.2 0.2 0.2 rg");
    var ix = M, iy = photoTop - boxH, iw = boxW, ih = boxH;
    if (info && imageName) {
      var sc = Math.min(boxW / info.width, boxH / info.height);
      iw = info.width * sc;
      ih = info.height * sc;
      ix = M + (boxW - iw) / 2;
      iy = photoTop - ih;
    }
    if (info && imageName) {
      cmds.push("q " + n2(iw) + " 0 0 " + n2(ih) + " " + n2(ix) + " " + n2(iy) + " cm /" + imageName + " Do Q");
    } else {
      cmds.push("0.93 0.93 0.91 rg");
      cmds.push(n2(ix) + " " + n2(iy) + " " + n2(iw) + " " + n2(ih) + " re f");
      drawCentered(cmds, "No photo stored", 14, false, iy + ih / 2 - 4, "0.35 0.35 0.35 rg");
    }
    cmds.push("1.25 w 0 0 0 RG");
    cmds.push(n2(ix) + " " + n2(iy) + " " + n2(iw) + " " + n2(ih) + " re S");
    var cy = iy - 20;
    for (s = 0; s < captionLines.length; s++) {
      drawCentered(cmds, captionLines[s], 13, true, cy, "0 0 0 rg");
      cy -= captionLead;
    }
    cy -= 2;
    for (s = 0; s < detailLines.length; s++) {
      drawCentered(cmds, detailLines[s].text, 10, false, cy, detailLines[s].priority ? "0.77 0 0 rg" : "0.15 0.15 0.15 rg");
      cy -= detailLead;
    }
    var foot = pageNo + " of " + pageCount;
    drawText(cmds, foot, 9, false, PAGE_W - M - textWidth(foot, 9, false), 22, "0.35 0.35 0.35 rg");
    return cmds.join("\n");
  }

  function buildPhotoPdf(doc) {
    var pages = (doc && doc.pages) || [];
    if (!pages.length) throw new Error("no pages");
    var pdf = {objs: []};
    function add(parts) { pdf.objs.push(parts); return pdf.objs.length; }
    function addStr(s) { return add([latin1(s)]); }
    var catalogId = addStr("");
    var pagesId = addStr("");
    var fontId = addStr("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    var boldId = addStr("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    var kids = [];
    var i, spec, info, imageId, content, contentId, pageId, resources, xobj;
    for (i = 0; i < pages.length; i++) {
      spec = pages[i] || {};
      info = spec.jpeg ? jpegInfo(spec.jpeg) : null;
      imageId = 0;
      if (info) {
        var header = "<< /Type /XObject /Subtype /Image /Width " + info.width + " /Height " + info.height +
          " /ColorSpace /" + colorSpace(info.components) + " /BitsPerComponent 8 /Filter /DCTDecode /Length " +
          spec.jpeg.length + " >>\nstream\n";
        imageId = add([latin1(header), spec.jpeg, latin1("\nendstream")]);
      }
      content = pageContent(spec, i + 1, pages.length, imageId ? "Im0" : "", info);
      contentId = add([latin1("<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream")]);
      resources = "<< /Font << /F1 " + fontId + " 0 R /F2 " + boldId + " 0 R >>";
      if (imageId) {
        xobj = " /XObject << /Im0 " + imageId + " 0 R >>";
        resources += xobj;
      }
      resources += " >>";
      pageId = addStr("<< /Type /Page /Parent " + pagesId + " 0 R /MediaBox [0 0 " + PAGE_W + " " + PAGE_H + "] /Resources " + resources + " /Contents " + contentId + " 0 R >>");
      kids.push(pageId + " 0 R");
    }
    var infoId = addStr("<< /Title (TEMPORARY BARRIER WALL CHECK) /Producer (Temporary Barrier Wall) /Creator (Temporary Barrier Wall) >>");
    pdf.objs[catalogId - 1] = [latin1("<< /Type /Catalog /Pages " + pagesId + " 0 R >>")];
    pdf.objs[pagesId - 1] = [latin1("<< /Type /Pages /Count " + pages.length + " /Kids [" + kids.join(" ") + "] >>")];

    var chunks = [latin1("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
    var offsets = [0];
    var pos = chunks[0].length;
    var oi, oj, head, tail, parts;
    for (oi = 0; oi < pdf.objs.length; oi++) {
      offsets.push(pos);
      head = latin1((oi + 1) + " 0 obj\n");
      tail = latin1("\nendobj\n");
      parts = [head].concat(pdf.objs[oi]).concat([tail]);
      for (oj = 0; oj < parts.length; oj++) { chunks.push(parts[oj]); pos += parts[oj].length; }
    }
    var xrefPos = pos;
    var xref = "xref\n0 " + (pdf.objs.length + 1) + "\n0000000000 65535 f \n";
    for (oi = 1; oi < offsets.length; oi++) xref += pad10(offsets[oi]) + " 00000 n \n";
    xref += "trailer\n<< /Size " + (pdf.objs.length + 1) + " /Root " + catalogId + " 0 R /Info " + infoId + " 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF\n";
    chunks.push(latin1(xref));
    return concat(chunks);
  }

  return {
    MAX_PHOTOS: MAX_PHOTOS,
    MAX_JPEG_BYTES: MAX_JPEG_BYTES,
    buildPhotoPdf: buildPhotoPdf,
    pagesFromFails: pagesFromFails,
    photoCaption: photoCaption,
    sectionLine: sectionLine,
    pdfFilename: pdfFilename,
    jpegInfo: jpegInfo
  };
});
