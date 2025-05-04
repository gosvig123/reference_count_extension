import * as vscode from 'vscode';
import { ErrorHandler } from './errorHandling';

/**
 * Interface for cache entry
 */
interface CacheEntry<T> {
    value: T;
    timestamp: number;
}

/**
 * Cache manager with expiration support
 */
export class CacheManager<K, V> {
    private cache: Map<K, CacheEntry<V>> = new Map();
    private readonly TTL_MS: number;
    private readonly name: string;
    private changeListeners: Array<() => void> = [];

    /**
     * Create a new cache manager
     * @param name The name of the cache (for logging)
     * @param ttlMs Time to live in milliseconds (default: 5 minutes)
     */
    constructor(name: string, ttlMs: number = 5 * 60 * 1000) {
        this.TTL_MS = ttlMs;
        this.name = name;
        
        // Log cache creation
        ErrorHandler.info(`Cache '${name}' created with TTL ${ttlMs}ms`, 'CacheManager');
    }

    /**
     * Set a value in the cache
     */
    public set(key: K, value: V): void {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
        this.notifyChangeListeners();
    }

    /**
     * Get a value from the cache
     * @returns The value or undefined if not found or expired
     */
    public get(key: K): V | undefined {
        const entry = this.cache.get(key);
        
        if (!entry) {
            return undefined;
        }
        
        // Check if the entry is expired
        if (this.isExpired(entry)) {
            this.cache.delete(key);
            this.notifyChangeListeners();
            return undefined;
        }
        
        return entry.value;
    }

    /**
     * Check if the cache has a non-expired value for the given key
     */
    public has(key: K): boolean {
        return this.get(key) !== undefined;
    }

    /**
     * Delete a value from the cache
     */
    public delete(key: K): boolean {
        const result = this.cache.delete(key);
        if (result) {
            this.notifyChangeListeners();
        }
        return result;
    }

    /**
     * Clear all values from the cache
     */
    public clear(): void {
        this.cache.clear();
        this.notifyChangeListeners();
        ErrorHandler.info(`Cache '${this.name}' cleared`, 'CacheManager');
    }

    /**
     * Get the number of entries in the cache
     */
    public size(): number {
        return this.cache.size;
    }

    /**
     * Add a change listener
     */
    public onChanged(listener: () => void): vscode.Disposable {
        this.changeListeners.push(listener);
        
        // Return a disposable to remove the listener
        return {
            dispose: () => {
                const index = this.changeListeners.indexOf(listener);
                if (index !== -1) {
                    this.changeListeners.splice(index, 1);
                }
            }
        };
    }

    /**
     * Remove expired entries from the cache
     * @returns The number of entries removed
     */
    public cleanup(): number {
        const keysToRemove: K[] = [];
        
        // Find expired entries
        this.cache.forEach((entry, key) => {
            if (this.isExpired(entry)) {
                keysToRemove.push(key);
            }
        });
        
        // Remove expired entries
        for (const key of keysToRemove) {
            this.cache.delete(key);
        }
        
        // Notify listeners if entries were removed
        if (keysToRemove.length > 0) {
            this.notifyChangeListeners();
            ErrorHandler.info(`Removed ${keysToRemove.length} expired entries from cache '${this.name}'`, 'CacheManager');
        }
        
        return keysToRemove.length;
    }

    /**
     * Get all keys in the cache
     */
    public keys(): K[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Check if an entry is expired
     */
    private isExpired(entry: CacheEntry<V>): boolean {
        return Date.now() - entry.timestamp > this.TTL_MS;
    }

    /**
     * Notify change listeners
     */
    private notifyChangeListeners(): void {
        for (const listener of this.changeListeners) {
            try {
                listener();
            } catch (error) {
                ErrorHandler.error('Error in cache change listener', error, 'CacheManager');
            }
        }
    }
}