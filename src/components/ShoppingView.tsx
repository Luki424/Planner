import { useMemo, useState } from 'react';
import { formatEuro, type Parsed } from '../domain/voice';
import { collectDisplayNames, recallPrice, suggestItems } from '../domain/prices';
import type { PriceMemoryEntry, ShoppingItem } from '../domain/types';
import {
  addShoppingItem,
  addShoppingItems,
  clearDoneShoppingItems,
  deleteShoppingItem,
  shoppingTotalCents,
  shoppingUnpricedCount,
  toggleShoppingItem,
  updateShoppingItem,
} from '../storage/store';
import { VoiceCapture } from './VoiceCapture';

type Props = {
  items: ShoppingItem[];
  today: string;
  displayName: string | null;
  priceMemory: Record<string, PriceMemoryEntry>;
};

/** "1,50" oder "1.50" → Cent; leer → null. */
function parsePrice(value: string): number | null | undefined {
  const trimmed = value.trim().replace('€', '').trim();
  if (!trimmed) return null;
  const normalized = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(normalized) || normalized < 0) return undefined;
  return Math.round(normalized * 100);
}

function formatPriceInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

export function ShoppingView({ items, today, displayName, priceMemory }: Props) {
  const [draft, setDraft] = useState('');
  const [draftPrice, setDraftPrice] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const { open, done } = useMemo(() => {
    // Nach Erfassungszeit, damit die Liste bei beiden gleich aussieht und
    // nichts springt, wenn der oder die andere etwas ergänzt.
    const byCreated = [...items].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    return {
      open: byCreated.filter((item) => !item.done),
      done: byCreated.filter((item) => item.done),
    };
  }, [items]);

  const displayNames = useMemo(() => collectDisplayNames(items), [items]);
  const suggestions = useMemo(
    () => suggestItems(priceMemory, displayNames, draft, items),
    [priceMemory, displayNames, draft, items],
  );
  const knownPrice = draft.trim() ? recallPrice(priceMemory, draft) : null;

  const openTotal = shoppingTotalCents(open);
  const allTotal = shoppingTotalCents(items);
  const missingPrices = shoppingUnpricedCount(open);

  const submitDraft = (overrides?: { name?: string; cents?: number | null }) => {
    const name = (overrides?.name ?? draft).trim();
    if (!name) return;
    const typed = parsePrice(draftPrice);
    // Ohne eingetippten Preis den zuletzt bezahlten übernehmen – sichtbar in
    // der Zeile und jederzeit korrigierbar.
    const price =
      overrides?.cents !== undefined
        ? overrides.cents
        : typed === undefined
          ? null
          : (typed ?? recallPrice(priceMemory, name));
    addShoppingItem({ name, estimatedCents: price, createdBy: displayName });
    setDraft('');
    setDraftPrice('');
  };

  const acceptVoice = (parsed: Parsed) => {
    if (parsed.kind !== 'shopping') return;
    addShoppingItems(
      parsed.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        estimatedCents: item.estimatedCents,
        createdBy: displayName,
      })),
    );
  };

  return (
    <section className="panel wide shopping">
      <header className="panel-head">
        <h2>Einkaufsliste</h2>
        <VoiceCapture
          mode="shopping"
          today={today}
          onAccept={acceptVoice}
          label="Einkauf diktieren"
        />
      </header>

      <div className="shopping-total">
        <div>
          <span className="total-value">{formatEuro(openTotal)}</span>
          <span className="muted small"> geschätzt · {open.length} offen</span>
        </div>
        {missingPrices > 0 && (
          <span className="muted small">
            {missingPrices} {missingPrices === 1 ? 'Position' : 'Positionen'} ohne Preis
          </span>
        )}
        {done.length > 0 && (
          <span className="muted small">
            im Wagen: {formatEuro(allTotal - openTotal)} · gesamt {formatEuro(allTotal)}
          </span>
        )}
      </div>

      <form
        className="shopping-add"
        onSubmit={(e) => {
          e.preventDefault();
          submitDraft();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Was fehlt? z.B. 2 Liter Milch"
          aria-label="Neuer Eintrag"
        />
        <input
          className="price-input"
          value={draftPrice}
          onChange={(e) => setDraftPrice(e.target.value)}
          placeholder="€"
          inputMode="decimal"
          aria-label="Geschätzter Preis"
        />
        <button className="btn primary" type="submit" disabled={!draft.trim()}>
          +
        </button>
      </form>

      {(suggestions.length > 0 || knownPrice !== null) && (
        <div className="suggestions">
          {knownPrice !== null && !draftPrice.trim() && (
            <span className="muted small">
              zuletzt {formatEuro(knownPrice)} – wird übernommen
            </span>
          )}
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.name}
              type="button"
              className="chip on suggestion"
              onClick={() => submitDraft({ name: suggestion.name, cents: suggestion.cents })}
            >
              {suggestion.name}
              {suggestion.cents !== null && (
                <span className="muted small"> {formatEuro(suggestion.cents)}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <ul className="shopping-list">
        {open.map((item) => (
          <ShoppingRow
            key={item.id}
            item={item}
            editing={editing === item.id}
            onEdit={() => setEditing(editing === item.id ? null : item.id)}
            onDone={() => setEditing(null)}
          />
        ))}
      </ul>

      {open.length === 0 && (
        <p className="empty">
          Liste ist leer. Tippe oben etwas ein oder diktiere es – „zwei Liter Milch und Brot für
          drei Euro" wird direkt in zwei Positionen zerlegt.
        </p>
      )}

      {done.length > 0 && (
        <div className="shopping-done">
          <header className="panel-head slim">
            <h3>Im Wagen ({done.length})</h3>
            <button className="btn tiny ghost" onClick={clearDoneShoppingItems}>
              Abgehaktes entfernen
            </button>
          </header>
          <ul className="shopping-list">
            {done.map((item) => (
              <ShoppingRow
                key={item.id}
                item={item}
                editing={editing === item.id}
                onEdit={() => setEditing(editing === item.id ? null : item.id)}
                onDone={() => setEditing(null)}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ShoppingRow({
  item,
  editing,
  onEdit,
  onDone,
}: {
  item: ShoppingItem;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const [price, setPrice] = useState(() => formatPriceInput(item.estimatedCents));
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity === null ? '' : String(item.quantity));
  const [unit, setUnit] = useState(item.unit);

  const priceValue = parsePrice(price);
  const priceInvalid = priceValue === undefined;

  const save = () => {
    if (priceInvalid || !name.trim()) return;
    const parsedQuantity = quantity.trim() ? Number(quantity.replace(',', '.')) : null;
    updateShoppingItem(item.id, {
      name: name.trim(),
      estimatedCents: priceValue,
      quantity: parsedQuantity !== null && Number.isFinite(parsedQuantity) ? parsedQuantity : null,
      unit: unit.trim(),
    });
    onDone();
  };

  const amount = [item.quantity !== null ? item.quantity : null, item.unit || null]
    .filter((part) => part !== null && part !== '')
    .join(' ');

  if (editing) {
    return (
      <li className="shopping-row editing">
        <form
          className="shopping-edit"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Bezeichnung" />
          <div className="field-row tight">
            <input
              className="qty-input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Menge"
              inputMode="decimal"
              aria-label="Menge"
            />
            <input
              className="unit-input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Einheit"
              aria-label="Einheit"
            />
            <input
              className="price-input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="€"
              inputMode="decimal"
              aria-label="Geschätzter Preis"
            />
          </div>
          {priceInvalid && <p className="hint warn">Preis bitte als Zahl, z.B. 2,49</p>}
          <div className="button-row">
            <button
              className="btn danger ghost tiny"
              type="button"
              onClick={() => deleteShoppingItem(item.id)}
            >
              Löschen
            </button>
            <span className="spacer" />
            <button className="btn ghost tiny" type="button" onClick={onDone}>
              Abbrechen
            </button>
            <button className="btn primary tiny" type="submit" disabled={priceInvalid}>
              Speichern
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`shopping-row${item.done ? ' done' : ''}`}>
      <button
        className="check"
        aria-label={item.done ? 'Zurück auf die Liste' : 'In den Wagen'}
        onClick={() => toggleShoppingItem(item.id)}
      />
      <button className="shopping-main" onClick={onEdit}>
        <span className="shopping-name">
          {amount && <span className="qty">{amount}</span>}
          {item.name}
        </span>
        {item.createdBy && <span className="muted small">von {item.createdBy}</span>}
      </button>
      <button className="shopping-price" onClick={onEdit}>
        {item.estimatedCents === null ? (
          <span className="muted">Preis?</span>
        ) : (
          formatEuro(item.estimatedCents)
        )}
      </button>
    </li>
  );
}
