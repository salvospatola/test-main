import { SongCatalog } from './db.service.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_QUERY_CACHE = 256;
const queryCache = new Map();

const normalizeText = (value) => String(value || '').trim();
const normalizeTitle = (value) => normalizeText(value).toLowerCase();

const setBoundedCache = (cacheMap, key, value, maxEntries) => {
    if (cacheMap.has(key)) cacheMap.delete(key);
    cacheMap.set(key, value);
    while (cacheMap.size > maxEntries) {
        const oldestKey = cacheMap.keys().next().value;
        cacheMap.delete(oldestKey);
    }
};

const cachedQuery = (queryKey) => {
    const cached = queryCache.get(queryKey);
    if (!cached) return null;
    if ((Date.now() - cached.cachedAt) > CACHE_TTL_MS) {
        queryCache.delete(queryKey);
        return null;
    }
    queryCache.delete(queryKey);
    queryCache.set(queryKey, cached);
    return cached.items;
};

const clearSongSearchCache = () => {
    queryCache.clear();
};

export const upsertSongsToCatalog = async (rawSongs = []) => {
    const songs = (Array.isArray(rawSongs) ? rawSongs : [])
        .map((song) => ({
            number: normalizeText(song?.number),
            title: normalizeText(song?.title),
            normalizedTitle: normalizeTitle(song?.title)
        }))
        .filter((song) => song.title && song.normalizedTitle);

    if (songs.length === 0) return;

    const bulkOps = songs.map((song) => ({
        updateOne: {
            filter: { normalizedTitle: song.normalizedTitle, number: song.number || '' },
            update: {
                $setOnInsert: {
                    title: song.title,
                    normalizedTitle: song.normalizedTitle,
                    number: song.number || ''
                },
                $set: {
                    title: song.title,
                    lastUsedAt: new Date()
                },
                $inc: { usageCount: 1 }
            },
            upsert: true
        }
    }));

    await SongCatalog.bulkWrite(bulkOps, { ordered: false });
    clearSongSearchCache();
};

export const searchSongs = async (rawQuery, limit = 20) => {
    const query = normalizeText(rawQuery);
    if (query.length < 2) return [];
    const normalizedLimit = Number.isFinite(Number(limit))
        ? Math.max(1, Math.min(50, Number(limit)))
        : 20;

    const cacheKey = `${query.toLowerCase()}::${normalizedLimit}`;
    const cached = cachedQuery(cacheKey);
    if (cached) return cached;

    const q = query.toLowerCase();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');

    const results = await SongCatalog.find({
        $or: [
            { normalizedTitle: rx },
            { title: rx },
            { number: rx }
        ]
    })
        .sort({ usageCount: -1, lastUsedAt: -1, title: 1 })
        .limit(normalizedLimit)
        .select('number title');

    const mapped = results.map((song) => ({
        number: normalizeText(song.number),
        title: normalizeText(song.title),
        sourceUrl: ''
    }));

    setBoundedCache(queryCache, cacheKey, { cachedAt: Date.now(), items: mapped }, MAX_QUERY_CACHE);
    return mapped;
};

