import React from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"

const AccessDenied = ({ title = "Zugriff verweigert", message = "Du hast leider nicht die benötigten Berechtigungen, um diesen Bereich zu betreten." }) => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center page-transition">
            <Card className="w-full max-w-lg shadow-2xl border-destructive/20 overflow-hidden">
                <CardHeader className="pt-12 pb-8 bg-destructive/5 border-b">
                    <div className="relative mx-auto w-fit mb-6">
                        <div className="w-24 h-24 bg-destructive/10 rounded-[2rem] flex items-center justify-center border border-destructive/20 shadow-[0_0_50px_rgba(239,68,68,0.15)]">
                            <ShieldAlert size={48} className="text-destructive" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-background border border-border p-2.5 rounded-xl shadow-xl text-amber-500">
                            <Lock size={18} />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold uppercase tracking-tight text-destructive">
                        {title}
                    </CardTitle>
                </CardHeader>
                
                <CardContent className="py-10">
                    <p className="text-muted-foreground font-medium max-w-sm mx-auto leading-relaxed uppercase tracking-normal text-[10px]">
                        {message}
                    </p>
                </CardContent>

                <CardFooter className="pb-10 justify-center">
                    <Button 
                        variant="outline"
                        size="lg"
                        className="px-10 h-12 font-bold uppercase tracking-normal gap-2"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft size={18} /> Zurückgehen
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default AccessDenied;
