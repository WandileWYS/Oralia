import './environment.ts';
import { ServiceError } from './errors.ts';

export function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new ServiceError('CONFIGURATION_MISSING', 503, `Server configuration is missing ${name}.`);
  return value;
}
export function appOrigin() {
  const url = new URL(required('APP_ORIGIN'));
  if (url.origin !== url.href.replace(/\/$/, '') || (process.env.VERCEL === '1' && url.protocol !== 'https:')) throw new ServiceError('CONFIGURATION_INVALID', 503, 'APP_ORIGIN must be the application origin.');
  return url.origin;
}
export function authSecret() {
  const secret = required('AUTH_SECRET');
  if (secret.length < 32) throw new ServiceError('CONFIGURATION_INVALID', 503, 'AUTH_SECRET must contain at least 32 characters.');
  return secret;
}
export function requireCreationConfiguration() {
  for (const name of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) required(name);
  appOrigin();
}
