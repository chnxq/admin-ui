import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5666';

function fail(message) {
  throw new Error(message);
}

async function ensureVisible(locator, message) {
  if (!(await locator.isVisible())) {
    fail(message);
  }
}

async function login(page) {
  await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle' });
  const username = page.locator('input[name="username"]');
  const password = page.locator('input[name="password"]');
  await ensureVisible(username, 'login username input not visible');
  await ensureVisible(password, 'login password input not visible');
  await username.fill('admin');
  await password.fill('123456');
  await password.press('Enter');
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
    timeout: 20000,
    waitUntil: 'networkidle',
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 640 },
  });

  try {
    await login(page);
    await page.goto(`${baseUrl}/app/permission/permission`, {
      waitUntil: 'networkidle',
    });

    const groupPanel = page.locator('.admin-permission-groups');
    const contentPanel = page.locator('.admin-permission-surface');
    const pagination = page.locator('.admin-permission-table .ant-pagination');

    await ensureVisible(groupPanel, 'group panel not visible');
    await ensureVisible(contentPanel, 'content panel not visible');
    await ensureVisible(pagination, 'permission pagination not visible');

    const beforeGroup = await groupPanel.boundingBox();
    const beforePagination = await pagination.boundingBox();
    if (!beforeGroup || !beforePagination) {
      fail('missing initial layout boxes');
    }

    const contentBox = await contentPanel.boundingBox();
    if (!contentBox) {
      fail('content panel box missing');
    }

    await page.mouse.move(
      contentBox.x + Math.min(contentBox.width / 2, 320),
      contentBox.y + Math.min(contentBox.height / 2, 240),
    );

    let afterPagination = beforePagination;
    for (let index = 0; index < 6; index += 1) {
      await page.mouse.wheel(0, 1600);
      await page.waitForTimeout(250);
      const nextBox = await pagination.boundingBox();
      if (!nextBox) {
        fail('pagination box missing after scroll');
      }
      afterPagination = nextBox;
      if (afterPagination.y + afterPagination.height <= 640) {
        break;
      }
    }

    const afterGroup = await groupPanel.boundingBox();
    if (!afterGroup) {
      fail('group panel box missing after scroll');
    }

    const stickyDelta = Math.abs(afterGroup.y - beforeGroup.y);
    const paginationReachedViewport =
      afterPagination.y + afterPagination.height <= 640;

    console.log(
      JSON.stringify(
        {
          ok: stickyDelta <= 2 && paginationReachedViewport,
          result: {
            groupAfterY: afterGroup.y,
            groupBeforeY: beforeGroup.y,
            paginationAfterBottom: afterPagination.y + afterPagination.height,
            paginationAfterY: afterPagination.y,
            paginationBeforeBottom:
              beforePagination.y + beforePagination.height,
            paginationBeforeY: beforePagination.y,
            paginationReachedViewport,
            stickyDelta,
          },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          message: error instanceof Error ? error.message : String(error),
          ok: false,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();
