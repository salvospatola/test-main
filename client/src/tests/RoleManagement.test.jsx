import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RoleManagement from '../components/RoleManagement';
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

describe('RoleManagement - Intensive Testing', () => {
    const mockRoles = [
        { _id: 'r1', name: 'ADMIN', permissions: [{ toolId: 't1', canView: true, canEdit: true }] },
        { _id: 'r2', name: 'USER', permissions: [{ toolId: 't1', canView: true, canEdit: false }] }
    ];
    const mockTools = [
        { _id: 't1', name: 'Home Wall', key: 'HOME' }
    ];

    const mockProps = {
        showToast: vi.fn(),
        showConfirm: vi.fn((title, msg, cb) => cb()),
        showPrompt: vi.fn((title, desc, placeholder, def, cb) => cb('NEW_ROLE'))
    };

    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockImplementation((url) => {
            if (url.includes('/api/roles/tools')) return Promise.resolve({ data: mockTools });
            if (url.includes('/api/roles')) return Promise.resolve({ data: mockRoles });
            return Promise.reject(new Error('Not found'));
        });
        axios.put.mockResolvedValue({});
        axios.post.mockResolvedValue({});
        axios.delete.mockResolvedValue({});
    });

    it('renders the role matrix with all roles and tools', async () => {
        render(<RoleManagement {...mockProps} />);
        
        await waitFor(() => {
            expect(screen.getByText('Administrator')).toBeInTheDocument();
            expect(screen.getByText('Benutzer')).toBeInTheDocument();
            expect(screen.getAllByText('Home Wall').length).toBeGreaterThan(0);
        });
    });

    it('toggles permissions correctly in the UI', async () => {
        render(<RoleManagement {...mockProps} />);
        
        await waitFor(() => screen.getByText('Benutzer'));
        
        // Find the "Gesperrt" (Locked) button in the row for USER and Home Wall
        const row = screen.getByText('Benutzer').closest('.group');
        const writeButton = Array.from(row.querySelectorAll('button')).find(b => b.textContent.includes('Gesperrt'));
        
        fireEvent.click(writeButton);
        
        // After toggle, it should change text to "Aktiv"
        expect(writeButton.textContent).toContain('Aktiv');
    });

    it('can save changes for a specific role', async () => {
        render(<RoleManagement {...mockProps} />);
        await waitFor(() => screen.getByText('Administrator'));
        
        const saveBtns = screen.getAllByText(/Speichern/i);
        fireEvent.click(saveBtns[0]);
        
        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/api/roles/r1'), expect.any(Object));
            expect(mockProps.showToast).toHaveBeenCalledWith(expect.stringContaining('gespeichert'), 'success');
        });
    });

    it('handles adding a new role via prompt', async () => {
        render(<RoleManagement {...mockProps} />);
        
        const addBtn = await screen.findByText(/Neue Rolle/i);
        fireEvent.click(addBtn);
        
        await waitFor(() => {
            expect(mockProps.showPrompt).toHaveBeenCalled();
            expect(axios.post).toHaveBeenCalledWith('/api/roles', expect.objectContaining({ name: 'NEW_ROLE' }));
        });
    });

    it('handles deleting a role with confirmation', async () => {
        render(<RoleManagement {...mockProps} />);
        
        await waitFor(() => screen.getByText('Benutzer'));
        
        // Use the mocked icon's test ID
        const trashIcon = screen.getAllByTestId('icon-trash')[0];
        const trashBtn = trashIcon.closest('button');
        
        fireEvent.click(trashBtn);
        
        await waitFor(() => {
            expect(mockProps.showConfirm).toHaveBeenCalled();
            expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/api/roles/r1'));
        });
    });
});
