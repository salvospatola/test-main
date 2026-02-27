import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotificationCenter from '../components/NotificationCenter';
import axios from 'axios';

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

describe('NotificationCenter - Intensive Testing', () => {
    const mockNotifications = [
        { _id: 'n1', title: 'Test Notif', message: 'Hello', read: false, createdAt: new Date().toISOString(), type: 'plan_update' },
        { _id: 'n2', title: 'Wall Notif', message: 'World', read: true, createdAt: new Date().toISOString(), type: 'wall_new_post' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockResolvedValue({ data: mockNotifications });
        axios.put.mockResolvedValue({ data: { success: true } });
    });

    it('renders notifications correctly after loading', async () => {
        render(<NotificationCenter onClose={() => {}} onNavigate={() => {}} />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Notif')).toBeInTheDocument();
            expect(screen.getByText('Wall Notif')).toBeInTheDocument();
        });
    });

    it('marks a notification as read when clicked', async () => {
        render(<NotificationCenter onClose={() => {}} onNavigate={() => {}} />);
        
        await waitFor(() => screen.getByText('Test Notif'));
        
        fireEvent.click(screen.getByText('Test Notif'));
        
        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/api/notifications/n1/read'));
        });
    });

    it('handles mark all as read', async () => {
        render(<NotificationCenter onClose={() => {}} onNavigate={() => {}} />);
        
        await waitFor(() => screen.getByText('Test Notif'));

        const markAllBtn = screen.getByText(/Alle lesen/i);
        fireEvent.click(markAllBtn);
        
        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith('/api/notifications/read-all');
        });
    });

    it('shows empty state when no notifications are present', async () => {
        axios.get.mockResolvedValue({ data: [] });
        render(<NotificationCenter onClose={() => {}} onNavigate={() => {}} />);

        await waitFor(() => {
            expect(screen.getByText(/Aktuell keine Mitteilungen/i)).toBeInTheDocument();
        });
    });

    it('navigates and closes when clicking external link', async () => {
        const mockNavigate = vi.fn();
        const mockClose = vi.fn();
        const notifWithLink = { ...mockNotifications[0], link: '/dienstplaner' };
        axios.get.mockResolvedValue({ data: [notifWithLink] });

        render(<NotificationCenter onClose={mockClose} onNavigate={mockNavigate} />);
        
        await waitFor(() => screen.getByText('Test Notif'));
        
        // Find by testId from global mock
        const linkIcon = screen.getByTestId('icon-external');
        const linkBtn = linkIcon.closest('button');
        fireEvent.click(linkBtn);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/dienstplaner');
            expect(mockClose).toHaveBeenCalled();
        });
    });
});
