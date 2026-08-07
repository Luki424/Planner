# Gemeinsame Nutzung einrichten (Firebase)

Ohne diesen Schritt läuft der Planer als reine Einzelplatz-App: die Daten liegen
im Browser und verlassen ihn nie. Wer die Liste zu zweit führen will, braucht
eine gemeinsame Ablage – das übernimmt Firebase.

Aufwand: einmalig etwa 15 Minuten. Kosten: keine. Das kostenlose Kontingent von
Firebase liegt bei 50.000 gelesenen und 20.000 geschriebenen Dokumenten pro Tag;
ein Haushalt mit zwei Personen kommt auf einen Bruchteil davon.

## 1. Projekt anlegen

1. [console.firebase.google.com](https://console.firebase.google.com) öffnen und
   mit einem Google-Konto anmelden.
2. **Projekt hinzufügen**, Name z.B. `tagesplaner`. Google Analytics wird nicht
   gebraucht – ruhig abwählen.

## 2. Anmeldung per E-Mail aktivieren

1. Links **Authentication** → **Jetzt starten**.
2. Reiter **Sign-in method** → **E-Mail/Passwort** → aktivieren → speichern.
   („E-Mail-Link ohne Passwort" bleibt aus.)

Ohne diesen Schritt meldet die App beim Anmelden
`Anmeldung per E-Mail ist im Firebase-Projekt noch nicht aktiviert`.

## 3. Datenbank anlegen

1. Links **Firestore Database** → **Datenbank erstellen**.
2. Standort: eine Region in Europa, z.B. `eur3` oder `europe-west3`.
3. Startmodus: **Produktionsmodus** (gesperrt). Die passenden Regeln kommen
   gleich im nächsten Schritt.

## 4. Sicherheitsregeln einspielen

Das ist der Schritt, der die Daten schützt – bitte nicht überspringen.

1. In **Firestore Database** den Reiter **Regeln** öffnen.
2. Den gesamten Inhalt der Datei [`firestore.rules`](./firestore.rules) aus
   diesem Projekt hineinkopieren, vorhandenen Inhalt ersetzen.
3. **Veröffentlichen**.

Die Regeln sorgen dafür, dass jeder Haushalt nur seine eigenen Daten sieht und
niemand ohne Anmeldung etwas lesen kann.

## 5. Web-App registrieren und Werte kopieren

1. **Projektübersicht** → Zahnrad → **Projekteinstellungen**.
2. Unter **Meine Apps** auf das Web-Symbol `</>` klicken.
3. Namen vergeben (z.B. `Planer`), **Firebase Hosting** nicht ankreuzen.
4. Firebase zeigt danach einen Block wie diesen:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "tagesplaner-1234.firebaseapp.com",
  projectId: "tagesplaner-1234",
  storageBucket: "tagesplaner-1234.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

Diesen Block vollständig kopieren.

> Diese Werte sind keine Passwörter. Sie benennen nur das Projekt und dürfen
> öffentlich stehen – geschützt wird alles über die Anmeldung und die Regeln
> aus Schritt 4.

## 6. In der App eintragen

**Einstellungen → Gemeinsam nutzen** öffnen, den Block einfügen, **Verbinden**.
Die Seite lädt neu und fragt nach der Anmeldung.

Alternativ lassen sich die Werte fest einbauen, dann entfällt das Eintragen auf
jedem Gerät. Dazu im Repository unter *Settings → Secrets and variables →
Actions → Variables* diese Einträge anlegen:

| Name | Wert |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

Der Veröffentlichungs-Workflow nimmt sie beim Bauen mit.

## 7. Haushalt anlegen und teilen

1. Person A: **Konto anlegen**, danach **Haushalt anlegen**.
2. In den Einstellungen erscheint ein Code wie `K7QMBX2RTA` → **Anzeigen** →
   **Kopieren** und der zweiten Person direkt geben.
3. Person B: eigenes Konto anlegen, dann den Code unter **Beitreten** eingeben.

Ab jetzt sehen beide dieselben Termine, Aufgaben und dieselbe Einkaufsliste.
Änderungen erscheinen innerhalb von Sekunden auf dem anderen Gerät.

**Wer anlegt, nimmt seinen Stand mit.** Was auf dem Gerät von Person A liegt,
wandert beim ersten Verbinden in den Haushalt – dort ist ja noch nichts.

**Wer beitritt, übernimmt den Stand des Haushalts.** Sammlungen, in denen der
Haushalt schon etwas hat, ersetzen die auf dem Gerät; nur wo er noch leer ist,
wandert der lokale Stand hinauf. Hat Person B auf ihrem Gerät schon gearbeitet,
fragt die App vorher nach und zählt auf, worum es geht. Wichtiges vorher über
**Einstellungen → Exportieren** sichern – so lässt es sich danach wieder
einspielen.

Der einfachste Weg ist deshalb: die Person mit den meisten Daten legt den
Haushalt an, die andere tritt bei.

**Zum Code:** Wer ihn kennt, kann dem Haushalt beitreten und alles sehen. Also
direkt weitergeben, nicht in offene Gruppen posten. Er lässt sich nicht ändern –
notfalls einen neuen Haushalt anlegen und neu beitreten.

## 8. Domain freigeben

Damit die Anmeldung von der veröffentlichten Adresse aus funktioniert:

**Authentication → Settings → Authorized domains** → `luki424.github.io`
hinzufügen. `localhost` steht dort bereits.

## Was wo landet

```
users/{uid}                          → zu welchem Haushalt jemand gehört
households/{code}                    → Mitgliederliste
households/{code}/tasks/{id}         → Aufgaben
households/{code}/blocks/{id}        → Zeitblöcke und Termine
households/{code}/series/{id}        → wiederkehrende Aufgaben
households/{code}/contexts/{id}      → Bereiche
households/{code}/taskLists/{id}     → Listen der Aufgabenliste
households/{code}/anniversaries/{id} → Geburtstage und Jahrestage
households/{code}/shopping/{id}      → Einkaufsliste
households/{code}/meta/settings      → Einstellungen
…                                    → Urlaub, Reisen, Rezepte, Essensplan, Kasse
```

Jeder Eintrag ist ein eigenes Dokument. Deshalb kommen sich zwei Personen nicht
in die Quere, wenn sie gleichzeitig etwas ändern: Wer zuletzt denselben Eintrag
anfasst, gewinnt – verschiedene Einträge bleiben beide erhalten.

## Ohne Netz

Firestore puffert lokal. Im Laden ohne Empfang lässt sich weiter abhaken und
ergänzen; sobald wieder Verbindung besteht, gleicht sich alles ab.
