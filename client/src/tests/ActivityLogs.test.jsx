import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ActivityLogs from '../components/ActivityLogs';
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

describe('ActivityLogs Component - Intensive Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockResponse = {
    total: 100,
    page: 1,
    pages: 10,
    logs: [
      { _id: '1', ip: '1.1.1.1', action: 'API_LOGIN', method: 'POST', path: '/api/auth/login', createdAt: new Date().toISOString(), UserId: { username: 'max', firstName: 'Max', lastName: 'Mustermann' } },
      { _id: '2', ip: '2.2.2.2', action: 'API_WALL_POST', method: 'POST', path: '/api/wall', createdAt: new Date().toISOString(), UserId: { username: 'erika', firstName: 'Erika', lastName: 'Stein' } }
    ]
  };

  it('renders correctly and displays logs', async () => {
    axios.get.mockResolvedValue({ data: mockResponse });

    render(<ActivityLogs showDetails={vi.fn()} />);

    // Flexibler Matcher für Titel
    expect(await screen.findByText(/Aktivitäts-Log/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText(/max/i)).toBeInTheDocument();
      expect(screen.getByText(/erika/i)).toBeInTheDocument();
      expect(screen.getByText('LOGIN')).toBeInTheDocument();
    });
  });

  it('handles search input', async () => {
    axios.get.mockResolvedValue({ data: mockResponse });

    render(<ActivityLogs />);

    const searchInput = screen.getByPlaceholderText(/IP, Aktion oder Pfad\.\.\./i);
    fireEvent.change(searchInput, { target: { value: '1.1.1.1' } });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/activity-logs', expect.objectContaining({
        params: expect.objectContaining({ search: '1.1.1.1' })
      }));
    });
  });

  it('handles pagination next/prev clicks', async () => {
    axios.get.mockResolvedValue({ data: mockResponse });

    render(<ActivityLogs />);

    // Wait for data to load
    await waitFor(() => screen.getByText(/von 10/i));
    expect(screen.getByText(/Seite/i)).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    // The next button has ChevronRight icon, which is mocked as icon-chevron-right
    const nextButton = buttons.find(b => b.querySelector('[data-testid="icon-chevron-right"]'));
    
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/activity-logs', expect.objectContaining({
        params: expect.objectContaining({ page: 2 })
      }));
    });
  });
});
