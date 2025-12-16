import { useState, useEffect } from 'react';

const DUPLICATE_ITEMS_KEY = 'pdv_duplicate_items';

export function useOrderSettings() {
  const [duplicateItems, setDuplicateItems] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DUPLICATE_ITEMS_KEY) === 'true';
  });

  const toggleDuplicateItems = (value: boolean) => {
    localStorage.setItem(DUPLICATE_ITEMS_KEY, String(value));
    setDuplicateItems(value);
  };

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === DUPLICATE_ITEMS_KEY) {
        setDuplicateItems(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return { duplicateItems, toggleDuplicateItems };
}
