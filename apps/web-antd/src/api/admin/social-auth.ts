import type {
  authenticationservicev1_AuthFlowStatus,
  authenticationservicev1_CompleteSocialLoginResponse,
  authenticationservicev1_ConfirmLinkOAuthResponse,
  authenticationservicev1_ListLinkedAccountsResponse,
  authenticationservicev1_ListProvidersResponse,
  authenticationservicev1_LoginResponse,
  authenticationservicev1_OAuthProvider,
  authenticationservicev1_RegisterUserRequest,
  authenticationservicev1_SocialAuthPendingBinding,
} from '#/api/generated/admin/service/v1';

import { authFlowClient, oauthClient, socialAuthClient } from './clients';

const SOCIAL_AUTH_STORAGE_KEY = 'admin.social_auth.session';
const SOCIAL_LINK_OAUTH_STORAGE_KEY = 'admin.social_auth.link_oauth';
const REFRESH_TOKEN_STORAGE_KEY = 'admin.refresh_token';

export type SocialProvider = 'alipay' | 'dingtalk' | 'github' | 'wechat';

export interface SocialLinkedAccount {
  accountId: string;
  connectedAt: string;
  credentialId: number;
  displayName: string;
  isBound: boolean;
  provider: SocialProvider;
  providerAccountId: string;
  providerLabel: string;
}

export interface SocialProviderOption {
  authorizationEndpoint?: string;
  defaultScopes: string[];
  displayName: string;
  enabled: boolean;
  provider: SocialProvider;
  providerKey: string;
}

export interface SocialAuthStartResult {
  authorizationUrl?: string;
  provider: SocialProvider;
  qrCodeUrl?: string;
  scene: 'oauth' | 'qrcode';
  sessionId: string;
  sessionToken?: string;
  state: 'pending' | 'unbound';
}

export interface SocialProfileSummary {
  avatar: string;
  bindToken?: string;
  nickname: string;
  provider: SocialProvider;
  providerLabel: string;
  sessionId: string;
}

export interface SocialAuthPendingResult {
  bindToken?: string;
  login?: authenticationservicev1_LoginResponse;
  profile?: SocialProfileSummary;
  sessionId: string;
  state: 'confirmed' | 'expired' | 'pending' | 'scanned' | 'unbound';
}

function getRefreshTokenStorage() {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function getSessionStorage() {
  return typeof window === 'undefined' ? undefined : window.sessionStorage;
}

function setRefreshToken(token?: string) {
  const storage = getRefreshTokenStorage();
  if (!storage) {
    return;
  }
  if (token) {
    storage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
  } else {
    storage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
}

export function persistSocialAuthSession(
  provider: SocialProvider,
  session: SocialAuthStartResult,
) {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  storage.setItem(
    SOCIAL_AUTH_STORAGE_KEY,
    JSON.stringify({
      provider,
      session,
    }),
  );
}

export function restoreSocialAuthSession(): null | {
  provider: SocialProvider;
  session: SocialAuthStartResult;
} {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }
  const raw = storage.getItem(SOCIAL_AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as {
      provider: SocialProvider;
      session: SocialAuthStartResult;
    };
  } catch {
    storage.removeItem(SOCIAL_AUTH_STORAGE_KEY);
    return null;
  }
}

export function clearSocialAuthSession() {
  getSessionStorage()?.removeItem(SOCIAL_AUTH_STORAGE_KEY);
}

export function persistLinkOAuthContext(context: {
  operationId: string;
  provider: SocialProvider;
}) {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  storage.setItem(SOCIAL_LINK_OAUTH_STORAGE_KEY, JSON.stringify(context));
}

export function restoreLinkOAuthContext(): null | {
  operationId: string;
  provider: SocialProvider;
} {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }
  const raw = storage.getItem(SOCIAL_LINK_OAUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as {
      operationId: string;
      provider: SocialProvider;
    };
  } catch {
    storage.removeItem(SOCIAL_LINK_OAUTH_STORAGE_KEY);
    return null;
  }
}

export function clearLinkOAuthContext() {
  getSessionStorage()?.removeItem(SOCIAL_LINK_OAUTH_STORAGE_KEY);
}

export function applySocialLoginTokens(
  response?: authenticationservicev1_LoginResponse,
) {
  if (!response?.access_token) {
    throw new Error('Social login response does not include access_token.');
  }
  setRefreshToken(response.refresh_token);
  return response.access_token;
}

export interface SocialBindExistingParams {
  bindToken: string;
  captchaCode: string;
  captchaId: string;
  identifier: string;
  password: string;
  type: 'email' | 'mobile' | 'username';
}

function providerLabel(provider: SocialProvider) {
  switch (provider) {
    case 'alipay': {
      return 'Alipay';
    }
    case 'dingtalk': {
      return 'DingTalk';
    }
    case 'wechat': {
      return 'WeChat';
    }
    default: {
      return 'GitHub';
    }
  }
}

function providerFromKey(providerKey?: string): SocialProvider {
  switch ((providerKey || '').trim()) {
    case 'alipay':
    case 'alipay_miniapp': {
      return 'alipay';
    }
    case 'dingtalk':
    case 'dingtalk_web': {
      return 'dingtalk';
    }
    case 'wechat':
    case 'wechat_miniapp':
    case 'wechat_web': {
      return 'wechat';
    }
    default: {
      return 'github';
    }
  }
}

function toOAuthProvider(
  provider: SocialProvider,
): authenticationservicev1_OAuthProvider {
  switch (provider) {
    case 'alipay': {
      return 'ALIPAY';
    }
    case 'dingtalk': {
      return 'DINGTALK';
    }
    case 'wechat': {
      return 'WECHAT';
    }
    default: {
      return 'GITHUB';
    }
  }
}

function toPendingState(status?: authenticationservicev1_AuthFlowStatus) {
  switch (status) {
    case 'AUTH_FLOW_CONFIRMED': {
      return 'confirmed';
    }
    case 'AUTH_FLOW_EXPIRED': {
      return 'expired';
    }
    case 'AUTH_FLOW_SCANNED': {
      return 'scanned';
    }
    case 'AUTH_FLOW_UNBOUND': {
      return 'unbound';
    }
    default: {
      return 'pending';
    }
  }
}

function toProfileSummary(
  provider: SocialProvider,
  pending?: authenticationservicev1_SocialAuthPendingBinding,
): SocialProfileSummary | undefined {
  if (!pending?.profile || !pending.sessionId) {
    return undefined;
  }
  return {
    avatar: pending.profile.avatar || '',
    bindToken: pending.bindToken,
    nickname: pending.profile.nickname || providerLabel(provider),
    provider,
    providerLabel: providerLabel(provider),
    sessionId: pending.sessionId,
  };
}

function normalizeCompleteResponse(
  provider: SocialProvider,
  response: authenticationservicev1_CompleteSocialLoginResponse,
): SocialAuthPendingResult {
  if (response.status === 'SOCIAL_AUTH_BOUND') {
    return {
      login: response.login,
      sessionId: response.pending?.sessionId || '',
      state: 'confirmed',
    };
  }
  if (response.status === 'SOCIAL_AUTH_UNBOUND') {
    return {
      bindToken: response.pending?.bindToken,
      profile: toProfileSummary(provider, response.pending),
      sessionId: response.pending?.sessionId || '',
      state: 'unbound',
    };
  }
  return {
    sessionId: response.pending?.sessionId || '',
    state: 'pending',
  };
}

export async function startSocialAuthApi(
  provider: SocialProvider,
): Promise<SocialAuthStartResult> {
  const response = await socialAuthClient.StartSocialLogin({
    clientType: 'admin',
    provider: toOAuthProvider(provider),
    providerKey: provider,
    redirectUri: undefined,
    scopes: [],
  });
  return {
    authorizationUrl: response.authorizationUrl,
    provider,
    qrCodeUrl: response.qrCodeUrl,
    scene:
      provider === 'wechat' || provider === 'dingtalk' ? 'qrcode' : 'oauth',
    sessionId: response.sessionId || '',
    sessionToken: response.state,
    state: 'pending',
  };
}

export async function completeSocialAuthApi(
  provider: SocialProvider,
  sessionId: string | undefined,
  code: string,
  state?: string,
) {
  const response = await socialAuthClient.CompleteSocialLogin({
    clientType: 'admin',
    code,
    provider: toOAuthProvider(provider),
    providerKey: provider,
    redirectUri:
      provider === 'github'
        ? `${window.location.origin}/auth/social/callback/github`
        : undefined,
    sessionId,
    state,
  });
  return normalizeCompleteResponse(provider, response);
}

export async function pollSocialAuthApi(
  _provider: SocialProvider,
  sessionId: string,
  sessionToken?: string,
): Promise<SocialAuthPendingResult> {
  const response = await authFlowClient.PollAuthSession({
    sessionId,
    sessionToken,
  });
  return {
    sessionId,
    state: toPendingState(response.status),
  };
}

export async function bindExistingSocialAuthApi(
  params: SocialBindExistingParams,
) {
  const payload: Record<string, string> = {
    captchaCode: params.captchaCode,
    captchaId: params.captchaId,
    password: params.password,
    [params.type]: params.identifier,
  };
  return await socialAuthClient.ConfirmBindOrRegister({
    bindToken: params.bindToken,
    clientType: 'admin',
    existing: payload,
    operation: 'BIND_EXISTING',
  });
}

export async function registerAndBindSocialAuthApi(
  bindToken: string,
  registration: authenticationservicev1_RegisterUserRequest,
) {
  return await socialAuthClient.ConfirmBindOrRegister({
    bindToken,
    clientType: 'admin',
    operation: 'REGISTER_NEW',
    registration,
  });
}

function toLinkedAccounts(
  response: authenticationservicev1_ListLinkedAccountsResponse,
): SocialLinkedAccount[] {
  return (response.items || []).map((item) => {
    const provider = providerFromKey(item.provider);
    return {
      accountId: item.identifier || item.providerAccountId || '',
      connectedAt: item.createdAt || item.updatedAt || '',
      credentialId: item.id || 0,
      displayName:
        item.providerAccountId || item.identifier || providerLabel(provider),
      isBound: item.status === 'ENABLED',
      provider,
      providerAccountId: item.providerAccountId || '',
      providerLabel: providerLabel(provider),
    };
  });
}

export async function listLinkedAccountsApi() {
  const response = await oauthClient.ListLinkedAccounts({});
  return toLinkedAccounts(response);
}

export async function listSocialProvidersApi() {
  const response: authenticationservicev1_ListProvidersResponse =
    await oauthClient.ListProviders({});
  return (response.items || []).map((item) => {
    const provider = providerFromKey(item.providerCustom);
    return {
      authorizationEndpoint: item.authorizationEndpoint,
      defaultScopes: item.defaultScopes || [],
      displayName: item.displayName || providerLabel(provider),
      enabled: Boolean(item.authorizationEndpoint || provider === 'github'),
      provider,
      providerKey: item.providerCustom || provider,
    } satisfies SocialProviderOption;
  });
}

export async function startLinkSocialAccountApi(provider: SocialProvider) {
  return await oauthClient.StartLinkOAuth({
    provider: toOAuthProvider(provider),
    providerCustom: provider,
    redirectUri: undefined,
    scopes: [],
  });
}

export async function confirmLinkSocialAccountApi(params: {
  code: string;
  operationId?: string;
  provider: SocialProvider;
  state?: string;
}) {
  const response: authenticationservicev1_ConfirmLinkOAuthResponse =
    await oauthClient.ConfirmLinkOAuth({
      code: params.code,
      operationId: params.operationId,
      provider: toOAuthProvider(params.provider),
      providerCustom: params.provider,
      state: params.state,
    });
  return response;
}

export async function unlinkSocialAccountApi(credentialId: number) {
  return await oauthClient.UnlinkOAuth({
    credentialId: String(credentialId),
    provider: 'OAUTH_PROVIDER_UNSPECIFIED',
    providerCustom: '',
  });
}
