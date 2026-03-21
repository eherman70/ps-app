import { useState, useEffect } from 'react';

export function useStorage(key) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await window.storage.list(key);
      const parsedItems = [];
      for (const itemKey of data.keys) {
        const item = await window.storage.get(itemKey);
        if (item && item.value) {
          parsedItems.push(JSON.parse(item.value));
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
      const storageKey = id ? `${key}_${id}` : key;
      await window.storage.set(storageKey, JSON.stringify(item));
      await loadItems(); // Reload items after save
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
      throw error;
    }
  };

  const deleteItem = async (id) => {
    try {
      await window.storage.remove(`${key}_${id}`);
      await loadItems(); // Reload items after delete
    } catch (error) {
      console.error(`Error deleting ${key}:`, error);
      throw error;
    }
  };

  useEffect(() => {
    loadItems();
  }, [key]);

  return { items, loading, saveItem, deleteItem };
}