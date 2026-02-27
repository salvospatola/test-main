import { test, expect } from '@playwright/test';

const routes = [
    '/',
    '/dienstplaner',
    '/admin',
    '/admin/users',
    '/admin/roles',
    '/admin/monitor',
    '/admin/stats',
    '/admin/security',
    '/admin/activity',
    '/admin/bot',
    '/impressum',
    '/datenschutz'
];

test.describe('Blank Screen & JS Error Check', () => {
    
    test.beforeEach(async ({ page }) => {
        // Mock Login as Admin to access all routes
        const response = await page.request.get('/api/dev/mock-login');
        const body = await response.json();
        const token = body.token;
        
        await page.goto('/');
        await page.evaluate((t) => localStorage.setItem('auth_token', t), token);
    });

    for (const route of routes) {
        test(`Route "${route}" should not have JS errors or blank screen`, async ({ page }) => {
            const consoleErrors = [];
            page.on('console', msg => {
                if (msg.type() === 'error') consoleErrors.push(msg.text());
            });
            page.on('pageerror', err => {
                consoleErrors.push(err.message);
            });

            await page.goto(route);
            // Wait for some common element to be sure it's not a blank page
            // Most pages have a header or a specific container
            await page.waitForLoadState('domcontentloaded');
            // Wait for a short moment for React to hydrate
            await page.waitForTimeout(1000);
            
            // Check if root element has content
            const rootHtml = await page.innerHTML('#root');
            expect(rootHtml.length).toBeGreaterThan(100); // Should have significant content

            // Check if "Uncaught ReferenceError" or similar is in console
            const hasLoaderError = consoleErrors.some(msg => msg.includes('Loader2 is not defined'));
            expect(hasLoaderError, `Detected "Loader2 is not defined" on route ${route}`).toBe(false);
            
            // General error check (excluding some known external errors if any)
            const significantErrors = consoleErrors.filter(msg => 
                !msg.includes('Failed to load resource') && 
                !msg.includes('chrome-extension')
            );
            
            expect(significantErrors, `Detected JS errors on route ${route}: ${significantErrors.join(', ')}`).toHaveLength(0);
        });
    }
});
