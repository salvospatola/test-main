import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Make React available for vi.mock factory (avoids ReferenceError)
global.React = React;

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

// Mock ResizeObserver
global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Mock scrollTo
window.HTMLElement.prototype.scrollTo = vi.fn();

// Mock EventSource
global.EventSource = class {
    constructor() {
        this.onmessage = null;
        this.onerror = null;
    }
    close() {}
};

// React 19 Compatibility Polyfill
// In React 19, act is exported from 'react'
import { act } from 'react';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.act = act;

// Ensure React.act is also set for testing-library
if (React && !React.act) {
    React.act = act;
}

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
    Toaster: () => null,
}));

// Mock Tooltip components
vi.mock('@/components/ui/tooltip', () => ({
    Tooltip: ({ children }) => <div>{children}</div>,
    TooltipTrigger: ({ children }) => <div>{children}</div>,
    TooltipContent: ({ children }) => <div>{children}</div>,
    TooltipProvider: ({ children }) => <div>{children}</div>,
}));

// Global Lucide Mock using React.createElement to avoid JSX issues in some environments
vi.mock('lucide-react', async (importOriginal) => {
    const actual = await importOriginal();
    const mockIcon = (name) => (props) => React.createElement('div', { 'data-testid': `icon-${name}`, ...props });
    
    return {
        ...actual,
        Guitar: mockIcon('guitar'),
        Music: mockIcon('music'),
        Drum: mockIcon('drum'),
        Send: mockIcon('send'),
        Loader2: mockIcon('loader'),
        Image: mockIcon('image'),
        Link: mockIcon('link'),
        Trash2: mockIcon('trash'),
        Edit2: mockIcon('edit'),
        MessageCircle: mockIcon('message'),
        MessageSquare: mockIcon('message-square'),
        Heart: mockIcon('heart'),
        Share2: mockIcon('share'),
        Clock: mockIcon('clock'),
        X: mockIcon('x'),
        ExternalLink: mockIcon('external'),
        Key: mockIcon('key'),
        MoreVertical: mockIcon('more'),
        MoreHorizontal: mockIcon('more-h'),
        Bell: mockIcon('bell'),
        Calendar: mockIcon('calendar'),
        Search: mockIcon('search'),
        Database: mockIcon('database'),
        Shield: mockIcon('shield'),
        ShieldAlert: mockIcon('shield-alert'),
        ShieldCheck: mockIcon('shield-check'),
        Lock: mockIcon('lock'),
        Terminal: mockIcon('terminal'),
        UserPlus: mockIcon('user-plus'),
        Save: mockIcon('save'),
        Plus: mockIcon('plus'),
        Check: mockIcon('check'),
        ChevronRight: mockIcon('chevron-right'),
        ChevronLeft: mockIcon('chevron-left'),
        Activity: mockIcon('activity'),
        TrendingUp: mockIcon('trending-up'),
        House: mockIcon('house'),
        HandHelping: mockIcon('hand'),
        ListMusic: mockIcon('list'),
        Monitor: mockIcon('monitor'),
        Sliders: mockIcon('sliders'),
        Wind: mockIcon('wind'),
        Mic2: mockIcon('mic'),
        Zap: mockIcon('zap'),
        Dot: mockIcon('dot'),
        RefreshCw: mockIcon('refresh'),
        RefreshCwIcon: mockIcon('refresh-icon'),
        Globe: mockIcon('globe'),
        LayoutDashboard: mockIcon('dashboard'),
        Users: mockIcon('users'),
        User: mockIcon('user'),
        Ban: mockIcon('ban'),
        Unlock: mockIcon('unlock'),
        Sun: mockIcon('sun'),
        Moon: mockIcon('moon'),
        Phone: mockIcon('phone'),
        Play: mockIcon('play'),
        FileSpreadsheet: mockIcon('spreadsheet'),
        Download: mockIcon('download'),
        Hand: mockIcon('hand-icon'),
        MonitorSmartphone: mockIcon('monitor-smartphone'),
        Quote: mockIcon('quote'),
        ChevronDown: mockIcon('chevron-down'),
        Info: mockIcon('info'),
        Mail: mockIcon('mail'),
        PanelLeft: mockIcon('panel-left'),
        Filter: mockIcon('filter'),
        CheckCircle2: mockIcon('check-circle'),
        CheckCircle2Icon: mockIcon('check-circle-icon'),
        AlertCircle: mockIcon('alert-circle'),
        AlertTriangle: mockIcon('alert-triangle'),
        AlertTriangleIcon: mockIcon('alert-triangle-icon'),
    };
});
