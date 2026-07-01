import keytar from 'keytar';
import crypto from 'crypto-js';
import { Secret, SecurityPolicy } from '@aios/types';
import { CoreLogger } from '@aios/core';

export class SecretManager {
  private readonly SERVICE_NAME = 'AIOS-Personal-OS';
  private logger: CoreLogger;
  private masterKey: string;

  constructor(logger: CoreLogger, masterKey: string) {
    this.logger = logger;
    this.masterKey = masterKey;
  }

  async storeSecret(key: string, value: string, service: string): Promise<void> {
    try {
      const encryptedValue = crypto.AES.encrypt(value, this.masterKey).toString();
      await keytar.setPassword(this.SERVICE_NAME, key, encryptedValue);
      this.logger.info(`Secret stored securely for ${service}: ${key}`);
    } catch (error: any) {
      this.logger.error(`Failed to store secret ${key}: ${error.message}`);
      throw error;
    }
  }

  async getSecret(key: string): Promise<string | null> {
    try {
      const encryptedValue = await keytar.getPassword(this.SERVICE_NAME, key);
      if (!encryptedValue) return null;

      const bytes = crypto.AES.decrypt(encryptedValue, this.masterKey);
      return bytes.toString(crypto.enc.Utf8);
    } catch (error: any) {
      this.logger.error(`Failed to retrieve secret ${key}: ${error.message}`);
      return null;
    }
  }

  async deleteSecret(key: string): Promise<void> {
    try {
      await keytar.deletePassword(this.SERVICE_NAME, key);
      this.logger.info(`Secret deleted: ${key}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete secret ${key}: ${error.message}`);
      throw error;
    }
  }
}