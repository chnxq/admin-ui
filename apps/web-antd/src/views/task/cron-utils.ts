import { preferences } from '@vben/preferences';

import cronstrue from 'cronstrue/i18n';

function resolveCronLocale() {
  return preferences.app.locale === 'zh-CN' ? 'zh_CN' : 'en';
}

export function formatCronDescription(expression?: string) {
  const cron = expression?.trim();
  if (!cron) {
    return '';
  }

  try {
    return cronstrue.toString(cron, {
      locale: resolveCronLocale(),
      throwExceptionOnParseError: true,
      use24HourTimeFormat: true,
      verbose: true,
    });
  } catch {
    return '';
  }
}

export function isValidCronExpression(expression?: string) {
  const cron = expression?.trim();
  if (!cron) {
    return false;
  }
  return !!formatCronDescription(cron);
}
