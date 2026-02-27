import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Building2, Mail, Scale } from 'lucide-react';

const Imprint = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8 py-10 page-transition">
            <Card className="shadow-xl border-border/50 overflow-hidden">
                <CardHeader className="bg-primary/5 p-10 border-b text-center">
                    <CardTitle className="text-4xl font-bold tracking-tight uppercase">Impressum</CardTitle>
                    <CardDescription className="text-muted-foreground uppercase tracking-[0.2em] text-xs font-bold mt-2">Gesetzliche Anbieterkennzeichnung</CardDescription>
                </CardHeader>
                
                <CardContent className="p-10 grid grid-cols-1 gap-10">
                    <div className="space-y-6">
                        <section className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-normal flex items-center gap-2 text-primary">
                                <Building2 size={16} /> Trägerverein
                            </h3>
                            <div className="text-muted-foreground font-medium leading-relaxed">
                                <p className="text-foreground font-bold">Verein für Mission und Diakonie e.V.</p>
                                <p>Neustraße 18</p>
                                <p>35685 Dillenburg</p>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-normal flex items-center gap-2 text-primary">
                                <Scale size={16} /> Vorstand
                            </h3>
                            <div className="text-muted-foreground font-medium leading-relaxed space-y-2">
                                <p>Volker Loh (vertretungsberechtigt), Buchenhöfe 87, 46286 Dorsten</p>
                                <p>Jörg Erbach (vertretungsberechtigt), Lippestraße 36, 59368 Werne</p>
                                <p>Horst-Peter Hohage (vertretungsberechtigt), Eichendorff Straße 25, 58769 Nachrodt</p>
                            </div>
                        </section>
                        <section className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-normal flex items-center gap-2 text-primary">
                                <Building2 size={16} /> Vereinsregister
                            </h3>
                            <div className="text-muted-foreground font-medium leading-relaxed">
                                <p>Amtsgericht Wetzlar - VR 2702</p>
                            </div>
                        </section>

                        <Separator />

                        <section className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-normal flex items-center gap-2 text-primary">
                                <Building2 size={16} /> Delegierte der Ortsgruppe EfG Neckarsulm
                            </h3>
                            <div className="text-muted-foreground font-medium leading-relaxed space-y-2">
                                <p>Marcus Gladrow (vertretungsberechtigt), Ganzhornstr. 96, 74172 Neckarsulm</p>
                                <p>Daniel Depner (vertretungsberechtigt), Ganzhornstr. 96, 74172 Neckarsulm</p>
                                <p>Georg Kahl-Mahlburger (vertretungsberechtigt), Ganzhornstr. 96, 74172 Neckarsulm</p>
                            </div>
                        </section>

                        <Separator />

                        <section className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-normal flex items-center gap-2 text-primary">
                                <Mail size={16} /> Verantwortlich i.S.d. §18 Abs. 2 MStV
                            </h3>
                            <div className="text-muted-foreground font-medium leading-relaxed">
                                <p>Marcus Gladrow</p>
                                <p>
                                    <a className="underline underline-offset-4 hover:text-foreground" href="mailto:marcus.gladrow@efg-neckarsulm.de">
                                        marcus.gladrow@efg-neckarsulm.de
                                    </a>
                                </p>
                                <p className="text-xs">
                                    Kontaktaufnahme erfolgt elektronisch per E-Mail.
                                </p>
                            </div>
                        </section>

                        <Separator />

                        <div className="bg-muted/30 p-6 rounded-2xl">
                            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                                Dieses Portal dient ausschließlich der internen Organisation und Kommunikation der EfG Neckarsulm. 
                                Jegliche unbefugte Nutzung oder Vervielfältigung der Inhalte ist untersagt.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Imprint;
