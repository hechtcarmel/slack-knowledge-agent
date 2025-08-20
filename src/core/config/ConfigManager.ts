import { z } from 'zod';
import { promises as fs } from 'fs';
import { watch, FSWatcher } from 'chokidar';
import { ChannelConfig } from '@/types/index.js';
import { Logger } from '@/utils/logger.js';

const logger = Logger.create('ConfigManager');

const ChannelSchema = z.object({
  id: z.string().regex(/^C[A-Z0-9]+$/),
  name: z.string().min(1),
  description: z.string().min(1)
});

const ChannelConfigSchema = z.object({
  channels: z.array(ChannelSchema)
});

export type ConfigChangeCallback = (config: ChannelConfig) => void;

export class ConfigManager {
  private config?: ChannelConfig;
  private watchers: Array<ConfigChangeCallback> = [];
  private fileWatcher: FSWatcher | undefined;
  
  async loadConfig(path: string = './config/channels.json'): Promise<ChannelConfig> {
    try {
      logger.info('Loading configuration', { path });
      const content = await fs.readFile(path, 'utf-8');
      const parsed = JSON.parse(content);
      this.config = ChannelConfigSchema.parse(parsed);
      
      logger.info('Configuration loaded successfully', {
        channelCount: this.config.channels.length
      });
      
      this.notifyWatchers();
      return this.config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.error('Invalid JSON in configuration file', error, { path });
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      if (error instanceof z.ZodError) {
        logger.error('Configuration validation failed', error, { path });
        throw new Error(`Configuration validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      logger.error('Failed to load configuration', error as Error, { path });
      throw error;
    }
  }
  
  watchConfig(path: string = './config/channels.json'): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }
    
    this.fileWatcher = watch(path, { ignoreInitial: true });
    
    this.fileWatcher.on('change', async () => {
      try {
        logger.info('Configuration file changed, reloading', { path });
        await this.loadConfig(path);
      } catch (error) {
        logger.error('Failed to reload configuration after change', error as Error, { path });
      }
    });
    
    this.fileWatcher.on('error', (err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('File watcher error', error, { path });
    });
    
    logger.info('Started watching configuration file', { path });
  }
  
  onChange(callback: ConfigChangeCallback): void {
    this.watchers.push(callback);
  }
  
  private notifyWatchers(): void {
    if (this.config) {
      this.watchers.forEach(callback => {
        try {
          callback(this.config!);
        } catch (error) {
          logger.error('Error in config change callback', error as Error);
        }
      });
    }
  }
  
  getChannel(id: string): ChannelConfig['channels'][0] | undefined {
    return this.config?.channels.find(c => c.id === id);
  }
  
  getAllChannels(): ChannelConfig['channels'] {
    return this.config?.channels || [];
  }
  
  validateChannelIds(channelIds: string[]): boolean {
    if (!this.config) return false;
    
    const configChannelIds = new Set(this.config.channels.map(c => c.id));
    return channelIds.every(id => configChannelIds.has(id));
  }
  
  getConfig(): ChannelConfig | undefined {
    return this.config;
  }
  
  close(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = undefined;
    }
    logger.info('Configuration manager closed');
  }
}