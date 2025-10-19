"use client";

import { useState, useMemo } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';

type UserProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: 'admin' | 'user';
};

export function OrganizationTab() {
  const firestore = useFirestore();
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersQuery);

  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<Partial<UserProfile> | null>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<'admin' | 'user'>('user');
  
  const { toast } = useToast();

  const sortedUsers = useMemo(() => {
    if (!users) return [];
    return [...users].sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
  }, [users]);

  const handleAddClick = () => {
    setIsEditing(false);
    setCurrentUser(null);
    setEmail("");
    setFirstName("");
    setLastName("");
    setRole("user");
    setOpen(true);
  };
  
  const handleEditClick = (user: UserProfile) => {
    setIsEditing(true);
    setCurrentUser(user);
    setEmail(user.email || "");
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setRole(user.role || "user");
    setOpen(true);
  };

  const handleDelete = (userId: string) => {
    // Note: This only deletes the user from Firestore.
    // The actual Firebase Auth user is not deleted here.
    // A cloud function would be required to do that securely.
    const docRef = doc(firestore, 'users', userId);
    deleteDoc(docRef);
    toast({
      title: 'Benutzer gelöscht',
      description: 'Der Benutzer wurde erfolgreich aus der Datenbank entfernt.',
    });
  };

  const handleSave = async () => {
    if (!email.trim() || !firstName.trim() || !lastName.trim()) {
        toast({
            variant: "destructive",
            title: "Fehler",
            description: "Bitte füllen Sie alle Felder aus.",
        });
        return;
    }

    if (isEditing && currentUser?.id) {
      // Edit existing user
      const docRef = doc(firestore, 'users', currentUser.id);
      await setDoc(docRef, { email, firstName, lastName, role }, { merge: true });
      toast({
        title: 'Benutzer aktualisiert',
        description: 'Die Benutzerdaten wurden erfolgreich gespeichert.',
      });
    } else {
      // Add new user
      // Note: This creates a user document in Firestore.
      // The user still needs to be created in Firebase Auth.
      // This is a simplified approach.
      const coll = collection(firestore, 'users');
      await addDoc(coll, { email, firstName, lastName, role, id: '' });
      toast({
        title: 'Benutzer hinzugefügt',
        description: `Das Profil für ${email} wurde erstellt. Der Benutzer muss noch in Firebase Auth angelegt werden, damit er sich anmelden kann.`,
      });
    }
    setOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-headline">Organisation</CardTitle>
              <CardDescription>
                Verwalten Sie die Benutzer Ihrer App.
              </CardDescription>
            </div>
            <Button onClick={handleAddClick}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Benutzer hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading && <TableRow><TableCell colSpan={4}>Benutzer werden geladen...</TableCell></TableRow>}
              {!usersLoading && sortedUsers?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.firstName} {user.lastName}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Menü</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => handleEditClick(user)}>
                          Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => handleDelete(user.id)}
                          className="text-destructive"
                        >
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Benutzer bearbeiten" : "Neuen Benutzer hinzufügen"}
            </DialogTitle>
            <DialogDescription>
              Füllen Sie die Details aus, um einen Benutzer zu verwalten.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="firstName">Vorname</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="lastName">Nachname</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEditing} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="role">Rolle</Label>
                <Select value={role} onValueChange={(value: 'admin' | 'user') => setRole(value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Rolle auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
