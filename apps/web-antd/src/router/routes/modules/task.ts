import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:timer-reset',
      order: 35,
      title: $t('menu.task.moduleName'),
    },
    name: 'Task',
    path: '/task',
    children: [
      {
        name: 'TaskManagement',
        path: '/task/index',
        component: () => import('#/views/task/index.vue'),
        meta: {
          icon: 'lucide:list-checks',
          title: $t('menu.task.task'),
        },
      },
      {
        name: 'TaskLog',
        path: '/task/log',
        component: () => import('#/views/task/log/index.vue'),
        meta: {
          icon: 'lucide:scroll-text',
          title: $t('menu.task.log'),
        },
      },
    ],
  },
];

export default routes;
