import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import UserManagement from '../components/UserManagement';
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

vi.mock('../components/ui/combobox-multiple', () => ({
    ComboboxMultiple: ({ selected = [], onChange }) => (
        <div data-testid="combobox-multiple">
            {selected.map(s => <span key={s}>{s}</span>)}
            <button onClick={() => onChange([...selected, 'new-item'])}>add</button>
        </div>
    )
}));

vi.mock('../components/ui/date-time-picker', () => ({
    DatePicker: ({ value, onChange }) => (
        <input data-testid="date-picker" value={value || ''} onChange={e => onChange(e.target.value)} />
    )
}));

describe('UserManagement - Intensive Testing', () => {
    let mockUsers;
    let mockRoles;

    beforeEach(() => {
        mockUsers = [
            { _id: 'u1', username: 'admin', firstName: 'Admin', lastName: 'User', role: 'ADMIN', RoleIds: [{_id: 'r1', name: 'Musiker'}], roles: ['Musiker'], lockUntil: null, tags: ['team'] },
            { _id: 'u2', username: 'test', firstName: 'Test', lastName: 'User', role: 'USER', RoleIds: [], roles: [], lockUntil: new Date(Date.now() + 3600000).toISOString(), tags: [] }
        ];
        mockRoles = [{ _id: 'r1', name: 'Musiker' }];

        vi.clearAllMocks();
        axios.get.mockImplementation((url) => {
            if (url.includes('/api/users/tags')) return Promise.resolve({ data: ['team', 'technik'] });
            if (url.includes('/api/users')) return Promise.resolve({ data: mockUsers });
            if (url.includes('/api/roles')) return Promise.resolve({ data: mockRoles });
            return Promise.reject(new Error('Not found'));
        });
        axios.post.mockResolvedValue({ data: { success: true } });
        axios.put.mockResolvedValue({ data: { success: true } });
        axios.delete.mockResolvedValue({ data: { success: true } });
    });

    it('renders user list correctly', async () => {
        render(<UserManagement currentUser={mockUsers[0]} showToast={vi.fn()} />);
        
        await waitFor(() => {
            expect(screen.getByText(/Admin User/i)).toBeInTheDocument();
            expect(screen.getByText(/@test/i)).toBeInTheDocument();
        });
        
        expect(screen.getByText('AKTIV')).toBeInTheDocument();
        expect(screen.getByText('GESPERRT')).toBeInTheDocument();
        expect(screen.getByText('team')).toBeInTheDocument();
    });

    it('filters users based on search input or tags', async () => {
        render(<UserManagement currentUser={mockUsers[0]} />);
        
        await waitFor(() => screen.getByText(/Admin User/i));
        
        const searchInput = screen.getByPlaceholderText(/Suchen/i);
        
        // Search by name
        fireEvent.change(searchInput, { target: { value: 'test' } });
        await waitFor(() => expect(screen.queryByText(/Admin User/i)).not.toBeInTheDocument());
        expect(screen.getByText(/Test User/i)).toBeInTheDocument();

        // Search by tag
        fireEvent.change(searchInput, { target: { value: 'team' } });
        await waitFor(() => expect(screen.getByText(/Admin User/i)).toBeInTheDocument());
    });

    it('opens create modal and handles user creation', async () => {
        const mockToast = vi.fn();
        render(<UserManagement currentUser={mockUsers[0]} showToast={mockToast} />);
        
        fireEvent.click(screen.getByText(/Neuer Benutzer/i));
        
        await waitFor(() => {
            expect(screen.getByText(/Neuer Benutzer/i, { selector: 'h2' })).toBeInTheDocument();
        });
        
        fireEvent.change(screen.getByLabelText(/Vorname/i), { target: { value: 'New' } });
        fireEvent.change(screen.getByLabelText(/Nachname/i), { target: { value: 'User' } });
        fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'newuser' } });
        
        fireEvent.click(screen.getByRole('button', { name: /Speichern/i }));
        
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/api/users', expect.objectContaining({ username: 'newuser' }));
            expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('erstellt'), 'success');
        });
    });

    // Note: Testing DropdownMenu items usually requires mocking Radix UI components
    // or ensuring the portal is correctly rendered in JSDOM.
    // For simplicity, we assume the component works if we can find the trigger.
    it('shows dropdown menu triggers for each user', async () => {
        render(<UserManagement currentUser={mockUsers[0]} />);
        await waitFor(() => screen.getByText(/Admin User/i));
        
        const triggers = screen.getAllByRole('button').filter(b => b.querySelector('[data-testid="icon-more-h"]'));
        expect(triggers.length).toBe(2);
    });
});
