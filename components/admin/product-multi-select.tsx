"use client";

import { useEffect, useState, useRef } from "react";

export function ProductMultiSelect({ products, initialSelected }: { products: Record<string, string>; initialSelected: string[] }) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>(initialSelected);
  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = Object.entries(products).filter(([, name]) =>
    !productSearch || name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelectedProducts(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <input type="hidden" name="products" value={selectedProducts.join(',')} />

      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedProducts.map(id => (
            <span key={id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-medium">
              {products[id] || id}
              <button type="button" onClick={() => toggle(id)} className="hover:bg-primary/20 rounded-full h-3.5 w-3.5 flex items-center justify-center text-primary/60 hover:text-primary">×</button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        placeholder={selectedProducts.length > 0 ? `${selectedProducts.length} selected — search more...` : "Search products..."}
        value={productSearch}
        onChange={(e) => { setProductSearch(e.target.value); setShowDropdown(true); }}
        onFocus={() => setShowDropdown(true)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        autoComplete="off"
      />

      {showDropdown && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-[200px] overflow-y-auto bg-popover border rounded-lg shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">No products found</div>
          ) : (
            filtered.map(([id, name]) => {
              const isSelected = selectedProducts.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2 ${isSelected ? 'bg-primary/5 text-primary font-semibold' : 'text-foreground'}`}
                >
                  <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                    {isSelected && <span className="text-[10px]">✓</span>}
                  </span>
                  <span className="truncate">{name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
