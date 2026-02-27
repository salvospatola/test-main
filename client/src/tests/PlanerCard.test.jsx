import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PlanerCard } from '../App';

// Mock UI components
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, onClick, className, ...props }) => <button onClick={onClick} className={className} {...props}>{children}</button>
}));
vi.mock('@/components/ui/card', () => ({
    Card: ({ children, className }) => <div className={className}>{children}</div>,
    CardHeader: ({ children, className }) => <div className={className}>{children}</div>,
    CardContent: ({ children, className }) => <div className={className}>{children}</div>,
    CardFooter: ({ children, className }) => <div className={className}>{children}</div>,
    CardTitle: ({ children, className }) => <div className={className}>{children}</div>,
    CardDescription: ({ children, className }) => <div className={className}>{children}</div>
}));
vi.mock('@/components/ui/badge', () => ({
    Badge: ({ children, className }) => <span className={className}>{children}</span>
}));
vi.mock('@/components/ui/separator', () => ({
    Separator: ({ className }) => <hr className={className} />
}));
vi.mock('@/components/ui/label', () => ({
    Label: ({ children, className }) => <label className={className}>{children}</label>
}));

describe('PlanerCard Component', () => {
    const mockEntry = {
        _id: '123',
        Datum: '2026-01-01',
        Typ: 'Sonntag',
        Thema: 'Test Thema',
        Predigt: 'Max Mustermann'
    };

    it('should call onDelete when delete button is clicked', () => {
        const onDelete = vi.fn();
        render(
            <PlanerCard 
                entry={mockEntry} 
                canEdit={true} 
                onDelete={onDelete} 
                onEdit={() => {}} 
                showToast={() => {}} 
            />
        );

        // Find by testId from global mock
        const trashIcon = screen.getByTestId('icon-trash');
        const deleteButton = trashIcon.closest('button');
        fireEvent.click(deleteButton);

        expect(onDelete).toHaveBeenCalledWith('123');
    });

    it('should not call onDelete when canEdit is false', () => {
        const onDelete = vi.fn();
        const showToast = vi.fn();
        render(
            <PlanerCard 
                entry={mockEntry} 
                canEdit={false} 
                onDelete={onDelete} 
                onEdit={() => {}} 
                showToast={showToast} 
            />
        );

        const trashIcon = screen.getByTestId('icon-trash');
        const deleteButton = trashIcon.closest('button');
        fireEvent.click(deleteButton);

        expect(onDelete).not.toHaveBeenCalled();
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Berechtigung'), 'error');
    });
});
