import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PhoneInput from '../components/PhoneInput';

describe('PhoneInput Component - Unit Testing', () => {
  it('renders correctly with default values', () => {
    const setCountryCode = vi.fn();
    const setPhoneNumber = vi.fn();
    
    render(
      <PhoneInput 
        countryCode="49" 
        setCountryCode={setCountryCode}
        phoneNumber="" 
        setPhoneNumber={setPhoneNumber}
        label="Test Label"
      />
    );

    expect(screen.getByText(/Test Label/i)).toBeInTheDocument();
    // Search for the input with the placeholder as identification
    expect(screen.getByPlaceholderText(/170 1234567/i)).toBeInTheDocument();
    // The country code is in the SelectTrigger
    expect(screen.getByText(/49/)).toBeInTheDocument();
  });

  it('detects invalid short numbers', async () => {
    const onValidationChange = vi.fn();
    
    render(
      <PhoneInput 
        countryCode="49" 
        setCountryCode={() => {}}
        phoneNumber="123" 
        setPhoneNumber={() => {}}
        onValidationChange={onValidationChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Ungültig/i)).toBeInTheDocument();
    });
  });
});
