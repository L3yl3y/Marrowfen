const vm = require("vm");
const fs = require("fs");
const path = require("path");
const FILES = ["mapdata.js", "rules.js", "engine.js", "company.js", "synod.js", "covenant.js", "wayfarer.js", "bot.js"];
module.exports = function load(extra) {
  const ctx = { console: console, Math: Math, JSON: JSON };
  vm.createContext(ctx);
  FILES.concat(extra || []).forEach(f => {
    const p = path.join(__dirname, "..", "src", f);
    if (fs.existsSync(p)) {
      vm.runInContext(fs.readFileSync(p, "utf8"), ctx, { filename: f });
    }
  });
  return ctx;
};
module.exports.FILES = FILES;
