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
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/page-header';
import { useUser, useSupabase, useTable } from '@/lib/supabase';
import type { Transaction } from '@/lib/types';
import { de } from 'date-fns/locale';
import { isValid, getYear, startOfYear, endOfYear, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

const navItems = [
  'Allgemein',
  'Sicherheit',
  'Support',
  'Erweitert',
];

const ADMIN_EMAIL = 'eberhard.janzen@freenet.de';

export default function SettingsPage() {
  const { setTheme } = useTheme();

  const { user } = useUser();
  const supabase = useSupabase();

  const [activeTab, setActiveTab] = useState('Allgemein');

  const { data: allTransactions } = useTable<Transaction>({
    table: 'transactions',
    filter: user ? [{ column: 'user_id', value: user.id }] : undefined,
    enabled: !!user,
  });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [budget, setBudget] = useState(2000);
  const [autoLogoutTimeout, setAutoLogoutTimeout] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const [deleteYear, setDeleteYear] = useState<number | null>(null);
  const [deleteMonth, setDeleteMonth] = useState<string>('all');

  const { toast } = useToast();

  const availableYearsForDelete = useMemo(() => {
    if (!allTransactions) return [];
    const years = new Set(allTransactions.map(t => getYear(parseISO(t.date as string))));
    return Array.from(years).sort((a, b) => b - a);
  }, [allTransactions]);

  useEffect(() => {
    if (availableYearsForDelete.length > 0 && !deleteYear) {
      setDeleteYear(availableYearsForDelete[0]);
    }
  }, [availableYearsForDelete, deleteYear]);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
      setBudget(user.budget ?? 2000);
      setAutoLogoutTimeout(user.autoLogoutTimeout ?? 0);
    }
  }, [user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            first_name: firstName,
            last_name: lastName,
            email: user.email,
          });

        if (error) throw error;

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
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;

        toast({
          title: 'Passwort geändert',
          description: 'Ihr Passwort wurde erfolgreich geändert.',
        });
        setNewPassword('');
        setConfirmPassword('');
    } catch (error: any) {
        console.error("Error updating password: ", error);
        toast({
            variant: 'destructive',
            title: 'Fehler beim Ändern des Passworts',
            description: error.message || 'Ein unbekannter Fehler ist aufgetreten.',
        })
    }
  };

    const handleSecuritySettingsSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        try {
            const { error } = await supabase
              .from('profiles')
              .upsert({ id: user.id, auto_logout_timeout: autoLogoutTimeout });

            if (error) throw error;
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
    if (!user) return;
    try {
        const { error } = await supabase
          .from('profiles')
          .upsert({ id: user.id, budget });

        if (error) throw error;
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
    if (!user) return;
    try {
      // Delete user profile
      await supabase.from('profiles').delete().eq('id', user.id);

      // Note: Actual user deletion requires admin privileges or a server-side function.
      // For now we sign out. To fully delete, set up a Supabase Edge Function.
      await supabase.auth.signOut();

      toast({
        title: 'Abgemeldet',
        description: 'Sie wurden abgemeldet. Kontaktieren Sie den Support, um Ihr Konto vollständig zu löschen.',
      });
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler beim Löschen des Kontos',
        description: error.message || 'Beim Löschen Ihres Kontos ist ein Fehler aufgetreten.',
      });
    }
  };

  const handleDeletePeriodData = async () => {
    if (!user || deleteYear === null) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Bitte wählen Sie ein Jahr aus.' });
      return;
    }

    setIsDeleting(true);

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

    try {
        const { data: rows, error: fetchError } = await supabase
          .from('transactions')
          .select('id')
          .gte('date', startDate.toISOString())
          .lte('date', endDate.toISOString());

        if (fetchError) throw fetchError;

        if (!rows || rows.length === 0) {
            toast({ title: 'Keine Daten gefunden', description: `Es gibt keine Transaktionen zum Löschen für ${confirmationText}.` });
            setIsDeleting(false);
            return;
        }

        const ids = rows.map(r => r.id);
        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .in('id', ids);

        if (deleteError) throw deleteError;

        toast({ title: 'Daten gelöscht', description: `Es wurden ${rows.length} Transaktionen für ${confirmationText} gelöscht.` });

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
    if (!user) {
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
                        Geben Sie ein neues Passwort ein, um es zu ändern.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4" onSubmit={handlePasswordSave}>
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
