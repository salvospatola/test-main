import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Building2, Mail, Phone, Database, Cookie, Link2 } from 'lucide-react';

const Privacy = () => {
  return (
    <div className="max-w-4xl mx-auto py-10 space-y-8 page-transition">
      <Card className="shadow-xl border-border/50 overflow-hidden">
        <CardHeader className="bg-primary/5 p-10 border-b text-center">
          <CardTitle className="text-4xl font-bold tracking-tight uppercase">Datenschutz</CardTitle>
          <CardDescription className="text-muted-foreground uppercase tracking-[0.2em] text-xs font-bold mt-2">
            Informationen zur Datenverarbeitung
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 sm:p-10 space-y-8">
          <section className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold border-l-4 border-primary pl-4 uppercase">Verantwortliche Stellen</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-muted/20 border-none">
                <CardContent className="p-5 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <Building2 size={14} /> Datenschutzbeauftragter / verantwortliche Stelle
                  </p>
                  <p className="text-sm font-semibold">Jürgen Golda</p>
                  <p className="text-sm text-muted-foreground">c/o P2 Consult Wilhelm-Bläser-Str. 3c, D-59174 Kamen</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Phone size={13} /> T. 02307.28744.88</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail size={13} /> datenschutz@p2consult.de</p>
                  <p className="text-sm text-muted-foreground">W: www.p2consult.de</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/20 border-none">
                <CardContent className="p-5 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <ShieldCheck size={14} /> Verein für Mission und Diakonie e.V. Datenschutzkoordinator
                  </p>
                  <p className="text-sm font-semibold">Christian Nicko</p>
                  <p className="text-sm text-muted-foreground">c/o Stiftung der Brüdergemeinden, Neustraße 18, 35685 Dillenburg</p>
                  <p className="text-sm text-muted-foreground">Telefon: +49 (0)2771-360079-22</p>
                  <p className="text-sm text-muted-foreground">E-Mail: datenschutz.m-d@stdbg.de</p>
                </CardContent>
              </Card>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Diese Datenschutzerklärung gilt sowohl für die verantwortliche Stelle als auch für die lokale Gemeinde/Ortsgruppe.
              Die Ortsgruppe unterwirft sich dem datenschutzkonformen Umgang gleichlautend dem des übergeordneten Vereins.
            </p>
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold border-l-4 border-primary pl-4 uppercase">1. Grundsätzliches</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Diese Datenschutzerklärung informiert über Art, Umfang und Zweck der Verarbeitung personenbezogener Daten innerhalb
              des Portals und der damit verbundenen Funktionen. Begrifflichkeiten wie „Verarbeitung“ oder „Verantwortlicher“
              richten sich nach Art. 4 DSGVO.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold uppercase">2. Verarbeitete Daten und Zwecke</h3>
            <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
              <li>Bestandsdaten (z.B. Name, Benutzername, Rollen- und Teamzuordnung)</li>
              <li>Kontaktdaten (z.B. E-Mail-Adresse, Telefonnummer)</li>
              <li>Inhaltsdaten (z.B. Beiträge, Kommentare, hochgeladene Bilder)</li>
              <li>Nutzungs- und Logdaten (z.B. Zugriffszeit, technische Metadaten, IP-Adresse)</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Die Verarbeitung erfolgt insbesondere zur Bereitstellung des Portals, interner Kommunikation und Organisation,
              IT-Sicherheit, Missbrauchsprävention sowie zur Bearbeitung von Anfragen.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold uppercase">3. Rechtsgrundlagen</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Soweit keine speziellere Grundlage benannt ist, erfolgt die Verarbeitung auf Basis von Art. 6 Abs. 1 lit. a DSGVO
              (Einwilligung), lit. b DSGVO (Vertrag/Anbahnung), lit. c DSGVO (rechtliche Verpflichtung) oder lit. f DSGVO
              (berechtigtes Interesse, insbesondere sicherer Betrieb des Portals).
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold uppercase flex items-center gap-2"><Cookie size={15} /> 4. Cookies und lokale Speicherung</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Es werden technisch notwendige Mechanismen zur Anmeldung und Sitzungsverwaltung verwendet (z.B. Authentifizierungsdaten,
              sofern erforderlich als Cookie oder in lokaler Speicherung des Browsers). Diese sind für den sicheren Betrieb
              und die Anmeldung notwendig.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Aktuell werden keine optionalen Tracking- oder Marketing-Cookies eingesetzt.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold uppercase flex items-center gap-2"><Database size={15} /> 5. Hosting, Logfiles und Speicherdauer</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Zur Bereitstellung des Onlineangebotes werden Hosting-, Datenbank- und Sicherheitsleistungen eingesetzt.
              Dabei können Zugriffs- und Logdaten verarbeitet werden, insbesondere zur Aufrechterhaltung der Systemsicherheit.
              Daten werden gelöscht oder in der Verarbeitung eingeschränkt, sobald sie für den Zweck nicht mehr erforderlich sind
              und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold uppercase flex items-center gap-2"><Link2 size={15} /> 6. Externe Inhalte</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Im Portal können externe Links und eingebettete Inhalte (z.B. YouTube-Links) angezeigt werden. Beim Aufruf solcher
              Inhalte kann es zur Datenübermittlung an den jeweiligen Drittanbieter kommen.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold uppercase">7. Empfänger und Auftragsverarbeiter</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Eine Weitergabe personenbezogener Daten erfolgt nur, soweit dies rechtlich zulässig ist, zur Vertragserfüllung
              erforderlich ist oder im Rahmen einer Auftragsverarbeitung nach Art. 28 DSGVO erfolgt.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold uppercase">8. Rechte der betroffenen Personen</h3>
            <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
              <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
              <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
              <li>Recht auf Löschung (Art. 17 DSGVO)</li>
              <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
              <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
              <li>Widerspruchsrecht (Art. 21 DSGVO)</li>
              <li>Beschwerderecht bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold uppercase">9. Änderungen dieser Datenschutzerklärung</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen rechtlichen
              und technischen Anforderungen entspricht.
            </p>
            <p className="text-sm font-medium">Stand: 17. Februar 2026</p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default Privacy;
