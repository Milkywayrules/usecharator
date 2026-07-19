"use client";

import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

interface UserMenuProps {
  user: {
    email: string;
    image?: string | null;
    name: string;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" type="button" variant="outline">
          {user.image ? (
            // biome-ignore lint/performance/noImgElement: GitHub avatar URL
            <img
              alt=""
              className="size-6 rounded-full"
              height={24}
              src={user.image}
              width={24}
            />
          ) : (
            <UserIcon className="size-4" />
          )}
          <span className="max-w-[8rem] truncate">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-muted-foreground text-xs">
          {user.email}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            authClient.signOut({
              fetchOptions: { onSuccess: () => window.location.reload() },
            })
          }
        >
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
