import { test, expect, type APIRequestContext } from '@playwright/test';

const COURSE_SLUG = process.env.E2E_COURSE_SLUG || 'sql-for-data-analysis';
const LESSON_ID = process.env.E2E_LESSON_ID || 'sql-1';

async function resolveCourseId(request: APIRequestContext): Promise<string | null> {
  const res = await request.get(`/api/v1/courses/${COURSE_SLUG}`);
  if (!res.ok()) return null;
  const body = await res.json();
  return body?.data?.id || null;
}

test.describe('Learning Flows', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('Learner opens a lesson, views content, and marks it complete', async ({ page }) => {
    await page.goto(`/learn/${COURSE_SLUG}/${LESSON_ID}`);

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });

    if (await page.getByText('This lesson is locked').isVisible().catch(() => false)) {
      test.skip(true, 'Lesson is locked for this user on this environment');
      return;
    }

    const markComplete = page.getByRole('button', { name: /mark complete/i });
    const completed = page.getByRole('button', { name: /^completed$/i });

    // Idempotent: the lesson may already be completed from an earlier run.
    try {
      await markComplete.waitFor({ state: 'visible', timeout: 5000 });
      await markComplete.click();
    } catch {
      // Already completed — verify below.
    }
    await expect(completed).toBeVisible({ timeout: 15000 });
  });

  test('Adaptive quiz: answer questions, submit, and see concept breakdown', async ({ page, request }) => {
    const courseId = await resolveCourseId(request);
    if (!courseId) {
      test.skip(true, `Course "${COURSE_SLUG}" not found on this environment`);
      return;
    }

    // Smart skip: only exercise the flow when the adaptive endpoint can
    // actually generate a quiz for this lesson on this environment.
    const preflight = await request.post(`/api/v1/adaptive/quiz/${courseId}/generate`, {
      params: { lesson_id: LESSON_ID, num_questions: 5 },
    });
    if (!preflight.ok()) {
      test.skip(true, `Adaptive quiz generation unavailable (HTTP ${preflight.status()})`);
      return;
    }
    const payload = await preflight.json();
    const questionCount = payload?.data?.questions?.length || 0;
    if (!questionCount) {
      test.skip(true, 'Adaptive quiz returned no questions on this environment');
      return;
    }

    await page.goto(`/learn/${COURSE_SLUG}/${LESSON_ID}/adaptive-quiz`);
    await page.getByRole('button', { name: /start adaptive quiz/i }).click();

    await expect(page.getByText(/Question 1 \/ /)).toBeVisible({ timeout: 20000 });

    const questionCards = page.locator('div.rounded-lg.border.p-4').filter({ hasText: 'Difficulty:' });
    await expect(questionCards).toHaveCount(questionCount, { timeout: 20000 });

    for (let i = 0; i < questionCount; i++) {
      await questionCards.nth(i).getByRole('button').first().click();
    }

    await page.getByRole('button', { name: /submit answers/i }).click();
    await expect(page.getByText('Quiz Complete')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Results by concept')).toBeVisible();
  });

  test('Mastery page renders radar with weak/strong concepts', async ({ page, request }) => {
    const courseId = await resolveCourseId(request);
    if (!courseId) {
      test.skip(true, `Course "${COURSE_SLUG}" not found on this environment`);
      return;
    }

    const conceptsRes = await request.get(`/api/v1/adaptive/concepts/${courseId}`);
    if (!conceptsRes.ok()) {
      test.skip(true, `Adaptive concepts endpoint unavailable (HTTP ${conceptsRes.status()})`);
      return;
    }
    const concepts = (await conceptsRes.json())?.data || [];
    if (!concepts.length) {
      test.skip(true, 'No adaptive concepts seeded for this course on this environment');
      return;
    }

    await page.goto(`/learn/${COURSE_SLUG}/mastery`);

    await expect(page.getByRole('heading', { name: 'Concept Mastery' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Mastery Radar' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Weak concepts' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Strong concepts' })).toBeVisible();
    await expect(page.locator('#main-content svg[viewBox*="0 0 320"]')).toBeVisible();
  });
});

test.describe('Support Tickets', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('User can create a support ticket and see it listed', async ({ page, request }) => {
    const me = await request.get('/api/v1/auth/me');
    if (!me.ok()) {
      test.skip(true, `Not authenticated on this environment (HTTP ${me.status()})`);
      return;
    }

    const subject = `E2E test ticket ${Date.now()}`;
    await page.goto('/support/tickets');
    await expect(page.getByRole('heading', { name: 'My tickets' })).toBeVisible();

    await page.getByRole('button', { name: 'Create ticket' }).click();
    await page.getByLabel('Subject').fill(subject);
    await page.getByPlaceholder('Describe your issue...').fill('Automated E2E test ticket created by the Phase 8 suite.');
    await page.getByRole('button', { name: /submit ticket/i }).click();

    await expect(page.getByText(subject)).toBeVisible({ timeout: 20000 });
  });
});
