const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "index_src.html");
const db = path.join(root, "games-full.json");
const out = path.join(root, "ui", "index.html");

const tpl = fs.readFileSync(src, "utf8");
const raw = fs.readFileSync(db, "utf8");
const list = raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);

if (!tpl.includes("__GAMES__")) {
  console.error("placeholder __GAMES__ not found in index_src.html");
  process.exit(1);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, tpl.replace("__GAMES__", list), "utf8");

const count = JSON.parse(list).length;
console.log("ui/index.html written, games:", count);
