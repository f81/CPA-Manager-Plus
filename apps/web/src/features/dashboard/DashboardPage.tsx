import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconChevronRight } from '@/components/ui/icons';
import { useAuthStore, useConfigStore, useModelsStore } from '@/stores';
import { apiKeysApi, providersApi, authFilesApi } from '@/services/api';
import { type ErrorLogFile, logsApi } from '@/services/api/logs';
import { type UsageServiceStatus, usageServiceApi } from '@/services/api/usageService';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { usePanelFeatureAvailability } from '@/hooks/usePanelFeatureAvailability';
import { resolveProviderCount } from './providerStats';
import { EndpointsCard } from './components/EndpointsCard';
import { ServedModelsCard } from './components/ServedModelsCard';
import { VersionCard } from './components/VersionCard';
import styles from './DashboardPage.module.scss';

interface ProviderStats {
  gemini: number | null;
  codex: number | null;
  xai: number | null;
  claude: number | null;
  openai: number | null;
}

interface QuickLink {
  to: string;
  label: string;
  value: number | string;
  loading: boolean;
  detail?: string;
}

const HEALTH_REFRESH_INTERVAL_MS = 60_000;

export function DashboardPage() {
  const connectionScope = useAuthStore((state) =>
    JSON.stringify([state.apiBase, state.managementKey])
  );
  const featureAvailability = usePanelFeatureAvailability();
  const useApiBaseAsCpaBase =
    featureAvailability.panelHostConfirmed &&
    featureAvailability.panelHostMode === 'external_panel';

  return (
    <DashboardPageContent
      key={`${connectionScope}:${featureAvailability.managerServiceBase}`}
      useApiBaseAsCpaBase={useApiBaseAsCpaBase}
    />
  );
}

function DashboardPageContent({ useApiBaseAsCpaBase }: { useApiBaseAsCpaBase: boolean }) {
  const { t } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const serverVersion = useAuthStore((state) => state.serverVersion);
  const serverBuildDate = useAuthStore((state) => state.serverBuildDate);
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const config = useConfigStore((state) => state.config);
  const featureAvailability = usePanelFeatureAvailability();

  const models = useModelsStore((state) => state.models);
  const modelsLoading = useModelsStore((state) => state.loading);
  const modelsError = useModelsStore((state) => state.error);
  const modelsCache = useModelsStore((state) => state.cache);
  const fetchModelsFromStore = useModelsStore((state) => state.fetchModels);

  const [stats, setStats] = useState<{
    apiKeys: number | null;
    authFiles: number | null;
  }>({
    apiKeys: null,
    authFiles: null,
  });

  const [providerStats, setProviderStats] = useState<ProviderStats>({
    gemini: null,
    codex: null,
    xai: null,
    claude: null,
    openai: null,
  });

  const [loading, setLoading] = useState(true);

  const [cardRefreshSignal, setCardRefreshSignal] = useState(0);
  const [collectorStatus, setCollectorStatus] = useState<UsageServiceStatus | null>(null);
  const [collectorLoading, setCollectorLoading] = useState(false);
  const [collectorError, setCollectorError] = useState('');
  const [errorLogs, setErrorLogs] = useState<ErrorLogFile[]>([]);
  const [errorLogsLoading, setErrorLogsLoading] = useState(false);
  const [errorLogsLoaded, setErrorLogsLoaded] = useState(false);
  const [errorLogsError, setErrorLogsError] = useState('');
  const [managerCpaBase, setManagerCpaBase] = useState('');
  const [statsError, setStatsError] = useState('');
  const [statusError, setStatusError] = useState('');

  const apiKeysCache = useRef<string[]>([]);
  const statsRequestId = useRef(0);
  const healthRequestId = useRef(0);
  const modelRequestId = useRef(0);
  useEffect(
    () => () => {
      statsRequestId.current += 1;
      healthRequestId.current += 1;
      modelRequestId.current += 1;
    },
    []
  );

  useEffect(() => {
    apiKeysCache.current = [];
  }, [apiBase, config?.apiKeys]);

  // The Manager service hosts both the gateway connection details and, when
  // request monitoring is on, the collector status and error-log index.
  const usageServiceBase = featureAvailability.managerServiceBase;
  const usageEnabled = featureAvailability.requestMonitoringAvailable && Boolean(usageServiceBase);

  const normalizeApiKeyList = (input: unknown): string[] => {
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    const keys: string[] = [];

    input.forEach((item) => {
      const record =
        item !== null && typeof item === 'object' && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : null;
      const value =
        typeof item === 'string'
          ? item
          : record
            ? (record['api-key'] ?? record.apiKey ?? record.key ?? record.Key)
            : '';
      const trimmed = String(value ?? '').trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      keys.push(trimmed);
    });

    return keys;
  };

  const resolveApiKeysForModels = useCallback(async () => {
    if (apiKeysCache.current.length) {
      return apiKeysCache.current;
    }

    const configKeys = normalizeApiKeyList(config?.apiKeys);
    if (configKeys.length) {
      apiKeysCache.current = configKeys;
      return configKeys;
    }

    try {
      const list = await apiKeysApi.list();
      const normalized = normalizeApiKeyList(list);
      if (normalized.length) {
        apiKeysCache.current = normalized;
      }
      return normalized;
    } catch {
      return [];
    }
  }, [config?.apiKeys]);

  const fetchModels = useCallback(async () => {
    const requestId = ++modelRequestId.current;
    if (connectionStatus !== 'connected' || !apiBase) {
      return;
    }

    try {
      const apiKeys = await resolveApiKeysForModels();
      if (requestId !== modelRequestId.current) return;
      const primaryKey = apiKeys[0];
      await fetchModelsFromStore(apiBase, primaryKey);
    } catch {
      // The models store retains its last snapshot and exposes the refresh error below.
    }
  }, [connectionStatus, apiBase, resolveApiKeysForModels, fetchModelsFromStore]);

  const refreshStats = useCallback(async () => {
    const requestId = ++statsRequestId.current;
    if (connectionStatus === 'connected') {
      setLoading(true);
      try {
        const [keysRes, filesRes, geminiRes, codexRes, xaiRes, claudeRes, openaiRes] =
          await Promise.allSettled([
            apiKeysApi.list(),
            authFilesApi.list(),
            providersApi.getGeminiKeys(),
            providersApi.getCodexConfigs(),
            providersApi.getXAIConfigs(),
            providersApi.getClaudeConfigs(),
            providersApi.getOpenAIProviders(),
          ]);

        if (requestId !== statsRequestId.current) return;
        setStats((current) => ({
          apiKeys: keysRes.status === 'fulfilled' ? keysRes.value.length : current.apiKeys,
          authFiles:
            filesRes.status === 'fulfilled' ? filesRes.value.files.length : current.authFiles,
        }));

        setProviderStats((current) => ({
          gemini: resolveProviderCount(geminiRes) ?? current.gemini,
          codex: resolveProviderCount(codexRes) ?? current.codex,
          xai: resolveProviderCount(xaiRes, { unsupportedAsZero: true }) ?? current.xai,
          claude: resolveProviderCount(claudeRes) ?? current.claude,
          openai: resolveProviderCount(openaiRes) ?? current.openai,
        }));
        setStatsError(
          [keysRes, filesRes, geminiRes, codexRes, xaiRes, claudeRes, openaiRes].some(
            (result) => result.status === 'rejected'
          )
            ? t('notification.refresh_failed')
            : ''
        );
      } finally {
        if (requestId === statsRequestId.current) setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [connectionStatus, t]);

  const refreshHealth = useCallback(async () => {
    const requestId = ++healthRequestId.current;
    if (!usageEnabled) {
      setCollectorStatus(null);
      setCollectorError('');
      setCollectorLoading(false);
      setErrorLogs([]);
      setErrorLogsLoaded(false);
      setErrorLogsError('');
      setErrorLogsLoading(false);
    }

    if (!usageServiceBase) {
      setManagerCpaBase('');
      setStatusError('');
      return;
    }

    if (usageEnabled) {
      setCollectorLoading(true);
      setErrorLogsLoading(true);
    }

    const [managerConfigResult, collectorResult, logsResult] = await Promise.allSettled([
      usageServiceApi.getManagerConfig(usageServiceBase, managementKey),
      usageEnabled
        ? usageServiceApi.getStatus(usageServiceBase, managementKey)
        : Promise.resolve(null),
      usageEnabled ? logsApi.fetchErrorLogs() : Promise.resolve(null),
    ]);

    if (requestId !== healthRequestId.current) return;

    if (managerConfigResult.status === 'fulfilled') {
      setManagerCpaBase(managerConfigResult.value.config.cpaConnection?.cpaBaseUrl || '');
    }

    if (collectorResult.status === 'fulfilled' && collectorResult.value) {
      setCollectorStatus(collectorResult.value);
      setCollectorError('');
    } else if (collectorResult.status === 'rejected') {
      const reason = collectorResult.reason;
      setCollectorError(reason instanceof Error ? reason.message : String(reason));
    }
    setCollectorLoading(false);

    if (logsResult.status === 'fulfilled' && logsResult.value) {
      setErrorLogs(Array.isArray(logsResult.value.files) ? logsResult.value.files : []);
      setErrorLogsLoaded(true);
      setErrorLogsError('');
    } else if (logsResult.status === 'rejected') {
      const reason = logsResult.reason;
      setErrorLogsError(reason instanceof Error ? reason.message : String(reason));
    }
    setErrorLogsLoading(false);

    setStatusError(
      [managerConfigResult, collectorResult, logsResult].some(
        (result) => result.status === 'rejected'
      )
        ? t('notification.refresh_failed')
        : ''
    );
  }, [managementKey, t, usageEnabled, usageServiceBase]);

  const refreshDashboard = useCallback(async () => {
    setCardRefreshSignal((value) => value + 1);
    await Promise.all([refreshStats(), fetchModels(), refreshHealth()]);
  }, [fetchModels, refreshHealth, refreshStats]);

  useEffect(() => {
    void Promise.all([refreshStats(), fetchModels()]);
  }, [fetchModels, refreshStats]);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  useEffect(() => {
    if (!usageEnabled) return;
    const timer = window.setInterval(() => {
      void refreshHealth();
    }, HEALTH_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refreshHealth, usageEnabled]);

  useHeaderRefresh(refreshDashboard);

  // Calculate total provider keys only when all provider stats are available.
  const providerStatsReady =
    providerStats.gemini !== null &&
    providerStats.codex !== null &&
    providerStats.xai !== null &&
    providerStats.claude !== null &&
    providerStats.openai !== null;
  const hasProviderStats =
    providerStats.gemini !== null ||
    providerStats.codex !== null ||
    providerStats.xai !== null ||
    providerStats.claude !== null ||
    providerStats.openai !== null;
  const totalProviderKeys = providerStatsReady
    ? (providerStats.gemini ?? 0) +
      (providerStats.codex ?? 0) +
      (providerStats.xai ?? 0) +
      (providerStats.claude ?? 0) +
      (providerStats.openai ?? 0)
    : 0;

  // An external panel talks to the gateway directly, so its own API base is the
  // gateway address. The embedded Manager learns it from its saved connection.
  const cpaBase = managerCpaBase || (useApiBaseAsCpaBase ? apiBase : '');

  const quickLinks: QuickLink[] = [
    {
      to: '/ai-providers',
      label: t('nav.ai_providers'),
      value: providerStatsReady ? totalProviderKeys : '-',
      loading: loading && !hasProviderStats,
      detail: hasProviderStats
        ? t('dashboard.provider_keys_detail', {
            gemini: providerStats.gemini ?? '-',
            codex: providerStats.codex ?? '-',
            xai: providerStats.xai ?? '-',
            claude: providerStats.claude ?? '-',
            openai: providerStats.openai ?? '-',
          })
        : undefined,
    },
    {
      to: '/accounts',
      label: t('nav.accounts', { defaultValue: t('accounts.title') }),
      value: stats.authFiles ?? '-',
      loading: loading && stats.authFiles === null,
      detail: t('dashboard.oauth_credentials'),
    },
    {
      to: '/config',
      label: t('dashboard.management_keys'),
      value: stats.apiKeys ?? '-',
      loading: loading && stats.apiKeys === null,
      detail: t('nav.config_management'),
    },
  ];

  return (
    <div className={styles.page}>
      {statsError ? (
        <div className="error-box" role="alert">
          {statsError}
        </div>
      ) : null}
      {statusError ? (
        <div className="error-box" role="alert">
          {statusError}
        </div>
      ) : null}

      <div className={styles.primary}>
        <EndpointsCard cpaBase={cpaBase} connectionStatus={connectionStatus} />
        <VersionCard
          appVersion={__APP_VERSION__ || t('dashboard.version_unknown')}
          apiVersion={serverVersion || t('dashboard.version_unknown')}
          cpaBase={cpaBase}
          serverBuildDate={serverBuildDate || undefined}
          connectionStatus={connectionStatus}
          refreshSignal={cardRefreshSignal}
          usageEnabled={usageEnabled}
          usageLoading={false}
          collectorStatus={collectorStatus}
          collectorLoading={collectorLoading}
          collectorError={collectorError}
          errorLogCount={errorLogs.length}
          errorLogsLoading={errorLogsLoading && !errorLogsLoaded}
          errorLogsError={errorLogsError}
          errorLogsLoaded={errorLogsLoaded}
        />
      </div>

      <ServedModelsCard
        models={models}
        loading={modelsLoading}
        error={modelsError}
        hasSnapshot={Boolean(modelsCache)}
      />

      <nav
        className={styles.quickLinks}
        aria-label={t('common.navigation', { defaultValue: 'Navigation' })}
      >
        {quickLinks.map((link) => (
          <Link key={link.to} to={link.to} className={styles.quickLink}>
            <span className={styles.quickLabel}>{link.label}</span>
            <IconChevronRight size={16} className={styles.quickArrow} />
            <span className={styles.quickValue}>{link.loading ? '...' : link.value}</span>
            {!link.loading && link.detail ? (
              <span className={styles.quickDetail} title={link.detail}>
                {link.detail}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
