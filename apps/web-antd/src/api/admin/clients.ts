import {
  createAdminPortalServiceClient,
  createApiAuditLogServiceClient,
  createApiServiceClient,
  createAuthenticationServiceClient,
  createDictEntryServiceClient,
  createDictTypeServiceClient,
  createFileServiceClient,
  createInternalMessageRecipientServiceClient,
  createInternalMessageServiceClient,
  createLoginAuditLogServiceClient,
  createMenuServiceClient,
  createOrgUnitServiceClient,
  createPermissionAuditLogServiceClient,
  createPermissionGroupServiceClient,
  createPermissionServiceClient,
  createPositionServiceClient,
  createRoleServiceClient,
  createTenantServiceClient,
  createUserProfileServiceClient,
  createUserServiceClient,
} from '#/api/generated/admin/service/v1';

import { adminRequestHandler } from './request-handler';

export const adminPortalClient =
  createAdminPortalServiceClient(adminRequestHandler);

export const apiAuditLogClient =
  createApiAuditLogServiceClient(adminRequestHandler);

export const apiClient = createApiServiceClient(adminRequestHandler);

export const authenticationClient =
  createAuthenticationServiceClient(adminRequestHandler);

export const dictCategoryClient =
  createDictTypeServiceClient(adminRequestHandler);

export const dictLabelClient =
  createDictEntryServiceClient(adminRequestHandler);

export const fileClient = createFileServiceClient(adminRequestHandler);

export const loginAuditLogClient =
  createLoginAuditLogServiceClient(adminRequestHandler);

export const internalMessageClient =
  createInternalMessageServiceClient(adminRequestHandler);

export const internalMessageRecipientClient =
  createInternalMessageRecipientServiceClient(adminRequestHandler);

export const menuClient = createMenuServiceClient(adminRequestHandler);

export const permissionAuditLogClient =
  createPermissionAuditLogServiceClient(adminRequestHandler);

export const orgUnitClient = createOrgUnitServiceClient(adminRequestHandler);

export const permissionClient =
  createPermissionServiceClient(adminRequestHandler);

export const permissionGroupClient =
  createPermissionGroupServiceClient(adminRequestHandler);

export const positionClient = createPositionServiceClient(adminRequestHandler);

export const roleClient = createRoleServiceClient(adminRequestHandler);

export const tenantClient = createTenantServiceClient(adminRequestHandler);

export const userClient = createUserServiceClient(adminRequestHandler);

export const userProfileClient =
  createUserProfileServiceClient(adminRequestHandler);
