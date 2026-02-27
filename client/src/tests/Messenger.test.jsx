import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { act } from 'react';
import { BrowserRouter } from 'react-router-dom';
import Messenger from '../components/Messenger';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => {
    const mockApi = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        interceptors: {
            request: { use: vi.fn(), eject: vi.fn() },
            response: { use: vi.fn(), eject: vi.fn() }
        }
    };
    return {
        default: {
            create: vi.fn(() => mockApi),
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            interceptors: {
                request: { use: vi.fn(), eject: vi.fn() }
            }
        }
    };
});

// Mock Socket.io
const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
};

const mockUser = {
    _id: 'user123',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User'
};

describe('Messenger Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should show "Neuer Chat" dialog when clicking the New Conversation button', async () => {
        const mockApi = axios.create();
        
        // Mock users for the selection dialog
        mockApi.get.mockImplementation((url) => {
            if (url === '/api/chat/conversations') return Promise.resolve({ data: [] });
            if (url === '/api/users/messenger') return Promise.resolve({ data: [
                { _id: 'other1', username: 'other1', firstName: 'Other', lastName: 'User', isOnline: true }
            ]});
            return Promise.reject(new Error('Not found'));
        });

        await act(async () => {
            render(
                <BrowserRouter>
                    <Messenger currentUser={mockUser} socket={mockSocket} />
                </BrowserRouter>
            );
        });

        // Wait for loading to finish (the Messenger header should be visible)
        await waitFor(() => {
            expect(screen.getByText(/Messenger/i)).toBeInTheDocument();
        }, { timeout: 3000 });

        // Find the New Conversation button by looking for the UserPlus icon testid
        const newChatBtn = screen.getByTestId('icon-user-plus').closest('button');

        expect(newChatBtn).toBeDefined();

        await act(async () => {
            fireEvent.click(newChatBtn);
        });

        // Expectation: A dialog or some indication of a new chat selection should appear
        expect(screen.getByText(/Neuer Chat/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Empfänger suchen/i)).toBeInTheDocument();
    });

    it('should navigate to a new conversation when selecting a user', async () => {
        const mockApi = axios.create();
        
        mockApi.get.mockImplementation((url) => {
            if (url === '/api/chat/conversations') return Promise.resolve({ data: [] });
            if (url === '/api/users/messenger') return Promise.resolve({ data: [
                { _id: 'other1', username: 'other1', firstName: 'Other', lastName: 'User' }
            ]});
            return Promise.reject(new Error('Not found'));
        });

        await act(async () => {
            render(
                <BrowserRouter>
                    <Messenger currentUser={mockUser} socket={mockSocket} />
                </BrowserRouter>
            );
        });

        await waitFor(() => {
            expect(screen.getByText(/Messenger/i)).toBeInTheDocument();
        });

        // Open modal
        const newChatBtn = screen.getByTestId('icon-user-plus').closest('button');
        await act(async () => {
            fireEvent.click(newChatBtn);
        });

        // Click on the user "Other User"
        const userEntry = screen.getByText(/Other User/i);
        await act(async () => {
            fireEvent.click(userEntry);
        });

        // Expect navigation to /messenger/new (since it's a new chat)
        expect(window.location.pathname).toBe('/messenger/new');
        // And the modal should be closed
        expect(screen.queryByText(/Neuer Chat/i)).not.toBeInTheDocument();
    });
});
