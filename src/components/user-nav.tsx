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
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser, useAuth, useStorage } from '@/firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export function UserNav() {
  const userAvatar = PlaceHolderImages.find(p => p.id === 'user-avatar-1');
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSignOut = () => {
    signOut(auth).then(() => {
      router.push('/login');
    });
  };
  
  const handleAvatarClick = () => {
      if (!isUploading) {
          fileInputRef.current?.click();
      }
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

        await updateProfile(user, { photoURL });
        
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
    return <Button variant="ghost" className="relative h-8 w-8 rounded-full">
      <Avatar className="h-9 w-9">
        <AvatarFallback>..
        </AvatarFallback>
      </Avatar>
    </Button>
  }
  
  if (!user) {
    return <Button asChild><Link href="/login">Anmelden</Link></Button>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9 cursor-pointer" onClick={handleAvatarClick}>
            {isUploading ? (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-muted/80">
                    <Loader2 className="h-4 w-4 animate-spin"/>
                </div>
            ) : (
                <>
                    {user.photoURL && <AvatarImage src={user.photoURL} alt="Benutzeravatar" />}
                    {!user.photoURL && userAvatar && <AvatarImage src={userAvatar.imageUrl} alt="Benutzeravatar" data-ai-hint={userAvatar.imageHint} />}
                    <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                </>
            )}
          </Avatar>
          <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange}
              className="hidden"
              accept="image/png, image/jpeg, image/gif"
          />
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
  );
}