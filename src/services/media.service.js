import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOADS_ROOT = process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(process.cwd(), 'uploads');

const ALLOWED_EXT = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif'
};

const PUBLIC_PREFIX = '/uploads';

const sanitizeSegment = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'item';

const ensureDir = async (dir) => {
    await fs.mkdir(dir, { recursive: true });
};

const randomSuffix = () => crypto.randomBytes(6).toString('hex');

export const ensureUploadsRoot = async () => {
    await ensureDir(UPLOADS_ROOT);
};

export const saveImageBuffer = async ({
    buffer,
    mimeType = 'application/octet-stream',
    scope = 'misc',
    ownerId = 'global',
    variant = 'original',
    extension
}) => {
    if (!buffer || !Buffer.isBuffer(buffer)) throw new Error('Invalid image buffer');

    const ext = extension || ALLOWED_EXT[mimeType] || 'bin';
    const safeScope = sanitizeSegment(scope);
    const safeOwner = sanitizeSegment(ownerId);
    const safeVariant = sanitizeSegment(variant);
    const fileName = `${Date.now()}-${safeVariant}-${randomSuffix()}.${ext}`;

    const subDir = path.join(safeScope, safeOwner);
    const absDir = path.join(UPLOADS_ROOT, subDir);
    await ensureDir(absDir);

    const absPath = path.join(absDir, fileName);
    await fs.writeFile(absPath, buffer);

    return `${PUBLIC_PREFIX}/${subDir.replaceAll(path.sep, '/')}/${fileName}`;
};

export const isManagedUploadPath = (value) =>
    typeof value === 'string' && value.startsWith(`${PUBLIC_PREFIX}/`);

export const deleteByPublicPath = async (publicPath) => {
    if (!isManagedUploadPath(publicPath)) return;
    const relativePart = publicPath.slice(PUBLIC_PREFIX.length).replace(/^\/+/, '');
    const absPath = path.join(UPLOADS_ROOT, relativePart);
    try {
        await fs.unlink(absPath);
    } catch (_e) {
        // Ignore missing files and unlink races.
    }
};

export const getUploadsRoot = () => UPLOADS_ROOT;
