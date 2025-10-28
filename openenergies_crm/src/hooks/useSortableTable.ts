// src/hooks/useSortableTable.ts
import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// Tipos genéricos para el hook
type SortDirection = 'asc' | 'desc';
type SortConfig<T> = {
  key: keyof T | null;
  direction: SortDirection;
};

// Opciones para el hook
type UseSortableTableOptions<T> = {
  initialSortKey?: keyof T;
  initialSortDirection?: SortDirection;
  sortValueAccessors?: Partial<Record<keyof T, (item: T) => any>>;
};

export function useSortableTable<T extends Record<string, any>>(
  items: T[] | undefined | null,
  options: UseSortableTableOptions<T> = {}
) {
  const { initialSortKey, initialSortDirection = 'asc', sortValueAccessors = {} as Partial<Record<keyof T, (item: T) => any>> } = options;

  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    key: initialSortKey ?? null,
    direction: initialSortDirection,
  });

  const handleSort = useCallback((key: keyof T) => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === key) {
        return { key, direction: prevConfig.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const getSortValue = useCallback((item: T, key: keyof T): any => {
    // --- 👇 CORRECCIÓN: Acceso seguro a accessors ---
    const accessor = sortValueAccessors[key];
    if (typeof accessor === 'function') {
      try {
        // Llama al accesor si es una función
        return accessor(item);
      } catch (e) {
        console.error(`Error en accesor para la clave "${String(key)}":`, e);
        return null; // Devuelve null si el accesor falla
      }
    }
    // --- FIN CORRECCIÓN ---

    // Acceso anidado simple (igual que antes)
    const keys = String(key).split('.');
    let value: any = item; // Inicia con tipo 'any' para el bucle
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }

    // --- 👇 CORRECCIÓN: Comprobar tipo antes de toLowerCase ---
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    // --- FIN CORRECCIÓN ---
    return value;
  }, [sortValueAccessors]);

  const sortedData = useMemo(() => {
    if (!items || items.length === 0) return [];
    const sortableItems = [...items];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const aValue = getSortValue(a, sortConfig.key!);
        const bValue = getSortValue(b, sortConfig.key!);

        if (aValue == null && bValue != null) return 1;
        if (aValue != null && bValue == null) return -1;
        if (aValue == null && bValue == null) return 0;
        if (aValue < bValue) return -1;
        if (aValue > bValue) return 1;
        return 0;
      });
      if (sortConfig.direction === 'desc') {
        sortableItems.reverse();
      }
    }
    return sortableItems;
  }, [items, sortConfig, getSortValue]);

  // --- 👇 CORRECCIÓN: Sintaxis JSX correcta ---
  const renderSortIcon = useCallback((columnKey: keyof T): React.ReactNode => { // Asegúrate de devolver React.ReactNode
    if (sortConfig.key !== columnKey) {
      // Devuelve el COMPONENTE como elemento React sin usar JSX
      return React.createElement(ArrowUpDown, { size: 14, style: { marginLeft: '4px', opacity: 0.3 } });
    }
    // Devuelve el COMPONENTE correcto según la dirección usando React.createElement
    return sortConfig.direction === 'asc'
      ? React.createElement(ArrowUp, { size: 14, style: { marginLeft: '4px' } })
      : React.createElement(ArrowDown, { size: 14, style: { marginLeft: '4px' } });
  }, [sortConfig]);
  // --- FIN CORRECCIÓN ---


  return {
    sortedData,
    handleSort,
    renderSortIcon,
    sortConfig,
  };
}