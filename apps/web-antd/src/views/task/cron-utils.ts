import { preferences } from '@vben/preferences';

import cronstrue from 'cronstrue/i18n';

function resolveCronLocale() {
  return preferences.app.locale === 'zh-CN' ? 'zh_CN' : 'en';
}

export function normalizeCronExpression(expression?: string) {
  const cron = expression?.trim();
  if (!cron) {
    return '';
  }

  const parts = cron.split(/\s+/).filter(Boolean);
  if (parts.length === 7) {
    return parts.slice(0, 6).join(' ');
  }
  return parts.join(' ');
}

export function formatCronDescription(expression?: string) {
  const cron = normalizeCronExpression(expression);
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
  const cron = normalizeCronExpression(expression);
  if (!cron) {
    return false;
  }
  return !!formatCronDescription(cron);
}
