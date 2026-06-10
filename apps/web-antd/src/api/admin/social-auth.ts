import type {
  authenticationservicev1_AuthFlowStatus,
  authenticationservicev1_CompleteSocialLoginResponse,
  authenticationservicev1_LoginResponse,
  authenticationservicev1_OAuthProvider,
  authenticationservicev1_RegisterUserRequest,
  authenticationservicev1_SocialAuthPendingBinding,
} from '#/api/generated/admin/service/v1';

import { authFlowClient, socialAuthClient } from './clients';

export type SocialProvider = 'alipay' | 'dingtalk' | 'github' | 'wechat';

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
  sessionId: string,
  code: string,
  state?: string,
) {
  const response = await socialAuthClient.CompleteSocialLogin({
    clientType: 'admin',
    code,
    provider: toOAuthProvider(provider),
    providerKey: provider,
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
