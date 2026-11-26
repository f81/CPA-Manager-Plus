/**
 * Client-facing gateway endpoints.
 *
 * These mirror the routes the gateway (CLIProxyAPI) registers for model
 * traffic. CPAMP itself only serves the management API, so every entry is
 * resolved against the gateway address (`cpaBase`), never against this panel.
 */

import { normalizeApiBase } from '@/utils/connection';

export type GatewayHttpMethod = 'GET' | 'POST';

export interface GatewayEndpoint {
  method: GatewayHttpMethod;
  path: string;
  labelKey: string;
}

export interface GatewayEndpointGroup {
  id: 'openai' | 'anthropic' | 'gemini' | 'codex';
  labelKey: string;
  /** Path prefix a client uses as its base URL. An empty string means the gateway root. */
  basePath: string;
  endpoints: readonly GatewayEndpoint[];
}

export const GATEWAY_ENDPOINT_GROUPS: readonly GatewayEndpointGroup[] = [
  {
    id: 'openai',
    labelKey: 'dashboard.endpoint_group_openai',
    basePath: '/v1',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/chat/completions',
        labelKey: 'dashboard.endpoint_chat_completions',
      },
      { method: 'POST', path: '/v1/responses', labelKey: 'dashboard.endpoint_responses' },
      { method: 'POST', path: '/v1/completions', labelKey: 'dashboard.endpoint_completions' },
      { method: 'GET', path: '/v1/models', labelKey: 'dashboard.endpoint_models' },
    ],
  },
  {
    id: 'anthropic',
    labelKey: 'dashboard.endpoint_group_anthropic',
    basePath: '',
    endpoints: [
      { method: 'POST', path: '/v1/messages', labelKey: 'dashboard.endpoint_messages' },
      {
        method: 'POST',
        path: '/v1/messages/count_tokens',
        labelKey: 'dashboard.endpoint_count_tokens',
      },
    ],
  },
  {
    id: 'gemini',
    labelKey: 'dashboard.endpoint_group_gemini',
    basePath: '/v1beta',
    endpoints: [
      {
        method: 'POST',
        path: '/v1beta/models/{model}:generateContent',
        labelKey: 'dashboard.endpoint_generate_content',
      },
      {
        method: 'POST',
        path: '/v1beta/models/{model}:streamGenerateContent',
        labelKey: 'dashboard.endpoint_stream_generate_content',
      },
      { method: 'GET', path: '/v1beta/models', labelKey: 'dashboard.endpoint_models' },
    ],
  },
  {
    id: 'codex',
    labelKey: 'dashboard.endpoint_group_codex',
    basePath: '/backend-api/codex',
    endpoints: [
      {
        method: 'POST',
        path: '/backend-api/codex/responses',
        labelKey: 'dashboard.endpoint_codex_responses',
      },
    ],
  },
];

/** Normalises a gateway address for display and URL joining; '' when unknown. */
export const normalizeGatewayBase = (cpaBase: string): string => normalizeApiBase(cpaBase);

/**
 * Joins a gateway address with a path.
 * Falls back to the bare path when the gateway address is not known yet, so a
 * row never shows a fabricated host.
 */
export const buildGatewayUrl = (cpaBase: string, path: string): string => {
  const base = normalizeGatewayBase(cpaBase);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${suffix}` : suffix;
};

/** Absolute URL a client should use as its base URL for an API family. */
export const buildGatewayBaseUrl = (cpaBase: string, basePath: string): string =>
  basePath ? buildGatewayUrl(cpaBase, basePath) : normalizeGatewayBase(cpaBase);
