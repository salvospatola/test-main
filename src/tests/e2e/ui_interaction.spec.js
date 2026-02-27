import { test, expect } from '@playwright/test';

test.describe('Full UI Interaction & Scenarios', () => {

    test.beforeEach(async ({ page }) => {
        // Login as Admin
        const response = await page.request.get('/api/dev/mock-login');
        const body = await response.json();
        await page.goto('/');
        await page.evaluate((t) => localStorage.setItem('auth_token', t), body.token);
    });

    test('User Management - Search and Modal', async ({ page }) => {
        await page.goto('/admin/users');
        await page.waitForLoadState('domcontentloaded');

        // Check if users table is visible
        await expect(page.locator('table').first()).toBeVisible();

        // Search functionality
        const searchInput = page.getByPlaceholder(/Suchen/i);
        await searchInput.fill('Admin');
        
        // Open New User Modal
        // "Neuer Benutzer" button
        await page.getByRole('button', { name: 'Neuer Benutzer' }).click();
        
        // Expect Dialog Title "Neuer Benutzer"
        // Using getByRole heading to distinguish from the button
        await expect(page.getByRole('heading', { name: 'Neuer Benutzer' })).toBeVisible();

        // Close Modal
        await page.getByRole('button', { name: 'Abbrechen' }).click();
        await expect(page.getByRole('heading', { name: 'Neuer Benutzer' })).not.toBeVisible();
    });

    test('Role Management - Render', async ({ page }) => {
        await page.goto('/admin/roles');
        await page.waitForLoadState('domcontentloaded');
        
        // Wait for table to appear (data loaded) - use first() if multiple tables exist
        await expect(page.locator('table').first()).toBeVisible();
        // Check for permission icons (Check or X)
        // We look for at least one svg inside the table
        await expect(page.locator('table svg').first()).toBeVisible();
    });

    test('System Monitor - Charts', async ({ page }) => {
        await page.goto('/admin/monitor');
        await page.waitForLoadState('domcontentloaded');
        
        // Check for generic stats cards or charts
        // "CPU", "RAM", "Disk" usually appear in titles or labels
        await expect(page.getByText('CPU').first()).toBeVisible();
        
        // Check for charts container (recharts)
        // We wait for at least one chart to render
        await expect(page.locator('.recharts-responsive-container').first()).toBeVisible();
    });

    test('Dienstplaner - Interaction', async ({ page }) => {
        await page.goto('/dienstplaner');
        await page.waitForLoadState('domcontentloaded');
        
        // Filter Toggle
        const filterBtn = page.getByRole('button', { name: /Meine|Alle/i }); 
        if (await filterBtn.isVisible()) {
            await filterBtn.click();
        }

        // Open New Entry Modal (Admin has permission)
        const newBtn = page.getByRole('button', { name: 'Neu' });
        if (await newBtn.isVisible()) {
            await newBtn.click();
            await expect(page.getByRole('dialog')).toBeVisible();
            await page.getByRole('button', { name: 'Abbrechen' }).click();
        }
    });

        test('Community Wall - Post Interaction', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');
    
            // Check input area (Textarea)
            await expect(page.locator('textarea')).toBeVisible();
    
            await page.locator('textarea').fill('Hello World E2E Test');
            // Check Send button
            const sendBtn = page.locator('button').filter({ has: page.locator('svg.lucide-send') });
            await expect(sendBtn).toBeVisible();
        });
    
    });
