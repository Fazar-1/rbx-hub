const https = require("https");
const fs = require("fs");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

function get(url, tries) {
  tries = tries || 3;
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { "User-Agent": UA, "Accept": "application/json" }, timeout: 25000 }, (res) => {
      let b = "";
      res.on("data", (d) => (b += d));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          if (tries > 1) return setTimeout(() => resolve(get(url, tries - 1)), 900);
          return resolve(null);
        }
        try { resolve(JSON.parse(b)); } catch (e) { resolve(null); }
      });
    });
    req.on("error", () => { if (tries > 1) setTimeout(() => resolve(get(url, tries - 1)), 900); else resolve(null); });
    req.on("timeout", () => { req.destroy(); if (tries > 1) setTimeout(() => resolve(get(url, tries - 1)), 900); else resolve(null); });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GENRE_MAP = {
  "Simulation": "Симулятор", "Roleplay": "RP", "Adventure": "Приключение",
  "Horror": "Выживание", "Action": "Экшен", "Strategy": "Стратегия",
  "Sports and Racing": "Спорт и гонки", "Shopping": "Магазин",
  "Puzzle": "Головоломка", "Party and Casual": "Вечеринка и казуал",
  "Obby": "Обби", "Shooter": "Шутер", "RPG": "RPG", "Survival": "Выживание",
  "Educational": "Другое", "Military": "Экшен", "Naval": "Другое",
  "Town and City": "RP", "Sci-Fi": "Другое", "Western": "Экшен",
  "Ninja": "Экшен", "Fighting": "Экшен", "Comedy": "Другое",
  "All": ""
};

const QUERIES = [
  "simulator", "obby", "adventure", "horror", "survival", "rpg", "tycoon",
  "tower defense", "shooter", "fighting", "parkour", "roleplay", "life",
  "racing", "soccer", "basketball", "fishing", "pet", "clicker", "escape",
  "steal", "battle", "escape room", "story", "anime", "dungeon", "city",
  "restaurant", "school", "police", "car", "plane", "farm", "survive",
  "mystery", "puzzle", "run", "battle royale", "zombie", "monster",
  "slap", "battles", "gym", "hotel", "train", "hospital", "sword",
  "punch", "hide", "find", "sniper", "murder", "sheriff", "candy",
  "food", "fashion", "dress", "avatar", "speed", "jump", "lava", "parkour",
  "minigames", "party", "quiz", "trivia", "bee", "dragon", "pokemon",
  "naruto", "jujutsu", "football", "volleyball", "boxing", "mma", "skate",
  "snow", "beach", "island", "space", "alien", "robot", "mine", "craft",
  "build", "buy", "sell", "rich", "money", "boss", "raid", "pvp", "ffa"
];

function pickGame(g) {
  return g && g.universeId && g.name && !g.isSponsored ? g : null;
}

async function main() {
  const pool = new Map();
  const sessionId = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  // 1) featured sorts
  const sortsUrl = "https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=" + sessionId + "&device=computer&country=all";
  const j = await get(sortsUrl);
  if (j && j.sorts) {
    for (const s of j.sorts) {
      if (s.contentType !== "Games" || !s.games) continue;
      for (const g of s.games) {
        const ok = pickGame(g);
        if (!ok) continue;
        const prev = pool.get(ok.universeId);
        if (!prev || (ok.playerCount || 0) > (prev.playerCount || 0)) pool.set(ok.universeId, ok);
      }
    }
  }
  console.log("after sorts:", pool.size);

  // 2) search across many queries, several pages each
  for (let qi = 0; qi < QUERIES.length; qi++) {
    const q = QUERIES[qi];
    let token = "";
    let pages = 0;
    let added = 0;
    while (pages < 8) {
      const url = "https://apis.roblox.com/search-api/omni-search?searchQuery=" + encodeURIComponent(q) +
        "&pageToken=" + encodeURIComponent(token) + "&sessionId=" + sessionId + "&pageType=all";
      const r = await get(url);
      pages++;
      if (!r || !r.searchResults) break;
      let rows = 0;
      for (const grp of r.searchResults) {
        if (grp.contentGroupType !== "Game" && grp.contentGroupType !== "Games") continue;
        for (const g of grp.contents || []) {
          const ok = pickGame(g);
          if (!ok) continue;
          rows++;
          const prev = pool.get(ok.universeId);
          if (!prev) added++;
          if (!prev || (ok.playerCount || 0) > (prev.playerCount || 0)) pool.set(ok.universeId, ok);
        }
      }
      if (!r.nextPageToken || rows === 0) break;
      token = r.nextPageToken;
      await sleep(220);
    }
    console.log("q[" + (qi + 1) + "/" + QUERIES.length + "] " + q + " +" + added + " total=" + pool.size);
    await sleep(120);
  }

  const ids = Array.from(pool.keys());
  console.log("unique:", ids.length);

  // 3) votes for accurate rating
  const votes = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50).join(",");
    const v = await get("https://games.roblox.com/v1/games/votes?universeIds=" + chunk);
    if (v && v.data) for (const x of v.data) votes.set(x.id, { up: x.upVotes || 0, down: x.downVotes || 0 });
    await sleep(160);
  }
  console.log("votes:", votes.size);

  const out = [];
  for (const [uid, g] of pool) {
    const v = votes.get(uid) || { up: g.totalUpVotes || 0, down: g.totalDownVotes || 0 };
    const total = v.up + v.down;
    let rating = total > 0 ? Math.round((v.up / total) * 50) / 10 : 0;
    if (rating > 5) rating = 5;
    let genre = GENRE_MAP[g.genreL1];
    if (genre == null || genre === "") genre = "Другое";
    out.push({
      n: String(g.name).trim().replace(/\s+/g, " "),
      g: genre,
      p: Number(g.playerCount) || 0,
      r: rating,
      u: uid,
      pl: Number(g.rootPlaceId) || 0
    });
  }

  out.sort((a, b) => b.p - a.p || b.r - a.r);
  fs.writeFileSync("games-full.json", JSON.stringify({ updated: new Date().toISOString().slice(0, 10), count: out.length, games: out }), "utf8");
  console.log("written:", out.length, "bytes:", fs.statSync("games-full.json").size);
  const byGenre = {};
  out.forEach((x) => (byGenre[x.g] = (byGenre[x.g] || 0) + 1));
  console.log("genres:", JSON.stringify(byGenre));
  console.log("withPlayers>0:", out.filter((x) => x.p > 0).length, "rated:", out.filter((x) => x.r > 0).length);
  console.log("top5:", out.slice(0, 5).map((x) => x.n + " " + x.p).join(" | "));
}

main().catch((e) => { console.error(e); process.exit(1); });
