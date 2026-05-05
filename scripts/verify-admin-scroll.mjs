import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5666';
const routes = [
  {
    key: 'role',
    path: '/system/role',
    surface: '.admin-role-surface',
    title: '角色管理',
  },
  {
    key: 'permission',
    path: '/app/permission/permission',
    surface: '.admin-permission-surface',
    title: '权限点管理',
  },
  {
    key: 'user',
    path: '/system/user',
    surface: '.admin-user-surface',
    title: '用户管理',
  },
  {
    key: 'api',
    path: '/system/api',
    surface: '.admin-api-surface',
    title: 'API管理',
  },
  {
    key: 'tenant',
    path: '/system/tenant',
    surface: '.admin-tenant-surface',
  },
  {
    key: 'position',
    path: '/system/position',
    surface: '.admin-position-surface',
  },
];

function fail(message) {
  throw new Error(message);
}

async function ensureVisible(locator, message) {
  if (!(await locator.isVisible())) {
    fail(message);
  }
}

async function tryDismissOverlays(page) {
  const selectors = [
    '.ant-modal-wrap .ant-modal-close',
    '.ant-tour .ant-tour-close',
    '.ant-drawer-close',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible()) {
        await candidate.click();
      }
    }
  }
}

async function hasMainTitle(page, title) {
  if (!title) {
    return true;
  }
  const locator = page
    .locator('#__vben_main_content .mb-2.flex.text-lg.font-semibold')
    .filter({ hasText: title });
  return (await locator.count()) > 0;
}

async function findVisiblePagination(page) {
  const selectors = [
    '.admin-role-table .ant-pagination',
    '.admin-permission-table .ant-pagination',
    '.admin-user-table .ant-pagination',
    '.admin-menu-table .ant-pagination',
    '.admin-api-table .ant-pagination',
    '.ant-table-pagination.ant-pagination',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible()) {
        return candidate;
      }
    }
  }

  return undefined;
}

async function verifyPageScroll(page, route) {
  console.log(`checking:${route.key}`);
  await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle' });
  await tryDismissOverlays(page);

  if (!(await hasMainTitle(page, route.title))) {
    fail(`${route.key}: main title not found`);
  }

  const pagination = await findVisiblePagination(page);
  if (!pagination) {
    fail(`${route.key}: visible pagination not found`);
  }

  const before = await pagination.boundingBox();
  if (!before) {
    fail(`${route.key}: pagination box missing before scroll`);
  }

  const viewport = page.viewportSize();
  if (!viewport) {
    fail(`${route.key}: viewport missing`);
  }

  const offscreen = before.y + before.height > viewport.height;
  const surface = page.locator(route.surface);
  const surfaceBox = await surface.boundingBox();
  if (!surfaceBox) {
    fail(`${route.key}: surface box missing`);
  }

  await page.mouse.move(
    surfaceBox.x + Math.min(surfaceBox.width / 2, 240),
    surfaceBox.y + Math.min(surfaceBox.height / 2, 240),
  );
  let after = before;
  for (let index = 0; index < 6; index += 1) {
    await page.mouse.wheel(0, 1600);
    await page.waitForTimeout(250);
    const nextBox = await pagination.boundingBox();
    if (!nextBox) {
      fail(`${route.key}: pagination box missing after scroll`);
    }
    after = nextBox;
    if (after.y + after.height <= viewport.height) {
      break;
    }
  }

  if (!after) {
    fail(`${route.key}: pagination box missing after scroll`);
  }

  return {
    afterBottom: after.y + after.height,
    afterY: after.y,
    beforeBottom: before.y + before.height,
    beforeY: before.y,
    key: route.key,
    offscreen,
    reachedViewport: after.y + after.height <= viewport.height,
    viewportHeight: viewport.height,
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1280, height: 640 },
});

try {
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

  const results = [];
  for (const route of routes) {
    results.push(await verifyPageScroll(page, route));
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
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
