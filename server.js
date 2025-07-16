// server.js (в вашем прокси)
import express from 'express';
import fetch from 'node-fetch';
import NodeCache from 'node-cache';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const { TMDB_KEY, PORT = 3000 } = process.env;
const cache = new NodeCache({ stdTTL: 24 * 3600 });
const BASE = 'https://api.themoviedb.org/3';

const app = express();
app.use(cors());

// 1) Жанры
app.get('/genre/movie/list', async (req, res) => {
  const cacheKey = 'genres';
  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }
  const url = `${BASE}/genre/movie/list?api_key=${TMDB_KEY}&language=ru-RU`;
  const data = await (await fetch(url)).json();
  // data.genres — массив объектов { id, name }
  cache.set(cacheKey, data.genres);
  res.json(data.genres);
});

// 2) Discover
app.get('/discover/movie', async (req, res) => {
  const qs = new URLSearchParams({
    api_key: TMDB_KEY,
    language: 'ru-RU',
    ...req.query
  }).toString();
  const { results, total_pages } = await (await fetch(`${BASE}/discover/movie?${qs}`)).json();
  res.json({ results, total_pages });
});

// 3) Details
app.get('/movie/:id', async (req, res) => {
  const id = req.params.id;
  const url = `${BASE}/movie/${id}?api_key=${TMDB_KEY}&language=ru-RU`;
  const data = await (await fetch(url)).json();
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
