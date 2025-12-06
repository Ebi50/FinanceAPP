'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser, useAuth, useStorage, useFirebase } from '@/firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';


export function UserNav() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const storage = useStorage();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSignOut = () => {
    signOut(auth).then(() => {
      router.push('/login');
    });
  };
  
  const handleAvatarUploadClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user) {
        return;
    }

    const file = event.target.files[0];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        toast({
            variant: "destructive",
            title: "Ungültiger Dateityp",
            description: "Bitte wählen Sie eine JPEG-, PNG- oder GIF-Datei.",
        });
        return;
    }

    setIsUploading(true);
    const storageRef = ref(storage, `avatars/${user.uid}/${file.name}`);

    try {
        const snapshot = await uploadBytes(storageRef, file);
        const photoURL = await getDownloadURL(snapshot.ref);

        // First, update the auth profile. This does NOT trigger onAuthStateChanged for profile updates.
        await updateProfile(user, { photoURL });
        
        // Then, update the user's document in Firestore.
        // Our new useUser hook listens to this document, so the UI will update reactively.
        const userDocRef = doc(firestore, 'users', user.uid);
        // We use a blocking set here to ensure the spinner stops at the right time.
        await setDoc(userDocRef, { photoURL }, { merge: true });

        toast({
            title: "Profilbild aktualisiert",
            description: "Ihr neues Profilbild wurde erfolgreich gespeichert.",
        });

    } catch (error) {
        console.error("Error uploading avatar:", error);
        toast({
            variant: "destructive",
            title: "Upload fehlgeschlagen",
            description: "Beim Hochladen Ihres Avatars ist ein Fehler aufgetreten.",
        });
    } finally {
        setIsUploading(false);
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }
  };


  if (isUserLoading) {
    return <Button variant="ghost" className="relative h-10 w-10 rounded-full">
      <Avatar className="h-10 w-10">
        <AvatarFallback>..
        </AvatarFallback>
      </Avatar>
    </Button>
  }
  
  if (!user) {
    return <Button asChild><Link href="/login">Anmelden</Link></Button>
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              {isUploading ? (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-muted/80">
                      <Loader2 className="h-5 w-5 animate-spin"/>
                  </div>
              ) : (
                  <>
                      {user.photoURL && <AvatarImage src={user.photoURL} alt="Benutzeravatar" />}
                      <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                  </>
              )}
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.displayName || 'User'}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/settings">Profil</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleAvatarUploadClick}>
              <ImageIcon className="mr-2 h-4 w-4" />
              <span>Profilbild ändern</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing">Abrechnung</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">Einstellungen</Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            Abmelden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange}
          className="hidden"
          accept="image/png, image/jpeg, image/gif"
      />
    </>
  );
}
