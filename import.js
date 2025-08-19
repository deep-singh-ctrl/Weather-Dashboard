const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const csv = require("csv-parser");

// create sqlite database
const db = new sqlite3.Database("db.sqlite");

// create table
db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS cities`);
  db.run(`CREATE TABLE cities (
    city TEXT,
    city_ascii TEXT,
    lat REAL,
    lng REAL,
    country TEXT,
    iso2 TEXT,
    iso3 TEXT,
    admin_name TEXT,
    capital TEXT,
    population INTEGER,
    id INTEGER PRIMARY KEY
  )`);
});

// read csv and insert into db
fs.createReadStream("data/worldcities.csv")
  .pipe(csv())
  .on("data", (row) => {
    db.run(
      `INSERT INTO cities 
      (city, city_ascii, lat, lng, country, iso2, iso3, admin_name, capital, population, id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.city,
        row.city_ascii,
        row.lat,
        row.lng,
        row.country,
        row.iso2,
        row.iso3,
        row.admin_name,
        row.capital,
        row.population,
        row.id,
      ]
    );
  })
  .on("end", () => {
    console.log("CSV imported into SQLite!");
  });
