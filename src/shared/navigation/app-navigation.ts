export type AppRole = 'Admin' | 'Employee';

export type NavigationItem = {
  label: string;
  to: string;
  roles: readonly AppRole[];
  icon: NavigationIcon;
};

export type NavigationIcon =
  | 'home'
  | 'receipt'
  | 'truck'
  | 'users'
  | 'package'
  | 'alert'
  | 'clipboard'
  | 'wallet'
  | 'calendar'
  | 'campaign';

export type NavigationGroup = {
  label: string;
  items: readonly NavigationItem[];
};

const allStaff: readonly AppRole[] = ['Admin', 'Employee'];
const adminsOnly: readonly AppRole[] = ['Admin'];

export const appNavigation: readonly NavigationGroup[] = [
  {
    label: 'Operación',
    items: [
      { label: 'Resumen', to: '/', roles: allStaff, icon: 'home' },
      { label: 'Ventas', to: '/sales', roles: allStaff, icon: 'receipt' },
      { label: 'Envíos', to: '/shipments', roles: allStaff, icon: 'truck' },
      { label: 'Clientes', to: '/clients', roles: allStaff, icon: 'users' },
      { label: 'Reservas', to: '/reservations', roles: allStaff, icon: 'calendar' },
    ],
  },
  {
    label: 'Inventario',
    items: [
      { label: 'Productos', to: '/products', roles: allStaff, icon: 'package' },
      { label: 'Incidencias', to: '/inventory/issues', roles: allStaff, icon: 'alert' },
      { label: 'Compras', to: '/purchases/orders', roles: adminsOnly, icon: 'clipboard' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { label: 'Finanzas', to: '/finances', roles: adminsOnly, icon: 'wallet' },
      {
        label: 'Campañas',
        to: '/discounts/campaigns',
        roles: adminsOnly,
        icon: 'campaign',
      },
      { label: 'Usuarios', to: '/users', roles: adminsOnly, icon: 'users' },
    ],
  },
];

export function getVisibleNavigation(roles: readonly string[]): NavigationGroup[] {
  return appNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.roles.some((role) => roles.includes(role)),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
