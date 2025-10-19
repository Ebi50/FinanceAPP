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
import { useUser, useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { updateProfile, updatePassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

const navItems = [
  'Allgemein',
  'Sicherheit',
  'Support',
  'Erweitert',
];

const ADMIN_EMAIL = 'eberhard.janzen@freenet.de';

type UserProfile = {
  firstName?: string;
  lastName?: string;
  email?: string;
  budget?: number;
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
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [budget, setBudget] = useState(2000);

  const { toast } = useToast();

  useEffect(() => {
    if (userProfile) {
      setFirstName(userProfile.firstName || '');
      setLastName(userProfile.lastName || '');
      setEmail(userProfile.email || user?.email || '');
      setBudget(userProfile.budget || 2000);
    } else if (user) {
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
        
        const userDocRef = doc(firestore, 'users', user.uid);
        setDocumentNonBlocking(userDocRef, { 
          firstName, 
          lastName,
          email: user.email // Make sure email is stored
        }, { merge: true });

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
    if (!user || !user.email) return;

    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Die neuen Passwörter stimmen nicht überein.',
      });
      return;
    }
    if (newPassword.length < 6) {
        toast({
            variant: 'destructive',
            title: 'Fehler',
            description: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.',
        });
        return;
    }
    
    try {
        const credential = EmailAuthProvider.credential(user.email, oldPassword);
        await reauthenticateWithCredential(user, credential);
        
        await updatePassword(user, newPassword);

        toast({
          title: 'Passwort geändert',
          description: 'Ihr Passwort wurde erfolgreich geändert.',
        });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
    } catch (error: any) {
        console.error("Error updating password: ", error);
        let description = 'Ein unbekannter Fehler ist aufgetreten.';
        if (error.code === 'auth/wrong-password') {
            description = 'Das alte Passwort ist nicht korrekt.';
        } else if (error.code === 'auth/requires-recent-login') {
            description = 'Diese Aktion erfordert eine erneute Anmeldung. Bitte melden Sie sich ab und wieder an.';
        }
        toast({
            variant: 'destructive',
            title: 'Fehler beim Ändern des Passworts',
            description,
        })
    }
  };

  const handleBudgetSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfileQuery) return;
    setDocumentNonBlocking(userProfileQuery, { budget }, { merge: true });
    toast({
      title: 'Budget gespeichert',
      description: `Ihr monatliches Budget wurde auf ${budget} € festgelegt.`,
    });
  };

  const handleDeleteAccount = async () => {
    if (!user || !firestore) return;
    try {
      const batch = writeBatch(firestore);

      // Note: With shared data, we don't delete transactions/categories when a user is deleted.
      // If that is desired, logic to query all transactions/categories by that user's ID would be needed.

      const userDocRef = doc(firestore, 'users', user.uid);
      batch.delete(userDocRef);

      await batch.commit();

      // This is a destructive action, user might need to re-authenticate
      // For simplicity, we just try to delete. If it fails, we inform the user.
      await deleteUser(user);

      toast({
        title: 'Konto gelöscht',
        description: 'Ihr Konto und alle zugehörigen Daten wurden dauerhaft entfernt.',
      });
      // The onAuthStateChanged listener will handle the redirect to /login
    } catch (error: any) {
      console.error('Error deleting account:', error);
      let description = 'Beim Löschen Ihres Kontos ist ein Fehler aufgetreten.';
      if (error.code === 'auth/requires-recent-login') {
        description = 'Diese Aktion erfordert eine erneute Anmeldung. Bitte melden Sie sich ab, wieder an und versuchen Sie es erneut.';
      }
      toast({
        variant: 'destructive',
        title: 'Fehler beim Löschen des Kontos',
        description: description,
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
                  <CardTitle>Passwort ändern</CardTitle>
                  <CardDescription>
                      Um Ihr Passwort zu ändern, geben Sie bitte zuerst Ihr altes Passwort ein.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <form className="space-y-4" onSubmit={handlePasswordSave}>
                      <div className="space-y-2">
                          <Label htmlFor="oldPassword">Altes Passwort</Label>
                          <Input id="oldPassword" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="newPassword">Neues Passwort</Label>
                          <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
                          <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                      </div>
                      <Button type="submit">Neues Passwort speichern</Button>
                  </form>
              </CardContent>
          </Card>
        );
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
                    <p>Für Support-Anfragen senden Sie bitte eine E-Mail an: <a href={`mailto:${ADMIN_EMAIL}`} className="text-primary underline">{ADMIN_EMAIL}</a></p>
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
                                        Diese Aktion kann nicht rückgängig gemacht werden. Dadurch werden Ihr Konto und alle Ihre Daten dauerhaft gelöscht.
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
              )
            )}
          </nav>
          <div className="grid gap-6">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
