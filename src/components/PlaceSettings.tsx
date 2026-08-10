import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  alterMin,
  alterText,
  genauigkeitText,
  istFrisch,
  kartenLink,
  ortungsFehler,
} from '../domain/standort';
import type { AppState } from '../domain/types';
import {
  beiFreigabewechsel,
  ladeFreigabe,
  ladeIchBin,
  speichereFreigabe,
  speichereIchBin,
} from '../storage/freigabe';
import { clearPlace, reportPlace } from '../storage/store';

/**
 * „Wo bist du gerade?"
 *
 * Drei Dinge stehen hier bewusst so und nicht anders:
 *
 * Die **Grenze steht vor dem Schalter**, nicht darunter. Wer glaubt, der
 * Planer melde den Standort auch bei geschlossener App, verlässt sich im
 * Notfall auf einen Punkt von vorgestern. Für genau diesen Fall steht der
 * Hinweis auf die Handy-Funktion daneben – die kann es wirklich.
 *
 * Das **Alter steht groß neben dem Ort**, nicht klein darunter. Ein Punkt
 * ohne Zeitangabe wird für „jetzt" gehalten.
 *
 * Und wer teilt, **sieht das durchgehend**. Ein Mitlesen, das man vergisst,
 * ist keins mehr.
 */
export function PlaceSettings({
  state,
  displayName,
}: {
  state: AppState;
  displayName: string | null;
}) {
  const teilt = useSyncExternalStore(beiFreigabewechsel, ladeFreigabe, () => false);
  const gewaehlt = useSyncExternalStore(beiFreigabewechsel, ladeIchBin, () => null);
  /*
   * Der Anmeldename als Vorschlag, nicht als Gewissheit: Er muss mit dem
   * Namen in der Personenliste nicht übereinstimmen, und ein Fehlgriff hieße
   * hier, den eigenen Ort unter dem Namen des anderen zu melden.
   */
  const vermutet =
    state.members.find((m) => m.name.toLowerCase() === (displayName ?? '').toLowerCase())?.id ??
    null;
  const memberId = gewaehlt ?? vermutet;
  const [meldung, setMeldung] = useState<string | null>(null);
  const [jetzt, setJetzt] = useState(() => new Date());

  // Die Zeitangaben altern sichtbar, ohne dass man neu laden muss.
  useEffect(() => {
    const uhr = setInterval(() => setJetzt(new Date()), 30_000);
    return () => clearInterval(uhr);
  }, []);

  const umschalten = (an: boolean) => {
    speichereFreigabe(an);
    setMeldung(null);
    /*
     * Beim Abschalten wird der letzte Punkt zurückgenommen. Ohne das wäre
     * „aus" nur „ab jetzt nichts Neues mehr" – und der alte Ort stünde
     * weiter beim anderen.
     */
    if (!an && memberId) clearPlace(memberId);
  };

  const hierBinIch = () => {
    if (!memberId || !navigator.geolocation) return;
    setMeldung('Wird geortet …');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        reportPlace({
          memberId,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          manual: true,
        });
        setMeldung('Standort gemeldet.');
      },
      (err) => setMeldung(ortungsFehler(err.code)),
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  };

  const andere = state.members.filter((m) => m.id !== memberId);

  return (
    <div className="settings-group">
      <h3>Wo seid ihr</h3>

      {/*
        Die Grenze zuerst. Sie ist der Grund, warum diese Funktion für einen
        echten Notfall nicht genügt – und das gehört gesagt, bevor jemand
        sich darauf verlässt.
      */}
      <p className="hint">
        <strong>Nur solange der Planer offen ist.</strong> Ein Browser darf den Standort nicht im
        Hintergrund melden. Liegt die App zu, bleibt der letzte Stand stehen – er kann Stunden alt
        sein.
      </p>
      <p className="hint achtung">
        <strong>Für einen echten Notfall reicht das nicht.</strong> Dafür gibt es die
        Standortfreigabe des Handys – bei Android in Google Maps, bei iPhone „Wo ist?". Die läuft
        auch im Hintergrund und ist dafür gemacht. Diese Anzeige hier beantwortet „wo bist du
        gerade", nicht „finde mich im Ernstfall".
      </p>

      {state.members.length === 0 ? (
        <p className="hint">
          Dafür müsst ihr erst als Personen angelegt sein – sonst weiß der Planer nicht, wessen
          Standort er meldet.
        </p>
      ) : (
        <>
          <label className="field">
            <span>Ich bin</span>
            <select
              value={memberId ?? ''}
              onChange={(e) => speichereIchBin(e.target.value || null)}
              aria-label="Wer bin ich"
            >
              <option value="">bitte wählen</option>
              {state.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {!memberId ? null : (
        <>
          <label className="check-field">
            <input type="checkbox" checked={teilt} onChange={(e) => umschalten(e.target.checked)} />
            <span>
              Meinen Standort teilen
              <span className="muted small">
                {' '}
                – gilt nur für dich; jeder schaltet es auf seinem Gerät selbst ein
              </span>
            </span>
          </label>

          {teilt && (
            <p className="hint">
              <span className="pulse" aria-hidden /> Dein Standort wird geteilt, solange der Planer
              offen ist. Abschalten nimmt auch den letzten Punkt zurück.
            </p>
          )}

          <div className="button-row">
            {meldung && <span className="muted small">{meldung}</span>}
            <span className="spacer" />
            {/*
              Der Handgriff daneben: Ein einzelnes „ich bin hier" ist oft
              genau das, was man will – und es verlangt keine dauerhafte
              Freigabe.
            */}
            <button className="btn" onClick={hierBinIch}>
              Ich bin hier
            </button>
          </div>
        </>
      )}

      <ul className="place-list">
        {andere.map((m) => {
          const ort = state.places.find((p) => p.memberId === m.id);
          if (!ort) {
            return (
              <li key={m.id} className="place-row">
                <span className="place-name">{m.name}</span>
                <span className="muted small">teilt gerade nicht</span>
              </li>
            );
          }
          const min = alterMin(ort.at, jetzt);
          return (
            <li key={m.id} className="place-row">
              <span className="place-name">{m.name}</span>
              {/* Das Alter zuerst und in Lesegröße – siehe oben. */}
              <span className={istFrisch(min) ? 'place-age frisch' : 'place-age'}>
                {alterText(min)}
                {ort.manual && ' · von Hand'}
              </span>
              <span className="muted small">{genauigkeitText(ort.accuracyM)}</span>
              <a
                className="btn tiny"
                href={kartenLink(ort.lat, ort.lon)}
                target="_blank"
                rel="noreferrer"
              >
                Auf der Karte
              </a>
            </li>
          );
        })}
        {andere.length === 0 && (
          <li className="place-row">
            <span className="muted small">Noch niemand sonst im Haushalt angelegt.</span>
          </li>
        )}
      </ul>
    </div>
  );
}
