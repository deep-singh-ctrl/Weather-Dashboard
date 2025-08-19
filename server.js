// server.js
const path = require("path");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

// Fallback fetch for Node < 18
const fetchFn = global.fetch
  ? global.fetch.bind(global)
  : (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database(path.join(__dirname, "db.sqlite"), (err) => {
  if (err) console.error("DB error:", err.message);
  else console.log("Connected to SQLite db.sqlite");
});

// Exact city lookup
app.get("/api/city/:name", (req, res) => {
  const name = req.params.name;
  db.get(
    `SELECT city, city_ascii, country, lat, lng FROM cities
     WHERE city_ascii = ? COLLATE NOCASE
     LIMIT 1`,
    [name],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "City not found" });
      res.json(row);
    }
  );
});

// Typeahead search: /api/search?q=del (returns up to 10 matches)
app.get("/api/search", (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);
  db.all(
    `SELECT city_ascii AS name, country, lat, lng
     FROM cities
     WHERE city_ascii LIKE ? COLLATE NOCASE
     ORDER BY population DESC NULLS LAST
     LIMIT 10`,
    [`${q}%`],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// Combined endpoint: /api/weather?city=Delhi
app.get("/api/weather", async (req, res) => {
  const city = (req.query.city || "").trim();
  if (!city) return res.status(400).json({ error: "Missing ?city=" });

  try {
    const coords = await new Promise((resolve, reject) => {
      db.get(
        `SELECT city_ascii AS name, country, lat, lng
         FROM cities
         WHERE city_ascii = ? COLLATE NOCASE
         LIMIT 1`,
        [city],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });

    if (!coords) return res.status(404).json({ error: "City not found" });

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current_weather=true`;
    console.log("Fetching weather for", coords.name, coords.country, "->", url);

    // Try fetch with per-attempt timeout and simple retries to handle transient network issues
    let resp;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s
      try {
        resp = await fetchFn(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!resp.ok) throw new Error(`Weather API error ${resp.status}`);
        break; // success
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn(`Fetch attempt ${attempt} failed:`, err && err.message ? err.message : err);
        if (attempt === maxAttempts) throw err; // rethrow after final attempt
        // backoff before retrying
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }

    const data = await resp.json();

    res.json({
      city: coords.name,
      country: coords.country,
      latitude: coords.lat,
      longitude: coords.lng,
      current_weather: data.current_weather,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running → http://localhost:${PORT}`));
