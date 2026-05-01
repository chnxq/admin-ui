import { describe, expect, it } from 'vitest';

import {
  buildAdminTableCsv,
  filterVisibleAdminTableColumns,
  flattenAdminTableData,
  getAdminTableColumnKey,
  getDefaultVisibleColumnKeys,
} from './shared';

describe('admin-table-toolbar shared', () => {
  it('returns stable default visible column keys', () => {
    const columns = [
      { dataIndex: 'id', title: 'ID' },
      { key: 'identity', title: 'User' },
      { dataIndex: ['meta', 'title'], title: 'Title' },
    ];

    expect(getDefaultVisibleColumnKeys(columns)).toEqual([
      'id',
      'identity',
      'meta.title',
    ]);
  });

  it('keeps alwaysVisible columns when filtering visible columns', () => {
    const columns = [
      { dataIndex: 'id', title: 'ID' },
      { key: 'name', title: 'Name' },
      { key: 'action', title: 'Action', alwaysVisible: true },
    ];

    const filtered = filterVisibleAdminTableColumns(columns, ['id']);

    expect(filtered.map((column) => getAdminTableColumnKey(column))).toEqual([
      'id',
      'action',
    ]);
  });

  it('flattens tree rows in depth-first order', () => {
    const rows = [
      {
        id: 1,
        name: 'root',
        children: [
          { id: 2, name: 'child-1' },
          {
            id: 3,
            name: 'child-2',
            children: [{ id: 4, name: 'leaf' }],
          },
        ],
      },
    ];

    expect(flattenAdminTableData(rows).map((item) => item.id)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('builds csv with heuristic export values and utf-8 bom', () => {
    const csv = buildAdminTableCsv(
      [
        { key: 'identity', title: 'User' },
        { key: 'contact', title: 'Contact' },
        { key: 'roles', title: 'Roles' },
        { key: 'action', title: 'Action', exportDisabled: true },
      ],
      [
        {
          email: 'admin@example.com',
          mobile: '13800000000',
          realname: 'Administrator',
          roleNames: ['Admin', 'Auditor'],
          username: 'admin',
        },
      ],
    );

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('User,Contact,Roles');
    expect(csv).toContain('admin / Administrator');
    expect(csv).toContain('13800000000 / admin@example.com');
    expect(csv).toContain('Admin / Auditor');
    expect(csv).not.toContain('Action');
  });
});
