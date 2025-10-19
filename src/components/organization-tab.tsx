"use client";

import { useState, useMemo, useEffect } from "react";
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
import { useUser } from '@/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

type UserProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: 'admin' | 'user';
};

export function OrganizationTab() {
  const { user: currentUserAuth } = useUser();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<Partial<UserProfile> | null>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<'admin' | 'user'>('user');
  
  const { toast } = useToast();

  const functions = useMemo(() => currentUserAuth ? getFunctions() : null, [currentUserAuth]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUserAuth || !functions) {
        setUsersLoading(false);
        return;
      };
      setUsersLoading(true);
      try {
        const listUsers = httpsCallable(functions, 'listUsers');
        const response: any = await listUsers();
        if (response.data.error) {
            throw new Error(response.data.error);
        }
        setUsers(response.data);
      } catch (error: any) {
        console.error("Error fetching users:", error);
        toast({
          variant: "destructive",
          title: "Fehler beim Laden der Benutzer",
          description: error.message,
        });
      } finally {
        setUsersLoading(false);
      }
    };

    if (currentUserAuth) {
      fetchUsers();
    }
  }, [currentUserAuth, functions, toast]);


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

  const handleDelete = async (userId: string) => {
    if (!currentUserAuth || !functions) return;
    try {
        const deleteUserFunc = httpsCallable(functions, 'deleteUser');
        const result: any = await deleteUserFunc({ id: userId });
        if (result.data.error) {
            throw new Error(result.data.error);
        }

        setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
        toast({
            title: 'Benutzer gelöscht',
            description: 'Der Benutzer wurde erfolgreich entfernt.',
        });
    } catch(error: any) {
        toast({
            variant: "destructive",
            title: 'Fehler beim Löschen',
            description: error.message,
        });
    }
  };

  const handleSave = async () => {
    if (!email.trim() || !firstName.trim() || !lastName.trim() || !currentUserAuth || !functions) {
        toast({
            variant: "destructive",
            title: "Fehler",
            description: "Bitte füllen Sie alle Felder aus.",
        });
        return;
    }
    
    try {
        const userData = { id: currentUser?.id, email, firstName, lastName, role };
        
        const saveUserFunc = isEditing 
            ? httpsCallable(functions, 'updateUser') 
            : httpsCallable(functions, 'createUser');
        
        const result: any = await saveUserFunc(userData);

        if (result.data.error) {
            throw new Error(result.data.error);
        }
        
        const savedUser = result.data;
        
        if (isEditing) {
            setUsers(prevUsers => prevUsers.map(u => u.id === savedUser.id ? savedUser : u));
            toast({
                title: 'Benutzer aktualisiert',
                description: 'Die Benutzerdaten wurden erfolgreich gespeichert.',
            });
        } else {
            setUsers(prevUsers => [...prevUsers, savedUser]);
            toast({
                title: 'Benutzer hinzugefügt',
                description: `Das Profil für ${email} wurde erstellt. Der Benutzer muss sich noch mit dieser E-Mail registrieren.`,
            });
        }

        setOpen(false);

    } catch (error: any) {
        toast({
            variant: "destructive",
            title: isEditing ? 'Fehler beim Aktualisieren' : 'Fehler beim Hinzufügen',
            description: error.message,
        });
    }
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
