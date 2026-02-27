import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import RegisterView from '../components/RegisterView';
import axios from 'axios';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useSearchParams: vi.fn(),
    };
});

vi.mock('axios', () => {
    const mockAxios = {
        create: vi.fn(() => mockAxios),
        interceptors: {
            request: { use: vi.fn(), eject: vi.fn() },
            response: { use: vi.fn(), eject: vi.fn() },
        },
        get: vi.fn(),
        post: vi.fn(),
        defaults: { headers: { common: {} } }
    };
    return { default: mockAxios };
});

vi.mock('../components/ui/input-otp', () => ({
    InputOTP: ({ children, value, onChange }) => (
        <div data-testid="otp-input">
            <input 
                data-testid="otp-mock-input"
                value={value} 
                onChange={(e) => onChange(e.target.value)} 
                placeholder="000000"
            />
            {children}
        </div>
    ),
    InputOTPGroup: ({ children }) => <div>{children}</div>,
    InputOTPSlot: ({ index }) => <div data-testid={`otp-slot-${index}`} />,
    InputOTPSeparator: () => <div>-</div>
}));

describe('RegisterView - Intensive Testing', () => {
    const mockOnAuthSuccess = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        useSearchParams.mockReturnValue([new URLSearchParams('invite=valid-token'), vi.fn()]);
        axios.post.mockResolvedValue({ data: { token: 'new-token' } });
    });

    const renderWithRouter = (ui) => {
        return render(<MemoryRouter>{ui}</MemoryRouter>);
    };

    it('blocks access without key', () => {
        useSearchParams.mockReturnValue([new URLSearchParams(''), vi.fn()]);
        renderWithRouter(<RegisterView onAuthSuccess={mockOnAuthSuccess} />);
        expect(screen.getByText(/Zugriff Verweigert/i)).toBeInTheDocument();
    });

    it('renders form with valid key', () => {
        renderWithRouter(<RegisterView onAuthSuccess={mockOnAuthSuccess} />);
        expect(screen.getByText(/Registrierung/i)).toBeInTheDocument();
    });

    it('completes flow correctly', async () => {
        renderWithRouter(<RegisterView onAuthSuccess={mockOnAuthSuccess} />);
        
        fireEvent.change(screen.getByLabelText(/Vorname/i), { target: { value: 'Max' } });
        fireEvent.change(screen.getByLabelText(/Nachname/i), { target: { value: 'Mustermann' } });
        fireEvent.change(screen.getByPlaceholderText(/170 1234567/i), { target: { value: '1701234567' } });
        
        // Wait for validation & enable
        const submitBtn = await screen.findByRole('button', { name: /CODE SENDEN/i });
        await waitFor(() => expect(submitBtn).toBeEnabled(), { timeout: 3000 });
        
        fireEvent.click(submitBtn);
        
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/api/auth/otp/request', expect.any(Object));
        });

        // Step 2
        expect(await screen.findByText(/Check WhatsApp/i)).toBeInTheDocument();
        const otpInput = screen.getByTestId('otp-mock-input');
        fireEvent.change(otpInput, { target: { value: '123456' } });
        
        const registerBtn = screen.getByText(/JETZT REGISTRIEREN/i);
        fireEvent.click(registerBtn);
        
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/api/auth/otp/verify', expect.any(Object));
            expect(mockOnAuthSuccess).toHaveBeenCalled();
        });
    });
});
