import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconCopy } from '@/components/ui/icons';
import { useNotificationStore } from '@/stores';
import { copyToClipboard } from '@/utils/clipboard';
import { classifyModels, modelDisplayLabel, type ModelInfo } from '@/utils/models';
import { getDashboardModelCountDisplay } from '../modelCountDisplay';
import styles from './ServedModelsCard.module.scss';

interface ServedModelsCardProps {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  /** Whether a model snapshot has been loaded for the current connection. */
  hasSnapshot: boolean;
}

/**
 * Every model the gateway currently serves, grouped by family.
 * Click a model to copy the name clients use in requests.
 */
export function ServedModelsCard({ models, loading, error, hasSnapshot }: ServedModelsCardProps) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const otherLabel = t('dashboard.models_other_group');
  const groupedModels = useMemo(() => classifyModels(models, { otherLabel }), [models, otherLabel]);
  const count = getDashboardModelCountDisplay(
    models.length,
    loading && !hasSnapshot,
    hasSnapshot ? null : error
  );

  const reportCopy = useCallback(
    (copied: boolean, message: string) => {
      showNotification(
        copied ? `${t('common.copied')}: ${message}` : t('notification.copy_failed'),
        copied ? 'success' : 'error'
      );
    },
    [showNotification, t]
  );

  const handleCopyModel = async (name: string) => {
    reportCopy(await copyToClipboard(name), name);
  };

  const handleCopyAll = async () => {
    const copied = await copyToClipboard(models.map((model) => model.name).join('\n'));
    showNotification(
      copied
        ? t('dashboard.models_copied_all', { count: models.length })
        : t('notification.copy_failed'),
      copied ? 'success' : 'error'
    );
  };

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <Link to="/system" className={styles.titleLink}>
            {t('dashboard.available_models')}
            <span className={styles.count}>{count}</span>
          </Link>
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleCopyAll()}
          disabled={models.length === 0}
        >
          <IconCopy size={14} />
          {t('dashboard.models_copy_all')}
        </Button>
      </div>
      <p className={styles.description}>{t('dashboard.models_desc')}</p>

      {error ? (
        <div className="error-box" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !hasSnapshot ? (
        <div className="hint">{t('common.loading')}</div>
      ) : !hasSnapshot ? null : models.length === 0 ? (
        <div className="hint">{t('system_info.models_empty')}</div>
      ) : (
        <div className={styles.groups}>
          {groupedModels.map((group) => (
            <div key={group.id} className={styles.group}>
              <div className={styles.groupLabel}>{group.label}</div>
              <div className={styles.tags}>
                {group.items.map((model) => {
                  const label = modelDisplayLabel(model);
                  return (
                    <button
                      type="button"
                      key={`${model.name}-${label || 'default'}`}
                      className={styles.tag}
                      title={model.description || t('common.copy')}
                      onClick={() => void handleCopyModel(model.name)}
                    >
                      <span className={styles.modelName}>{model.name}</span>
                      {label && <span className={styles.modelAlias}>{label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
