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
import { useAuth } from "@/lib/auth-provider";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react";


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { user, isUserLoading, refreshUser } = useAuth();
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
      await api.login(email, password);
      // Pull the freshly created session into the provider, then let the
      // effect above redirect to the dashboard.
      await refreshUser();
    } catch (error: any) {
      console.error("Sign-in failed:", error);
      toast({
        variant: "destructive",
        title: "Anmeldung fehlgeschlagen",
        description: error?.message || "Ein unbekannter Fehler ist aufgetreten.",
      });
    } finally {
      setIsSigningIn(false);
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
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !isSigningIn) handleAuthAction(); }}
                  disabled={isSigningIn}
                  autoComplete="current-password"
                />
              </div>
              <Button onClick={handleAuthAction} className="w-full" disabled={isSigningIn}>
                {isSigningIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSigningIn ? 'Anmelden...' : 'Anmelden'}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Passwort vergessen? Es wird lokal mit <code>npm run set-password</code> neu gesetzt.
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
