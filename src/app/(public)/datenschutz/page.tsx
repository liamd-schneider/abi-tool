import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = { title: "Datenschutz" };

export default function DatenschutzPage() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <LegalSection title="1. Verantwortlicher">
        <p>[Name, Anschrift, E-Mail – wie im Impressum]</p>
      </LegalSection>

      <LegalSection title="2. Welche Daten wir verarbeiten">
        <ul>
          <li>Account: Vor- und Nachname, Benutzername, Passwort (nur verschlüsselt gespeichert), Rolle, Jahrgang</li>
          <li>Inhalte, die ihr eintragt: Termine, Schicht-Eintragungen, Spenden, Abstimmungen, Anmerkungen, Einkaufslisten</li>
          <li>Technisch: Login-Zeitpunkte, Benachrichtigungen, Push-Abos (wenn aktiviert), Kalender-Link-Schlüssel</li>
          <li>Klicks auf Partnerangebote (Partner, Zeitpunkt, Jahrgang) – zur Abrechnung mit Partnern</li>
        </ul>
        <p>Wir benötigen keine E-Mail-Adressen und verkaufen keine Daten.</p>
      </LegalSection>

      <LegalSection title="3. Zweck und Rechtsgrundlage">
        <p>
          Bereitstellung der Plattform zur Organisation eures Abi-Jahrgangs (Art. 6 Abs. 1 lit. b DSGVO). Klickzählung bei
          Partnerangeboten auf Grundlage unseres berechtigten Interesses an der Finanzierung der kostenlosen Plattform (Art. 6
          Abs. 1 lit. f DSGVO). [Rechtsgrundlagen prüfen lassen – insbesondere bei Nutzer:innen unter 16 Jahren.]
        </p>
      </LegalSection>

      <LegalSection title="4. Wer die Daten sieht">
        <p>
          Nur Mitglieder des eigenen Jahrgangs; jeder Jahrgang ist technisch von allen anderen getrennt. Die Plattform-Betreiber
          haben Zugriff, soweit es für den Betrieb nötig ist.
        </p>
      </LegalSection>

      <LegalSection title="5. Dienstleister (Auftragsverarbeitung)">
        <ul>
          <li>Supabase (Datenbank & Login) – Serverstandort Frankfurt am Main (EU)</li>
          <li>Vercel (Hosting der Website) – [Region und Vertragsgrundlage eintragen]</li>
          <li>Push-Dienste der Browser-Hersteller (Google, Apple, Mozilla) – nur wenn Push aktiviert ist</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Speicherdauer">
        <p>
          Bis zur Löschung des Accounts bzw. des Jahrgangs. Ein Jahrgang kann jederzeit vollständig gelöscht werden. [Fristen
          ergänzen, z. B. automatische Löschung X Monate nach dem Abi-Jahr.]
        </p>
      </LegalSection>

      <LegalSection title="7. Eure Rechte">
        <p>
          Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie
          Beschwerde bei einer Datenschutz-Aufsichtsbehörde. Wendet euch dazu an [E-Mail].
        </p>
      </LegalSection>

      <LegalSection title="8. Cookies">
        <p>
          Wir verwenden nur technisch notwendige Cookies (Anmeldung und gemerkter Jahrgang). Es gibt kein Tracking und keine
          Werbe-Cookies.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
