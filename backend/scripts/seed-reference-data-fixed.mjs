
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(join(process.cwd(), 'package.json'));
const dotenv = require('dotenv');
const mongoose = require('mongoose');

for (const file of ['../.env', '.env']) {
  const path = resolve(file);
  if (existsSync(path)) dotenv.config({ path });
}

const folder = process.argv[2];
const apply = process.argv.includes('--apply');

if (!folder) {
  throw new Error('Provide the CSV folder path');
}

function readCsv(filename) {
  const path = join(folder, filename);

  if (!existsSync(path)) {
    throw new Error(`Missing file: ${filename}`);
  }

  const lines = readFileSync(path, 'utf8')
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/);

  const headers = lines.shift().split(',').map(x => x.trim());

  return lines.filter(Boolean).map(line => {
    const values = line.split(',').map(x => x.trim());
    return Object.fromEntries(
      headers.map((key, i) => [key, values[i] ?? ''])
    );
  });
}

const countries = readCsv('Countries.csv');
const cities = readCsv('Cities.csv');
const airports = readCsv('Airports.csv');
const attractions = readCsv('Attractions.csv');

const countryMap = new Map(countries.map(c => [c.code, c.name]));
const cityMap = new Map(cities.map(c => [c.city_id, c.name]));

function check(rows, key, name) {
  const values = rows.map(r => r[key]);

  if (values.some(v => !v) || new Set(values).size !== values.length) {
    throw new Error(`${name}: invalid or duplicate ${key}`);
  }
}

check(countries, 'code', 'Countries');
check(cities, 'city_id', 'Cities');
check(airports, 'iata_code', 'Airports');
check(attractions, 'attraction_id', 'Attractions');

for (const city of cities) {
  if (!countryMap.has(city.country_code)) {
    throw new Error(`Unknown country for city: ${city.city_id}`);
  }
}

for (const airport of airports) {
  const city = cities.find(c => c.city_id === airport.city_id);

  if (!city || city.country_code !== airport.country_code) {
    throw new Error(`Invalid airport city: ${airport.iata_code}`);
  }

  if (!/^[A-Z]{3}$/.test(airport.iata_code) || !airport.time_zone) {
    throw new Error(`Invalid airport: ${airport.iata_code}`);
  }
}

for (const attraction of attractions) {
  if (!cityMap.has(attraction.city_id)) {
    throw new Error(`Invalid attraction city: ${attraction.attraction_id}`);
  }
}

const mappedAirports = airports.map(a => ({
  code: a.iata_code,
  name: a.name,
  city: cityMap.get(a.city_id),
  country: countryMap.get(a.country_code),
  timeZone: a.time_zone
}));

console.log('Countries:', countries.length);
console.log('Cities:', cities.length);
console.log('Airports:', airports.length);
console.log('Attractions:', attractions.length);
console.log('Airport preview:', mappedAirports[0]);

if (!apply) {
  console.log('DRY RUN PASSED: nothing was written to MongoDB.');
  process.exit(0);
}

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI missing from environment');
}

await mongoose.connect(process.env.MONGODB_URI);

try {
  const db = mongoose.connection.db;

  async function upsert(collection, rows, key) {
    if (!rows.length) return;

    const operations = rows.map(row => ({
      updateOne: {
        filter: { [key]: row[key] },
        update: { $set: row },
        upsert: true
      }
    }));

    await db.collection(collection).bulkWrite(operations);
    console.log(`Imported ${rows.length} records into ${collection}`);
  }

  await upsert('countries', countries, 'code');
  await upsert('cities', cities, 'city_id');
  await upsert('attractions', attractions, 'attraction_id');
  await upsert('airports', mappedAirports, 'code');

  console.log('GEN-12 IMPORT COMPLETED');
} finally {
  await mongoose.disconnect();
}
