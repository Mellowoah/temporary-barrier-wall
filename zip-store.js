/* Store-only ZIP (no compression). Photos are already JPEG, so this just packs them.
   Offline, no dependencies. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBWZip = api;
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this), function () {
  "use strict";
  var CRC = null;
  function crcTable() {
    if (CRC) return CRC;
    CRC = new Uint32Array(256);
    var n, k, c;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      CRC[n] = c >>> 0;
    }
    return CRC;
  }
  function crc32(bytes) {
    var table = crcTable(), c = 0xFFFFFFFF, i;
    for (i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function u16(n) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
  function u32(n) { return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]); }
  function latin1(s) {
    var a = new Uint8Array(s.length), i;
    for (i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255;
    return a;
  }
  function concat(parts) {
    var n = 0, i, o = 0, out;
    for (i = 0; i < parts.length; i++) n += parts[i].length;
    out = new Uint8Array(n);
    for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }
  function asBytes(data) {
    if (!data) return new Uint8Array(0);
    if (data instanceof Uint8Array) return data;
    if (typeof data === "string") return latin1(data);
    return new Uint8Array(data);
  }
  function zipStore(files) {
    files = files || [];
    var locals = [], centrals = [], offset = 0, i;
    for (i = 0; i < files.length; i++) {
      var name = String(files[i].name || ("file-" + (i + 1))).replace(/[\\/]/g, "_");
      var nameBytes = latin1(name);
      var data = asBytes(files[i].data);
      var crc = crc32(data);
      var local = concat([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0),
        nameBytes, data
      ]);
      var central = concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length),
        u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
        nameBytes
      ]);
      locals.push(local);
      centrals.push(central);
      offset += local.length;
    }
    var cd = centrals.length ? concat(centrals) : new Uint8Array(0);
    var eocd = concat([
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(cd.length), u32(offset), u16(0)
    ]);
    return concat(locals.concat([cd, eocd]));
  }
  return {zipStore: zipStore, crc32: crc32};
});
