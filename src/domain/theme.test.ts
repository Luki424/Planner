import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isThemeChoice, nextChoice, resolveTheme } from './theme';

describe('Wahl prüfen', () => {
  it('erkennt die gültigen Werte', () => {
    for (const wahl of ['system', 'light', 'dark']) assert.equal(isThemeChoice(wahl), true);
  });

  it('lehnt alles andere ab', () => {
    for (const murks of ['hell', '', null, undefined, 42, {}]) {
      assert.equal(isThemeChoice(murks), false);
    }
  });
});

describe('Was angezeigt wird', () => {
  it('folgt bei „wie das Gerät" der Systemeinstellung', () => {
    assert.equal(resolveTheme('system', true), 'light');
    assert.equal(resolveTheme('system', false), 'dark');
  });

  it('setzt sich bei fester Wahl über das Gerät hinweg', () => {
    assert.equal(resolveTheme('dark', true), 'dark');
    assert.equal(resolveTheme('light', false), 'light');
  });
});

describe('Umschalten', () => {
  it('wechselt von hell nach dunkel', () => {
    assert.equal(nextChoice('light', true), 'dark');
  });

  it('wechselt von dunkel nach hell', () => {
    assert.equal(nextChoice('dark', false), 'light');
  });

  it('macht aus „wie das Gerät" das Gegenteil des Sichtbaren', () => {
    /*
     * Wer tippt, will jetzt etwas anderes sehen – nicht die Systemvorgabe
     * bestätigt bekommen. Zurück zu ihr geht es über die Einstellungen.
     */
    assert.equal(nextChoice('system', true), 'dark');
    assert.equal(nextChoice('system', false), 'light');
  });

  it('führt zweimaliges Tippen zum Ausgangsbild zurück', () => {
    const erst = nextChoice('system', false);
    assert.equal(nextChoice(erst, false), 'dark');
  });
});
