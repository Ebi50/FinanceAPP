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

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="mx-auto max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline">ExpenceTrack</CardTitle>
          <CardDescription>
            Geben Sie Ihre Anmeldeinformationen ein, um auf Ihr Konto zuzugreifen
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
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Passwort</Label>
                <Link href="#" className="ml-auto inline-block text-sm underline">
                  Passwort vergessen?
                </Link>
              </div>
              <Input id="password" type="password" required />
            </div>
            <Button type="submit" className="w-full" asChild>
              <Link href="/">Anmelden</Link>
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            Noch kein Konto?{" "}
            <Link href="#" className="underline">
              Registrieren
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
