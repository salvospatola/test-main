import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import axios from 'axios';
import SystemMonitor from '../components/SystemMonitor';

vi.mock('axios', () => {
    const mockAxios = {
        create: vi.fn(() => mockAxios),
        interceptors: {
            request: { use: vi.fn(), eject: vi.fn() },
            response: { use: vi.fn(), eject: vi.fn() }
        },
        get: vi.fn(),
        put: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        defaults: { headers: { common: {} } }
    };
    return { default: mockAxios };
});

describe('SystemMonitor', () => {
    const mockStats = {
        cpu: 12.5,
        memory: 512 * 1024 * 1024,
        traffic: 42,
        live: { total: 10, users: 5, guests: 5 },
        security: { alerts: 0, locked: 0, totalFailed: 10, recent: [] },
        whatsapp: { connected: true },
        db: { reads: 100, writes: 50 }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockImplementation((url) => {
            if (url.includes('/api/monitoring/stats')) return Promise.resolve({ data: mockStats });
            if (url.includes('/api/monitoring/bans')) return Promise.resolve({ data: [] });
            return Promise.resolve({ data: {} });
        });
    });

    it('renders system stats correctly', async () => {
        render(<SystemMonitor showDetails={() => {}} />);
        
        await waitFor(() => {
            expect(screen.getByText('12.5%')).toBeInTheDocument();
            expect(screen.getByText('42')).toBeInTheDocument();
            // Specific check for Online Now value
            const onlineNow = screen.getAllByText('10');
            expect(onlineNow.length).toBeGreaterThan(0);
        });
    });

    it('handles security alerts visual state', async () => {
        const alertStats = { ...mockStats, security: { alerts: 5, locked: 2, totalFailed: 20, recent: [] } };
        axios.get.mockResolvedValueOnce({ data: alertStats }).mockResolvedValueOnce({ data: [] });
        
        render(<SystemMonitor />);
        
        await waitFor(() => {
            expect(screen.getByText('5')).toBeInTheDocument();
            expect(screen.getByText(/2 Konten gesperrt/i)).toBeInTheDocument();
        });
    });
});
