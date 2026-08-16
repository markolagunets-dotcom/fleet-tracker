// class-validator's decorators need the metadata polyfill; Nest loads it in the
// app, but a standalone unit test has to ask for it.
import 'reflect-metadata';

import { validateEnv } from './env.config';

describe('validateEnv', () => {
  it('fills development defaults when nothing is set', () => {
    const config = validateEnv({});
    expect(config.PORT).toBe(3001);
    expect(config.NODE_ENV).toBe('development');
  });

  it('coerces PORT, which always arrives as a string', () => {
    expect(validateEnv({ PORT: '4000' }).PORT).toBe(4000);
  });

  it.each([['not-a-number'], ['0'], ['70000']])('rejects PORT=%s', (port) => {
    expect(() => validateEnv({ PORT: port })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('refuses to fall back to localhost in production', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'production', DATABASE_URL: 'file:/data/x.db' }),
    ).toThrow(/CORS_ORIGIN must be set explicitly/);
  });

  it('accepts a fully specified production environment', () => {
    const config = validateEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      CORS_ORIGIN: 'https://example.com',
      DATABASE_URL: 'file:/data/fleet.db',
    });
    expect(config.PORT).toBe(8080);
    expect(config.CORS_ORIGIN).toBe('https://example.com');
  });
});
