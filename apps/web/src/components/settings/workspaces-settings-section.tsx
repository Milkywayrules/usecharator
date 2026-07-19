"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteWorkspace,
  invalidateWorkspaceScopedQueries,
  listWorkspaces,
  updateWorkspace,
} from "@/lib/api-client";

export function WorkspacesSettingsSection() {
  const queryClient = useQueryClient();
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});

  const workspacesQuery = useQuery({
    queryFn: listWorkspaces,
    queryKey: ["workspaces"],
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateWorkspace(id, { name }),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace renamed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkspace,
    onError: (error: Error) => toast.error(error.message),
    onSuccess: async () => {
      invalidateWorkspaceScopedQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace deleted");
    },
  });

  return (
    <Card id="workspaces">
      <CardHeader>
        <CardTitle>Workspaces</CardTitle>
        <CardDescription>
          Rename or remove workspaces. A workspace must be empty before it can
          be deleted, and you must keep at least one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {workspacesQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading workspaces…</p>
        ) : null}
        {workspacesQuery.data?.items.map((workspace) => {
          const draftName = draftNames[workspace.id] ?? workspace.name;
          return (
            <div
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end"
              key={workspace.id}
            >
              <div className="grid flex-1 gap-2">
                <Label htmlFor={`workspace-${workspace.id}`}>Name</Label>
                <Input
                  id={`workspace-${workspace.id}`}
                  onChange={(event) =>
                    setDraftNames((current) => ({
                      ...current,
                      [workspace.id]: event.target.value,
                    }))
                  }
                  value={draftName}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={
                    renameMutation.isPending ||
                    draftName.trim().length === 0 ||
                    draftName.trim() === workspace.name
                  }
                  onClick={() =>
                    renameMutation.mutate({
                      id: workspace.id,
                      name: draftName.trim(),
                    })
                  }
                  variant="default"
                >
                  Save
                </Button>
                <Button
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(workspace.id)}
                  variant="outline"
                >
                  <Trash2Icon className="size-4" />
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
