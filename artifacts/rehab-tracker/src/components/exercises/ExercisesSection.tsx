import { useState } from "react";
import {
  useListSessionExercises,
  getListSessionExercisesQueryKey,
  useCreateSessionExercise,
  useDeleteExercise,
  type Exercise,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dumbbell, Plus, Trash2, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DraftSet = { weight: string; reps: string };

interface Props {
  sessionId: string;
}

function summarizeSets(sets: { weight: number; reps: number }[]) {
  if (!sets.length) return { topWeight: 0, totalReps: 0, totalVolume: 0 };
  let topWeight = 0;
  let totalReps = 0;
  let totalVolume = 0;
  for (const s of sets) {
    totalReps += s.reps;
    totalVolume += s.weight * s.reps;
    if (s.weight > topWeight) topWeight = s.weight;
  }
  return { topWeight, totalReps, totalVolume };
}

export function ExercisesSection({ sessionId }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [sets, setSets] = useState<DraftSet[]>([{ weight: "", reps: "" }]);

  const { data: exercises, isLoading } = useListSessionExercises(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getListSessionExercisesQueryKey(sessionId),
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListSessionExercisesQueryKey(sessionId),
    });

  const createExercise = useCreateSessionExercise({
    mutation: {
      onSuccess: () => {
        invalidate();
        setName("");
        setSets([{ weight: "", reps: "" }]);
        setShowForm(false);
      },
    },
  });

  const deleteExercise = useDeleteExercise({
    mutation: { onSuccess: () => invalidate() },
  });

  const updateSet = (i: number, field: keyof DraftSet, value: string) => {
    setSets((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s))
    );
  };

  const addSetRow = () =>
    setSets((prev) => {
      const last = prev[prev.length - 1];
      return [...prev, { weight: last?.weight ?? "", reps: last?.reps ?? "" }];
    });

  const removeSetRow = (i: number) =>
    setSets((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const cleaned = sets
      .map((s) => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps, 10) }))
      .filter((s) => !isNaN(s.weight) && !isNaN(s.reps) && s.reps > 0);
    if (cleaned.length === 0) return;

    createExercise.mutate({
      sessionId,
      data: {
        name: name.trim(),
        unit,
        sets: cleaned,
        position: exercises?.length ?? 0,
      },
    });
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2 font-serif font-medium">
          <Dumbbell size={16} className="text-primary" />
          Exercises
          {exercises && exercises.length > 0 && (
            <span className="text-xs text-muted-foreground font-sans font-normal">
              ({exercises.length})
            </span>
          )}
        </CardTitle>
        {!showForm && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-border/50"
            onClick={() => setShowForm(true)}
          >
            <Plus size={14} className="mr-1" /> Add exercise
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : exercises && exercises.length > 0 ? (
          <div className="space-y-3">
            {exercises.map((ex: Exercise) => {
              const summary = summarizeSets(ex.sets);
              return (
                <div
                  key={ex.id}
                  className="border border-border/50 rounded-lg p-3 bg-accent/10 group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{ex.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Top {summary.topWeight} {ex.unit} · {summary.totalReps} reps
                        {" · "}
                        {summary.totalVolume.toLocaleString()} {ex.unit} volume
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteExercise.mutate({ exerciseId: ex.id })}
                      title="Remove exercise"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ex.sets.map((s, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-md bg-background border border-border/60 font-mono"
                      >
                        {s.weight}
                        {ex.unit} × {s.reps}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          !showForm && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No exercises logged yet.
            </div>
          )
        )}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="border border-border/60 rounded-lg p-3 bg-card space-y-3"
          >
            <div className="flex gap-2">
              <Input
                placeholder="Exercise name (e.g. Back squat)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1"
                autoFocus
              />
              <Select value={unit} onValueChange={(v) => setUnit(v as "kg" | "lb")}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lb">lb</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                <span className="w-6 text-center">#</span>
                <span className="flex-1">Weight ({unit})</span>
                <span className="flex-1">Reps</span>
                <span className="w-7" />
              </div>
              {sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-center text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    placeholder="0"
                    value={s.weight}
                    onChange={(e) => updateSet(i, "weight", e.target.value)}
                    className="flex-1 h-9"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={s.reps}
                    onChange={(e) => updateSet(i, "reps", e.target.value)}
                    className="flex-1 h-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSetRow(i)}
                    disabled={sets.length === 1}
                    title="Remove set"
                  >
                    <X size={13} />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addSetRow}
                className="h-7 text-xs text-muted-foreground"
              >
                <Plus size={12} className="mr-1" /> Add set
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setName("");
                  setSets([{ weight: "", reps: "" }]);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!name.trim() || createExercise.isPending}
              >
                Save exercise
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
