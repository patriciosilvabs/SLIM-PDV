import { useState, useEffect, useCallback } from 'react';
import { resolveCurrentTenantId } from '@/lib/tenantResolver';
import { listCategories, listProducts, listTables } from '@/lib/firebaseTenantCrud';

const CACHE_PREFIX = 'pdv-cache-';
const CACHE_EXPIRY = 60 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function getFromCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

function setToCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (error) {
    console.warn('Failed to cache data:', error);
  }
}

export function useProductsCache() {
  const [products, setProducts] = useState<any[]>(() => getFromCache('products') || []);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const tenantId = await resolveCurrentTenantId();
      if (!tenantId) {
        setProducts([]);
        return;
      }
      const data = await listProducts(tenantId);
      setProducts(data);
      setToCache('products', data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (products.length === 0) {
      refresh();
    }
  }, [products.length, refresh]);

  return { products, isLoading, refresh };
}

export function useCategoriesCache() {
  const [categories, setCategories] = useState<any[]>(() => getFromCache('categories') || []);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const tenantId = await resolveCurrentTenantId();
      if (!tenantId) {
        setCategories([]);
        return;
      }
      const data = await listCategories(tenantId);
      const active = data.filter((c) => c.is_active);
      setCategories(active);
      setToCache('categories', active);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (categories.length === 0) {
      refresh();
    }
  }, [categories.length, refresh]);

  return { categories, isLoading, refresh };
}

export function useTablesCache() {
  const [tables, setTables] = useState<any[]>(() => getFromCache('tables') || []);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const tenantId = await resolveCurrentTenantId();
      if (!tenantId) {
        setTables([]);
        return;
      }
      const data = await listTables(tenantId);
      setTables(data);
      setToCache('tables', data);
    } catch (error) {
      console.error('Error fetching tables:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tables.length === 0) {
      refresh();
    }
  }, [tables.length, refresh]);

  return { tables, isLoading, refresh };
}

export function clearAllCache() {
  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    if (key.startsWith(CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}
