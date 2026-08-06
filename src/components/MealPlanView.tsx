import { useMemo, useState } from 'react';
import { WEEKDAY_SHORT, addDays, formatDateShort, weekDates, weekdayIndex } from '../domain/dates';
import {
  SLOTS,
  SLOT_LABELS,
  collectNeeded,
  formatQuantity,
  ingredientsOf,
  mealLabel,
} from '../domain/meals';
import { formatEuro } from '../domain/voice';
import type { AppState, MealSlot, Recipe } from '../domain/types';
import {
  addIngredient,
  addRecipe,
  addShoppingItems,
  clearMeal,
  deleteIngredient,
  deleteRecipe,
  setMeal,
  updateIngredient,
  updateRecipe,
} from '../storage/store';

type Props = {
  state: AppState;
  anchorDate: string;
  displayName: string | null;
};

/**
 * Essensplan für die Woche und die Rezepte dahinter.
 *
 * Der eigentliche Nutzen liegt im Übergang zur Einkaufsliste: aus vier
 * geplanten Gerichten wird eine Liste, in der Zwiebeln einmal mit der Summe
 * stehen und nicht viermal einzeln.
 */
export function MealPlanView({ state, anchorDate, displayName }: Props) {
  const [woche, setWoche] = useState(anchorDate);
  const [offenesRezept, setOffenesRezept] = useState<string | null>(null);
  const [neuerName, setNeuerName] = useState('');
  const [auswahl, setAuswahl] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [vorschau, setVorschau] = useState(false);
  const [mitVorraeten, setMitVorraeten] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  const tage = useMemo(() => weekDates(woche), [woche]);

  const geplant = useMemo(
    () => state.meals.filter((m) => tage.includes(m.date)),
    [state.meals, tage],
  );

  const bedarf = useMemo(
    () =>
      collectNeeded({
        entries: geplant,
        recipes: state.recipes,
        ingredients: state.recipeIngredients,
        shopping: state.shopping,
        priceMemory: state.settings.priceMemory,
        includeStaples: mitVorraeten,
      }),
    [geplant, state.recipes, state.recipeIngredients, state.shopping, state.settings.priceMemory, mitVorraeten],
  );

  const summe = bedarf.items.reduce((sum, i) => sum + (i.estimatedCents ?? 0), 0);
  const rezept = offenesRezept ? state.recipes.find((r) => r.id === offenesRezept) : null;

  const uebernehmen = (nurNeue: boolean) => {
    const auswahlItems = nurNeue ? bedarf.items.filter((i) => !i.alreadyListed) : bedarf.items;
    if (auswahlItems.length === 0) {
      setMeldung('Nichts zu übernehmen.');
      return;
    }
    addShoppingItems(
      auswahlItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        estimatedCents: item.estimatedCents,
        createdBy: displayName,
      })),
    );
    setVorschau(false);
    setMeldung(`${auswahlItems.length} auf die Einkaufsliste gelegt.`);
  };

  /* ------------------------------------------------------------- Rezept */

  if (rezept) return <RezeptKarte state={state} recipe={rezept} onBack={() => setOffenesRezept(null)} />;

  return (
    <div className="meals">
      <header className="panel-head slim">
        <h3>Essensplan</h3>
        <div className="date-nav">
          <button
            className="icon-btn"
            onClick={() => setWoche(addDays(woche, -7))}
            aria-label="Vorwoche"
          >
            ‹
          </button>
          <strong>ab {formatDateShort(tage[0])}</strong>
          <button
            className="icon-btn"
            onClick={() => setWoche(addDays(woche, 7))}
            aria-label="Folgewoche"
          >
            ›
          </button>
        </div>
      </header>

      <div className="meal-grid">
        {tage.map((date) => (
          <div key={date} className={`meal-day${date === anchorDate ? ' is-today' : ''}`}>
            <div className="meal-day-head">
              <strong>
                {WEEKDAY_SHORT[weekdayIndex(date)]} {formatDateShort(date)}
              </strong>
            </div>
            {SLOTS.map((slot) => {
              const eintrag = state.meals.find((m) => m.date === date && m.slot === slot);
              return (
                <button
                  key={slot}
                  className={`meal-slot${eintrag ? ' filled' : ''}`}
                  onClick={() => setAuswahl({ date, slot })}
                >
                  <span className="meal-slot-label">{SLOT_LABELS[slot]}</span>
                  <span className="meal-slot-value">
                    {eintrag ? mealLabel(eintrag, state.recipes) : '+'}
                  </span>
                  {eintrag && eintrag.servings !== 2 && (
                    <span className="meal-slot-servings">{eintrag.servings} P.</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {auswahl && (
        <MahlzeitWaehlen
          state={state}
          date={auswahl.date}
          slot={auswahl.slot}
          onClose={() => setAuswahl(null)}
          onOpenRecipe={(id) => {
            setAuswahl(null);
            setOffenesRezept(id);
          }}
        />
      )}

      <div className="button-row">
        <button
          className="btn primary"
          onClick={() => {
            setMeldung(null);
            setVorschau(true);
          }}
          disabled={geplant.length === 0}
        >
          Zutaten auf die Einkaufsliste
        </button>
        {geplant.length === 0 && (
          <span className="muted small">Erst ein Gericht einplanen.</span>
        )}
      </div>

      {meldung && <p className="hint">{meldung}</p>}

      {vorschau && (
        <div className="ics-preview">
          <p className="hint">
            {bedarf.items.length} {bedarf.items.length === 1 ? 'Zutat' : 'Zutaten'} aus{' '}
            {geplant.length} {geplant.length === 1 ? 'Gericht' : 'Gerichten'}
            {summe > 0 && ` · rund ${formatEuro(summe)}`}
          </p>

          {bedarf.staplesSkipped > 0 && (
            <p className="hint">
              {bedarf.staplesSkipped} Vorratszutaten ausgelassen – Salz und Öl gehören selten auf
              die Liste.
            </p>
          )}
          {bedarf.withoutRecipe > 0 && (
            <p className="hint">
              {bedarf.withoutRecipe} geplante Mahlzeiten haben kein Rezept und liefern keine
              Zutaten.
            </p>
          )}

          <label className="check-field">
            <input
              type="checkbox"
              checked={mitVorraeten}
              onChange={(e) => setMitVorraeten(e.target.checked)}
            />
            Vorräte mitnehmen
          </label>

          <ul className="ics-list">
            {bedarf.items.map((item) => (
              <li key={`${item.name}|${item.unit}`} className={item.alreadyListed ? 'muted' : ''}>
                <strong>{formatQuantity(item.quantity, item.unit)}</strong> {item.name}
                {item.estimatedCents !== null && (
                  <span className="muted small"> · {formatEuro(item.estimatedCents)}</span>
                )}
                {item.alreadyListed && <span className="muted small"> · steht schon auf der Liste</span>}
                <span className="muted small"> · aus {item.from.join(', ')}</span>
              </li>
            ))}
          </ul>

          <div className="button-row">
            <button className="btn ghost" onClick={() => setVorschau(false)}>
              Abbrechen
            </button>
            <span className="spacer" />
            <button className="btn" onClick={() => uebernehmen(false)}>
              Alle übernehmen
            </button>
            <button
              className="btn primary"
              onClick={() => uebernehmen(true)}
              disabled={bedarf.items.every((i) => i.alreadyListed)}
            >
              Nur was fehlt
            </button>
          </div>
        </div>
      )}

      <div className="settings-group">
        <h3>Gerichte</h3>
        <ul className="context-list">
          {state.recipes.map((r) => (
            <li key={r.id} className="recipe-row">
              <button className="link strong" onClick={() => setOffenesRezept(r.id)}>
                {r.title}
              </button>
              <span className="muted small">
                {ingredientsOf(r.id, state.recipeIngredients).length} Zutaten · für {r.servings}
              </span>
            </li>
          ))}
        </ul>
        {state.recipes.length === 0 && (
          <p className="empty">
            Noch keine Gerichte. Lege eines an – die Zutaten wandern später auf die Einkaufsliste.
          </p>
        )}
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!neuerName.trim()) return;
            const neu = addRecipe(neuerName);
            setNeuerName('');
            setOffenesRezept(neu.id);
          }}
        >
          <input
            value={neuerName}
            onChange={(e) => setNeuerName(e.target.value)}
            placeholder="Gericht hinzufügen"
            aria-label="Neues Gericht"
          />
          <button className="btn" type="submit" disabled={!neuerName.trim()}>
            Anlegen
          </button>
        </form>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Gericht wählen */

function MahlzeitWaehlen({
  state,
  date,
  slot,
  onClose,
  onOpenRecipe,
}: {
  state: AppState;
  date: string;
  slot: MealSlot;
  onClose: () => void;
  onOpenRecipe: (id: string) => void;
}) {
  const vorhanden = state.meals.find((m) => m.date === date && m.slot === slot);
  const [servings, setServings] = useState(vorhanden?.servings ?? 2);
  const [freitext, setFreitext] = useState(vorhanden?.recipeId ? '' : (vorhanden?.title ?? ''));

  return (
    <div className="meal-picker">
      <header className="panel-head slim">
        <h3>
          {SLOT_LABELS[slot]} am {formatDateShort(date)}
        </h3>
        <button className="btn tiny ghost" onClick={onClose}>
          Schließen
        </button>
      </header>

      <label className="field narrow">
        <span>Portionen</span>
        <input
          type="number"
          min={1}
          max={20}
          value={servings}
          onChange={(e) => setServings(Math.max(1, Number(e.target.value)))}
        />
      </label>

      <div className="filters">
        {state.recipes.map((r: Recipe) => (
          <button
            key={r.id}
            className={`chip${vorhanden?.recipeId === r.id ? ' on' : ''}`}
            onClick={() => {
              setMeal(date, slot, { recipeId: r.id, servings });
              onClose();
            }}
          >
            {r.title}
          </button>
        ))}
      </div>
      {state.recipes.length === 0 && (
        <p className="hint">Noch keine Gerichte angelegt – trag unten ein, was es gibt.</p>
      )}

      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!freitext.trim()) return;
          setMeal(date, slot, { title: freitext, servings });
          onClose();
        }}
      >
        <input
          value={freitext}
          onChange={(e) => setFreitext(e.target.value)}
          placeholder="Oder frei eintragen: Reste, Essen gehen …"
          aria-label="Freier Eintrag"
        />
        <button className="btn" type="submit" disabled={!freitext.trim()}>
          Eintragen
        </button>
      </form>

      <div className="button-row">
        {vorhanden?.recipeId && (
          <button className="btn tiny" onClick={() => onOpenRecipe(vorhanden.recipeId!)}>
            Rezept öffnen
          </button>
        )}
        <span className="spacer" />
        {vorhanden && (
          <button
            className="btn tiny danger ghost"
            onClick={() => {
              clearMeal(date, slot);
              onClose();
            }}
          >
            Leeren
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Rezept */

function RezeptKarte({
  state,
  recipe,
  onBack,
}: {
  state: AppState;
  recipe: Recipe;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [menge, setMenge] = useState('');
  const [einheit, setEinheit] = useState('');
  const zutaten = ingredientsOf(recipe.id, state.recipeIngredients);

  return (
    <div className="recipe">
      <header className="panel-head slim">
        <button className="btn tiny ghost" onClick={onBack}>
          ‹ Essensplan
        </button>
        <span className="spacer" />
        <button
          className="btn tiny danger ghost"
          onClick={() => {
            deleteRecipe(recipe.id);
            onBack();
          }}
          title="Gericht löschen. Geplante Mahlzeiten behalten den Namen."
        >
          Löschen
        </button>
      </header>

      <input
        className="trip-title"
        value={recipe.title}
        onChange={(e) => updateRecipe(recipe.id, { title: e.target.value })}
        aria-label="Name des Gerichts"
      />

      <div className="field-row tight">
        <label className="field narrow">
          <span>Für … Personen</span>
          <input
            type="number"
            min={1}
            max={20}
            value={recipe.servings}
            onChange={(e) =>
              updateRecipe(recipe.id, { servings: Math.max(1, Number(e.target.value)) })
            }
          />
        </label>
      </div>

      <p className="hint">
        Die Mengen gelten für {recipe.servings} Personen. Beim Einplanen wird auf die dort
        eingetragene Zahl umgerechnet.
      </p>

      <ul className="shopping-list">
        {zutaten.map((zutat) => (
          <li key={zutat.id} className="shopping-row">
            <span className="shopping-main">
              <span className="shopping-name">
                <strong>{formatQuantity(zutat.quantity, zutat.unit)}</strong> {zutat.name}
              </span>
            </span>
            <label className="check-field small" title="Vorrat: wandert nicht auf die Einkaufsliste">
              <input
                type="checkbox"
                checked={zutat.staple}
                onChange={(e) => updateIngredient(zutat.id, { staple: e.target.checked })}
              />
              Vorrat
            </label>
            <button
              className="btn tiny danger ghost"
              onClick={() => deleteIngredient(zutat.id)}
              aria-label="Zutat entfernen"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {zutaten.length === 0 && <p className="empty">Noch keine Zutaten.</p>}

      <form
        className="shopping-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addIngredient(recipe.id, {
            name,
            quantity: menge.trim() ? Number(menge.replace(',', '.')) : null,
            unit: einheit,
          });
          setName('');
          setMenge('');
          setEinheit('');
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Zutat"
          aria-label="Zutat"
        />
        <input
          className="qty-input"
          value={menge}
          onChange={(e) => setMenge(e.target.value)}
          placeholder="Menge"
          aria-label="Menge"
          inputMode="decimal"
        />
        <input
          className="unit-input"
          value={einheit}
          onChange={(e) => setEinheit(e.target.value)}
          placeholder="g, Stück …"
          aria-label="Einheit"
        />
        <button className="btn primary" type="submit" disabled={!name.trim()}>
          +
        </button>
      </form>

      <label className="field">
        <span>Notizen</span>
        <textarea
          rows={3}
          value={recipe.notes}
          onChange={(e) => updateRecipe(recipe.id, { notes: e.target.value })}
        />
      </label>
    </div>
  );
}
