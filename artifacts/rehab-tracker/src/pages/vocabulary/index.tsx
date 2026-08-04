import { useState } from "react";
import { BookOpen, Plus, Pencil, Trash2, Check, X, RotateCcw } from "lucide-react";
import {
  useListCorrections, getListCorrectionsQueryKey,
  useCreateCorrection, useUpdateCorrection, useDeleteCorrection,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface EditState {
  id: string;
  raw: string;
  corrected: string;
}

export default function Vocabulary() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCorrectionsQueryKey() });

  const { data: corrections = [], isLoading } = useListCorrections({
    query: { queryKey: getListCorrectionsQueryKey() },
  });

  const createCorrection = useCreateCorrection({ mutation: { onSuccess: invalidate } });
  const updateCorrection = useUpdateCorrection({ mutation: { onSuccess: invalidate } });
  const deleteCorrection = useDeleteCorrection({ mutation: { onSuccess: invalidate } });

  const [newRaw, setNewRaw] = useState("");
  const [newCorrected, setNewCorrected] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [search, setSearch] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newRaw.trim() || !newCorrected.trim()) return;
    createCorrection.mutate(
      { data: { raw: newRaw.trim(), corrected: newCorrected.trim(), isDefault: false } },
      { onSuccess: () => { setNewRaw(""); setNewCorrected(""); } }
    );
  }

  function handleSaveEdit() {
    if (!editing) return;
    updateCorrection.mutate({
      correctionId: editing.id,
      data: { raw: editing.raw.trim(), corrected: editing.corrected.trim() },
    }, { onSuccess: () => setEditing(null) });
  }

  const filtered = corrections.filter(
    (c) =>
      c.raw.toLowerCase().includes(search.toLowerCase()) ||
      c.corrected.toLowerCase().includes(search.toLowerCase())
  );

  const defaultCount = corrections.filter((c) => c.isDefault).length;
  const customCount = corrections.filter((c) => !c.isDefault).length;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight flex items-center gap-3">
            <BookOpen size={28} className="text-primary" />
            Voice Vocabulary
          </h1>
          <p className="text-muted-foreground mt-1">
            Teach the app your terminology. Corrections are applied automatically to every voice transcription.
          </p>
          <div className="flex gap-3 mt-3">
            <Badge variant="outline" className="text-xs">{defaultCount} built-in</Badge>
            <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">{customCount} custom</Badge>
          </div>
        </div>

        {/* Add new */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus size={16} className="text-primary" /> Add Correction
            </CardTitle>
            <CardDescription className="text-xs">
              What the microphone hears → what it should say
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Heard (wrong)</label>
                <Input
                  placeholder='e.g. "anterior crucial"'
                  value={newRaw}
                  onChange={(e) => setNewRaw(e.target.value)}
                />
              </div>
              <div className="text-muted-foreground pb-2 shrink-0">→</div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Should be</label>
                <Input
                  placeholder='e.g. "anterior cruciate"'
                  value={newCorrected}
                  onChange={(e) => setNewCorrected(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={!newRaw.trim() || !newCorrected.trim() || createCorrection.isPending}
                className="shrink-0 mb-0.5"
              >
                <Plus size={14} className="mr-1" /> Add
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Search + list */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Corrections ({corrections.length})</CardTitle>
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 h-8 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No corrections found.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {filtered.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/20 transition-colors">
                    {editing?.id === c.id ? (
                      <>
                        <Input
                          value={editing.raw}
                          onChange={(e) => setEditing({ ...editing, raw: e.target.value })}
                          className="flex-1 h-8 text-sm"
                        />
                        <span className="text-muted-foreground shrink-0">→</span>
                        <Input
                          value={editing.corrected}
                          onChange={(e) => setEditing({ ...editing, corrected: e.target.value })}
                          className="flex-1 h-8 text-sm"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 shrink-0"
                          onClick={handleSaveEdit}
                          disabled={updateCorrection.isPending}
                        >
                          <Check size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground shrink-0"
                          onClick={() => setEditing(null)}
                        >
                          <X size={14} />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-mono text-muted-foreground truncate">
                          {c.raw}
                        </span>
                        <span className="text-muted-foreground shrink-0">→</span>
                        <span className="flex-1 text-sm font-medium truncate">{c.corrected}</span>
                        {c.isDefault && (
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0 text-muted-foreground">
                            built-in
                          </Badge>
                        )}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditing({ id: c.id, raw: c.raw, corrected: c.corrected })}
                          >
                            <Pencil size={12} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteCorrection.mutate({ correctionId: c.id })}
                            disabled={deleteCorrection.isPending}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
