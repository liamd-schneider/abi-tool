import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = { title: "Nutzungsbedingungen" };

export default function NutzungsbedingungenPage() {
  return (
    <LegalPage title="Nutzungsbedingungen">
      <LegalSection title="1. Angebot">
        <p>
          Das Abi-Tool ist eine kostenlose Plattform zur Organisation von Abi-Jahrgängen (Termine, Schichten, Spenden,
          Abstimmungen). Es besteht kein Anspruch auf ständige Verfügbarkeit.
        </p>
      </LegalSection>
      <LegalSection title="2. Registrierung">
        <p>
          Wer einen Jahrgang registriert, wird dessen Admin und ist dafür verantwortlich, Accounts nur für Mitglieder des
          eigenen Jahrgangs anzulegen und Zugangsdaten vertraulich weiterzugeben.
        </p>
      </LegalSection>
      <LegalSection title="3. Inhalte">
        <p>
          Für eingetragene Inhalte sind die jeweiligen Nutzer:innen verantwortlich. Rechtswidrige, beleidigende oder
          diskriminierende Inhalte sind verboten. Wir können Inhalte entfernen und Jahrgänge sperren.
        </p>
      </LegalSection>
      <LegalSection title="4. Partnerangebote">
        <p>
          Die Plattform finanziert sich über gekennzeichnete Partnerangebote. Verträge kommen ausschließlich mit dem jeweiligen
          Partner zustande.
        </p>
      </LegalSection>
      <LegalSection title="5. Haftung">
        <p>[Haftungsregelung ergänzen und rechtlich prüfen lassen.]</p>
      </LegalSection>
      <LegalSection title="6. Löschung">
        <p>Accounts und ganze Jahrgänge können jederzeit gelöscht werden. Wendet euch dazu an [E-Mail].</p>
      </LegalSection>
    </LegalPage>
  );
}
