import { beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer;
let usingExternalMongo = false;

// Nutzt eine vorhandene MongoDB (MONGODB_URI), sonst In-Memory als Fallback.
beforeAll(async () => {
    const useExternalMongo = process.env.USE_EXTERNAL_MONGO_FOR_TESTS === '1';
    const externalUri = useExternalMongo ? process.env.MONGODB_URI : undefined;
    let uri = externalUri;

    if (!uri) {
        mongoServer = await MongoMemoryServer.create();
        uri = mongoServer.getUri();
        process.env.MONGODB_URI = uri;
    } else {
        usingExternalMongo = true;
    }

    // Verhindern von doppelten Verbindungen
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(uri);
    }
});

// Bereinigt die Datenbank nach jedem einzelnen Test (Isolation)
beforeEach(async () => {
    if (mongoose.connection.db) {
        const collections = await mongoose.connection.db.collections();
        for (let collection of collections) {
            await collection.deleteMany({});
        }
    }
});

// Stoppt die Datenbank und trennt die Verbindung nach Abschluss aller Tests
afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    if (!usingExternalMongo && mongoServer) {
        await mongoServer.stop();
    }
});
