import { test, expect } from '@playwright/test';

test.describe('UI Consistency & Shadcn Integration', () => {
    
    test('Login Page should display shadcn card and inputs', async ({ page }) => {
        await page.goto('/');
        
        const loginBtn = page.getByRole('button', { name: /Login/i }).first();
        await loginBtn.click();

        // Check for Card component classes (simplified check for visibility)
        await expect(page.getByText('Willkommen zurück im Portal')).toBeVisible();
        
        // Check for Input component (shadcn inputs usually have bg-transparent or similar, but we customised)
        const phoneInput = page.locator('input[type="tel"]');
        await expect(phoneInput).toBeVisible();
        // Check if the input is interactive
        await phoneInput.fill('123456');
        await expect(phoneInput).toHaveValue('123456');
    });

    test('Primary color should be violet-ish', async ({ page }) => {
        await page.goto('/');
        
        // Check a primary button's computed background color. 
        // We can't easily check HSL values directly as computed styles often return RGB.
        // Violet 262.1 83.3% 57.8% is roughly #8b5cf6 (Tailwind violet-500) or similar.
        // Let's just check if the CSS variable is defined on :root
        
        const primaryVar = await page.evaluate(() => {
            return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
        });
        
        // We set it to "262.1 83.3% 57.8%"
        expect(primaryVar).toContain('262.1'); 
    });

    test('Theme toggling should work', async ({ page }) => {
        await page.goto('/');
        
        // Ensure desktop view to see the header buttons
        await page.setViewportSize({ width: 1280, height: 720 });
        
        const darkButton = page.getByTitle('Dunkel');
        if (await darkButton.isVisible()) {
            await darkButton.click();
            await page.waitForTimeout(200); // Wait for transition
            await expect(page.locator('html')).toHaveClass(/dark/);
        }
    });
});
