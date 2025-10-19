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
} from "@/components/ui/alert-dialog";
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/page-header';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, writeBatch, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { updateProfile, updatePassword, deleteUser } from 'firebase/auth';
import { OrganizationTab } from '@/components/organization-tab';

const allNavItems = [
  'Allgemein',
  'Sicherheit',
  'Integrationen',
  'Support',
  'Organisation',
  'Erweitert',
];

type UserProfile = {
  firstName?: string;
  lastName?: string;
  email?: string;
  budget?: number;
  role?: 'admin' | 'user';
}

export default function SettingsPage() {
  const { setTheme } = useTheme();
  
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [activeTab, setActiveTab] = useState('Allgemein');

  const userProfileQuery = useMemoFirebase(() =>
    user ? doc(firestore, 'users', user.uid) : null,
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileQuery);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [budget, setBudget] = useState(2000);

  const { toast } = useToast();
  
  const isAdmin = userProfile?.role === 'admin';

  const navItems = useMemo(() => {
    if (isAdmin) {
      return allNavItems;
    }
    return allNavItems.filter(item => item !== 'Organisation');
  }, [isAdmin]);


  useEffect(() => {
    if (userProfile) {
      setFirstName(userProfile.firstName || '');
      setLastName(userProfile.lastName || '');
      setEmail(userProfile.email || user?.email || '');
      setBudget(userProfile.budget || 2000);
    } else if (user) {
        // Fallback if profile doesn't exist in Firestore yet
        const nameParts = user.displayName?.split(' ') || ['', ''];
        setFirstName(nameParts[0]);
        setLastName(nameParts.slice(1).join(' '));
        setEmail(user.email || '');
    }
  }, [userProfile, user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfileQuery) return;
    try {
        const displayName = `${firstName} ${lastName}`.trim();
        if(user.displayName !== displayName) {
            await updateProfile(user, { displayName });
        }
        await setDoc(userProfileQuery, { firstName, lastName }, { merge: true });
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

  const handleDeleteAccount = async () => {
    if (!user || !firestore) return;
    try {
      const batch = writeBatch(firestore);

      // Delete all collections for the user
      const transactionsRef = collection(firestore, `users/${user.uid}/transactions`);
      const categoriesRef = collection(firestore, `users/${user.uid}/expenseCategories`);
      
      const transactionsSnap = await getDocs(transactionsRef);
      transactionsSnap.forEach(doc => batch.delete(doc.ref));

      const categoriesSnap = await getDocs(categoriesRef);
      categoriesSnap.forEach(doc => batch.delete(doc.ref));

      // Delete the user profile document
      const userDocRef = doc(firestore, 'users', user.uid);
      batch.delete(userDocRef);

      // Commit the batch delete
      await batch.commit();

      // Finally, delete the user from Firebase Auth
      await deleteUser(user);

      toast({
        title: 'Konto gelöscht',
        description: 'Ihr Konto und alle zugehörigen Daten wurden dauerhaft entfernt.',
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler beim Löschen des Kontos',
        description: 'Bitte melden Sie sich erneut an und versuchen Sie es erneut.',
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Vorname</Label>
                      <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Nachname</Label>
                      <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
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
        case 'Organisation':
          content = isAdmin ? <OrganizationTab /> : <p>Sie haben keine Berechtigung, auf diesen Bereich zuzugreifen.</p>;
          break;
        case 'Support':
            content = (
              <Card>
                <CardHeader>
                  <CardTitle>Support</CardTitle>
                  <CardDescription>
                    Benötigen Sie Hilfe? Kontaktieren Sie uns.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Für Support-Anfragen senden Sie bitte eine E-Mail an: <a href="mailto:support@expencetrack.app" className="text-primary underline">support@expencetrack.app</a></p>
                </CardContent>
              </Card>
            );
            break;
        case 'Erweitert':
            content = (
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Gefahrenzone</CardTitle>
                        <CardDescription>
                            Diese Aktionen können nicht rückgängig gemacht werden. Bitte seien Sie vorsichtig.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">Konto löschen</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Sind Sie absolut sicher?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Diese Aktion kann nicht rückgängig gemacht werden. Dadurch werden Ihr Konto und alle Ihre Daten dauerhaft gelöscht, einschliesslich aller Transaktionen und Kategorien.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Ich verstehe, mein Konto löschen
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
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
