'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, writeBatch, collection, getDocs, query, where, Timestamp, setDoc } from 'firebase/firestore';
import { updateProfile, updatePassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import type { Transaction } from '@/lib/types';
import { de } from 'date-fns/locale';
import { isValid, getYear, getMonth, startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

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
  autoLogoutTimeout?: number;
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
  
  const transactionsQuery = useMemoFirebase(() => 
    user ? collection(firestore, 'transactions') : null,
    [firestore, user]
  );
  const { data: allTransactions } = useCollection<Transaction>(transactionsQuery);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [budget, setBudget] = useState(2000);
  const [autoLogoutTimeout, setAutoLogoutTimeout] = useState(0);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [deleteYear, setDeleteYear] = useState<number | null>(null);
  const [deleteMonth, setDeleteMonth] = useState<string>('all'); // 'all' or month index "0"-"11"

  const { toast } = useToast();

  const availableYearsForDelete = useMemo(() => {
    if (!allTransactions) return [];
    const years = new Set(allTransactions.map(t => getYear(t.date.toDate())));
    return Array.from(years).sort((a, b) => b - a);
  }, [allTransactions]);

  useEffect(() => {
    if (availableYearsForDelete.length > 0 && !deleteYear) {
      setDeleteYear(availableYearsForDelete[0]);
    }
  }, [availableYearsForDelete, deleteYear]);

  useEffect(() => {
    if (userProfile) {
      setFirstName(userProfile.firstName || '');
      setLastName(userProfile.lastName || '');
      setEmail(userProfile.email || user?.email || '');
      setBudget(userProfile.budget || 2000);
      setAutoLogoutTimeout(userProfile.autoLogoutTimeout || 0); // 0 for 'Never'
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
        await setDoc(userDocRef, { 
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
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
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
  
    const handleSecuritySettingsSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !userProfileQuery) return;
        try {
            await setDoc(userProfileQuery, { autoLogoutTimeout }, { merge: true });
            toast({
                title: 'Sicherheitseinstellungen gespeichert',
                description: 'Der automatische Logout wurde aktualisiert.',
            });
        } catch (error) {
            console.error("Error updating security settings: ", error);
            toast({
                variant: "destructive",
                title: "Fehler",
                description: "Die Sicherheitseinstellungen konnten nicht gespeichert werden.",
            });
        }
    };

  const handleBudgetSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfileQuery) return;
    try {
        await setDoc(userProfileQuery, { budget }, { merge: true });
        toast({
            title: 'Budget gespeichert',
            description: `Ihr monatliches Budget wurde auf ${formatCurrency(budget)} festgelegt.`,
        });
    } catch (error) {
        console.error("Error updating budget: ", error);
        toast({
            variant: "destructive",
            title: "Fehler",
            description: "Das Budget konnte nicht gespeichert werden.",
        });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !firestore) return;
    try {
      // We are not deleting any user data to allow for collaborative features.
      // But we will delete the user's profile document.
      const userDocRef = doc(firestore, 'users', user.uid);
      await writeBatch(firestore).delete(userDocRef).commit();
      
      await deleteUser(user);

      toast({
        title: 'Konto gelöscht',
        description: 'Ihr Konto wurde dauerhaft entfernt.',
      });
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

  const handleDataMigration = async () => {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Benutzer nicht angemeldet oder Datenbank nicht verfügbar.',
      });
      return;
    }
  
    setIsMigrating(true);
    toast({
      title: 'Datenmigration gestartet',
      description: 'Ihre alten Daten werden jetzt kopiert...',
    });
  
    try {
      const batch = writeBatch(firestore);
  
      // --- Migrate Categories ---
      const oldCategoriesRef = collection(firestore, `users/${user.uid}/expenseCategories`);
      const categoriesSnapshot = await getDocs(oldCategoriesRef);
      
      let migratedCategoriesCount = 0;
      categoriesSnapshot.forEach(docSnapshot => {
        const newDocRef = doc(firestore, 'expenseCategories', docSnapshot.id);
        batch.set(newDocRef, docSnapshot.data());
        migratedCategoriesCount++;
      });
  
      // --- Migrate Transactions ---
      const oldTransactionsRef = collection(firestore, `users/${user.uid}/transactions`);
      const transactionsSnapshot = await getDocs(oldTransactionsRef);
  
      let migratedTransactionsCount = 0;
      transactionsSnapshot.forEach(docSnapshot => {
        const newDocRef = doc(firestore, 'transactions', docSnapshot.id);
        batch.set(newDocRef, docSnapshot.data());
        migratedTransactionsCount++;
      });
  
      if (migratedCategoriesCount === 0 && migratedTransactionsCount === 0) {
        toast({
          title: 'Keine Daten gefunden',
          description: 'Es wurden keine alten Daten zum Migrieren gefunden.',
        });
      } else {
        await batch.commit();
        toast({
          title: 'Migration erfolgreich!',
          description: `${migratedCategoriesCount} Kategorien und ${migratedTransactionsCount} Transaktionen wurden erfolgreich verschoben.`,
        });
      }
  
    } catch (error) {
      console.error("Error migrating data:", error);
      toast({
        variant: 'destructive',
        title: 'Migration fehlgeschlagen',
        description: 'Beim Verschieben Ihrer Daten ist ein Fehler aufgetreten. Prüfen Sie die Konsole für Details.',
      });
    } finally {
      setIsMigrating(false);
    }
  };
  
  const handleDeletePeriodData = async () => {
    if (!user || !firestore || deleteYear === null) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Bitte wählen Sie ein Jahr aus.' });
      return;
    }
    
    setIsDeleting(true);

    const transactionsRef = collection(firestore, 'transactions');
    let startDate: Date;
    let endDate: Date;
    let confirmationText = '';

    if (deleteMonth === 'all') {
        startDate = startOfYear(new Date(deleteYear, 0, 1));
        endDate = endOfYear(new Date(deleteYear, 11, 31));
        confirmationText = `alle Daten für das Jahr ${deleteYear}`;
    } else {
        const monthIndex = parseInt(deleteMonth, 10);
        startDate = startOfMonth(new Date(deleteYear, monthIndex));
        endDate = endOfMonth(new Date(deleteYear, monthIndex));
        confirmationText = `alle Daten für ${de.localize?.month(monthIndex)} ${deleteYear}`;
    }

    const q = query(transactionsRef, where('date', '>=', Timestamp.fromDate(startDate)), where('date', '<=', Timestamp.fromDate(endDate)));

    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            toast({ title: 'Keine Daten gefunden', description: `Es gibt keine Transaktionen zum Löschen für ${confirmationText}.` });
            setIsDeleting(false);
            return;
        }

        const batch = writeBatch(firestore);
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        toast({ title: 'Daten gelöscht', description: `Es wurden ${querySnapshot.size} Transaktionen für ${confirmationText} gelöscht.` });

    } catch (error) {
        console.error("Error deleting period data:", error);
        toast({
            variant: 'destructive',
            title: 'Löschen fehlgeschlagen',
            description: 'Beim Löschen der Daten ist ein Fehler aufgetreten.',
        });
    } finally {
        setIsDeleting(false);
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
                    <Label htmlFor="budget">Monatliches Budget</Label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">€</span>
                      <Input 
                        id="budget" 
                        type="text" 
                        className="pl-8"
                        value={new Intl.NumberFormat('de-DE').format(budget)}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\./g, '').replace(',', '.');
                          const numberValue = parseFloat(value);
                          if (!isNaN(numberValue)) {
                            setBudget(numberValue);
                          } else if (e.target.value === '') {
                            setBudget(0);
                          }
                        }}
                      />
                    </div>
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
          <>
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
            <Card>
                <CardHeader>
                    <CardTitle>Sitzungsverwaltung</CardTitle>
                    <CardDescription>
                        Konfigurieren Sie den automatischen Logout bei Inaktivität.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4" onSubmit={handleSecuritySettingsSave}>
                        <div className="space-y-2">
                            <Label htmlFor="auto-logout">Automatischer Logout nach</Label>
                            <Select
                                value={String(autoLogoutTimeout)}
                                onValueChange={(value) => setAutoLogoutTimeout(Number(value))}
                            >
                                <SelectTrigger id="auto-logout">
                                    <SelectValue placeholder="Zeit auswählen" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Niemals</SelectItem>
                                    <SelectItem value="5">5 Minuten</SelectItem>
                                    <SelectItem value="15">15 Minuten</SelectItem>
                                    <SelectItem value="30">30 Minuten</SelectItem>
                                    <SelectItem value="60">1 Stunde</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-muted-foreground">
                               Sie werden nach der ausgewählten Zeit der Inaktivität automatisch abgemeldet. Dies gilt auch, wenn der Laptop zugeklappt wird.
                            </p>
                        </div>
                        <Button type="submit">Speichern</Button>
                    </form>
                </CardContent>
            </Card>
          </>
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
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Datenmigration</CardTitle>
                    <CardDescription>
                      Verschieben Sie alte, privat gespeicherte Daten in die neue, gemeinsame Datenstruktur. Dieser Vorgang ist nur einmal notwendig.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={handleDataMigration} disabled={isMigrating}>
                      {isMigrating ? 'Daten werden migriert...' : 'Alte Daten migrieren'}
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Gefahrenzone</CardTitle>
                        <CardDescription>
                            Diese Aktionen können nicht rückgängig gemacht werden. Bitte seien Sie vorsichtig.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-2">Transaktionen löschen</h4>
                            <div className="flex flex-col sm:flex-row gap-2 items-center">
                                <Select
                                    value={deleteYear?.toString() ?? ''}
                                    onValueChange={(value) => setDeleteYear(Number(value))}
                                >
                                    <SelectTrigger className="w-full sm:w-[120px]">
                                        <SelectValue placeholder="Jahr" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableYearsForDelete.map(year => (
                                            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={deleteMonth}
                                    onValueChange={setDeleteMonth}
                                >
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="Monat" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Ganzes Jahr</SelectItem>
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <SelectItem key={i} value={String(i)}>
                                                {de.localize?.month(i)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="w-full sm:w-auto" disabled={!deleteYear || isDeleting}>
                                            {isDeleting ? 'Löschen...' : 'Daten löschen'}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Sind Sie absolut sicher?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Diese Aktion kann nicht rückgängig gemacht werden. Es werden alle Transaktionen für 
                                                {deleteMonth === 'all' ? ` das Jahr ${deleteYear}` : ` ${de.localize?.month(Number(deleteMonth))} ${deleteYear}`}
                                                {' '}dauerhaft gelöscht.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeletePeriodData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                Ich verstehe, Daten löschen
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>

                        <div className="border-t pt-4">
                           <h4 className="font-semibold mb-2">Konto löschen</h4>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">Konto löschen</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Sind Sie absolut sicher?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Diese Aktion kann nicht rückgängig gemacht werden. Dadurch wird Ihr Konto dauerhaft gelöscht.
                                            Ihre Transaktionsdaten bleiben für andere Benutzer erhalten.
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
                        </div>
                    </CardContent>
                </Card>
              </>
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
