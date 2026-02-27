import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } }
  };
  return { default: mockAxios };
});

describe('App Integration Smoke Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders landing page and brand', async () => {
    axios.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.reject({ response: { status: 401 } });
      if (url === '/api/plan') return Promise.resolve({ data: { plan: [] } });
      if (url === '/api/wall') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // More robust matcher using waitFor and searching for the specific brand text
    await waitFor(() => {
      const brandElements = screen.getAllByText(/EFG NSU/i);
      expect(brandElements.length).toBeGreaterThan(0);
    });
  });

  it('shows login buttons for unauthenticated users', async () => {
    axios.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.reject({ response: { status: 401 } });
      if (url === '/api/plan') return Promise.resolve({ data: { plan: [] } });
      if (url === '/api/wall') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    const loginButtons = await screen.findAllByText(/Login/i);
    expect(loginButtons.length).toBeGreaterThan(0);
  });
});
