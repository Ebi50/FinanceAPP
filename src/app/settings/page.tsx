'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/page-header';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { updateProfile, updatePassword } from 'firebase/auth';

const navItems = [
  'Allgemein',
  'Sicherheit',
  'Integrationen',
  'Support',
  'Organisation',
  'Erweitert',
];

type UserProfile = {
  name?: string;
  email?: string;
  budget?: number;
}

export default function SettingsPage() {
  const { setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('Allgemein');
  
  const { user } = useUser();
  const firestore = useFirestore();

  const userProfileQuery = useMemoFirebase(() =>
    user ? doc(firestore, 'users', user.uid) : null,
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileQuery);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [budget, setBudget] = useState(2000);

  const { toast } = useToast();

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || user?.displayName || '');
      setEmail(userProfile.email || user?.email || '');
      setBudget(userProfile.budget || 2000);
    } else if (user) {
        // Fallback if profile doesn't exist in Firestore yet
        setName(user.displayName || '');
        setEmail(user.email || '');
    }
  }, [userProfile, user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfileQuery) return;
    try {
        if(user.displayName !== name) {
            await updateProfile(user, { displayName: name });
        }
        await setDoc(userProfileQuery, { name }, { merge: true });
        toast({
            title: 'Profil gespeichert',
            description: 'Ihre Daten wurden erfolgreich aktualisiert.',
        });
    } catch (error) {
        console.error("Error updating profile: ", error);
        toast({
            variant: "destructive",
            title: "Fehler",
            description: "Profil konnte nicht aktualisiert werden.",
        });
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Die Passwörter stimmen nicht überein.',
      });
      return;
    }
    if (password.length < 6) {
        toast({
            variant: 'destructive',
            title: 'Fehler',
            description: 'Das Passwort muss mindestens 6 Zeichen lang sein.',
        });
        return;
    }
    
    try {
        await updatePassword(user, password)
        toast({
          title: 'Passwort geändert',
          description: 'Ihr Passwort wurde erfolgreich geändert.',
        });
        setPassword('');
        setConfirmPassword('');
    } catch (error) {
        console.error("Error updating password: ", error);
        toast({
            variant: 'destructive',
            title: 'Fehler beim Ändern des Passworts',
            description: 'Bitte melden Sie sich erneut an und versuchen Sie es erneut.',
        })
    }
  };

  const handleBudgetSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfileQuery) return;
    try {
        await setDoc(userProfileQuery, { budget }, { merge: true });
        toast({
          title: 'Budget gespeichert',
          description: `Ihr monatliches Budget wurde auf ${budget} € festgelegt.`,
        });
    } catch (error) {
        console.error("Error updating budget: ", error);
        toast({
            variant: "destructive",
            title: "Fehler",
            description: "Budget konnte nicht gespeichert werden.",
        });
    }
  };


  const renderContent = () => {
    if (isProfileLoading) {
      return <p>Lade...</p>
    }
    
    let content;
    switch(activeTab) {
      case 'Allgemein':
        content = (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Profil</CardTitle>
                <CardDescription>
                  Aktualisieren Sie Ihre persönlichen Daten.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleProfileSave}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled
                    />
                  </div>
                  <Button type="submit">Änderungen speichern</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Budget</CardTitle>
                <CardDescription>
                  Legen Sie Ihr monatliches Budget fest.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleBudgetSave}>
                  <div className="space-y-2">
                    <Label htmlFor="budget">Monatliches Budget (€)</Label>
                    <Input id="budget" type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
                  </div>
                  <Button type="submit">Budget speichern</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Benachrichtigungen</CardTitle>
                <CardDescription>
                  Verwalten Sie Ihre Benachrichtigungseinstellungen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-notifications">
                    E-Mail-Benachrichtigungen
                  </Label>
                  <Switch id="email-notifications" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="push-notifications">
                    Push-Benachrichtigungen
                  </Label>
                  <Switch id="push-notifications" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Darstellung</CardTitle>
                <CardDescription>
                  Passen Sie das Erscheinungsbild der App an.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Thema</Label>
                  <Select onValueChange={(value) => setTheme(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Thema auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dunkel</SelectItem>
                      <SelectItem value="light">Hell</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Sprache</Label>
                  <Select defaultValue="de">
                    <SelectTrigger>
                      <SelectValue placeholder="Sprache auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="en">Englisch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </>
        );
        break;
      case 'Sicherheit':
        content = (
          <Card>
              <CardHeader>
                  <CardTitle>Passwort</CardTitle>
                  <CardDescription>
                      Ändern Sie hier Ihr Passwort.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <form className="space-y-4" onSubmit={handlePasswordSave}>
                      <div className="space-y-2">
                          <Label htmlFor="password">Neues Passwort</Label>
                          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
                          <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                      </div>
                      <Button type="submit">Neues Passwort speichern</Button>
                  </form>
              </CardContent>
          </Card>
        );
        break;
      default:
        content = (
          <Card>
            <CardHeader>
              <CardTitle>{activeTab}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Einstellungen für {activeTab} werden hier angezeigt.</p>
            </CardContent>
          </Card>
        );
        break;
    }
    return content;
  }


  return (
    <div className="flex-col md:flex">
      <PageHeader />
      <main className="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <h1 className="text-3xl font-semibold">Einstellungen</h1>
        </div>
        <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
          <nav className="grid gap-4 text-sm text-muted-foreground">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => setActiveTab(item)}
                className={cn(
                  'text-left',
                  activeTab === item && 'font-semibold text-primary'
                )}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="grid gap-6">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
