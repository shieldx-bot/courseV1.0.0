import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display the hero section with title", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /one membership/i })
    ).toBeVisible();
  });

  test("should have working skip-to-content link", async ({ page }) => {
    await page.keyboard.press("Tab");
    const skipLink = page.getByText("Skip to main content");
    await expect(skipLink).toBeVisible();
    await skipLink.click();
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("should navigate to pricing", async ({ page }) => {
    await page.getByText("Start learning today").click();
    await expect(page).toHaveURL(/\/pricing/);
  });

  test("should navigate to courses", async ({ page }) => {
    await page.getByText("Browse courses").click();
    await expect(page).toHaveURL(/\/courses/);
  });
});