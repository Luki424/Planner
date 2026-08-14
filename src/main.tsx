import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { bitteUmDauerhaft } from './storage/dauerhaft';
import './styles.css';

/*
 * Gleich beim Start um dauerhaften Speicher bitten.
 *
 * Ohne diese Bitte ist die Ablage „best effort": Der Browser darf sie räumen,
 * sobald der Platz auf dem Gerät knapp wird – ohne Rückfrage. Genau so sind
 * hier zweimal Anmeldung, Firebase-Verbindung und alle gerätelokalen
 * Einstellungen verschwunden, ohne dass die App etwas gelöscht hätte.
 *
 * Chrome gewährt es einer installierten App meist stillschweigend, Firefox
 * fragt nach, Safari kennt die Frage nicht. Eine Ablehnung ist kein Fehler und
 * bleibt hier folgenlos – in den Einstellungen steht, woran man ist, und dort
 * lässt es sich erneut versuchen.
 */
void bitteUmDauerhaft();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
