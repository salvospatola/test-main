import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PlanerModal } from '../App';
import { BrowserRouter } from 'react-router-dom';

// Mock UI components that might cause issues in a test environment
vi.mock('@/components/ui/date-time-picker', () => ({
    DatePicker: () => <div data-testid="date-picker" />,
    TimePicker: () => <div data-testid="time-picker" />,
    DateTimePicker: () => <div data-testid="date-time-picker" />
}));

vi.mock('@/components/ui/combobox-multiple', () => ({
    ComboboxMultiple: () => <div data-testid="combobox-multiple" />
}));

describe('PlanerModal', () => {
    const mockUsers = [
        { username: 'user1', firstName: 'User', lastName: 'One' },
        { username: 'user2', firstName: 'User', lastName: 'Two' }
    ];

    it('should render without crashing', () => {
        render(
            <BrowserRouter>
                <PlanerModal 
                    entry={null} 
                    onClose={() => {}} 
                    onSave={() => {}} 
                    allUsers={mockUsers} 
                />
            </BrowserRouter>
        );
        
        expect(screen.getByText('Neuer Termin')).toBeDefined();
        expect(screen.getByText('PLAN SPEICHERN')).toBeDefined();
    });

    it('should render with an existing entry', () => {
        const entry = {
            _id: '123',
            Datum: '2026-02-20',
            tags: ['Sonntag'],
            Klavier: 'user1'
        };

        render(
            <BrowserRouter>
                <PlanerModal 
                    entry={entry} 
                    onClose={() => {}} 
                    onSave={() => {}} 
                    allUsers={mockUsers} 
                />
            </BrowserRouter>
        );
        
        expect(screen.getByText('Termin bearbeiten')).toBeDefined();
    });

    it('should show Musikprobe label', () => {
        render(
            <BrowserRouter>
                <PlanerModal 
                    entry={null} 
                    onClose={() => {}} 
                    onSave={() => {}} 
                    allUsers={mockUsers} 
                />
            </BrowserRouter>
        );
        
        expect(screen.getByText(/Musikprobe/i)).toBeDefined();
    });
});
