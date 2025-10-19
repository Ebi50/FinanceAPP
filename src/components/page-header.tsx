import Link from "next/link";
import { UserNav } from "./user-nav";

export function PageHeader() {
  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4 md:px-8">
        <Link href="/" className="cursor-pointer">
          <h1 className="text-2xl font-headline font-bold tracking-tight">
            Dashboard
          </h1>
        </Link>
        <div className="ml-auto flex items-center space-x-4">
          <UserNav />
        </div>
      </div>
    </div>
  );
}
