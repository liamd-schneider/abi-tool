import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = { title: "Impressum" };

export default function ImpressumPage() {
  return (
    <LegalPage title="Impressum">
      <LegalSection title="Angaben gemäß § 5 DDG">
        <p>
          [Vor- und Nachname bzw. Firma]
          <br />
          [Straße Hausnummer]
          <br />
          [PLZ Ort]
        </p>
      </LegalSection>
      <LegalSection title="Kontakt">
        <p>
          E-Mail: [kontakt@eure-domain.de]
          <br />
          Telefon: [optional]
        </p>
      </LegalSection>
      <LegalSection title="Verantwortlich für den Inhalt">
        <p>[Name, Anschrift wie oben]</p>
      </LegalSection>
      <LegalSection title="Partnerangebote">
        <p>
          Auf dieser Website werden Angebote von Partnern angezeigt. Diese sind als „Anzeige“ gekennzeichnet. Für Klicks bzw.
          Buchungen über diese Links erhalten wir ggf. eine Vergütung. Für die Inhalte der verlinkten Seiten sind ausschließlich
          deren Betreiber verantwortlich.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
