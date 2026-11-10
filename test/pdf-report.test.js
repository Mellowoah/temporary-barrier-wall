/* Seeds sample barrier-wall fails (with JPEG photos) and checks the PDF.
   Run: node test/pdf-report.test.js
   No network and no extra packages. */
"use strict";
var assert = require("assert");
var fs = require("fs");
var path = require("path");
var execFileSync = require("child_process").execFileSync;
var TBW = require("../pdf-report.js");

/* 2x2 red JPEG, written by Pillow. Small on purpose so 18 copies stay tiny. */
var TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDmqKKK8w+4P//Z",
  "base64"
);

function pageCount(bytes) {
  var text = Buffer.from(bytes).toString("latin1");
  var n = text.match(/\/Type \/Page(?!s)/g);
  return n ? n.length : 0;
}

var info = TBW.jpegInfo(TINY_JPEG);
assert.ok(info && info.width === 2 && info.height === 2, "sample jpeg should be 2x2");

var fails = [];
for (var i = 0; i < 18; i++) {
  fails.push({
    jpeg: TINY_JPEG,
    staText: "Sta 1923+12.50",
    unitText: "Lot 1 | Unit " + (i + 1),
    defectsText: 'Spall 6"+',
    sizeText: "6 in",
    locText: "Top",
    note: i === 0 ? "joint (north)" : "",
    priority: i === 2
  });
}
var built = TBW.pagesFromFails(fails, {section: "1923", dateText: "11/10/2026", name: "Aide"});
assert.strictEqual(built.pages.length, 18);
assert.strictEqual(built.truncated, false);
assert.strictEqual(built.pages[0].sectionLine, "Section 1923");
assert.strictEqual(built.pages[0].caption, "Photo 01 | Sta 1923+12.50");
assert.strictEqual(built.pages[17].caption, "Photo 18 | Sta 1923+12.50");
assert.strictEqual(built.pages[0].title, "TEMPORARY BARRIER WALL CHECK");
assert.ok(built.pages[2].details.some(function (d) { return d.indexOf("PRIORITY") === 0; }));

assert.strictEqual(TBW.sectionLine("Section 1923"), "Section 1923");
assert.strictEqual(TBW.photoCaption(0, "Sta 1923+12.50"), "Photo 01 | Sta 1923+12.50");
assert.strictEqual(TBW.pdfFilename("1923", "2026-11-10"), "barrier-wall-check-1923-2026-11-10.pdf");
assert.strictEqual(TBW.pdfFilename("Section 1923", "2026-11-10"), "barrier-wall-check-1923-2026-11-10.pdf");
assert.strictEqual(TBW.pdfFilename("NB outside wall", "2026-11-10"), "barrier-wall-check-nb-outside-wall-2026-11-10.pdf");

var bytes = TBW.buildPhotoPdf({pages: built.pages});
assert.strictEqual(Buffer.from(bytes.slice(0, 8)).toString("latin1"), "%PDF-1.4");
assert.ok(Buffer.from(bytes.slice(-6)).toString("latin1").indexOf("%%EOF") >= 0);
assert.strictEqual(pageCount(bytes), 18, "expected 18 letter pages");
var raw = Buffer.from(bytes).toString("latin1");
assert.ok(raw.indexOf("/MediaBox [0 0 612 792]") >= 0, "letter size");
assert.strictEqual((raw.match(/\/Filter \/DCTDecode/g) || []).length, 18);
["TEMPORARY BARRIER WALL CHECK", "Section 1923", "Photo 01 | Sta 1923+12.50", "Photo 18 | Sta 1923+12.50", "Date: 11/10/2026", "Name: Aide", "Lot 1 | Unit 1 | Spall 6\"+ | 6 in | Top", "PRIORITY - base unstable / rocking / shifted", "1 of 18", "18 of 18"].forEach(function (s) {
  assert.ok(raw.indexOf(s) >= 0, "missing text: " + s);
});
assert.ok(raw.indexOf("joint \\(north\\)") >= 0, "note with parentheses should be escaped, not dropped");

var blank = TBW.pagesFromFails([{staText: "Sta 20+05.00", unitText: "Unit 4", defectsText: "Crack through/at base"}], {section: "20", dateText: "01/02/2026", name: ""});
assert.strictEqual(blank.pages.length, 1);
assert.strictEqual(blank.pages[0].jpeg, null);
var blankPdf = TBW.buildPhotoPdf({pages: blank.pages});
var blankRaw = Buffer.from(blankPdf).toString("latin1");
assert.strictEqual(pageCount(blankPdf), 1);
assert.ok(blankRaw.indexOf("Photo 01 | Sta 20+05.00") >= 0);
assert.ok(blankRaw.indexOf("No photo stored") >= 0);
assert.ok(blankRaw.indexOf("Name: -") >= 0);

var many = [];
for (var j = 0; j < TBW.MAX_PHOTOS + 5; j++) many.push({jpeg: TINY_JPEG, staText: "Sta 10+00.00"});
var capped = TBW.pagesFromFails(many, {section: "10", dateText: "03/04/2026", name: "A"});
assert.strictEqual(capped.pages.length, TBW.MAX_PHOTOS);
assert.strictEqual(capped.truncated, true);
assert.strictEqual(capped.omitted, 5);
assert.strictEqual(pageCount(TBW.buildPhotoPdf({pages: capped.pages})), TBW.MAX_PHOTOS);

assert.throws(function () { TBW.buildPhotoPdf({pages: []}); });

var root = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
var sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
assert.ok(html.indexOf('src="pdf-report.js"') >= 0, "app should load the local PDF builder");
assert.ok(html.indexOf('id="pdf"') >= 0 && html.indexOf("Download PDF") >= 0);
assert.ok(html.indexOf('id="csv"') >= 0 && html.indexOf("Download CSV") >= 0);
assert.ok(html.indexOf('data-a="pdf"') >= 0, "history view should have a PDF button next to CSV");
assert.ok(html.indexOf('data-a="csv"') >= 0);
assert.ok(html.indexOf("saveCsv(buildCsv()") >= 0, "CSV download must stay wired");
assert.ok(html.indexOf("pagesFromFails") >= 0);
assert.ok(html.indexOf("navigator.share") >= 0);
assert.ok(html.indexOf("a.download=filename") >= 0, "share fallback is a blob download link");
assert.ok(sw.indexOf("tbw-v2") >= 0, "service worker cache version should be bumped");
assert.ok(sw.indexOf("pdf-report.js") >= 0, "service worker should precache the PDF builder");
assert.ok(!/cdn\.|unpkg|jsdelivr|cdnjs/i.test(html + "\n" + sw + "\n" + fs.readFileSync(path.join(root, "pdf-report.js"), "utf8")));

var inline = html.match(/<script>\r?\n([\s\S]*)<\/script>\s*<\/body>/);
assert.ok(inline, "inline app script");
var appPath = path.join(__dirname, ".app-syntax-check.js");
fs.writeFileSync(appPath, inline[1]);
execFileSync(process.execPath, ["--check", appPath]);
execFileSync(process.execPath, ["--check", path.join(root, "pdf-report.js")]);
fs.unlinkSync(appPath);

console.log("ok — 18-page sample PDF is " + bytes.length + " bytes; cap is " + TBW.MAX_PHOTOS + " photos");
