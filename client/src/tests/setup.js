import '@testing-library/jest-dom';
import { vi } from 'vitest';
import * as React from 'react';
import { act } from 'react';

// Mock matchMedia for theme tests
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), 
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock EventSource
global.EventSource = class {
    constructor() {
        this.onmessage = null;
        this.onerror = null;
    }
    close() {}
};

// React 19 Compatibility
global.IS_REACT_ACT_ENVIRONMENT = true;
global.act = act;
if (!React.act) {
    React.act = act;
}
