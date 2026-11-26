import { describe, expect, it } from 'vitest';
import {
  GATEWAY_ENDPOINT_GROUPS,
  buildGatewayBaseUrl,
  buildGatewayUrl,
  normalizeGatewayBase,
} from './gatewayEndpoints';

describe('gateway endpoints', () => {
  it('lists each client-facing API family exactly once', () => {
    expect(GATEWAY_ENDPOINT_GROUPS.map((group) => group.id)).toEqual([
      'openai',
      'anthropic',
      'gemini',
      'codex',
    ]);
  });

  it('keeps endpoint paths inside their family prefix and unique per family', () => {
    // Anthropic clients use the bare origin, but its routes live under /v1/messages.
    const familyPrefix: Record<string, string> = {
      openai: '/v1/',
      anthropic: '/v1/messages',
      gemini: '/v1beta/',
      codex: '/backend-api/codex/',
    };

    for (const group of GATEWAY_ENDPOINT_GROUPS) {
      const keys = new Set<string>();
      for (const endpoint of group.endpoints) {
        expect(endpoint.path.startsWith(familyPrefix[group.id])).toBe(true);
        const key = `${endpoint.method} ${endpoint.path}`;
        expect(keys.has(key)).toBe(false);
        keys.add(key);
      }
    }
  });

  it('joins the gateway address with an endpoint path', () => {
    expect(buildGatewayUrl('https://gateway.example.com', '/v1/chat/completions')).toBe(
      'https://gateway.example.com/v1/chat/completions'
    );
    expect(buildGatewayUrl('https://gateway.example.com/', '/v1/models')).toBe(
      'https://gateway.example.com/v1/models'
    );
    expect(buildGatewayUrl('gateway.example.com', 'v1/models')).toBe(
      'http://gateway.example.com/v1/models'
    );
  });

  it('falls back to the bare path while the gateway address is unknown', () => {
    expect(buildGatewayUrl('', '/v1/completions')).toBe('/v1/completions');
    expect(buildGatewayUrl('   ', '/v1/messages')).toBe('/v1/messages');
  });

  it('builds the base URL a client family is configured with', () => {
    const base = 'https://gateway.example.com';
    expect(buildGatewayBaseUrl(base, '/v1')).toBe(`${base}/v1`);
    expect(buildGatewayBaseUrl(base, '/v1beta')).toBe(`${base}/v1beta`);
    expect(buildGatewayBaseUrl(base, '/backend-api/codex')).toBe(`${base}/backend-api/codex`);
    // Anthropic SDKs append /v1 themselves, so the base is the bare origin.
    expect(buildGatewayBaseUrl(base, '')).toBe(base);
    expect(buildGatewayBaseUrl('', '/v1')).toBe('/v1');
    expect(buildGatewayBaseUrl('', '')).toBe('');
  });

  it('normalises a saved management address into a gateway origin', () => {
    expect(normalizeGatewayBase('http://localhost:8317/v0/management/')).toBe(
      'http://localhost:8317'
    );
    expect(normalizeGatewayBase('localhost:8317')).toBe('http://localhost:8317');
    expect(normalizeGatewayBase('  ')).toBe('');
  });
});
