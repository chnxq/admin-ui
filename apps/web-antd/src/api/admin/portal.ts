import type { RouteMeta, RouteRecordStringComponent } from '@vben/types';

import type {
  AnalyticsDashboardResponse,
  resourceservicev1_MenuRouteItem,
} from '#/api/generated/admin/service/v1';

import { adminPortalClient } from './clients';

function mapRouteMeta(route: resourceservicev1_MenuRouteItem): RouteMeta {
  const meta = route.meta;

  return {
    activeIcon: meta?.activeIcon,
    activePath: meta?.activePath,
    affixTab: meta?.affixTab,
    affixTabOrder: meta?.affixTabOrder,
    authority: meta?.authority ?? [],
    badge: meta?.badge,
    badgeType: meta?.badgeType as RouteMeta['badgeType'],
    badgeVariants: meta?.badgeVariants,
    hideChildrenInMenu: meta?.hideChildrenInMenu,
    hideInBreadcrumb: meta?.hideInBreadcrumb,
    hideInMenu: meta?.hideInMenu,
    hideInTab: meta?.hideInTab,
    icon: meta?.icon,
    iframeSrc: meta?.iframeSrc,
    ignoreAccess: meta?.ignoreAccess,
    keepAlive: meta?.keepAlive,
    link: meta?.link,
    loaded: meta?.loaded,
    maxNumOfOpenTab: meta?.maxNumOfOpenTab,
    menuVisibleWithForbidden: meta?.menuVisibleWithForbidden,
    openInNewWindow: meta?.openInNewWindow,
    order: meta?.order,
    title: meta?.title || route.name || route.path || '',
  };
}

function mapRoute(
  route: resourceservicev1_MenuRouteItem,
): RouteRecordStringComponent {
  const children = route.children?.map((child) => mapRoute(child));
  const mappedRoute = {
    component: route.component || 'BasicLayout',
    meta: mapRouteMeta(route),
    name: route.name || route.path || 'AdminRoute',
    path: route.path || '/',
  } as RouteRecordStringComponent;

  if (route.alias) {
    mappedRoute.alias = route.alias;
  }
  if (children?.length) {
    mappedRoute.children = children;
  }
  if (route.redirect) {
    mappedRoute.redirect = route.redirect;
  }

  return mappedRoute;
}

export async function getPermissionCodesApi() {
  const response = await adminPortalClient.GetMyPermissionCode({});
  return response.codes ?? [];
}

export async function getCaptchaApi() {
  return await adminPortalClient.GetCaptcha({});
}

export async function getAllMenusApi() {
  const response = await adminPortalClient.GetNavigation({});
  return (response.items ?? []).map((route) => mapRoute(route));
}

export async function getInitialContextApi() {
  const response = await adminPortalClient.GetInitialContext({});

  return {
    menus: (response.menus ?? []).map((route) => mapRoute(route)),
    permissions: response.permissions ?? [],
  };
}

export async function getAnalyticsDashboardApi() {
  const response = await adminPortalClient.GetAnalyticsDashboard({});
  return response as AnalyticsDashboardResponse;
}
