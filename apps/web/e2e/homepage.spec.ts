import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display the hero section with title", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /become legendary/i, level: 1 })
    ).toBeVisible();
  });

  test("should display competitive ecosystem sections", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "The Community is Moving", exact: true, level: 2 })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /global leaderboard/i, level: 2 })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /featured challenges/i, level: 2 })
    ).toBeVisible();
  });

  test("should have working skip-to-content link", async ({ page }) => {
    await page.keyboard.press("Tab");
    const skipLink = page.getByText("Skip to main content");
    await expect(skipLink).toBeVisible();
    await skipLink.click();
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("should navigate to arena", async ({ page }) => {
    await page.getByRole("link", { name: "Start Competing" }).click();
    await expect(page).toHaveURL(/\/arena/);
  });

  test("should navigate to courses", async ({ page }) => {
    await page.getByText("Browse Challenges").click();
    await expect(page).toHaveURL(/\/courses/);
  });
});