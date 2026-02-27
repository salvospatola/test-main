import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileModal } from '../App'; 

describe('ProfileModal Component - Unit Testing', () => {
  const mockUser = {
    firstName: 'Max',
    lastName: 'Mustermann',
    email: 'max@example.com',
    phone: '491701234567',
    role: 'ADMIN',
    notifications: {
      plan_assigned: { app: true, whatsapp: false }
    }
  };

  it('renders user data correctly in profile tab', () => {
    render(
      <ProfileModal 
        user={mockUser} 
        onClose={vi.fn()} 
        onSave={vi.fn()} 
        theme="AUTO" 
        setTheme={vi.fn()} 
      />
    );

    expect(screen.getByDisplayValue('Max')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mustermann')).toBeInTheDocument();
  });

  it('switches between profile and notifications tabs', () => {
    render(
      <ProfileModal 
        user={mockUser} 
        onClose={vi.fn()} 
        onSave={vi.fn()} 
        theme="AUTO" 
        setTheme={vi.fn()} 
      />
    );

    const tabs = screen.getAllByRole('button');
    const notifTab = tabs.find(t => t.textContent === 'Mitteilungen');
    fireEvent.click(notifTab);

    expect(screen.getByText(/Dienstplaner/i)).toBeInTheDocument();
  });
});
