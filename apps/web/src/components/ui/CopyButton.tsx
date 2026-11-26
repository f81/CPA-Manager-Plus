import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconCheck, IconCopy } from './icons';
import { copyToClipboard } from '@/utils/clipboard';
import { useNotificationStore } from '@/stores';
import styles from './CopyButton.module.scss';

const FEEDBACK_MS = 1500;

interface CopyButtonProps {
  /** Text placed on the clipboard. */
  value: string;
  /** Accessible description of what the button copies. */
  label: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Icon button that copies `value` and briefly swaps its icon for a check mark.
 * The result is also announced through the notification store.
 */
export function CopyButton({ value, label, className = '', disabled = false }: CopyButtonProps) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    []
  );

  const handleClick = useCallback(async () => {
    const ok = await copyToClipboard(value);
    showNotification(
      ok ? `${t('common.copied')}: ${value}` : t('notification.copy_failed'),
      ok ? 'success' : 'error'
    );
    if (!ok) return;
    setCopied(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => setCopied(false), FEEDBACK_MS);
  }, [showNotification, t, value]);

  const classes = [styles.button, copied ? styles.copied : '', className].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={() => void handleClick()}
      title={label}
      aria-label={label}
      disabled={disabled}
    >
      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
    </button>
  );
}
