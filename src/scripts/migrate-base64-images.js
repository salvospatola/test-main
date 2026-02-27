import mongoose from 'mongoose';
import { connectDB, Post, User } from '../services/db.service.js';
import { ensureUploadsRoot, saveImageBuffer } from '../services/media.service.js';

const args = process.argv.slice(2);
const isDryRun = !args.includes('--write');
const batchSize = (() => {
    const idx = args.findIndex((a) => a === '--batch-size');
    if (idx === -1) return 100;
    const raw = Number.parseInt(args[idx + 1], 10);
    return Number.isInteger(raw) && raw > 0 ? raw : 100;
})();

const dataUrlRegex = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

const parseDataUrl = (value) => {
    if (typeof value !== 'string') return null;
    const match = value.match(dataUrlRegex);
    if (!match) return null;
    const mimeType = match[1];
    const base64Payload = match[2];
    try {
        const buffer = Buffer.from(base64Payload, 'base64');
        if (!buffer || buffer.length === 0) return null;
        return { mimeType, buffer };
    } catch (_e) {
        return null;
    }
};

const migrateUsers = async () => {
    const cursor = User.find({}, { profileImage: 1, optimizedProfileImage: 1 }).cursor();
    const updates = [];
    let scanned = 0;
    let converted = 0;

    for await (const user of cursor) {
        scanned += 1;
        const setOps = {};

        for (const [field, variant] of [
            ['profileImage', 'original'],
            ['optimizedProfileImage', 'optimized']
        ]) {
            const parsed = parseDataUrl(user[field]);
            if (!parsed) continue;

            converted += 1;
            if (!isDryRun) {
                const storedPath = await saveImageBuffer({
                    buffer: parsed.buffer,
                    mimeType: parsed.mimeType,
                    scope: 'profiles',
                    ownerId: user._id,
                    variant
                });
                setOps[field] = storedPath;
            }
        }

        if (!isDryRun && Object.keys(setOps).length > 0) {
            updates.push({
                updateOne: {
                    filter: { _id: user._id },
                    update: { $set: setOps }
                }
            });
        }

        if (!isDryRun && updates.length >= batchSize) {
            await User.bulkWrite(updates);
            updates.length = 0;
        }
    }

    if (!isDryRun && updates.length > 0) {
        await User.bulkWrite(updates);
    }

    return { scanned, converted };
};

const migratePosts = async () => {
    const cursor = Post.find({}, { attachments: 1, optimizedAttachments: 1 }).cursor();
    const updates = [];
    let scanned = 0;
    let converted = 0;

    for await (const post of cursor) {
        scanned += 1;
        let touched = false;
        const setOps = {};

        const convertArray = async (source = [], variantPrefix) => {
            const next = [];
            for (let i = 0; i < source.length; i += 1) {
                const item = source[i];
                const parsed = parseDataUrl(item);
                if (!parsed) {
                    next.push(item);
                    continue;
                }
                converted += 1;
                touched = true;
                if (isDryRun) {
                    next.push(item);
                } else {
                    const storedPath = await saveImageBuffer({
                        buffer: parsed.buffer,
                        mimeType: parsed.mimeType,
                        scope: 'wall',
                        ownerId: post._id,
                        variant: `${variantPrefix}-${i}`
                    });
                    next.push(storedPath);
                }
            }
            return next;
        };

        const nextAttachments = await convertArray(post.attachments || [], 'original');
        const nextOptimized = await convertArray(post.optimizedAttachments || [], 'optimized');

        if (!isDryRun && touched) {
            setOps.attachments = nextAttachments;
            setOps.optimizedAttachments = nextOptimized;
            updates.push({
                updateOne: {
                    filter: { _id: post._id },
                    update: { $set: setOps }
                }
            });
        }

        if (!isDryRun && updates.length >= batchSize) {
            await Post.bulkWrite(updates);
            updates.length = 0;
        }
    }

    if (!isDryRun && updates.length > 0) {
        await Post.bulkWrite(updates);
    }

    return { scanned, converted };
};

const run = async () => {
    console.log(`Starting image migration (${isDryRun ? 'DRY-RUN' : 'WRITE'})...`);
    await connectDB();
    await ensureUploadsRoot();

    if (mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB connection is not ready.');
    }

    const userResult = await migrateUsers();
    const postResult = await migratePosts();

    console.log('--- Migration Summary ---');
    console.log(`Users scanned: ${userResult.scanned}, user image fields converted: ${userResult.converted}`);
    console.log(`Posts scanned: ${postResult.scanned}, post image entries converted: ${postResult.converted}`);
    console.log(`Mode: ${isDryRun ? 'DRY-RUN (no writes)' : 'WRITE (changes persisted)'}`);
};

run()
    .then(async () => {
        await mongoose.disconnect();
        process.exit(0);
    })
    .catch(async (err) => {
        console.error('Migration failed:', err);
        try {
            await mongoose.disconnect();
        } catch (_e) {}
        process.exit(1);
    });
