const fs = require("fs");
const path = require("path");
const files = process.argv.slice(2);
let total = 0;
function strip(src) {
  let out = "";
  let i = 0;
  let lastSig = "";
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") { i++; }
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") { out += "\n"; } i++; }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      i++;
      while (i < src.length && src[i] !== q) { if (src[i] === "\\") { i++; } if (src[i] === "\n") { out += "\n"; } i++; }
      i++;
      out += '""';
      lastSig = '"';
      continue;
    }
    if (c === "/" && /[(,=:\[!&|?{};]|^$|return/.test(lastSig)) {
      i++;
      let cls = false;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "[") { cls = true; }
        if (src[i] === "]") { cls = false; }
        if (src[i] === "/" && !cls) { break; }
        i++;
      }
      i++;
      while (/[a-z]/.test(src[i] || "")) { i++; }
      out += "R";
      lastSig = "R";
      continue;
    }
    out += c;
    if (!/\s/.test(c)) {
      lastSig = c;
      if (/[a-z]/.test(c)) {
        const m = out.match(/return$/);
        if (m) { lastSig = "return"; }
      }
    }
    i++;
  }
  return out;
}
files.forEach(f => {
  const src = fs.readFileSync(f, "utf8");
  const code = strip(src);
  const lines = code.split("\n");
  lines.forEach((line, k) => {
    const t = line.replace(/\?\?|\?\./g, "");
    if (t.indexOf("?") >= 0) {
      total++;
      console.log(path.basename(f) + ":" + (k + 1) + ": ternary: " + src.split("\n")[k].trim().slice(0, 120));
    }
    const s = line.trim();
    if (/^[^(=]*&&/.test(s) && /;$/.test(s) && !/^(if|else|return|var|let|const|while|for|\}|case)\b/.test(s) && !/^[|&]/.test(s)) {
      total++;
      console.log(path.basename(f) + ":" + (k + 1) + ": && statement: " + src.split("\n")[k].trim().slice(0, 120));
    }
  });
});
console.log("lint findings", total);
