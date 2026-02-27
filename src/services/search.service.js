import { Channel, MusicPlan, Post, User } from './db.service.js';

const INDEXES = {
  users: 'portal_users',
  channels: 'portal_channels',
  posts: 'portal_posts',
  plans: 'portal_plans'
};

const isMeiliEnabled = () => (process.env.SEARCH_ENGINE || '').toLowerCase() === 'meilisearch' || Boolean(process.env.MEILI_URL);
const getMeiliBaseUrl = () => (process.env.MEILI_URL || 'http://meilisearch:7700').replace(/\/$/, '');
const getMeiliApiKey = () => process.env.MEILI_MASTER_KEY || process.env.MEILI_API_KEY || '';

const meiliRequest = async (path, options = {}, timeoutMs = 1200) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const apiKey = getMeiliApiKey();
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(`${getMeiliBaseUrl()}${path}`, { ...options, headers, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Meili ${res.status}: ${text}`);
    }
    if (res.status === 204) return null;
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
};

const ensureIndex = async (uid, primaryKey = 'id') => {
  try {
    await meiliRequest(`/indexes/${uid}`, { method: 'GET' });
  } catch {
    await meiliRequest('/indexes', { method: 'POST', body: JSON.stringify({ uid, primaryKey }) });
  }
};

const ensureIndexes = async () => {
  if (!isMeiliEnabled()) return false;
  await Promise.all(Object.values(INDEXES).map((uid) => ensureIndex(uid)));

  await meiliRequest(`/indexes/${INDEXES.users}/settings`, {
    method: 'PATCH',
    body: JSON.stringify({
      searchableAttributes: ['username', 'firstName', 'lastName', 'email', 'searchText'],
      displayedAttributes: ['id']
    })
  });
  await meiliRequest(`/indexes/${INDEXES.channels}/settings`, {
    method: 'PATCH',
    body: JSON.stringify({
      searchableAttributes: ['title', 'description', 'searchText'],
      displayedAttributes: ['id']
    })
  });
  await meiliRequest(`/indexes/${INDEXES.posts}/settings`, {
    method: 'PATCH',
    body: JSON.stringify({
      searchableAttributes: ['content', 'linkTitle', 'linkDescription', 'pollQuestion', 'pollOptions', 'searchText'],
      displayedAttributes: ['id']
    })
  });
  await meiliRequest(`/indexes/${INDEXES.plans}/settings`, {
    method: 'PATCH',
    body: JSON.stringify({
      searchableAttributes: ['Datum', 'Thema', 'Predigt', 'Leitung', 'TechnikPC', 'TechnikSound', 'Organisator', 'Anbetungsstunde', 'Klavier', 'Gitarre', 'Bass', 'Schlagzeug', 'Gesang1', 'Gesang2', 'searchText'],
      displayedAttributes: ['id']
    })
  });
  return true;
};

const toUserDoc = (user) => ({
  id: String(user._id),
  username: user.username || '',
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  email: user.email || '',
  searchText: [user.username, user.firstName, user.lastName, user.email].filter(Boolean).join(' ')
});

const toChannelDoc = (channel) => ({
  id: String(channel._id),
  title: channel.title || '',
  description: channel.description || '',
  searchText: [channel.title, channel.description].filter(Boolean).join(' ')
});

const toPostDoc = (post) => ({
  id: String(post._id),
  content: post.content || '',
  linkTitle: post.linkData?.title || '',
  linkDescription: post.linkData?.description || '',
  pollQuestion: post.poll?.question || '',
  pollOptions: Array.isArray(post.poll?.options) ? post.poll.options.map((o) => o.label).join(' ') : '',
  searchText: [post.content, post.linkData?.title, post.linkData?.description, post.poll?.question].filter(Boolean).join(' ')
});

const toPlanDoc = (plan) => ({
  id: String(plan._id),
  Datum: plan.Datum || '',
  Thema: plan.Thema || '',
  Predigt: plan.Predigt || '',
  Leitung: plan.Leitung || '',
  TechnikPC: plan.TechnikPC || '',
  TechnikSound: plan.TechnikSound || '',
  Organisator: plan.Organisator || '',
  Anbetungsstunde: plan.Anbetungsstunde || '',
  Klavier: plan.Klavier || '',
  Gitarre: plan.Gitarre || '',
  Bass: plan.Bass || '',
  Schlagzeug: plan.Schlagzeug || '',
  Gesang1: plan.Gesang1 || '',
  Gesang2: plan.Gesang2 || '',
  searchText: [plan.Datum, plan.Thema, plan.Predigt, plan.Leitung].filter(Boolean).join(' ')
});

const addDocuments = async (uid, documents) => {
  if (!documents.length) return;
  await meiliRequest(`/indexes/${uid}/documents`, {
    method: 'POST',
    body: JSON.stringify(documents)
  }, 2000);
};

const deleteDocument = async (uid, id) => {
  await meiliRequest(`/indexes/${uid}/documents/${id}`, { method: 'DELETE' }, 1000);
};

const reindexAll = async () => {
  if (!isMeiliEnabled()) return false;
  await ensureIndexes();
  const [users, channels, posts, plans] = await Promise.all([
    User.find({}).select('username firstName lastName email'),
    Channel.find({}).select('title description'),
    Post.find({}).select('content linkData poll'),
    MusicPlan.find({}).select('Datum Thema Predigt Leitung TechnikPC TechnikSound Organisator Anbetungsstunde Klavier Gitarre Bass Schlagzeug Gesang1 Gesang2')
  ]);
  await Promise.all([
    addDocuments(INDEXES.users, users.map(toUserDoc)),
    addDocuments(INDEXES.channels, channels.map(toChannelDoc)),
    addDocuments(INDEXES.posts, posts.map(toPostDoc)),
    addDocuments(INDEXES.plans, plans.map(toPlanDoc))
  ]);
  return true;
};

const upsertUserById = async (id) => {
  if (!isMeiliEnabled()) return;
  await ensureIndexes();
  const user = await User.findById(id).select('username firstName lastName email');
  if (!user) return deleteDocument(INDEXES.users, id);
  await addDocuments(INDEXES.users, [toUserDoc(user)]);
};

const upsertChannelById = async (id) => {
  if (!isMeiliEnabled()) return;
  await ensureIndexes();
  const channel = await Channel.findById(id).select('title description');
  if (!channel) return deleteDocument(INDEXES.channels, id);
  await addDocuments(INDEXES.channels, [toChannelDoc(channel)]);
};

const upsertPostById = async (id) => {
  if (!isMeiliEnabled()) return;
  await ensureIndexes();
  const post = await Post.findById(id).select('content linkData poll');
  if (!post) return deleteDocument(INDEXES.posts, id);
  await addDocuments(INDEXES.posts, [toPostDoc(post)]);
};

const upsertPlanById = async (id) => {
  if (!isMeiliEnabled()) return;
  await ensureIndexes();
  const plan = await MusicPlan.findById(id).select('Datum Thema Predigt Leitung TechnikPC TechnikSound Organisator Anbetungsstunde Klavier Gitarre Bass Schlagzeug Gesang1 Gesang2');
  if (!plan) return deleteDocument(INDEXES.plans, id);
  await addDocuments(INDEXES.plans, [toPlanDoc(plan)]);
};

const searchIds = async ({ query, limit = 8 }) => {
  if (!isMeiliEnabled()) return null;
  await ensureIndexes();
  const size = Math.min(Math.max(limit, 1), 20);

  const run = async (uid) => {
    const res = await meiliRequest(`/indexes/${uid}/search`, {
      method: 'POST',
      body: JSON.stringify({ q: query, limit: size })
    }, 1200);
    return Array.isArray(res?.hits) ? res.hits.map((hit) => String(hit.id)) : [];
  };

  const [users, channels, posts, plans] = await Promise.all([
    run(INDEXES.users),
    run(INDEXES.channels),
    run(INDEXES.posts),
    run(INDEXES.plans)
  ]);

  return { users, channels, posts, plans };
};

export default {
  isMeiliEnabled,
  ensureIndexes,
  reindexAll,
  upsertUserById,
  upsertChannelById,
  upsertPostById,
  upsertPlanById,
  searchIds
};
