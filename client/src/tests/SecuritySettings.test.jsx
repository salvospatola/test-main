import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SecuritySettings from '../components/SecuritySettings';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
  };
  return { default: mockAxios };
});

describe('SecuritySettings Component - Intensive Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axios.get.mockImplementation((url) => {
        if (url.includes('/config')) return Promise.resolve({ data: { registrationOpen: false } });
        if (url.includes('/bans')) return Promise.resolve({ data: [{ _id: 'b1', ip: '192.168.1.1', reason: 'Abuse', createdAt: new Date().toISOString() }] });
        if (url.includes('/invites')) return Promise.resolve({ data: [] });
        if (url.includes('/register-secret')) return Promise.resolve({ data: { exists: true } });
        return Promise.reject(new Error('Not found'));
    });
    axios.post.mockResolvedValue({ data: { success: true } });
    axios.delete.mockResolvedValue({ data: { success: true } });
  });

  it('renders security settings and loads bans', async () => {
    render(<SecuritySettings showToast={vi.fn()} />);

    expect(await screen.findByText(/Sicherheit & Zugriff/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
    });
  });

  it('allows removing an IP ban', async () => {
    const mockToast = vi.fn();
    render(<SecuritySettings showToast={mockToast} />);

    await waitFor(() => screen.getByText('192.168.1.1'));

    const removeButton = screen.getByText(/Freischalten/i);
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/api/monitoring/bans/b1'));
      expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('entsperrt'), 'success');
    });
  });

  it('handles empty ban list correctly', async () => {
    axios.get.mockImplementation((url) => {
        if (url.includes('/config')) return Promise.resolve({ data: { registrationOpen: false } });
        if (url.includes('/bans')) return Promise.resolve({ data: [] });
        if (url.includes('/invites')) return Promise.resolve({ data: [] });
        if (url.includes('/register-secret')) return Promise.resolve({ data: { exists: true } });
        return Promise.resolve({ data: {} });
    });

    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByText(/Keine gesperrten IPs/i)).toBeInTheDocument();
    });
  });

  it('allows updating the registration secret', async () => {
    const mockToast = vi.fn();
    render(<SecuritySettings showToast={mockToast} />);

    // Wait for data to load
    await waitFor(() => screen.getByPlaceholderText(/Neuen Code setzen/i));

    const input = screen.getByPlaceholderText(/Neuen Code setzen/i);
    fireEvent.change(input, { target: { value: 'new-master-code' } });

    // Key button
    const keyIcon = screen.getByTestId('icon-key');
    const saveButton = keyIcon.closest('button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/register-secret'), expect.objectContaining({ secret: 'new-master-code' }));
      expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('aktualisiert'), 'success');
    });
  });
});
