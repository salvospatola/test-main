import makeWASocket, { 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, 
    delay, 
    getAggregateVotesInPollMessage,
    Browsers,
    BufferJSON,
    initAuthCreds
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode';
import NodeCache from 'node-cache';
import { logSystem } from './log.service.js';
import { WhatsAppAuth, WhatsAppLog, GlobalSetting, User, Role, WhatsAppOutbox } from './db.service.js';
import emailService from './email.service.js';
import net from 'net';

const recordLog = async (level, type, event, message, details = {}) => {
    try {
        await WhatsAppLog.create({ level, type, event, message, details });
    } catch (e) {
        console.error("Failed to record WhatsApp log:", e);
    }
};

const msgRetryCounterCache = new NodeCache();
const groupCache = new NodeCache({ stdTTL: 60 }); 
const knownNumbersCache = new NodeCache({ stdTTL: 120 });
const messageStore = new NodeCache({ stdTTL: 14400, checkperiod: 600 });
const outboundMessageMetaCache = new NodeCache({ stdTTL: 86400, checkperiod: 600 });
const OUTAGE_ALERT_DELAY_MS = 2 * 60 * 1000;
const WHATSAPP_HEALTH_STATE_KEY = 'whatsapp_health_state';

const normalizeUserJid = (jid = '') => {
  const text = String(jid || '').trim();
  if (!text.includes('@')) return text;
  const [left, domain] = text.split('@');
  if (!left || !domain) return text;
  return `${left.split(':')[0]}@${domain}`;
};

const getLocalPart = (jid = '') => String(jid || '').split('@')[0].split(':')[0];

const pickBestDisplayName = (participant = {}) => {
  const candidates = [
    participant.notify,
    participant.name,
    participant.pushName,
    participant.verifiedName,
    participant.verifiedBizName
  ];
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
};

const extractKnownNumberFromParticipant = (participant = {}) => {
  const raw = String(participant?.id || '').trim();
  if (!raw) return '';

  const atIndex = raw.indexOf('@');
  const localPart = atIndex >= 0 ? raw.slice(0, atIndex) : raw;
  const domain = atIndex >= 0 ? raw.slice(atIndex + 1).toLowerCase() : '';

  // Gruppen-JIDs selbst nicht als Telefonnummer behandeln.
  if (domain.endsWith('g.us')) return '';
  // LID/Device-Identifier sind keine waehlbaren Telefonnummern.
  if (domain.includes('lid')) return '';
  // Nur bekannte personengebundene JID-Domaenen akzeptieren.
  if (domain && domain !== 's.whatsapp.net' && domain !== 'c.us') return '';

  // Multi-device IDs koennen einen Geraete-Suffix enthalten (z.B. 49123:45@...).
  const withoutDevice = localPart.split(':')[0] || localPart;
  let digits = withoutDevice.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  // E.164 Obergrenze + Mindestlaenge fuer sinnvolle Telefonnummern.
  if (digits.length < 8 || digits.length > 15) return '';
  return digits;
};

/**
 * Custom MongoDB-based Auth State for Baileys
 * Fixes session corruption issues on Windows/Docker file systems.
 */
const useMongoDBAuthState = async () => {
    const writeData = async (data, id) => {
        const str = JSON.stringify(data, BufferJSON.replacer);
        await WhatsAppAuth.findByIdAndUpdate(id, { data: str }, { upsert: true });
    };

    const readData = async (id) => {
        try {
            const res = await WhatsAppAuth.findById(id);
            if (!res?.data) return null;
            return JSON.parse(res.data, BufferJSON.reviver);
        } catch (e) { return null; }
    };

    const removeData = async (id) => {
        await WhatsAppAuth.findByIdAndDelete(id);
    };

    const creds = await readData('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = value;
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(value ? writeData(value, key) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
};

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.qrCode = null;
    this.isConnected = false;
    this.isInitializing = false;
    this.isCleaning = false;
    this.isDiagnosing = false;
    this.lastAttemptTime = 0;
    this.pairingMode = String(process.env.WHATSAPP_PAIRING_MODE || 'auto').toLowerCase();
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.maxReconnectAttempts = 8;
    this.baseReconnectDelayMs = 5000;
    this.maxReconnectDelayMs = 15 * 60 * 1000;
    this.healthStateLoaded = false;
    this.lastConnectedAt = null;
    this.lastDisconnectedAt = null;
    this.lastDisconnectReason = '';
    this.outageActive = false;
    this.outageSince = null;
    this.outageAlertSent = false;
    this.outageAlertSentAt = null;
    this.lastRecoveredAt = null;
    this.offlineAlertTimer = null;
  }

  shouldAutoInitialize() {
    return this.pairingMode !== 'manual';
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  clearOfflineAlertTimer() {
    if (this.offlineAlertTimer) {
      clearTimeout(this.offlineAlertTimer);
      this.offlineAlertTimer = null;
    }
  }

  async loadHealthState() {
    if (this.healthStateLoaded) return;
    try {
      const doc = await GlobalSetting.findOne({ key: WHATSAPP_HEALTH_STATE_KEY }).lean();
      const value = doc?.value ? JSON.parse(doc.value) : null;
      if (value && typeof value === 'object') {
        this.lastConnectedAt = value.lastConnectedAt ? new Date(value.lastConnectedAt) : null;
        this.lastDisconnectedAt = value.lastDisconnectedAt ? new Date(value.lastDisconnectedAt) : null;
        this.lastDisconnectReason = String(value.lastDisconnectReason || '');
        this.outageActive = Boolean(value.outageActive);
        this.outageSince = value.outageSince ? new Date(value.outageSince) : null;
        this.outageAlertSent = Boolean(value.outageAlertSent);
        this.outageAlertSentAt = value.outageAlertSentAt ? new Date(value.outageAlertSentAt) : null;
        this.lastRecoveredAt = value.lastRecoveredAt ? new Date(value.lastRecoveredAt) : null;
      }
    } catch (e) {
      logSystem('WHATSAPP', `Health state load failed: ${e.message}`, 'DEBUG');
    } finally {
      this.healthStateLoaded = true;
    }
  }

  async saveHealthState() {
    try {
      const value = JSON.stringify({
        connected: Boolean(this.isConnected),
        initializing: Boolean(this.isInitializing || this.isCleaning),
        lastConnectedAt: this.lastConnectedAt ? this.lastConnectedAt.toISOString() : '',
        lastDisconnectedAt: this.lastDisconnectedAt ? this.lastDisconnectedAt.toISOString() : '',
        lastDisconnectReason: this.lastDisconnectReason || '',
        outageActive: Boolean(this.outageActive),
        outageSince: this.outageSince ? this.outageSince.toISOString() : '',
        outageAlertSent: Boolean(this.outageAlertSent),
        outageAlertSentAt: this.outageAlertSentAt ? this.outageAlertSentAt.toISOString() : '',
        lastRecoveredAt: this.lastRecoveredAt ? this.lastRecoveredAt.toISOString() : '',
        updatedAt: new Date().toISOString()
      });
      await GlobalSetting.findOneAndUpdate(
        { key: WHATSAPP_HEALTH_STATE_KEY },
        { value },
        { upsert: true }
      );
    } catch (e) {
      logSystem('WHATSAPP', `Health state save failed: ${e.message}`, 'DEBUG');
    }
  }

  async getStatus() { 
    // If this instance is the active gateway, return local state
    if (process.env.ENABLE_WHATSAPP === 'true' && this.sock) {
      const outageSeconds = this.outageSince ? Math.max(0, Math.floor((Date.now() - this.outageSince.getTime()) / 1000)) : 0;
      return { 
        connected: this.isConnected, 
        qr: this.qrCode, 
        initializing: this.isInitializing || this.isCleaning, 
        user: this.sock?.user,
        pairingMode: this.pairingMode,
        reconnectAttempts: this.reconnectAttempts,
        reconnectScheduled: Boolean(this.reconnectTimer),
        maxReconnectAttempts: this.maxReconnectAttempts,
        health: {
          outageActive: this.outageActive,
          outageSince: this.outageSince ? this.outageSince.toISOString() : null,
          outageSeconds,
          lastConnectedAt: this.lastConnectedAt ? this.lastConnectedAt.toISOString() : null,
          lastDisconnectedAt: this.lastDisconnectedAt ? this.lastDisconnectedAt.toISOString() : null,
          lastDisconnectReason: this.lastDisconnectReason || null,
          outageAlertSent: this.outageAlertSent,
          outageAlertSentAt: this.outageAlertSentAt ? this.outageAlertSentAt.toISOString() : null,
          lastRecoveredAt: this.lastRecoveredAt ? this.lastRecoveredAt.toISOString() : null
        }
      }; 
    }

    // Otherwise (API instance), read from DB
    try {
      const doc = await GlobalSetting.findOne({ key: WHATSAPP_HEALTH_STATE_KEY });
      if (doc?.value) {
        const state = JSON.parse(doc.value);
        // Check if state is stale (older than 45s)
        const lastUpdate = new Date(state.updatedAt || 0);
        const isStale = (new Date() - lastUpdate) > 45000;
        
        return {
          connected: isStale ? false : state.connected,
          initializing: isStale ? false : state.initializing,
          qr: null, // QR only available on gateway
          health: state,
          isProxy: true
        };
      }
    } catch (e) {
      logSystem('WHATSAPP', `Remote status check failed: ${e.message}`, 'DEBUG');
    }

    return { connected: false, initializing: false };
  }

  async sendAdminOutageEmail({ recovered = false } = {}) {
    if (!emailService.isReady()) return;
    const recipients = await this.getAdminAlertRecipients();
    if (recipients.length === 0) return;

    const outageSince = this.outageSince ? this.outageSince.toLocaleString('de-DE') : 'unknown';
    const disconnectedAt = this.lastDisconnectedAt ? this.lastDisconnectedAt.toLocaleString('de-DE') : 'unknown';
    const connectedAt = this.lastConnectedAt ? this.lastConnectedAt.toLocaleString('de-DE') : 'unknown';
    const reason = this.lastDisconnectReason || 'unknown';

    const subject = recovered
      ? 'EFG Portal: WhatsApp Bot wieder online'
      : 'EFG Portal: WhatsApp Bot offline';
    const text = recovered
      ? `Der WhatsApp Bot ist wieder online.\n\nOffline seit: ${outageSince}\nWieder online: ${connectedAt}\nLetzter Fehler: ${reason}`
      : `Der WhatsApp Bot ist aktuell offline.\n\nSeit: ${disconnectedAt}\nFehler: ${reason}`;

    await Promise.all(recipients.map((user) => emailService.send({
      to: user.email,
      subject,
      text
    })));
  }

  scheduleOfflineAlert() {
    this.clearOfflineAlertTimer();
    this.offlineAlertTimer = setTimeout(async () => {
      this.offlineAlertTimer = null;
      if (this.isConnected || !this.outageActive || this.outageAlertSent) return;
      this.outageAlertSent = true;
      this.outageAlertSentAt = new Date();
      await this.recordSendAttempt('health_alert_sent', {
        outageSince: this.outageSince ? this.outageSince.toISOString() : null,
        disconnectedAt: this.lastDisconnectedAt ? this.lastDisconnectedAt.toISOString() : null
      }, 'warn');
      await this.sendAdminOutageEmail({ recovered: false });
      await this.saveHealthState();
    }, OUTAGE_ALERT_DELAY_MS);
  }

  scheduleReconnect(statusCode = 0) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logSystem('WHATSAPP', `Reconnect-Limit erreicht (${this.maxReconnectAttempts}). Warte auf manuellen Start.`, 'WARNING');
      recordLog('warn', 'connection', 'reconnect_limit', 'Reconnect-Limit erreicht', { statusCode, attempts: this.reconnectAttempts });
      return;
    }
    this.reconnectAttempts += 1;
    const jitter = Math.floor(Math.random() * 1200);
    const delayMs = Math.min(this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1) + jitter, this.maxReconnectDelayMs);
    this.clearReconnectTimer();
    logSystem('WHATSAPP', `Reconnect geplant in ${Math.round(delayMs / 1000)}s (Versuch ${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'DEBUG');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initialize({ force: true });
    }, delayMs);
  }

  async checkOutboundConnectivity() {
    if (this.isDiagnosing) return;
    this.isDiagnosing = true;
    const hosts = [
      { host: 'g.whatsapp.net', port: 443 },
      { host: 'g.whatsapp.net', port: 5222 },
      { host: 'v.whatsapp.net', port: 443 },
      { host: 'google.com', port: 80 }
    ];

    logSystem('WHATSAPP_DIAG', 'Starte Outbound-Verbindungsprüfung...');
    
    // DNS Test
    try {
      const { lookup } = await import('dns/promises');
      const ip = await lookup('g.whatsapp.net');
      logSystem('WHATSAPP_DIAG', `✅ DNS Auflösung erfolgreich: g.whatsapp.net -> ${ip.address}`, 'INFO');
    } catch (e) {
      logSystem('WHATSAPP_DIAG', `❌ DNS Auflösung fehlgeschlagen: ${e.message}`, 'ERROR');
    }

    for (const item of hosts) {
      const start = Date.now();
      const isAvailable = await new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(5000);
        socket.on('connect', () => { socket.destroy(); resolve(true); })
              .on('timeout', () => { socket.destroy(); resolve(false); })
              .on('error', () => { socket.destroy(); resolve(false); })
              .connect(item.port, item.host);
      });
      
      const duration = Date.now() - start;
      if (isAvailable) {
        logSystem('WHATSAPP_DIAG', `✅ Verbindung zu ${item.host}:${item.port} erfolgreich (${duration}ms)`, 'INFO');
      } else {
        logSystem('WHATSAPP_DIAG', `❌ Verbindung zu ${item.host}:${item.port} fehlgeschlagen (Timeout/Blocked)`, 'ERROR');
      }
    }
    this.isDiagnosing = false;
  }

  async initialize(options = {}) {
    const force = Boolean(options?.force);
    await this.loadHealthState();
    if (this.pairingMode === 'manual' && !force) {
      logSystem('WHATSAPP', 'Pairing-Modus ist MANUAL: Automatische Initialisierung übersprungen.', 'DEBUG');
      return;
    }
    if (this.isInitializing || this.isCleaning) return;
    
    // Cooldown check (30 seconds) - allow manual/forced starts to bypass
    const now = Date.now();
    if (!force && now - this.lastAttemptTime < 30000) {
        logSystem('WHATSAPP', 'Warte auf Reconnect-Cooldown (30s)...', 'DEBUG');
        return;
    }
    
    this.lastAttemptTime = now;
    this.isInitializing = true;
    this.qrCode = null;
    logSystem('WHATSAPP', 'Initialisiere WhatsApp-Socket (MongoDB Auth)...');

    // Diagnose am Start
    await this.checkOutboundConnectivity().catch(e => console.error("Diag failed", e));

    try {
      const { state, saveCreds } = await useMongoDBAuthState();
      const { version } = await fetchLatestBaileysVersion();
      
      logSystem('WHATSAPP', `Nutze Baileys Version: ${version.join('.')}`, 'DEBUG');

      if (this.sock) {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.ev.removeAllListeners('messages.upsert');
        this.sock.ev.removeAllListeners('messages.update');
        try { this.sock.end(undefined); } catch (e) {}
        this.sock = null;
      }

      this.sock = makeWASocket({
        version,
        logger: pino({ level: 'error' }),
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'error' }))
        },
        browser: Browsers.ubuntu('Chrome'),
        msgRetryCounterCache,
        connectTimeoutMs: 90000,
        keepAliveIntervalMs: 30000,
        emitOwnEvents: true,
        // IPv4 bevorzugen
        options: {
            family: 4
        },
        getMessage: async (key) => {
            const msg = messageStore.get(key.id);
            if (msg) return msg.message;
            return undefined;
        }
      });

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) { 
          logSystem('WHATSAPP', 'Neuer QR-Code generiert.', 'INFO');
          recordLog('info', 'auth', 'qr_received', 'Neuer QR-Code generiert');
          this.qrCode = await qrcode.toDataURL(qr); 
          this.isConnected = false; 
          this.isInitializing = false; 
        }

        if (connection === 'open') {
          logSystem('WHATSAPP', '✅ WhatsApp System ist vollständig synchronisiert und online.', 'INFO');
          recordLog('info', 'connection', 'connected', 'Bot erfolgreich verbunden');
          const wasOutageActive = this.outageActive;
          const hadAlert = this.outageAlertSent;
          this.isConnected = true;
          this.qrCode = null;
          this.isInitializing = false;
          this.reconnectAttempts = 0;
          this.clearReconnectTimer();
          this.clearOfflineAlertTimer();
          this.lastConnectedAt = new Date();
          this.lastDisconnectReason = '';
          this.outageActive = false;
          this.outageSince = null;
          if (wasOutageActive) this.lastRecoveredAt = this.lastConnectedAt;
          if (wasOutageActive && hadAlert) {
            await this.sendAdminOutageEmail({ recovered: true });
          }
          this.outageAlertSent = false;
          this.outageAlertSentAt = null;
          await this.saveHealthState();

          // Start heartbeat to keep status fresh in DB
          if (!this.heartbeatTimer) {
            this.heartbeatTimer = setInterval(() => this.saveHealthState(), 30000);
          }
        }

        if (connection === 'close') {
          if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
          }
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const errorMessage = lastDisconnect?.error?.message;
          const reason = Object.entries(DisconnectReason).find(r => r[1] === statusCode)?.[0] || 'Unknown';
          this.isConnected = false;
          this.isInitializing = false;
          this.lastDisconnectedAt = new Date();
          this.lastDisconnectReason = reason;

          logSystem('WHATSAPP', `Verbindung geschlossen. Status: ${statusCode}, Fehler: ${errorMessage}`, 'WARNING');
          
          // Rate-limit logging and handle connectionReplaced
          if (statusCode === 440 || statusCode === DisconnectReason.connectionReplaced) {
            logSystem('WHATSAPP', '⚠️ Verbindung wurde von einer anderen Instanz übernommen (connectionReplaced). Beende Prozess für K8s-Backoff...', 'ERROR');
            process.exit(1); // Kubernetes handles the restart with exponential backoff
          }

          if (!this.outageActive) {
            this.outageActive = true;
            this.outageSince = this.lastDisconnectedAt;
            this.outageAlertSent = false;
            this.outageAlertSentAt = null;
          }
          this.scheduleOfflineAlert();
          
          recordLog(statusCode === DisconnectReason.loggedOut ? 'error' : 'warn', 'connection', 'disconnected', `Verbindung getrennt: ${reason}`, { statusCode, errorMessage });
          await this.saveHealthState();

          if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
            logSystem('WHATSAPP', 'Sitzung ungültig (Logged Out). Führe Reset durch...', 'ERROR');
            recordLog('error', 'auth', 'auth_failure', 'Sitzung ungültig oder abgelaufen');
            await this.cleanupAndRestart({ force: true });
          } else {
            logSystem('WHATSAPP', `Automatischer Reconnect erforderlich (Code ${statusCode})`, 'DEBUG');
            recordLog('info', 'connection', 'reconnecting', 'Automatischer Reconnect gestartet');
            this.scheduleReconnect(statusCode);
          }
        }
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('messages.upsert', async (m) => {
          for (const msg of m.messages) {
              if (msg.key.id) messageStore.set(msg.key.id, msg);
          }
      });

      this.sock.ev.on('messages.update', async (updates) => {
        for (const update of updates || []) {
          const messageId = update?.key?.id;
          if (!messageId) continue;
          const tracked = outboundMessageMetaCache.get(messageId);
          if (!tracked) continue;

          const status = typeof update?.update?.status !== 'undefined'
            ? update.update.status
            : (typeof update?.status !== 'undefined' ? update.status : null);
          const updateError = update?.update?.error?.message || update?.error?.message || null;
          if (status === null && !updateError) continue;

          await this.recordSendAttempt('ack_update', {
            messageId,
            status,
            error: updateError,
            jid: tracked.jid,
            input: tracked.input,
            attempt: tracked.attempt
          }, updateError ? 'warn' : 'info');
        }
      });

    } catch (error) {
      logSystem('WHATSAPP', `Socket-Fehler: ${error.message}`, 'ERROR');
      recordLog('error', 'system', 'error', `Kritischer Socket-Fehler: ${error.message}`);
      this.isInitializing = false;
    }
  }

  async cleanupAndRestart(options = {}) {
    if (this.isCleaning) return;
    this.isCleaning = true;
    this.isConnected = false;
    this.clearReconnectTimer();
    this.clearOfflineAlertTimer();
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.sock) { try { this.sock.end(undefined); } catch (e) {} this.sock = null; }
    await delay(2000);
    try {
        logSystem('WHATSAPP', 'Lösche Session-Daten aus MongoDB...');
        await WhatsAppAuth.deleteMany({});
    } catch (e) {}
    this.isCleaning = false;
    this.reconnectAttempts = 0;
    await this.initialize({ force: Boolean(options?.force) });
  }

  async startPairing() {
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    await this.initialize({ force: true });
    return await this.getStatus();
  }

  async stopPairing() {
    this.clearReconnectTimer();
    this.clearOfflineAlertTimer();
    this.isConnected = false;
    this.isInitializing = false;
    this.qrCode = null;
    this.outageActive = false;
    this.outageSince = null;
    this.outageAlertSent = false;
    this.outageAlertSentAt = null;
    this.lastDisconnectReason = 'manual_stop';
    if (this.sock) {
      try { this.sock.end(undefined); } catch (e) {}
      this.sock = null;
    }
    await this.saveHealthState();
    return await this.getStatus();
  }

  async logout() { if (this.sock) { try { await this.sock.logout(); } catch (e) {} } await this.cleanupAndRestart({ force: true }); }
  getQRCode() { return this.qrCode; }

  formatJid(jid) {
    if (!jid) throw new Error('Keine Empfänger-ID');
    if (jid.includes('@')) return jid;
    let clean = jid.replace(/\D/g, '');
    if (clean.startsWith('0') && !clean.startsWith('00')) clean = '49' + clean.substring(1);
    if (clean.startsWith('00')) clean = clean.substring(2);
    return clean.length > 15 ? `${clean}@g.us` : `${clean}@s.whatsapp.net`;
  }
  getOwnJid() {
    return normalizeUserJid(this.sock?.user?.id || '');
  }

  async resolveSendJid(inputJid) {
    const normalizedInput = normalizeUserJid(inputJid);
    const ownJid = this.getOwnJid();
    if (ownJid && getLocalPart(ownJid) === getLocalPart(normalizedInput)) {
      return ownJid;
    }

    if (!this.sock?.onWhatsApp) return normalizedInput;

    try {
      const matches = await this.sock.onWhatsApp(normalizedInput);
      const first = Array.isArray(matches) ? matches[0] : null;
      const exists = typeof first?.exists === 'boolean' ? first.exists : Boolean(first);
      if (exists && first?.jid) {
        return normalizeUserJid(first.jid);
      }
    } catch (e) {
      logSystem('WHATSAPP', `Recipient-Preflight fehlgeschlagen (${normalizedInput}): ${e.message}`, 'DEBUG');
    }
    return normalizedInput;
  }

  isRetryableSendError(error) {
    const msg = String(error?.message || '').toLowerCase();
    return [
      'session',
      'pre-key',
      'retry',
      'timed out',
      'connection closed',
      'not found'
    ].some((needle) => msg.includes(needle));
  }

  trackOutboundMessage(messageId, details = {}) {
    const id = String(messageId || '').trim();
    if (!id) return;
    const meta = {
      timestamp: new Date().toISOString(),
      ...details
    };
    outboundMessageMetaCache.set(id, meta);
  }

  async recordSendAttempt(event, details = {}, level = 'info') {
    await recordLog(level, 'send', event, `Send event: ${event}`, details);
  }

  async getGroups() {
    if (!this.isConnected || !this.sock) return [];
    const cached = groupCache.get('list'); if (cached) return cached;
    try {
        const groups = await this.sock.groupFetchAllParticipating();
        const list = Object.values(groups).map(g => ({ id: g.id, subject: g.subject }));
        groupCache.set('list', list); return list;
    } catch(e) { return []; }
  }

  async getKnownNumbers() {
    if (!this.isConnected || !this.sock) return [];
    const cached = knownNumbersCache.get('list');
    if (cached) return cached;

    try {
      const groups = await this.sock.groupFetchAllParticipating();
      const knownMap = new Map();

      Object.values(groups || {}).forEach((group) => {
        (group?.participants || []).forEach((participant) => {
          const number = extractKnownNumberFromParticipant(participant);
          if (!number) return;
          const current = knownMap.get(number) || { number, displayName: '', groups: 0 };
          const foundName = pickBestDisplayName(participant);
          if (!current.displayName && foundName) current.displayName = foundName;
          current.groups += 1;
          knownMap.set(number, current);
        });
      });

      const list = Array.from(knownMap.values())
        .sort((a, b) => a.number.localeCompare(b.number))
        .map((entry) => ({
          number: entry.number,
          displayName: entry.displayName || entry.number,
          groups: entry.groups
        }));
      knownNumbersCache.set('list', list);
      return list;
    } catch (e) {
      return [];
    }
  }

  async sendMessage(number, message) {
    // If this instance is NOT the gateway, queue it
    if (process.env.ENABLE_WHATSAPP !== 'true') {
      try {
        const entry = await WhatsAppOutbox.create({ number, message });
        logSystem('WHATSAPP', `Nachricht in Outbox eingereiht für ${number}`, 'INFO');
        return { status: 'queued', id: entry._id };
      } catch (e) {
        throw new Error(`Outbox-Queuing fehlgeschlagen: ${e.message}`);
      }
    }

    if (!this.isConnected || !this.sock) throw new Error('Nicht verbunden');
    const input = this.formatJid(number);
    let jid = await this.resolveSendJid(input);
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await this.recordSendAttempt('send_attempt', {
          attempt,
          input,
          jid,
          preview: String(message || '').slice(0, 120)
        });

        try {
          await this.sock.sendPresenceUpdate('composing', jid);
        } catch (presenceError) {
          logSystem('WHATSAPP', `Presence-Update fehlgeschlagen (${jid}): ${presenceError.message}`, 'DEBUG');
          await this.recordSendAttempt('presence_failed', {
            attempt,
            input,
            jid,
            error: presenceError.message
          }, 'debug');
        }

        const sentMsg = await this.sock.sendMessage(jid, { text: message });
        if (sentMsg) {
          messageStore.set(sentMsg.key.id, sentMsg);
          this.trackOutboundMessage(sentMsg?.key?.id, { attempt, input, jid });
          await this.recordSendAttempt('send_success', {
            attempt,
            input,
            jid,
            messageId: sentMsg?.key?.id || null
          });
        }
        return sentMsg;
      } catch (e) {
        lastError = e;
        if (attempt === 1 && this.isRetryableSendError(e)) {
          logSystem('WHATSAPP', `Erster Sendeversuch fehlgeschlagen (${jid}), Retry startet: ${e.message}`, 'WARNING');
          await this.recordSendAttempt('send_retry', {
            attempt,
            input,
            jid,
            error: e.message
          }, 'warn');
          await delay(1500);
          jid = await this.resolveSendJid(jid);
          continue;
        }
        await this.recordSendAttempt('send_failed', {
          attempt,
          input,
          jid,
          error: e.message
        }, 'error');
        throw e;
      }
    }

    throw lastError || new Error('Senden fehlgeschlagen');
  }

  async startOutboxProcessor() {
    if (this.outboxTimer) return;
    logSystem('WHATSAPP', '🚀 Outbox Processor gestartet.', 'INFO');
    this.outboxTimer = setInterval(async () => {
      if (!this.isConnected || !this.sock) return;

      try {
        const pending = await WhatsAppOutbox.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(5);
        for (const msg of pending) {
          try {
            await this.sendMessage(msg.number, msg.message);
            msg.status = 'sent';
            await msg.save();
            logSystem('WHATSAPP', `Outbox-Nachricht an ${msg.number} versendet.`, 'DEBUG');
          } catch (err) {
            msg.attempts += 1;
            msg.lastError = err.message;
            if (msg.attempts >= 3) msg.status = 'error';
            await msg.save();
            logSystem('WHATSAPP', `Outbox-Fehler für ${msg.number}: ${err.message}`, 'WARNING');
          }
        }
      } catch (e) {
        console.error("Outbox Processor Error:", e);
      }
    }, 5000);
  }
  async sendPoll(number, name, values, selectableCount = 1) {
    if (!this.isConnected || !this.sock) throw new Error('Nicht verbunden');
    const jid = this.formatJid(number);
    try {
        const sentPoll = await this.sock.sendMessage(jid, { poll: { name, values, selectableCount } });
        if (sentPoll) messageStore.set(sentPoll.key.id, sentPoll);
        return sentPoll.key.id;
    } catch (e) { throw e; }
  }

  async sendDocument(number, { buffer, fileName, mimeType, caption }) {
    if (!this.isConnected || !this.sock) throw new Error('Nicht verbunden');
    const jid = this.formatJid(number);
    if (!buffer) throw new Error('Dokument-Buffer fehlt');
    try {
        const sent = await this.sock.sendMessage(jid, {
            document: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
            mimetype: mimeType || 'application/octet-stream',
            fileName: fileName || 'Dokument',
            caption: caption || ''
        });
        if (sent) messageStore.set(sent.key.id, sent);
        return sent;
    } catch (e) { throw e; }
  }
}

if (!globalThis.__WHATSAPP_SERVICE__) {
    globalThis.__WHATSAPP_SERVICE__ = new WhatsAppService();
}
const whatsappService = globalThis.__WHATSAPP_SERVICE__;
export const initializeWhatsApp = () => whatsappService.initialize();
export default whatsappService;
