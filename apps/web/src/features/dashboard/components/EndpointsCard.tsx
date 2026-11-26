import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CopyButton } from '@/components/ui/CopyButton';
import { Card } from '@/components/ui/Card';
import type { ConnectionStatus } from '@/types';
import {
  GATEWAY_ENDPOINT_GROUPS,
  buildGatewayBaseUrl,
  buildGatewayUrl,
  normalizeGatewayBase,
} from '../gatewayEndpoints';
import styles from './EndpointsCard.module.scss';

interface EndpointsCardProps {
  /** Gateway (CPA) address clients connect to. Empty while it is unknown. */
  cpaBase: string;
  connectionStatus: ConnectionStatus;
}

const CONNECTION_LABEL_KEY: Record<ConnectionStatus, string> = {
  connected: 'common.connected',
  connecting: 'common.connecting',
  disconnected: 'common.disconnected',
  error: 'common.error',
};

/**
 * Lists every client-facing gateway endpoint, resolved against the gateway
 * address, with the base URL each client family should be configured with.
 */
export function EndpointsCard({ cpaBase, connectionStatus }: EndpointsCardProps) {
  const { t } = useTranslation();
  const gateway = normalizeGatewayBase(cpaBase);
  const hasGateway = Boolean(gateway);

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <h2 className={styles.title}>{t('dashboard.endpoints_title')}</h2>
          <p className={styles.description}>{t('dashboard.endpoints_desc')}</p>
        </div>
        <span className={`${styles.status} ${styles[connectionStatus]}`}>
          <span className={styles.statusDot} aria-hidden="true" />
          {t(CONNECTION_LABEL_KEY[connectionStatus])}
        </span>
      </div>

      <div className={`${styles.address} ${hasGateway ? '' : styles.addressUnknown}`}>
        <span className={styles.addressLabel}>{t('dashboard.endpoints_gateway_address')}</span>
        <div className={styles.addressRow}>
          <code className={styles.addressValue}>
            {hasGateway ? gateway : t('dashboard.endpoints_address_unknown')}
          </code>
          {hasGateway && (
            <CopyButton
              value={gateway}
              label={t('dashboard.endpoints_copy_url', { url: gateway })}
            />
          )}
        </div>
      </div>

      <div className={styles.groups}>
        {GATEWAY_ENDPOINT_GROUPS.map((group) => {
          const baseUrl = buildGatewayBaseUrl(cpaBase, group.basePath);
          return (
            <section key={group.id} className={styles.group}>
              <div className={styles.groupHeader}>
                <h3 className={styles.groupTitle}>{t(group.labelKey)}</h3>
                <div className={styles.base}>
                  <span className={styles.baseLabel}>{t('dashboard.endpoints_base_url')}</span>
                  <code className={styles.baseValue}>{baseUrl}</code>
                  <CopyButton
                    className={styles.baseCopy}
                    value={baseUrl}
                    label={t('dashboard.endpoints_copy_url', { url: baseUrl })}
                  />
                </div>
              </div>
              <ul className={styles.endpoints}>
                {group.endpoints.map((endpoint) => {
                  const url = buildGatewayUrl(cpaBase, endpoint.path);
                  return (
                    <li key={`${endpoint.method} ${endpoint.path}`} className={styles.endpoint}>
                      <span className={styles.method}>{endpoint.method}</span>
                      <code className={styles.path}>{endpoint.path}</code>
                      <span className={styles.endpointLabel}>{t(endpoint.labelKey)}</span>
                      <CopyButton value={url} label={t('dashboard.endpoints_copy_url', { url })} />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className={styles.footer}>
        {hasGateway ? t('dashboard.endpoints_auth_hint') : t('dashboard.endpoints_address_hint')}{' '}
        <Link to="/config">
          {t(hasGateway ? 'dashboard.endpoints_manage_keys' : 'dashboard.endpoints_open_config')}
        </Link>
      </p>
    </Card>
  );
}
