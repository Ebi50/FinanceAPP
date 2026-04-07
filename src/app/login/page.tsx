'use client';
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import Image from "next/image"
import { useUser, useSupabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlaceHolderImages } from '@/lib/placeholder-images';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react";


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const supabase = useSupabase();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const loginImage = PlaceHolderImages.find(p => p.id === 'login-image-1');

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleAuthAction = async () => {
    setIsSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Sign-in failed:", error);
      let description = "Ein unbekannter Fehler ist aufgetreten.";
      if (error.message?.includes('Invalid login credentials')) {
        description = "Die Anmeldedaten sind nicht korrekt.";
      } else if (error.message?.includes('Email not confirmed')) {
        description = "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.";
      }
      toast({
        variant: "destructive",
        title: "Anmeldung fehlgeschlagen",
        description: description,
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
        toast({
            variant: "destructive",
            title: "E-Mail erforderlich",
            description: "Bitte geben Sie Ihre E-Mail-Adresse ein.",
        });
        return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/settings`,
    });

    if (error) {
      console.error("Error sending password reset email:", error);
      toast({
        variant: "destructive",
        title: "Fehler beim E-Mail-Versand",
        description: error.message || 'E-Mail konnte nicht gesendet werden.',
        duration: 9000,
      });
    } else {
      toast({
        title: "E-Mail zum Zurücksetzen gesendet",
        description: "Wenn ein Konto mit dieser E-Mail existiert, wurde eine Anleitung zum Zurücksetzen des Passworts gesendet.",
      });
    }
  };

  if (isUserLoading || user) {
      return <div className="flex items-center justify-center min-h-screen">Laden...</div>
  }

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center py-12">
        <Card className="mx-auto max-w-sm border-0 shadow-none lg:border lg:shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-headline">Dashboard</CardTitle>
            <CardDescription>
              Geben Sie Ihre Anmeldeinformationen ein, um auf Ihr Konto zuzugreifen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@beispiel.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSigningIn}
                  autoComplete="email"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Passwort</Label>
                    <Button variant="link" className="ml-auto inline-block text-sm underline p-0 h-auto" onClick={() => setResetDialogOpen(true)}>
                      Passwort vergessen?
                    </Button>
                    <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Passwort zurücksetzen</AlertDialogTitle>
                          <AlertDialogDescription>
                            Geben Sie Ihre E-Mail-Adresse ein, um einen Link zum Zurücksetzen Ihres Passworts zu erhalten.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="grid gap-2">
                          <Label htmlFor="reset-email">E-Mail</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="m@beispiel.com"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                          />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction onClick={handlePasswordReset}>Link senden</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSigningIn}
                  autoComplete="new-password"
                />
              </div>
              <Button onClick={handleAuthAction} className="w-full" disabled={isSigningIn}>
                {isSigningIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSigningIn ? 'Anmelden...' : 'Anmelden'}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Neue Benutzer können in den Supabase-Einstellungen angelegt werden.
            </div>
          </CardContent>
        </Card>
      </div>
       <div className="hidden bg-muted lg:block">
        {loginImage && (
            <Image
                src={loginImage.imageUrl}
                alt={loginImage.description}
                data-ai-hint={loginImage.imageHint}
                width="1920"
                height="1080"
                className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
        )}
      </div>
    </div>
  )
}
