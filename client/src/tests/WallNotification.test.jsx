import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import axios from 'axios';
import CommunityWall from '../components/CommunityWall';

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

describe('Wall Notification Integration', () => {
    const mockUser = { _id: 'u1', username: 'testuser', firstName: 'Marcel', lastName: 'Lohr' };

    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockResolvedValue({ data: [] });
        axios.post.mockResolvedValue({ data: { _id: 'p1', content: 'Test Post', author: mockUser, attachments: [], likes: [], comments: [], createdAt: new Date().toISOString() } });
    });

    it('triggers a post request when a new message is submitted', async () => {
        // Authorize
        const authUser = { ...mockUser, role: 'ADMIN' };
        render(<CommunityWall currentUser={authUser} showConfirm={() => {}} showPrompt={() => {}} showAlert={() => {}} showToast={() => {}} />);
        
        // Wait for loading to finish (looking for textarea)
        const input = await screen.findByPlaceholderText(/Was beschäftigt dich/i);
        fireEvent.change(input, { target: { value: 'Hallo Welt' } });
        
        const sendBtn = screen.getByText(/POSTEN/i);
        fireEvent.click(sendBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/api/wall', expect.any(FormData), expect.any(Object));
        });
    });
});
