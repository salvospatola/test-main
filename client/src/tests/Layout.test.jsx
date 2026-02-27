import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
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

// Mock UI components that use Portals
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children, open }) => <div data-testid="dropdown-root">{children}</div>,
  DropdownMenuTrigger: ({ children }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }) => <div onClick={onClick} className={className}>{children}</div>,
  DropdownMenuLabel: ({ children }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuPortal: ({ children }) => <div>{children}</div>,
  DropdownMenuSub: ({ children }) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children }) => <div>{children}</div>,
}));

describe('App Layout & Navigation - Integration Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('auth_token', 'fake-token');
    
    // Default mocks for app initialization
    axios.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve({ 
        data: { 
          user: { 
            firstName: 'Max', 
            lastName: 'Mustermann',
            role: 'ADMIN', 
            permissions: [{key: 'HOME', canView: true}, {key: 'USER_MGMT', canView: true}, {key: 'MUSIC_PLANER', canView: true}],
            notifications: {},
            theme: 'AUTO'
          } 
        } 
      });
      if (url === '/api/plan') return Promise.resolve({ data: { plan: [] } });
      if (url === '/api/wall') return Promise.resolve({ data: [] });
      if (url === '/api/notifications') return Promise.resolve({ data: [] });
      if (url === '/api/whatsapp/status') return Promise.resolve({ data: { connected: true } });
      return Promise.resolve({ data: {} });
    });
  });

  it('renders sidebar navigation correctly for admin', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // Sidebar navigation check - text might be broken up by icon div
    await waitFor(() => {
      const links = screen.getAllByRole('link');
      const wallLink = links.find(l => l.textContent.includes('Schwarzes Brett'));
      expect(wallLink).toBeDefined();
    });
  });

  it('handles logout flow', async () => {
    axios.post.mockResolvedValue({ data: { success: true } });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    // Find the user menu trigger in the header
    const userButtons = await screen.findAllByRole('button');
    const trigger = userButtons.find(b => b.textContent.includes('Max'));
    expect(trigger).toBeDefined();
    fireEvent.click(trigger);

    // If dropdown menu doesn't show up in JSDOM, we might need to mock it or find another way
    // But usually finding the text works if it's rendered.
    const logoutButton = await screen.findByText(/Abmelden/i);
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/auth/logout');
    });
  });
});
