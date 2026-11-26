import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/DropdownMenu';
import { PageTransition } from '@/components/common/PageTransition';
import { DatabaseMaintenanceBanner } from '@/components/common/DatabaseMaintenanceBanner';
import { DatabaseMaintenanceProvider } from '@/components/common/DatabaseMaintenanceContext';
import { MainRoutes } from '@/router/MainRoutes';
import {
  IconActivity,
  IconBot,
  IconChartLine,
  IconCheck,
  IconGithub,
  IconHardDrive,
  IconKey,
  IconLayoutDashboard,
  IconLogOut,
  IconMonitor,
  IconMoon,
  IconMoreVertical,
  IconPanelLeftClose,
  IconPanelLeftOpen,
  IconPlugin,
  IconRefreshCw,
  IconScrollText,
  IconServer,
  IconSettings,
  IconShield,
  IconSun,
  IconX,
} from '@/components/ui/icons';
import {
  CPAMP_SYMBOL_BLACK_URL,
  CPAMP_SYMBOL_WHITE_URL,
  CPAMP_WORDMARK_BLACK_URL,
  CPAMP_WORDMARK_WHITE_URL,
} from '@/assets/brand';
import {
  useAuthStore,
  useConfigStore,
  useLanguageStore,
  useNotificationStore,
  useThemeStore,
} from '@/stores';
import { pluginsApi } from '@/services/api';
import {
  collectPluginResourceEntries,
  isPluginManagementNavVisible,
  isPluginResourceNavVisible,
  PLUGIN_RESOURCES_REFRESH_EVENT,
  resolvePluginAssetURL,
  type PluginResourceEntry,
} from '@/features/plugins/pluginResources';
import { triggerHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { usePanelFeatureAvailability } from '@/hooks/usePanelFeatureAvailability';
import { getDemoLogoutPath, prefixRouteBase, stripRouteBase } from '@/features/demo/demoMode';
import { LANGUAGE_LABEL_KEYS, LANGUAGE_ORDER, STORAGE_KEY_SIDEBAR } from '@/utils/constants';
import { isSupportedLanguage } from '@/utils/language';

const SIDEBAR_ICON_SIZE = 16;
const GITHUB_REPOSITORY_URL = 'https://github.com/seakee/CPA-Manager-Plus';

const sidebarIcons: Record<string, ReactNode> = {
  dashboard: <IconLayoutDashboard size={SIDEBAR_ICON_SIZE} />,
  usageAnalytics: <IconChartLine size={SIDEBAR_ICON_SIZE} />,
  monitoring: <IconActivity size={SIDEBAR_ICON_SIZE} />,
  maintenance: <IconHardDrive size={SIDEBAR_ICON_SIZE} />,
  aiProviders: <IconBot size={SIDEBAR_ICON_SIZE} />,
  plugins: <IconPlugin size={SIDEBAR_ICON_SIZE} />,
  config: <IconSettings size={SIDEBAR_ICON_SIZE} />,
  accounts: <IconShield size={SIDEBAR_ICON_SIZE} />,
  oauth: <IconKey size={SIDEBAR_ICON_SIZE} />,
  logs: <IconScrollText size={SIDEBAR_ICON_SIZE} />,
  system: <IconServer size={SIDEBAR_ICON_SIZE} />,
};

function PluginSidebarIcon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return showImage ? (
    <img src={src} alt="" onError={() => setFailed(true)} />
  ) : (
    <IconPlugin size={SIDEBAR_ICON_SIZE} />
  );
}

type NavItem = {
  path: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
  /** Rendered indented, for entries that belong to the item above them. */
  nested?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

interface MainLayoutProps {
  routeBase?: string;
  demoMode?: boolean;
}

function MainLayoutContent({ routeBase = '', demoMode = false }: MainLayoutProps = {}) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const location = useLocation();
  const navigate = useNavigate();
  const routePathname = stripRouteBase(location.pathname, routeBase);

  const logout = useAuthStore((state) => state.logout);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const apiBase = useAuthStore((state) => state.apiBase);
  const supportsPlugin = useAuthStore((state) => state.supportsPlugin);

  const config = useConfigStore((state) => state.config);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const clearCache = useConfigStore((state) => state.clearCache);
  const featureAvailability = usePanelFeatureAvailability();

  const theme = useThemeStore((state) => state.theme);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const cycleTheme = useThemeStore((state) => state.cycleTheme);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_SIDEBAR) === 'true';
    } catch {
      return false;
    }
  });
  const [pluginResources, setPluginResources] = useState<PluginResourceEntry[]>([]);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  const fullBrandName = 'CPA Manager Plus';
  const isLogsPage = routePathname.startsWith('/logs');
  const isPluginResourcePage = routePathname.startsWith('/plugin-pages');
  const isDarkTheme = resolvedTheme === 'dark';
  const showSidebarLabels = !sidebarCollapsed || sidebarOpen;
  const configPluginsEnabled = config?.pluginsEnabled;
  const pluginControlMenuVisible = isPluginManagementNavVisible({
    supportsPlugin,
    pluginsEnabled: configPluginsEnabled,
  });

  // 将顶部悬浮控制区高度写入 CSS 变量，供移动端粘性元素和浮层避让。
  useLayoutEffect(() => {
    const updateHeaderHeight = () => {
      const height = headerRef.current?.offsetHeight;
      if (height) {
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };

    updateHeaderHeight();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && headerRef.current
        ? new ResizeObserver(updateHeaderHeight)
        : null;
    if (resizeObserver && headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  // 将主内容区的中心点写入 CSS 变量，供底部浮层（配置面板操作栏、提供商导航）对齐到内容区
  useLayoutEffect(() => {
    const updateContentCenter = () => {
      const el = contentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      document.documentElement.style.setProperty('--content-center-x', `${centerX}px`);
    };

    updateContentCenter();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && contentRef.current
        ? new ResizeObserver(updateContentCenter)
        : null;

    if (resizeObserver && contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    window.addEventListener('resize', updateContentCenter);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateContentCenter);
      document.documentElement.style.removeProperty('--content-center-x');
    };
  }, []);

  useEffect(() => {
    fetchConfig().catch(() => {
      // ignore initial failure; login flow会提示
    });
  }, [fetchConfig]);

  const loadPluginResources = useCallback(async () => {
    if (connectionStatus !== 'connected' || !supportsPlugin) {
      setPluginResources([]);
      return;
    }

    try {
      const plugins = await pluginsApi.list();
      setPluginResources(
        isPluginResourceNavVisible({
          supportsPlugin,
          pluginsEnabled: plugins.pluginsEnabled,
        })
          ? collectPluginResourceEntries(plugins.plugins)
          : []
      );
    } catch {
      setPluginResources([]);
    }
  }, [connectionStatus, supportsPlugin]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPluginResources();
    }, 0);

    window.addEventListener(PLUGIN_RESOURCES_REFRESH_EVENT, loadPluginResources);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(PLUGIN_RESOURCES_REFRESH_EVENT, loadPluginResources);
    };
  }, [apiBase, configPluginsEnabled, loadPluginResources]);

  const handleLanguageSelect = (nextLanguage: string) => {
    if (!isSupportedLanguage(nextLanguage)) {
      return;
    }
    setLanguage(nextLanguage);
  };

  const handleLogout = () => {
    if (demoMode) {
      navigate(getDemoLogoutPath(routeBase), { replace: true });
      return;
    }
    logout();
  };

  // Built inline on purpose: the list is tiny, and capturing handlers inside a
  // manual memo is something the React Compiler lint rejects.
  const headerMenuItems: DropdownMenuItem[] = [
    ...LANGUAGE_ORDER.map((lang) => ({
      key: `language-${lang}`,
      label: t(LANGUAGE_LABEL_KEYS[lang]),
      icon: language === lang ? <IconCheck size={16} /> : undefined,
      onClick: () => handleLanguageSelect(lang),
    })),
    { key: 'divider-github', type: 'divider' as const },
    {
      key: 'github',
      label: t('header.open_github'),
      icon: <IconGithub size={16} />,
      onClick: () => window.open(GITHUB_REPOSITORY_URL, '_blank', 'noopener,noreferrer'),
    },
    { key: 'divider-logout', type: 'divider' as const },
    {
      key: 'logout',
      label: t('header.logout'),
      icon: <IconLogOut size={16} />,
      tone: 'danger' as const,
      onClick: handleLogout,
    },
  ];

  const dashboardNavItem: NavItem = {
    path: '/',
    label: t('nav.dashboard'),
    icon: sidebarIcons.dashboard,
  };
  const usageAnalyticsNavItem = featureAvailability.requestMonitoringAvailable
    ? {
        path: '/usage-analytics',
        label: t('nav.usage_analytics'),
        icon: sidebarIcons.usageAnalytics,
      }
    : null;
  const monitoringNavItem = featureAvailability.requestMonitoringAvailable
    ? {
        path: '/monitoring',
        label: t('nav.monitoring_center'),
        icon: sidebarIcons.monitoring,
      }
    : null;
  const usageMaintenanceNavItem: NavItem | null =
    featureAvailability.panelHostMode === 'manager_embedded' &&
    featureAvailability.managerServiceAvailable
      ? {
          path: '/usage-maintenance',
          label: t('nav.usage_maintenance', { defaultValue: 'Usage Maintenance' }),
          icon: sidebarIcons.maintenance,
        }
      : null;
  const operationNavItems: NavItem[] = [
    {
      path: '/logs',
      label: t('nav.logs'),
      icon: sidebarIcons.logs,
    },
  ];
  const pluginControlNavItems: NavItem[] = pluginControlMenuVisible
    ? [
        {
          path: '/plugins',
          label: t('nav.plugins'),
          icon: sidebarIcons.plugins,
        },
      ]
    : [];
  // Pages contributed by installed plugins. They sit beneath the Plugins entry
  // in their own sidebar group so they don't read as built-in pages.
  const pluginResourceNavItems: NavItem[] = pluginControlMenuVisible
    ? pluginResources.map((resource) => ({
        path: resource.route,
        label: resource.label,
        icon: <PluginSidebarIcon src={resolvePluginAssetURL(resource.pluginLogo, apiBase)} />,
        nested: true,
      }))
    : [];
  const navGroups: NavGroup[] = [
    {
      label: t('nav.group_overview', { defaultValue: 'Overview' }),
      items: [
        dashboardNavItem,
        ...(usageAnalyticsNavItem ? [usageAnalyticsNavItem] : []),
        ...(monitoringNavItem ? [monitoringNavItem] : []),
        ...(usageMaintenanceNavItem ? [usageMaintenanceNavItem] : []),
      ],
    },
    {
      label: t('nav.group_gateway', { defaultValue: 'Gateway' }),
      items: [
        {
          path: '/ai-providers',
          label: t('nav.ai_providers'),
          icon: sidebarIcons.aiProviders,
        },
        {
          path: '/accounts',
          label: t('nav.accounts', { defaultValue: t('accounts.title') }),
          icon: sidebarIcons.accounts,
        },
        {
          path: '/oauth',
          label: t('nav.oauth', { defaultValue: 'OAuth' }),
          icon: sidebarIcons.oauth,
        },
        {
          path: '/config',
          label: t('nav.config_management'),
          icon: sidebarIcons.config,
        },
      ],
    },
    {
      label: t('nav.group_plugins', { defaultValue: 'Plugins' }),
      items: [...pluginControlNavItems, ...pluginResourceNavItems],
    },
    {
      label: t('nav.group_system', { defaultValue: 'System' }),
      items: [
        ...operationNavItems,
        {
          path: '/system',
          label: t('nav.system_info'),
          icon: sidebarIcons.system,
        },
      ],
    },
  ].filter((group) => group.items.length > 0);
  const navItems = navGroups.flatMap((group) => group.items);
  const navOrder = navItems.map((item) => item.path);
  const getRouteOrder = (pathname: string) => {
    const trimmedPath =
      pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const normalizedPath = trimmedPath === '/dashboard' ? '/' : trimmedPath;

    const aiProvidersIndex = navOrder.indexOf('/ai-providers');
    if (aiProvidersIndex !== -1) {
      if (normalizedPath === '/ai-providers') return aiProvidersIndex;
      if (normalizedPath.startsWith('/ai-providers/')) {
        if (normalizedPath.startsWith('/ai-providers/gemini')) return aiProvidersIndex + 0.1;
        if (normalizedPath.startsWith('/ai-providers/codex')) return aiProvidersIndex + 0.2;
        if (normalizedPath.startsWith('/ai-providers/claude')) return aiProvidersIndex + 0.3;
        if (normalizedPath.startsWith('/ai-providers/vertex')) return aiProvidersIndex + 0.4;
        if (normalizedPath.startsWith('/ai-providers/openai')) return aiProvidersIndex + 0.6;
        return aiProvidersIndex + 0.05;
      }
    }

    const exactIndex = navOrder.indexOf(normalizedPath);
    if (exactIndex !== -1) return exactIndex;
    const nestedIndex = navOrder.findIndex(
      (path) => path !== '/' && normalizedPath.startsWith(`${path}/`)
    );
    return nestedIndex === -1 ? null : nestedIndex;
  };

  const getTransitionVariant = useCallback((fromPathname: string, toPathname: string) => {
    const normalize = (pathname: string) => {
      const trimmed =
        pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
      return trimmed === '/dashboard' ? '/' : trimmed;
    };

    const from = normalize(fromPathname);
    const to = normalize(toPathname);
    const isAccounts = (pathname: string) => pathname === '/accounts';
    const isAiProviders = (pathname: string) =>
      pathname === '/ai-providers' || pathname.startsWith('/ai-providers/');
    if (isAccounts(from) && isAccounts(to)) return 'ios';
    if (isAiProviders(from) && isAiProviders(to)) return 'ios';
    return 'none';
  }, []);

  const handleRefreshAll = async () => {
    clearCache();
    const results = await Promise.allSettled([
      fetchConfig(undefined, true),
      loadPluginResources(),
      triggerHeaderRefresh(),
    ]);
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected && rejected.status === 'rejected') {
      const reason = rejected.reason;
      const message =
        typeof reason === 'string' ? reason : reason instanceof Error ? reason.message : '';
      showNotification(
        `${t('notification.refresh_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
      return;
    }
    showNotification(t('notification.data_refreshed'), 'success');
  };

  const mobileSidebarToggleLabel = sidebarOpen
    ? t('sidebar.toggle_collapse', { defaultValue: 'Close navigation' })
    : t('sidebar.toggle_expand', { defaultValue: 'Open navigation' });
  const normalizedLocationPath =
    routePathname.length > 1 && routePathname.endsWith('/')
      ? routePathname.slice(0, -1)
      : routePathname;
  const currentPath = normalizedLocationPath === '/dashboard' ? '/' : normalizedLocationPath;
  const matchesNavPath = (item: NavItem, pathname: string) =>
    item.path === '/' || item.exact
      ? pathname === item.path
      : pathname === item.path || pathname.startsWith(`${item.path}/`);
  const activeNavItem =
    [...navItems]
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => matchesNavPath(item, currentPath)) ?? null;
  const standaloneRouteLabel =
    currentPath === '/accounts' ? t('nav.accounts', { defaultValue: t('accounts.title') }) : null;
  const currentRouteLabel = activeNavItem?.label ?? standaloneRouteLabel ?? fullBrandName;
  const themeLabel = t(
    theme === 'white' ? 'theme.white' : theme === 'dark' ? 'theme.dark' : 'theme.auto'
  );
  // The button cycles auto -> light -> dark, so the icon shows the active mode.
  const themeIcon =
    theme === 'white' ? (
      <IconSun size={16} />
    ) : theme === 'dark' ? (
      <IconMoon size={16} />
    ) : (
      <IconMonitor size={16} />
    );

  return (
    <div
      className={[
        'app-shell',
        sidebarCollapsed ? 'sidebar-is-collapsed' : '',
        isPluginResourcePage ? 'plugin-resource-shell' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="main-header" ref={headerRef}>
        <div className="navbar">
          <div className="navbar-left">
            <button
              type="button"
              className="hamburger-container"
              onClick={() => {
                if (window.matchMedia('(max-width: 768px)').matches) {
                  setSidebarOpen((prev) => !prev);
                  return;
                }
                setSidebarCollapsed((prev) => {
                  const next = !prev;
                  try {
                    localStorage.setItem(STORAGE_KEY_SIDEBAR, String(next));
                  } catch {
                    /* ignore storage failures */
                  }
                  return next;
                });
              }}
              title={mobileSidebarToggleLabel}
              aria-label={mobileSidebarToggleLabel}
            >
              {sidebarOpen ? (
                <IconX size={16} />
              ) : sidebarCollapsed ? (
                <IconPanelLeftOpen size={16} />
              ) : (
                <IconPanelLeftClose size={16} />
              )}
            </button>

            <nav
              className="app-breadcrumb"
              aria-label={t('common.navigation', { defaultValue: 'Navigation' })}
            >
              <span className="breadcrumb-item">{currentRouteLabel}</span>
            </nav>
          </div>

          <div className="navbar-right">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshAll}
              title={t('header.refresh_all')}
              aria-label={t('header.refresh_all')}
            >
              <IconRefreshCw size={16} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={cycleTheme}
              title={`${t('theme.switch')}: ${themeLabel}`}
              aria-label={`${t('theme.switch')}: ${themeLabel}`}
            >
              {themeIcon}
            </Button>

            <DropdownMenu
              ariaLabel={t('header.menu', { defaultValue: 'Menu' })}
              triggerTitle={t('header.menu', { defaultValue: 'Menu' })}
              triggerClassName="header-menu-trigger"
              triggerIcon={<IconMoreVertical size={16} />}
              items={headerMenuItems}
            />
          </div>
        </div>
      </header>

      <div className="main-body">
        <button
          type="button"
          className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-label={t('common.close')}
          aria-hidden={!sidebarOpen}
          tabIndex={sidebarOpen ? 0 : -1}
        />

        <aside
          className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}
        >
          <NavLink
            to={prefixRouteBase('/', routeBase)}
            end
            className="sidebar-brand"
            title={fullBrandName}
            aria-label={fullBrandName}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-brand-main">
              <img
                src={isDarkTheme ? CPAMP_SYMBOL_WHITE_URL : CPAMP_SYMBOL_BLACK_URL}
                alt=""
                className="sidebar-brand-symbol"
              />
              {showSidebarLabels && (
                <img
                  src={isDarkTheme ? CPAMP_WORDMARK_WHITE_URL : CPAMP_WORDMARK_BLACK_URL}
                  alt="CPA Manager Plus"
                  className="sidebar-brand-wordmark"
                />
              )}
            </span>
          </NavLink>

          <div className="nav-section">
            {navGroups.map((group, groupIndex) => (
              <div className="nav-menu-section" key={`nav-section-${groupIndex}`}>
                {showSidebarLabels ? (
                  <div className="nav-menu-label">{group.label}</div>
                ) : groupIndex > 0 ? (
                  <div className="nav-menu-divider" aria-hidden="true" />
                ) : null}
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={prefixRouteBase(item.path, routeBase)}
                    end={item.path === '/' || item.exact}
                    className={({ isActive }) =>
                      `nav-item ${item.nested ? 'nav-item-nested' : ''} ${
                        isActive || matchesNavPath(item, currentPath) ? 'active' : ''
                      }`
                    }
                    onClick={() => setSidebarOpen(false)}
                    title={item.label}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {showSidebarLabels && <span className="nav-label">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <div
          className={[
            'content',
            isLogsPage ? 'content-logs' : '',
            isPluginResourcePage ? 'content-plugin-resource' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          ref={contentRef}
        >
          <main
            className={[
              'main-content',
              isLogsPage ? 'main-content-logs' : '',
              isPluginResourcePage ? 'main-content-plugin-resource' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <DatabaseMaintenanceBanner />
            <PageTransition
              key={routeBase || 'main'}
              render={(location) => <MainRoutes location={location} routeBase={routeBase} />}
              getRouteOrder={(pathname) => getRouteOrder(stripRouteBase(pathname, routeBase))}
              getTransitionVariant={(fromPathname, toPathname) =>
                getTransitionVariant(
                  stripRouteBase(fromPathname, routeBase),
                  stripRouteBase(toPathname, routeBase)
                )
              }
              scrollContainerRef={contentRef}
            />
          </main>
        </div>
      </div>
    </div>
  );
}

export function MainLayout(props: MainLayoutProps = {}) {
  return (
    <DatabaseMaintenanceProvider>
      <MainLayoutContent {...props} />
    </DatabaseMaintenanceProvider>
  );
}
