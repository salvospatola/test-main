import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../services/log.service.js', () => ({
  logSystem: vi.fn()
}));

describe('WhatsAppService sendMessage robustness', () => {
  let whatsappService;
  let originalSock;
  let originalConnected;

  beforeAll(async () => {
    const module = await import('../services/whatsapp.service.js');
    whatsappService = module.default;
  });

  beforeEach(() => {
    originalSock = whatsappService.sock;
    originalConnected = whatsappService.isConnected;
  });

  afterEach(() => {
    whatsappService.sock = originalSock;
    whatsappService.isConnected = originalConnected;
    vi.restoreAllMocks();
  });

  it('uses own normalized JID for self-message targets', async () => {
    const sendPresenceUpdate = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue({ key: { id: 'm1' } });
    const onWhatsApp = vi.fn().mockResolvedValue([{ exists: true, jid: '491701234567@s.whatsapp.net' }]);

    whatsappService.sock = {
      user: { id: '491701234567:12@s.whatsapp.net' },
      onWhatsApp,
      sendPresenceUpdate,
      sendMessage
    };
    whatsappService.isConnected = true;

    await whatsappService.sendMessage('01701234567', 'test');

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith('491701234567@s.whatsapp.net', { text: 'test' });
    expect(onWhatsApp).not.toHaveBeenCalled();
  });

  it('retries once when first send fails with a retryable session error', async () => {
    const sendPresenceUpdate = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('session missing for recipient'))
      .mockResolvedValueOnce({ key: { id: 'm2' } });
    const onWhatsApp = vi.fn().mockResolvedValue([{ exists: true, jid: '491709999999@s.whatsapp.net' }]);

    whatsappService.sock = {
      user: { id: '491701111111:4@s.whatsapp.net' },
      onWhatsApp,
      sendPresenceUpdate,
      sendMessage
    };
    whatsappService.isConnected = true;

    await whatsappService.sendMessage('491709999999', 'retry-test');

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenNthCalledWith(1, '491709999999@s.whatsapp.net', { text: 'retry-test' });
    expect(sendMessage).toHaveBeenNthCalledWith(2, '491709999999@s.whatsapp.net', { text: 'retry-test' });
  });
});
