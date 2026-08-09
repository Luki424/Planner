import { WERKZEUGE } from '../domain/assistant';

/**
 * Der Weg zum Sprachmodell.
 *
 * Direkt aus dem Browser, ohne Zwischenstation: Der Planer ist eine reine
 * Browser-App auf einer öffentlichen Seite, einen Server gibt es nicht. Der
 * Schlüssel gehört deshalb dem Benutzer und bleibt auf seinem Gerät – er
 * wird ausdrücklich **nicht** mit dem Haushalt abgeglichen, damit er nicht
 * in der gemeinsamen Datenbank landet.
 */

export type Anbieter = 'anthropic' | 'openai';

export type Zugang = { anbieter: Anbieter; schluessel: string; modell: string };

export const STANDARD_MODELL: Record<Anbieter, string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-5',
};

export const ANBIETER_NAME: Record<Anbieter, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
};

/** Wo man einen Schlüssel bekommt – steht in den Einstellungen daneben. */
export const ANBIETER_LINK: Record<Anbieter, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
};

export type Rolle = 'user' | 'assistant';
export type Nachricht = { rolle: Rolle; text: string };

export type Werkzeugruf = { id: string; name: string; args: Record<string, unknown> };

export type Antwort = { text: string; rufe: Werkzeugruf[] };

const LIMIT = 1024;

function alsJson(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object') return v as Record<string, unknown>;
  if (typeof v === 'string') {
    try {
      const geparst: unknown = JSON.parse(v);
      return geparst && typeof geparst === 'object' ? (geparst as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Fragt das Modell. Wirft mit einer Meldung, die man dem Benutzer zeigen kann.
 *
 * Fehler werden bewusst übersetzt: „401" hilft niemandem weiter, „der
 * Schlüssel wird nicht angenommen" schon.
 */
export async function frage(
  zugang: Zugang,
  system: string,
  verlauf: Nachricht[],
  signal?: AbortSignal,
): Promise<Antwort> {
  const sauber = zusammenfassen(verlauf);
  return zugang.anbieter === 'anthropic'
    ? await fragAnthropic(zugang, system, sauber, signal)
    : await fragOpenAi(zugang, system, sauber, signal);
}

/**
 * Fasst aufeinanderfolgende Nachrichten derselben Rolle zusammen.
 *
 * Das passiert im Alltag: Eine Anfrage schlägt fehl, man fragt noch einmal –
 * und schon stehen zwei Fragen hintereinander, ohne Antwort dazwischen.
 * Anthropic nimmt einen solchen Verlauf nicht an. Er wäre der zweite Fehler
 * direkt nach dem ersten, also genau dann, wenn es am meisten stört.
 */
function zusammenfassen(verlauf: Nachricht[]): Nachricht[] {
  const raus: Nachricht[] = [];
  for (const n of verlauf) {
    const letzte = raus[raus.length - 1];
    if (letzte && letzte.rolle === n.rolle) letzte.text = `${letzte.text}\n\n${n.text}`;
    else raus.push({ ...n });
  }
  return raus;
}

async function pruefen(res: Response): Promise<unknown> {
  if (res.ok) return res.json();
  if (res.status === 401 || res.status === 403) {
    throw new Error('Der Schlüssel wird nicht angenommen. Stimmt er noch?');
  }
  if (res.status === 429) throw new Error('Zu viele Anfragen auf einmal. Gleich noch einmal.');
  if (res.status >= 500) throw new Error('Der Dienst antwortet gerade nicht.');
  let grund = '';
  try {
    const daten = (await res.json()) as { error?: { message?: string } };
    grund = daten?.error?.message ?? '';
  } catch {
    // Kein JSON – dann eben ohne Begründung.
  }
  throw new Error(grund || `Anfrage abgelehnt (${res.status}).`);
}

async function fragAnthropic(
  zugang: Zugang,
  system: string,
  verlauf: Nachricht[],
  signal?: AbortSignal,
): Promise<Antwort> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': zugang.schluessel,
      'anthropic-version': '2023-06-01',
      // Ohne diesen Kopf lehnt die Schnittstelle Aufrufe aus dem Browser ab.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: zugang.modell,
      max_tokens: LIMIT,
      system,
      messages: verlauf.map((n) => ({ role: n.rolle, content: n.text })),
      tools: WERKZEUGE.map((w) => ({
        name: w.name,
        description: w.beschreibung,
        input_schema: w.schema,
      })),
    }),
  });

  const daten = (await pruefen(res)) as {
    content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  };
  const teile = daten.content ?? [];
  return {
    text: teile
      .filter((t) => t.type === 'text')
      .map((t) => t.text ?? '')
      .join('\n')
      .trim(),
    rufe: teile
      .filter((t) => t.type === 'tool_use')
      .map((t) => ({ id: t.id ?? '', name: t.name ?? '', args: alsJson(t.input) })),
  };
}

async function fragOpenAi(
  zugang: Zugang,
  system: string,
  verlauf: Nachricht[],
  signal?: AbortSignal,
): Promise<Antwort> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${zugang.schluessel}`,
    },
    body: JSON.stringify({
      model: zugang.modell,
      max_completion_tokens: LIMIT,
      messages: [
        { role: 'system', content: system },
        ...verlauf.map((n) => ({ role: n.rolle, content: n.text })),
      ],
      tools: WERKZEUGE.map((w) => ({
        type: 'function',
        function: { name: w.name, description: w.beschreibung, parameters: w.schema },
      })),
    }),
  });

  const daten = (await pruefen(res)) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
      };
    }>;
  };
  const nachricht = daten.choices?.[0]?.message;
  return {
    text: (nachricht?.content ?? '').trim(),
    rufe: (nachricht?.tool_calls ?? []).map((r) => ({
      id: r.id ?? '',
      name: r.function?.name ?? '',
      args: alsJson(r.function?.arguments),
    })),
  };
}
