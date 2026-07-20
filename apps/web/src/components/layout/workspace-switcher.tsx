"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  tierLimitBodyFromError,
  useTierLimitPrompt,
} from "@/components/billing/tier-limit-prompt-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  activateWorkspace,
  createWorkspace,
  invalidateWorkspaceScopedQueries,
  listWorkspaces,
} from "@/lib/api-client";

export function WorkspaceSwitcher() {
  const queryClient = useQueryClient();
  const showTierLimitPrompt = useTierLimitPrompt();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const workspacesQuery = useQuery({
    queryFn: listWorkspaces,
    queryKey: ["workspaces"],
  });

  const activeWorkspace =
    workspacesQuery.data?.items.find((item) => item.isActive) ??
    workspacesQuery.data?.items[0];

  const activateMutation = useMutation({
    mutationFn: activateWorkspace,
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSuccess: async () => {
      invalidateWorkspaceScopedQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace switched");
    },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createWorkspace(name),
    onError: (error: Error) => {
      if (showTierLimitPrompt(tierLimitBodyFromError(error))) {
        return;
      }
      toast.error(error.message);
    },
    onSuccess: async () => {
      invalidateWorkspaceScopedQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setCreateOpen(false);
      setNewName("");
      toast.success("Workspace created");
    },
  });

  if (workspacesQuery.isLoading) {
    return (
      <div
        aria-hidden
        className="hidden h-9 w-28 animate-pulse rounded-md bg-muted sm:block"
      />
    );
  }

  if (workspacesQuery.isError) {
    const message =
      workspacesQuery.error instanceof Error
        ? workspacesQuery.error.message
        : "Could not load workspaces";
    if (message.toLowerCase().includes("no workspace")) {
      return (
        <>
          <Button
            className="hidden h-8 px-3 text-xs sm:inline-flex"
            onClick={() => setCreateOpen(true)}
            variant="outline"
          >
            Create workspace
          </Button>
          <CreateWorkspaceDialog
            name={newName}
            onNameChange={setNewName}
            onOpenChange={setCreateOpen}
            onSubmit={() => createMutation.mutate(newName.trim())}
            open={createOpen}
            pending={createMutation.isPending}
          />
        </>
      );
    }
    return null;
  }

  if (!activeWorkspace) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Switch workspace"
          className="hidden max-w-[12rem] items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm hover:bg-secondary sm:inline-flex"
        >
          <span className="truncate font-medium">{activeWorkspace.name}</span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {workspacesQuery.data?.items.map((workspace) => (
            <DropdownMenuItem
              disabled={workspace.isActive || activateMutation.isPending}
              key={workspace.id}
              onClick={() => activateMutation.mutate(workspace.id)}
            >
              <span className="truncate">{workspace.name}</span>
              {workspace.isActive ? (
                <span className="ml-auto text-muted-foreground text-xs">
                  Active
                </span>
              ) : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            New workspace
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings#workspaces">Manage workspaces</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog
        name={newName}
        onNameChange={setNewName}
        onOpenChange={setCreateOpen}
        onSubmit={() => createMutation.mutate(newName.trim())}
        open={createOpen}
        pending={createMutation.isPending}
      />
    </>
  );
}

function CreateWorkspaceDialog({
  name,
  onNameChange,
  onOpenChange,
  onSubmit,
  open,
  pending,
}: {
  name: string;
  onNameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  pending: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Workspaces keep characters, keys, and tokens grouped together.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="workspace-name">Name</Label>
          <Input
            id="workspace-name"
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="My project"
            value={name}
          />
        </div>
        <Button
          disabled={pending || name.trim().length === 0}
          onClick={onSubmit}
        >
          Create workspace
        </Button>
      </DialogContent>
    </Dialog>
  );
}
