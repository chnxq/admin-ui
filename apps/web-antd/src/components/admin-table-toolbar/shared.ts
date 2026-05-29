import type { TableColumnsType } from 'ant-design-vue';

import { $t } from '@vben/locales';

type ColumnPath = Array<number | string> | number | string;
type AdminTableSortOrder = 'ascend' | 'descend';

type AdminTableColumnBase<T> = TableColumnsType<T>[number] & {
  alwaysVisible?: boolean;
  columnLabel?: string;
  dataIndex?: ColumnPath;
  exportDisabled?: boolean;
  exportValue?: (record: T) => unknown;
  hideInColumnSettings?: boolean;
  key?: number | string;
  sortable?: boolean;
  sortField?: string;
};

export type AdminTableColumn<T = Record<string, any>> = AdminTableColumnBase<T>;
export interface AdminTableSorting {
  direction: 'ASC' | 'DESC';
  field: string;
}

interface AdminTableSorterLike<T = Record<string, any>> {
  column?: AdminTableColumn<T>;
  field?: ColumnPath;
  order?: AdminTableSortOrder | null;
}

function normalizePath(path?: ColumnPath): Array<number | string> {
  if (Array.isArray(path)) {
    return path;
  }
  if (path === undefined || path === null || path === '') {
    return [];
  }
  return String(path).split('.');
}

function escapeCsvCell(value: string) {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}

function toSnakeCase(value: string) {
  return value
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replaceAll(/[-\s]+/g, '_')
    .toLowerCase();
}

export function getAdminTableColumnKey<T>(
  column: Pick<AdminTableColumnBase<T>, 'dataIndex' | 'key'>,
) {
  if (column.key !== undefined && column.key !== null && column.key !== '') {
    return String(column.key);
  }

  const path = normalizePath(column.dataIndex as ColumnPath | undefined);
  return path.length > 0 ? path.map(String).join('.') : undefined;
}

export function getAdminTableColumnTitle<T>(
  column: Pick<AdminTableColumnBase<T>, 'columnLabel' | 'title'>,
) {
  if (typeof column.columnLabel === 'string' && column.columnLabel.trim()) {
    return column.columnLabel.trim();
  }
  if (typeof column.title === 'string' && column.title.trim()) {
    return column.title.trim();
  }
  return undefined;
}

export function getAdminTableColumnSortField<T>(
  column: Pick<AdminTableColumnBase<T>, 'dataIndex' | 'sortable' | 'sortField'>,
) {
  const configured = column.sortField?.trim();
  if (configured) {
    return configured;
  }
  if (!column.sortable) {
    return undefined;
  }

  const path = normalizePath(column.dataIndex as ColumnPath | undefined);
  if (path.length === 0) {
    return undefined;
  }

  return path.map((segment) => toSnakeCase(String(segment))).join('.');
}

export function getDefaultVisibleColumnKeys<T>(columns: AdminTableColumn<T>[]) {
  return columns
    .map((column) => getAdminTableColumnKey(column))
    .filter((key): key is string => Boolean(key));
}

export function filterVisibleAdminTableColumns<T>(
  columns: AdminTableColumn<T>[],
  visibleColumnKeys: string[],
) {
  const keySet = new Set(visibleColumnKeys);

  return columns.filter((column) => {
    const key = getAdminTableColumnKey(column);
    if (!key) {
      return true;
    }
    return column.alwaysVisible || keySet.has(key);
  });
}

export function applyAdminTableSorting<T>(
  columns: AdminTableColumn<T>[],
  sorting: AdminTableSorting[] = [],
): AdminTableColumn<T>[] {
  const sortingMap = new Map(
    sorting.map((item) => [
      item.field,
      item.direction === 'ASC' ? 'ascend' : 'descend',
    ]),
  );

  return columns.map((column) => {
    const sortField = getAdminTableColumnSortField(column);
    const sortOrder = sortField ? sortingMap.get(sortField) : undefined;
    if (!column.sortable && sortOrder === undefined) {
      return column;
    }

    return {
      ...column,
      sortOrder: (sortOrder ?? null) as AdminTableSortOrder | null,
    };
  });
}

export function toAdminTableSorting<T>(
  sorter?: AdminTableSorterLike<T> | AdminTableSorterLike<T>[],
) {
  const items = Array.isArray(sorter) ? sorter : (sorter ? [sorter] : []);

  return items.flatMap((item) => {
    const direction =
      item.order === 'ascend'
        ? 'ASC'
        : (item.order === 'descend'
          ? 'DESC'
          : undefined);
    if (!direction) {
      return [];
    }

    const field =
      (item.column && getAdminTableColumnSortField(item.column)) ||
      normalizeSortField(item.field);
    if (!field) {
      return [];
    }

    return [{ direction, field } satisfies AdminTableSorting];
  });
}

export function flattenAdminTableData<T extends Record<string, any>>(
  records: T[],
  childrenKey: string = 'children',
) {
  const flattened: T[] = [];

  const visit = (items: T[]) => {
    for (const item of items) {
      flattened.push(item);
      const children = item[childrenKey];
      if (Array.isArray(children) && children.length > 0) {
        visit(children);
      }
    }
  };

  visit(records);
  return flattened;
}

export function resolveAdminTableExportValue<T extends Record<string, any>>(
  record: T,
  column: AdminTableColumn<T>,
) {
  if (typeof column.exportValue === 'function') {
    return column.exportValue(record);
  }

  const heuristicValue = resolveHeuristicExportValue(record, column);
  if (heuristicValue !== undefined) {
    return heuristicValue;
  }

  const path = normalizePath(column.dataIndex);
  if (path.length === 0) {
    const columnKey = getAdminTableColumnKey(column);
    if (!columnKey) {
      return undefined;
    }
    return resolveValueByPath(record, normalizePath(columnKey));
  }

  return resolveValueByPath(record, path);
}

export function buildAdminTableCsv<T extends Record<string, any>>(
  columns: AdminTableColumn<T>[],
  records: T[],
) {
  const exportColumns = columns.filter((column) => {
    const key = getAdminTableColumnKey(column);
    const title = getAdminTableColumnTitle(column);
    return Boolean(key && title && !column.exportDisabled);
  });

  const header = exportColumns
    .map((column) => escapeCsvCell(getAdminTableColumnTitle(column) ?? ''))
    .join(',');

  const lines = records.map((record) =>
    exportColumns
      .map((column) =>
        escapeCsvCell(
          normalizeAdminTableExportValue(
            resolveAdminTableExportValue(record, column),
          ),
        ),
      )
      .join(','),
  );

  return [`\uFEFF${header}`, ...lines].join('\r\n');
}

function normalizeAdminTableExportValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeAdminTableExportValue(item))
      .filter(Boolean)
      .join(' / ');
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function resolveHeuristicExportValue<T extends Record<string, any>>(
  record: T,
  column: AdminTableColumn<T>,
) {
  const key = getAdminTableColumnKey(column);

  switch (key) {
    case 'contact': {
      return [record.mobile, record.email].filter(Boolean).join(' / ');
    }
    case 'identity': {
      return [record.username, record.realname ?? record.nickname]
        .filter(Boolean)
        .join(' / ');
    }
    case 'menu': {
      return [record.meta?.title, record.name ?? record.path]
        .filter(Boolean)
        .join(' / ');
    }
    case 'orgUnit': {
      return [record.name, record.description].filter(Boolean).join(' / ');
    }
    case 'orgUnits': {
      return record.orgUnitNames ?? [];
    }
    case 'permission': {
      return [record.name, record.code].filter(Boolean).join(' / ');
    }
    case 'position': {
      return [record.name, record.code].filter(Boolean).join(' / ');
    }
    case 'positions': {
      return record.positionNames ?? [];
    }
    case 'resource': {
      return [
        $t('ui.tableToolbar.menuCount', [record.menuIds?.length ?? 0]),
        $t('ui.tableToolbar.apiCount', [record.apiIds?.length ?? 0]),
      ].join(' / ');
    }
    case 'role': {
      return [record.name, record.code].filter(Boolean).join(' / ');
    }
    case 'roles': {
      return record.roleNames?.length ? record.roleNames : (record.roles ?? []);
    }
    case 'tenant': {
      return [record.name, record.code].filter(Boolean).join(' / ');
    }
    default: {
      return undefined;
    }
  }
}

function normalizeSortField(field?: ColumnPath) {
  const path = normalizePath(field);
  if (path.length === 0) {
    return undefined;
  }

  return path.map((segment) => toSnakeCase(String(segment))).join('.');
}

function resolveValueByPath(
  source: Record<string, any>,
  path: Array<number | string>,
) {
  let value: unknown = source;

  for (const key of path) {
    if (value === null || value === undefined) {
      return value;
    }
    value = (value as Record<string, unknown>)[key];
  }

  return value;
}
