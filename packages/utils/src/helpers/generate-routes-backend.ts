import type { RouteRecordRaw } from 'vue-router';

import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
  RouteRecordStringComponent,
} from '@vben-core/typings';

import { mapTree } from '@vben-core/shared/utils';

/**
 * 判断路由是否在菜单中显示但访问时展示 403（让用户知悉功能并申请权限）
 */
function menuHasVisibleWithForbidden(route: RouteRecordRaw): boolean {
  return !!route.meta?.menuVisibleWithForbidden;
}

/**
 * 动态生成路由 - 后端方式
 * 对 meta.menuVisibleWithForbidden 为 true 的项直接替换为 403 组件，让用户知悉功能并申请权限。
 */
async function generateRoutesByBackend(
  options: GenerateMenuAndRoutesOptions,
): Promise<RouteRecordRaw[]> {
  const {
    fetchMenuListAsync,
    layoutMap = {},
    pageMap = {},
    forbiddenComponent,
  } = options;

  try {
    const menuRoutes = await fetchMenuListAsync?.();
    if (!menuRoutes) {
      return [];
    }

    const moduleNames = collectModuleNames(pageMap);
    const normalizePageMap: ComponentRecordType = {};

    for (const [key, value] of Object.entries(pageMap)) {
      normalizePageMap[normalizeViewPath(key, moduleNames)] = value;
    }

    let routes = convertRoutes(
      menuRoutes,
      layoutMap,
      normalizePageMap,
      moduleNames,
    );

    if (forbiddenComponent) {
      routes = mapTree(routes, (route) => {
        if (menuHasVisibleWithForbidden(route)) {
          route.component = forbiddenComponent;
        }
        return route;
      });
    }

    return routes;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

function convertRoutes(
  routes: RouteRecordStringComponent[],
  layoutMap: ComponentRecordType,
  pageMap: ComponentRecordType,
  moduleNames: Set<string>,
): RouteRecordRaw[] {
  return mapTree(routes, (node) => {
    const route = node as unknown as RouteRecordRaw;
    const { component, name } = node;

    if (!name) {
      console.error('route name is required', route);
    }

    // layout转换
    if (component && layoutMap[component]) {
      route.component = layoutMap[component];
      // 页面组件转换
    } else if (component) {
      const normalizePath = normalizeViewPath(component, moduleNames);
      const pageKey = normalizePath.endsWith('.vue')
        ? normalizePath
        : `${normalizePath}.vue`;
      if (pageMap[pageKey]) {
        route.component = pageMap[pageKey];
      } else {
        console.error(`route component is invalid: ${pageKey}`, route);
        route.component = pageMap['/_core/fallback/not-found.vue'];
      }
    }

    return route;
  });
}

function collectModuleNames(pageMap: ComponentRecordType): Set<string> {
  const moduleNames = new Set<string>();
  for (const key of Object.keys(pageMap)) {
    const normalizedKey = key.replaceAll('\\', '/');
    const match = normalizedKey.match(/\/modules\/([^/]+)\/views\//);
    if (match?.[1]) {
      moduleNames.add(normalizeModuleRouteName(match[1]));
    }
  }
  return moduleNames;
}

function normalizeViewPath(path: string, moduleNames: Set<string>): string {
  const normalizedPath = path
    .replace(/^(\.\/|\.\.\/)+/, '')
    .replaceAll('\\', '/');
  const viewPath = normalizedPath.startsWith('/')
    ? normalizedPath
    : `/${normalizedPath}`;

  if (viewPath.startsWith('/views/')) {
    return viewPath.replace(/^\/views/, '');
  }

  if (viewPath.startsWith('/modules/')) {
    return normalizeModuleViewPath(viewPath);
  }

  if (viewPath.startsWith('/_core/')) {
    return viewPath;
  }

  const segments = viewPath.split('/').filter(Boolean);
  const moduleName = segments[0];
  if (segments.length >= 2 && moduleName && moduleNames.has(moduleName)) {
    return `/modules/${moduleName}/views/${segments.slice(1).join('/')}`;
  }

  return viewPath;
}

function normalizeModuleRouteName(moduleDirName: string): string {
  return moduleDirName.endsWith('-ui')
    ? moduleDirName.slice(0, -3)
    : moduleDirName;
}

function normalizeModuleViewPath(viewPath: string): string {
  const match = viewPath.match(/^\/modules\/([^/]+)\/(.*)$/);
  const moduleDirName = match?.[1];
  if (!moduleDirName) {
    return viewPath;
  }
  const rest = match[2] ?? '';
  return `/modules/${normalizeModuleRouteName(moduleDirName)}/${rest}`;
}

export { generateRoutesByBackend };
