"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { User, LogOut } from "lucide-react";

export default function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="w-8 h-8" />;
  }

  if (!session) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={() => signIn("google")}
      >
        <User size={14} className="mr-1" />
        Sign in
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {session.user?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session.user.image}
          alt=""
          className="w-7 h-7 rounded-full border border-border"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
          <User size={14} className="text-primary" />
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => signOut()}
      >
        <LogOut size={12} />
      </Button>
    </div>
  );
}
