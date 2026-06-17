import type { Locale } from 'ant-design-vue/es/locale';

import type { App } from 'vue';

import type { LocaleSetupOptions, SupportedLanguagesType } from '@vben/locales';

import { ref } from 'vue';

import {
  $t,
  setupI18n as coreSetup,
  loadLocalesMapFromDir,
} from '@vben/locales';
import { preferences } from '@vben/preferences';

import antdEnLocale from 'ant-design-vue/es/locale/en_US';
import antdDefaultLocale from 'ant-design-vue/es/locale/zh_CN';
import dayjs from 'dayjs';

const antdLocale = ref<Locale>(antdDefaultLocale);

const modules = import.meta.glob('./langs/**/*.json');
const generatedPageI18nModules = import.meta.glob(
  '../views/generated/**/page_i18n.*.json',
);
const generatedLocaleModules = import.meta.glob(
  '../views/generated/**/langs/**/*.json',
);

const localesMap = loadLocalesMapFromDir(
  /\.\/langs\/([^/]+)\/(.*)\.json$/,
  modules,
);
const generatedLocalesMap = loadLocalesMapFromDir(
  /\.\.\/views\/generated\/.*\/langs\/([^/]+)\/(.*)\.json$/,
  generatedLocaleModules,
);

function setNestedValue(
  target: Record<string, any>,
  path: string[],
  value: unknown,
) {
  let current = target;
  for (const segment of path.slice(0, -1)) {
    const existing = current[segment];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      current[segment] = {};
    }
    current = current[segment];
  }
  const leaf = path.at(-1);
  if (leaf) {
    current[leaf] = value;
  }
}

function expandFlatMessages(source: Record<string, unknown>) {
  const expanded: Record<string, any> = {};
  for (const [key, value] of Object.entries(source)) {
    setNestedValue(expanded, key.split('.'), value);
  }
  return expanded;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeLocaleMessages(
  target: Record<string, any>,
  source: Record<string, any>,
) {
  const result: Record<string, any> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const existing = result[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = mergeLocaleMessages(existing, value);
      continue;
    }
    result[key] = value;
  }
  return result;
}

async function loadGeneratedPageMessages(lang: SupportedLanguagesType) {
  const fileName =
    lang === 'zh-CN' ? 'page_i18n.zh-CN.json' : 'page_i18n.en-US.json';
  const matchedEntries = Object.entries(generatedPageI18nModules).filter(
    ([path]) => path.endsWith(`/${fileName}`),
  );
  if (matchedEntries.length === 0) {
    return {};
  }

  const messageModules = await Promise.all(
    matchedEntries.map(([, importer]) => importer()),
  );
  const mergedMessages: Record<string, any> = {};
  for (const mod of messageModules) {
    const raw = (mod as any)?.default;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const expandedMessages = expandFlatMessages(
        raw as Record<string, unknown>,
      );
      const nextMessages = mergeLocaleMessages(
        mergedMessages,
        expandedMessages,
      );
      for (const [key, value] of Object.entries(nextMessages)) {
        mergedMessages[key] = value;
      }
    }
  }
  return mergedMessages;
}

async function loadGeneratedLocaleMessages(lang: SupportedLanguagesType) {
  const generatedLocaleMessages = await generatedLocalesMap[lang]?.();
  return generatedLocaleMessages?.default ?? {};
}
/**
 * 加载应用特有的语言包
 * 这里也可以改造为从服务端获取翻译数据
 * @param lang
 */
async function loadMessages(lang: SupportedLanguagesType) {
  const [appLocaleMessages, generatedLocaleMessages, generatedPageMessages] =
    await Promise.all([
      localesMap[lang]?.(),
      loadGeneratedLocaleMessages(lang),
      loadGeneratedPageMessages(lang),
      loadThirdPartyMessage(lang),
    ]);
  const baseMessages = appLocaleMessages?.default ?? {};
  return mergeLocaleMessages(
    mergeLocaleMessages(baseMessages, generatedLocaleMessages),
    generatedPageMessages,
  );
}

/**
 * 加载第三方组件库的语言包
 * @param lang
 */
async function loadThirdPartyMessage(lang: SupportedLanguagesType) {
  await Promise.all([loadAntdLocale(lang), loadDayjsLocale(lang)]);
}

/**
 * 加载dayjs的语言包
 * @param lang
 */
async function loadDayjsLocale(lang: SupportedLanguagesType) {
  let locale;
  switch (lang) {
    case 'en-US': {
      locale = await import('dayjs/locale/en');
      break;
    }
    case 'zh-CN': {
      locale = await import('dayjs/locale/zh-cn');
      break;
    }
    // 默认使用英语
    default: {
      locale = await import('dayjs/locale/en');
    }
  }
  if (locale) {
    dayjs.locale(locale);
  } else {
    console.error(`Failed to load dayjs locale for ${lang}`);
  }
}

/**
 * 加载antd的语言包
 * @param lang
 */
async function loadAntdLocale(lang: SupportedLanguagesType) {
  switch (lang) {
    case 'en-US': {
      antdLocale.value = antdEnLocale;
      break;
    }
    case 'zh-CN': {
      antdLocale.value = antdDefaultLocale;
      break;
    }
  }
}

async function setupI18n(app: App, options: LocaleSetupOptions = {}) {
  await coreSetup(app, {
    defaultLocale: preferences.app.locale,
    loadMessages,
    missingWarn: !import.meta.env.PROD,
    ...options,
  });
}

export { $t, antdLocale, setupI18n };
