import { useState, useEffect } from 'react';

export function useStorage(key) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const formatItem = (parsed, id) => {
    const formatted = { ...parsed, id };
    if (key === 'farmer') {
      if (typeof formatted.firstName === 'string') formatted.firstName = formatted.firstName.toUpperCase();
      if (typeof formatted.lastName === 'string') formatted.lastName = formatted.lastName.toUpperCase();
      if (typeof formatted.middleName === 'string') formatted.middleName = formatted.middleName.toUpperCase();
    }
    return formatted;
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const prefix = `${key}_`;
      const isApiBacked = Boolean(window.storage?.getEntityFromKey?.(key));
      const data = await window.storage.list(prefix);

      // Fast path: if the adapter provided full items, use them immediately to bypass N+1
      if (isApiBacked && data?._items) {
        // Cleanup stale ghost record from localStorage only (not via API)
        try { localStorage.removeItem(key); } catch (_) {}
        setItems(data._items.map(item => formatItem(item, item.id || 'legacy')));
        setLoading(false);
        return;
      }

      const keys = [...(data?.keys || [])];

      // Backward compatibility for non-API storage only
      if (!isApiBacked) {
        const legacyRecord = await window.storage.get(key);
        if (legacyRecord?.value) {
          keys.push(key);
        }
      } else {
        // Cleanup stale ghost record from previous localStorage fallback
        try {
          await window.storage.remove(key);
        } catch {
          // no-op
        }
      }

      const parsedItems = [];
      for (const itemKey of keys) {
        const item = await window.storage.get(itemKey);
        if (item && item.value) {
          const parsed = JSON.parse(item.value);
          if (parsed && typeof parsed === 'object') {
            const derivedId = itemKey.startsWith(prefix)
              ? itemKey.slice(prefix.length)
              : 'legacy';
            parsedItems.push(formatItem(parsed, parsed.id || derivedId));
          }
        }
      }
      setItems(parsedItems);
    } catch (error) {
      console.error(`Error loading ${key}:`, error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const saveItem = async (id, item) => {
    try {
      const resolvedId = id || item?.id;

      // Important: in the API-backed adapter, plain key => create, key_with_id => update
      if (resolvedId) {
        const storageKey = `${key}_${resolvedId}`;
        await window.storage.set(storageKey, JSON.stringify({ ...item, id: resolvedId }));
      } else {
        const provisionalId = generateId();
        await window.storage.set(key, JSON.stringify({ ...item, id: provisionalId }));
      }

      await loadItems(); // Reload items after save
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
      throw error;
    }
  };

  const deleteItem = async (id) => {
    try {
      if (!id) return;
      await window.storage.remove(`${key}_${id}`);

      // Backward compatibility: allow deleting legacy record
      if (id === 'legacy') {
        await window.storage.remove(key);
      }

      await loadItems(); // Reload items after delete
    } catch (error) {
      console.error(`Error deleting ${key}:`, error);
      throw error;
    }
  };

  useEffect(() => {
    loadItems();
  }, [key]);

  return { items, loading, saveItem, deleteItem, refreshItems: loadItems };
}