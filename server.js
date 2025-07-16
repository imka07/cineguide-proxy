
import express from 'express';
import fetch from 'node-fetch';
import NodeCache from 'node-cache';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const TMDB_KEY = process.env.TMDB_KEY;
const PORT = process.env.PORT || 3000;
const CACHE_TTL = 24 * 3600;

const cache = new NodeCache({ stdTTL: CACHE_TTL });
const app = express();

app.use(cors());

// Простой корень
app.get('/', (_req, res) => {
  res.send('TMDb proxy is up');
});

// Эндпоинт жанров
app.get('/genre/movie/list', async (req, res) => {
  const cacheKey = 'genres';
  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }
  try {
    const resp = await fetch(
      `https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_KEY}&language=ru-RU`
    );
    const data = await resp.json();
    // убедимся, что data.genres — массив
    const genres = Array.isArray(data.genres) ? data.genres : [];
    cache.set(cacheKey, genres);
    res.json({ genres });
  } catch (err) {
    console.error('Error fetching genres:', err);
    res.status(500).json({ error: 'Could not fetch genres' });
  }
});

// Эндпоинт discover
app.get('/discover/movie', async (req, res) => {
  // Логируем пришедшие query для отладки
  console.log('📡 /discover/movie query:', req.query);

  // Кэшировать на уровне полного URL
  const cacheKey = `discover_${JSON.stringify(req.query)}`;
  if (cache.has(cacheKey)) {
    console.log('↩️ Cache hit for', cacheKey);
    return res.json(cache.get(cacheKey));
  }

  try {
    const qs = new URLSearchParams({
      api_key: TMDB_KEY,
      language: 'ru-RU',
      ...req.query
    }).toString();
    const resp = await fetch(`https://api.themoviedb.org/3/discover/movie?${qs}`);
    const data = await resp.json();

    // проверяем, что ответ содержит массив results
    if (!Array.isArray(data.results)) {
      console.warn('⚠️ Unexpected data.results:', data.results);
      return res.status(502).json({ error: 'Invalid response from TMDb' });
    }

    // кэшируем и отдаем весь объект, чтобы клиент видел results и total_pages
    cache.set(cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error('Error fetching discover:', err);
    res.status(500).json({ error: 'Could not fetch discover' });
  }
});

// Эндпоинт details
app.get('/movie/:id', async (req, res) => {
  const id = req.params.id;
  const cacheKey = `movie_${id}`;
  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }
  try {
    const resp = await fetch(
      `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&language=ru-RU`
    );
    const data = await resp.json();
    cache.set(cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error('Error fetching movie detail:', err);
    res.status(500).json({ error: 'Could not fetch movie detail' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server listening on http://0.0.0.0:${PORT}`);
});
