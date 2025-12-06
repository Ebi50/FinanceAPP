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
import { useAuth, useUser } from "@/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react";


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const auth = useAuth();
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
    if (!auth) return;
    setIsSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged in the provider will handle the redirect
    } catch (error: any) {
      console.error("Sign-in failed:", error);
      let description = "Ein unbekannter Fehler ist aufgetreten.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
        description = "Für diese E-Mail-Adresse wurde kein Benutzerkonto gefunden.";
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = "Das eingegebene Passwort ist nicht korrekt.";
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
  
  const handlePasswordReset = () => {
    if (!auth) {
        toast({
            variant: "destructive",
            title: "Fehler",
            description: "Authentifizierungsdienst nicht verfügbar.",
        });
        return;
    }
    if (!resetEmail) {
        toast({
            variant: "destructive",
            title: "E-Mail erforderlich",
            description: "Bitte geben Sie Ihre E-Mail-Adresse ein.",
        });
        return;
    }
    sendPasswordResetEmail(auth, resetEmail)
        .then(() => {
            toast({
                title: "E-Mail zum Zurücksetzen gesendet",
                description: "Wenn ein Konto mit dieser E-Mail existiert, wurde eine Anleitung zum Zurücksetzen des Passworts gesendet.",
            });
        })
        .catch((error) => {
            console.error("Error sending password reset email:", error);
            let description = 'E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.';
            
            // Provide more specific feedback for configuration issues vs. general errors.
            if (error.code === 'auth/missing-continue-uri' || 
                error.code === 'auth/invalid-continue-uri' ||
                error.code === 'auth/unauthorized-continue-uri') {
                description = 'Die App ist nicht korrekt für den E-Mail-Versand konfiguriert. Bitte überprüfen Sie Ihre Firebase-Konsoleneinstellungen für E-Mail-Vorlagen.';
            } else if (error.code && error.message) {
                // Show the specific error to aid debugging SMTP/other issues
                description = `${error.code}: ${error.message}`;
            }

            toast({
                variant: "destructive",
                title: "Fehler beim E-Mail-Versand",
                description: description,
                duration: 9000,
            });
        });
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
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button variant="link" className="ml-auto inline-block text-sm underline p-0 h-auto">
                            Passwort vergessen?
                          </Button>
                      </AlertDialogTrigger>
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
              Neue Benutzer können in der Firebase-Konsole angelegt werden.
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
