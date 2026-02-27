import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SystemLogs from '../components/SystemLogs';
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

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('SystemLogs Component - Intensive Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLogs = [
    { _id: '1', level: 'INFO', source: 'SYSTEM', message: 'Startup complete', createdAt: new Date().toISOString() },
    { _id: '2', level: 'ERROR', source: 'WHATSAPP', message: 'Connection failed', createdAt: new Date().toISOString(), details: { code: 500 } }
  ];

  it('renders correctly and loads logs', async () => {
    axios.get.mockResolvedValue({ data: mockLogs });

    render(<SystemLogs showAlert={vi.fn()} />);

    // Flexibler Matcher für Titel
    expect(await screen.findByText(/System-Konsole/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Startup complete')).toBeInTheDocument();
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  it('toggles live stream status', async () => {
    axios.get.mockResolvedValue({ data: mockLogs });

    render(<SystemLogs />);

    const liveButton = await screen.findByRole('button', { name: /Pause/i });
    fireEvent.click(liveButton);

    expect(await screen.findByText(/Pausiert/i)).toBeInTheDocument();
  });

  it('filters logs based on search query', async () => {
    axios.get.mockResolvedValue({ data: mockLogs });

    render(<SystemLogs />);

    await waitFor(() => screen.getByText('Startup complete'));

    const searchInput = screen.getByPlaceholderText(/Suchen\.\.\./i);
    fireEvent.change(searchInput, { target: { value: 'WHATSAPP' } });

    expect(screen.queryByText('Startup complete')).not.toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('copies logs to clipboard', async () => {
    axios.get.mockResolvedValue({ data: mockLogs });

    render(<SystemLogs />);

    await waitFor(() => screen.getByText(/Kopieren/i));

    const copyButton = screen.getByText(/Kopieren/i);
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(screen.getByText(/Kopiert!/i)).toBeInTheDocument();
  });
});
