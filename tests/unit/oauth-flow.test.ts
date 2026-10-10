import { test, expect, describe } from 'bun:test';
import { startLogin, finishLogin, validateReturnTo, type OAuthSettings } from '../../src/oauth-flow';
import worker from '../../deploy/oauth-proxy/worker';

const settings: OAuthSettings = {
  clientId: 'cid', clientSecret: 'secret', allowedOrigins: ['https://docs.example.com'], defaultReturnPath: '/_',
};

/** Cookie header to send back, from a response's Set-Cookie headers */
function cookiesFrom(res: Response): string {
  return res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
}

const fakeGitHub = (async () => Response.json({ access_token: 'tok123' })) as unknown as typeof fetch;

describe('validateReturnTo', () => {
  test('allows own and listed origins only', () => {
    expect(validateReturnTo('https://auth.example.com/_', 'https://auth.example.com')).toBe('https://auth.example.com/_');
    expect(validateReturnTo('https://docs.example.com/_#x', 'https://auth.example.com', ['https://docs.example.com/'])).toBe('https://docs.example.com/_');
    expect(validateReturnTo('https://evil.example/_', 'https://auth.example.com', ['https://docs.example.com'])).toBeNull();
    expect(validateReturnTo('javascript:alert(1)', 'https://auth.example.com')).toBeNull();
  });
});

describe('OAuth flow', () => {
  test('round trip returns the token to the allowed return_to in the fragment', async () => {
    const start = startLogin(new Request('https://auth.example.com/_opendoc/auth/github?return_to=' + encodeURIComponent('https://docs.example.com/_')), settings);
    expect(start.status).toBe(302);
    const authorize = new URL(start.headers.get('location')!);
    expect(authorize.host).toBe('github.com');
    expect(authorize.searchParams.get('redirect_uri')).toBe('https://auth.example.com/_opendoc/auth/callback');
    const state = authorize.searchParams.get('state')!;

    const done = await finishLogin(new Request(`https://auth.example.com/_opendoc/auth/callback?code=c&state=${state}`, {
      headers: { cookie: cookiesFrom(start) },
    }), settings, fakeGitHub);
    expect(done.status).toBe(302);
    expect(done.headers.get('location')).toBe('https://docs.example.com/_#github_token=tok123');
  });

  test('without return_to the token goes to the local editor path', async () => {
    const start = startLogin(new Request('http://localhost:3000/_opendoc/auth/github'), settings);
    const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
    const done = await finishLogin(new Request(`http://localhost:3000/_opendoc/auth/callback?code=c&state=${state}`, {
      headers: { cookie: cookiesFrom(start) },
    }), settings, fakeGitHub);
    expect(done.headers.get('location')).toBe('http://localhost:3000/_#github_token=tok123');
  });

  test('rejects a disallowed return_to and a forged state', async () => {
    const bad = startLogin(new Request('https://auth.example.com/_opendoc/auth/github?return_to=https://evil.example/'), settings);
    expect(bad.status).toBe(400);
    const forged = await finishLogin(new Request('https://auth.example.com/_opendoc/auth/callback?code=c&state=abc', {
      headers: { cookie: 'od_oauth_state=xyz' },
    }), settings, fakeGitHub);
    expect(forged.status).toBe(400);
  });
});

describe('OAuth proxy worker', () => {
  const env = { GITHUB_CLIENT_ID: 'cid', GITHUB_CLIENT_SECRET: 's', ALLOWED_ORIGINS: 'https://docs.example.com' };

  test('requires return_to and enforces the allowlist', async () => {
    expect((await worker.fetch(new Request('https://w.dev/_opendoc/auth/github'), env)).status).toBe(400);
    expect((await worker.fetch(new Request('https://w.dev/_opendoc/auth/github?return_to=https://evil.example/'), env)).status).toBe(400);
    const ok = await worker.fetch(new Request('https://w.dev/_opendoc/auth/github?return_to=https://docs.example.com/_'), env);
    expect(ok.status).toBe(302);
  });
});
