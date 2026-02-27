import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BotJobModal, { JOB_TYPES } from '../components/BotJobModal';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn()
    },
    Toaster: () => null
}));

// Mock DateTimePicker
vi.mock('@/components/ui/date-time-picker', () => ({
    DateTimePicker: ({ label, value, onChange }) => (
        <div data-testid="datetime-picker">
            <label>{label}</label>
            <input 
                type="text" 
                value={value || ''} 
                onChange={(e) => onChange(e.target.value)} 
                placeholder="Select date"
            />
        </div>
    )
}));

describe('BotJobModal Validation and Interaction', () => {
    const mockOnSave = vi.fn();
    const mockOnClose = vi.fn();
    const defaultJobForm = {
        name: '',
        type: 'PLAN_UPDATE',
        mode: 'recurring',
        weekday: '*',
        hour: '10',
        minute: '00',
        params: { targetJid: '' }
    };

    const renderModal = (jobForm = defaultJobForm) => {
        return render(
            <BotJobModal 
                isOpen={true} 
                onClose={mockOnClose} 
                onSave={mockOnSave}
                jobForm={jobForm}
                setJobForm={vi.fn()}
                groups={[{ id: 'g1', subject: 'Test Group' }]}
                currentUser={{}}
            />
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('requires a job name', async () => {
        renderModal();
        const saveBtn = screen.getByText('AUFGABE SICHERN');
        fireEvent.click(saveBtn);
        
        expect(toast.error).toHaveBeenCalledWith('Bitte einen Namen für die Aufgabe eingeben.');
        expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('requires execution time for "once" mode', async () => {
        const onceForm = { ...defaultJobForm, mode: 'once', name: 'Test Job', executionTime: '' };
        renderModal(onceForm);
        
        fireEvent.click(screen.getByText('AUFGABE SICHERN'));
        
        expect(toast.error).toHaveBeenCalledWith('Bitte einen Ausführungszeitpunkt wählen.');
        expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('requires a target for PLAN_UPDATE', async () => {
        const invalidForm = { ...defaultJobForm, name: 'Test Job', params: { targetJid: '' } };
        renderModal(invalidForm);
        
        fireEvent.click(screen.getByText('AUFGABE SICHERN'));
        
        expect(toast.error).toHaveBeenCalledWith('Bitte eine Zielgruppe oder Nummer angeben.');
        expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('validates SIMPLE_MESSAGE requirements', async () => {
        const msgForm = { ...defaultJobForm, type: 'SIMPLE_MESSAGE', name: 'Test Msg', params: { number: '', message: '' } };
        renderModal(msgForm);
        
        fireEvent.click(screen.getByText('AUFGABE SICHERN'));
        
        expect(toast.error).toHaveBeenCalledWith('Bitte einen Empfänger angeben.');
    });

    it('renders CHECK_REMINDERS specific view', () => {
        const reminderForm = { ...defaultJobForm, type: 'CHECK_REMINDERS', name: 'Reminder Job', params: { daysBeforeMin: '1', daysBeforeMax: '3', cooldownHours: '12' } };
        renderModal(reminderForm);

        expect(screen.getByText(/frei definierbaren Tagesfenster/i)).toBeInTheDocument();
        expect(screen.getByText(/Ab wie vielen Tagen vorher/i)).toBeInTheDocument();
    });
});
