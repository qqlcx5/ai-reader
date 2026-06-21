/**
 * M1 Entry & Layout — Application Routes
 *
 * Defines all navigation destinations within the extension.
 * Based on design-01-entry-layout.md §3.1.
 */

export enum AppRoute {
  Home = 'home',
  History = 'history',
  Settings = 'settings',
  Workflows = 'workflows',
}

export interface RouteMeta {
  route: AppRoute;
  params?: Record<string, string>;
}

export const ROUTE_LABELS: Record<AppRoute, string> = {
  [AppRoute.Home]: 'Chat',
  [AppRoute.History]: 'History',
  [AppRoute.Settings]: 'Settings',
  [AppRoute.Workflows]: 'Workflows',
};
