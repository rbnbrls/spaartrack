import { createCipheriv, createDecipheriv, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BrokerCredentials } from '../../../packages/integration-contracts/src/trading212.js';
export interface SealedCredential { ciphertext: string; iv: string; tag: string }
export function brokerKey(): Buffer {
  const configured = process.env.BROKER_MASTER_KEY;
  if (configured) {
    if (!/^[a-f0-9]{64}$/i.test(configured)) throw new Error('BROKER_KEY_INVALID');
    return Buffer.from(configured, 'hex');
  }
  if ((process.env.APP_ENV || 'local') !== 'local') throw new Error('BROKER_KEY_REQUIRED');
  const path = process.env.BROKER_KEY_FILE || '/var/lib/spaartrack-secrets/broker.key';
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  try { writeFileSync(path, randomBytes(32), { flag: 'wx', mode: 0o600 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  const key = readFileSync(path);
  if (key.length !== 32) throw new Error('BROKER_KEY_INVALID');
  return key;
}
export function sealCredential(value: BrokerCredentials, key: Buffer, binding: string): SealedCredential {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(binding));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}
export function openCredential(box: SealedCredential, key: Buffer, binding: string): BrokerCredentials {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'));
  decipher.setAAD(Buffer.from(binding)); decipher.setAuthTag(Buffer.from(box.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(box.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
}
const derive = (password: string, salt: string): Promise<Buffer> => new Promise((resolve,reject) => scrypt(password,salt,64,(error,key) => error ? reject(error) : resolve(key)));
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex'); return `${salt}:${(await derive(password,salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt,value] = hash.split(':'); const actual = await derive(password,salt);
  const expected = Buffer.from(value,'hex'); return actual.length === expected.length && timingSafeEqual(actual,expected);
}
