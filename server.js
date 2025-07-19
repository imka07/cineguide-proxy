// server.js
import express from 'express';
import fetch from 'node-fetch';
import NodeCache from 'node-cache';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();
const TMDB_KEY = process.env.TMDB_KEY;
const PORT    = process.env.PORT || 3000;
const TTL     = 24 * 3600;

const cache = new NodeCache({ stdTTL: TTL });
const app   = express();

app.use(cors());
app.use(express.json());

// --- Прокси для картинок TMDb ---
app.use(
  '/image',
  createProxyMiddleware({
    target: 'https://image.tmdb.org',
    changeOrigin: true,
    secure: true,
    pathRewrite: (path /* e.g. '/bptfVGE…jpg' */, req) => {
      const newPath = `/t/p/w500${path}`; // просто префикс + исходный путь
      console.log('🖼 proxy rewrite:', path, '→', newPath);
      return newPath;
    },
    onProxyReq: (_proxyReq, req) => {
      console.log('🖼 proxy to TMDb:', req.url);
    },
    onError: (err, _req, res) => {
      console.error('🚨 Image proxy error:', err.message);
      res.sendStatus(502);
    },
  })
);

// --- Корень ---
app.get('/', (_req, res) => {
  res.send('TMDb proxy is up');
});

// --- Жанры ---
app.get('/genre/movie/list', async (req, res) => {
  const key = 'genres';
  if (cache.has(key)) return res.json(cache.get(key));
  try {
    const resp = await fetch(
      `https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_KEY}&language=ru-RU`
    );
    const { genres } = await resp.json();
    cache.set(key, genres);
    res.json({ genres });
  } catch (e) {
    console.error('Genre error:', e);
    res.status(500).json({ error: 'Could not fetch genres' });
  }
});

// --- Discover ---
app.get('/discover/movie', async (req, res) => {
  const cacheKey = `discover_${JSON.stringify(req.query)}`;
  if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

  try {
    const qs = new URLSearchParams({
      api_key: TMDB_KEY,
      language: 'ru-RU',
      ...req.query,
    }).toString();
    const resp = await fetch(`https://api.themoviedb.org/3/discover/movie?${qs}`);
    const data = await resp.json();
    if (!Array.isArray(data.results)) {
      return res.status(502).json({ error: 'Invalid response from TMDb' });
    }
    cache.set(cacheKey, data);
    res.json(data);
  } catch (e) {
    console.error('Discover error:', e);
    res.status(500).json({ error: 'Could not fetch discover' });
  }
});

// --- Details ---
app.get('/movie/:id', async (req, res) => {
  const { id } = req.params;
  const key     = `movie_${id}`;
  if (cache.has(key)) return res.json(cache.get(key));

  try {
    const resp = await fetch(
      `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&language=ru-RU`
    );
    const data = await resp.json();
    cache.set(key, data);
    res.json(data);
  } catch (e) {
    console.error('Detail error:', e);
    res.status(500).json({ error: 'Could not fetch movie detail' });
  }
});

// --- Favorites utilities ---
const FAVORITES_FILE = './favorites.json';
const readFavorites = () => {
  if (!fs.existsSync(FAVORITES_FILE)) return {};
  return JSON.parse(fs.readFileSync(FAVORITES_FILE, 'utf-8'));
};
const writeFavorites = (data) => {
  fs.writeFileSync(FAVORITES_FILE, JSON.stringify(data, null, 2));
};

// --- Favorites endpoints ---
app.get('/favorites/:userId', (req, res) => {
  const all = readFavorites();
  res.json(all[req.params.userId] || []);
});

app.post('/favorites/:userId', (req, res) => {
  const userId = req.params.userId;
  const movie  = req.body;
  const all    = readFavorites();
  const map    = new Map((all[userId] || []).map(f => [f.id, f]));
  map.set(movie.id, movie);
  all[userId] = Array.from(map.values());
  writeFavorites(all);
  res.status(201).json({ success: true });
});

app.delete('/favorites/:userId/:movieId', (req, res) => {
  const { userId, movieId } = req.params;
  const all = readFavorites();
  all[userId] = (all[userId] || []).filter(m => String(m.id) !== movieId);
  writeFavorites(all);
  res.json({ success: true });
});

// --- Старт сервера ---
app.listen(PORT, () => {
  console.log(`🚀 Proxy listening on http://0.0.0.0:${PORT}`);
});
