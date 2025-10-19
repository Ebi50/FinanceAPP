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
import { initiateEmailSignIn } from "@/firebase/non-blocking-login";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlaceHolderImages } from '@/lib/placeholder-images';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const loginImage = PlaceHolderImages.find(p => p.id === 'login-image-1');

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleAuthAction = () => {
    initiateEmailSignIn(auth, email, password);
  };

  if (isUserLoading || user) {
      return <div className="flex items-center justify-center min-h-screen">Laden...</div>
  }

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center py-12">
        <Card className="mx-auto max-w-sm border-0 shadow-none lg:border lg:shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-headline">ExpenceTrack</CardTitle>
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
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Passwort</Label>
                    <Link href="#" className="ml-auto inline-block text-sm underline">
                      Passwort vergessen?
                    </Link>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button onClick={handleAuthAction} className="w-full">
                Anmelden
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
