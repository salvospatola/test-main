import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginView from '../components/LoginView';
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
        delete: vi.fn(),
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

describe('LoginView - Intensive Testing', () => {
    const mockOnAuthSuccess = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockResolvedValue({ data: { exists: true } });
        axios.post.mockResolvedValue({});
    });

    const waitDebounce = () => new Promise(r => setTimeout(r, 800));

    it('renders initial state correctly', () => {
        render(<LoginView onAuthSuccess={mockOnAuthSuccess} onClose={mockOnClose} />);
        expect(screen.getByText(/Anmelden/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/170 1234567/i)).toBeInTheDocument();
    });

    it('validates valid phone number and checks existence', async () => {
        axios.get.mockResolvedValue({ data: { exists: true } });
        
        render(<LoginView onAuthSuccess={mockOnAuthSuccess} onClose={mockOnClose} />);
        const input = screen.getByPlaceholderText(/170 1234567/i);
        
        fireEvent.change(input, { target: { value: '1701234567' } });
        
        await waitDebounce();
        
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/auth/check-phone?phone=491701234567'));
        });
        
        expect(await screen.findByText(/Konto erkannt/i)).toBeInTheDocument();
    });

    it('shows "Nicht registriert" for unknown numbers', async () => {
        axios.get.mockResolvedValue({ data: { exists: false } });
        
        render(<LoginView onAuthSuccess={mockOnAuthSuccess} onClose={mockOnClose} />);
        const input = screen.getByPlaceholderText(/170 1234567/i);
        
        fireEvent.change(input, { target: { value: '1709999999' } });
        
        await waitDebounce();
        
        expect(await screen.findByText(/Nicht registriert/i)).toBeInTheDocument();
    });

    it('keeps "Code anfordern" disabled until account is recognized', async () => {
        axios.get.mockResolvedValue({ data: { exists: false } });

        render(<LoginView onAuthSuccess={mockOnAuthSuccess} onClose={mockOnClose} />);
        const input = screen.getByPlaceholderText(/170 1234567/i);
        fireEvent.change(input, { target: { value: '1709999999' } });

        await waitDebounce();

        const requestCodeBtn = await screen.findByRole('button', { name: /Code anfordern/i });
        expect(requestCodeBtn).toBeDisabled();
    });

    it('completes full login flow (Success Path)', async () => {
        axios.get.mockResolvedValue({ data: { exists: true } });
        axios.post.mockResolvedValueOnce({}); // Request OTP
        axios.post.mockResolvedValueOnce({ data: { token: 'valid-jwt-token', user: { firstName: 'Test' } } }); // Verify OTP

        render(<LoginView onAuthSuccess={mockOnAuthSuccess} onClose={mockOnClose} />);
        
        // Step 1: Phone
        fireEvent.change(screen.getByPlaceholderText(/170 1234567/i), { target: { value: '1701234567' } });
        await waitDebounce();
        
        const requestCodeBtn = await screen.findByRole('button', { name: /Code anfordern/i });
        fireEvent.click(requestCodeBtn);

        // Step 2: OTP
        expect(await screen.findByText(/via WhatsApp geschickt/i)).toBeInTheDocument();
        
        const otpInput = screen.getByTestId('otp-mock-input');
        fireEvent.change(otpInput, { target: { value: '123456' } });
        
        const loginBtn = screen.getByRole('button', { name: /Anmelden/i });
        fireEvent.click(loginBtn);
        
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/api/auth/otp/verify', {
                phone: '491701234567',
                code: '123456'
            });
            expect(mockOnAuthSuccess).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Test' }));
        });
    });

    it('allows going back to change phone number', async () => {
        axios.get.mockResolvedValue({ data: { exists: true } });
        axios.post.mockResolvedValue({});

        render(<LoginView onAuthSuccess={mockOnAuthSuccess} onClose={mockOnClose} />);
        
        fireEvent.change(screen.getByPlaceholderText(/170 1234567/i), { target: { value: '1701234567' } });
        await waitDebounce();
        
        const requestCodeBtn = await screen.findByRole('button', { name: /Code anfordern/i });
        fireEvent.click(requestCodeBtn);
        
        const backBtn = await screen.findByText(/Nummer falsch\? Ändern/i);
        fireEvent.click(backBtn);
        
        expect(screen.getByPlaceholderText(/170 1234567/i)).toBeInTheDocument();
    });
});
