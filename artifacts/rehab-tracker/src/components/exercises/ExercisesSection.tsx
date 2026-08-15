import { useState } from "react";
import {
  useListSessionExercises,
  getListSessionExercisesQueryKey,
  useCreateSessionExercise,
  useDeleteExercise,
  type Exercise,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dumbbell, Plus, Trash2, X, Mic, MicOff, Keyboard } from "lucide-react";

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
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useCorrections } from "@/hooks/useCorrections";

// ── Parser ────────────────────────────────────────────────────────────────────

interface ParsedExercise {
  name: string;
  numSets: number;
  reps: number;
  weight: number;
  unit: "kg" | "lb";
}

function parseExerciseDictation(raw: string): ParsedExercise {
  let text = raw.trim();

  // Weight + unit  (must run before generic number extraction)
  let weight = 0;
  let unit: "kg" | "lb" = "kg";
  const weightRx = /(\d+(?:[.,]\d+)?)\s*(kg|קג|קילו|kilos?|lb|pounds?|פאונד)/i;
  const wm = text.match(weightRx);
  if (wm) {
    weight = parseFloat(wm[1].replace(",", "."));
    unit = /lb|pounds?|פאונד/i.test(wm[2]) ? "lb" : "kg";
    text = text.replace(wm[0], " ");
  }

  // Sets
  let numSets = 1;
  const setsRx = /(\d+)\s*(sets?|סטים?|сетов?|серий?|подходов?)/i;
  const sm = text.match(setsRx);
  if (sm) {
    numSets = parseInt(sm[1]);
    text = text.replace(sm[0], " ");
  }

  // Reps
  let reps = 0;
  const repsRx = /(\d+)\s*(reps?|repetitions?|חזרות?|חזרה|повторений?|повторов?|раз)/i;
  const rm = text.match(repsRx);
  if (rm) {
    reps = parseInt(rm[1]);
    text = text.replace(rm[0], " ");
  }

  // Fallback: "N x M" or "N × M" or "N by M"  →  sets × reps
  if (!sm && !rm) {
    const xm = text.match(/(\d+)\s*[xXх×]\s*(\d+)/);
    if (xm) {
      numSets = parseInt(xm[1]);
      reps = parseInt(xm[2]);
      text = text.replace(xm[0], " ");
    }
  }

  // Strip leftover filler words
  text = text
    .replace(/\b(at|of|with|for|and|ב|עם|של|по|на|с|за)\b/gi, " ")
    .replace(/[,،،。]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { name: text, numSets, reps, weight, unit };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type DraftSet = { weight: string; reps: string };

function summarizeSets(sets: { weight: number; reps: number }[]) {
  if (!sets.length) return { topWeight: 0, totalReps: 0, totalVolume: 0 };
  let topWeight = 0, totalReps = 0, totalVolume = 0;
  for (const s of sets) {
    totalReps += s.reps;
    totalVolume += s.weight * s.reps;
    if (s.weight > topWeight) topWeight = s.weight;
  }
  return { topWeight, totalReps, totalVolume };
}

interface Props { sessionId: string }

// ── Component ─────────────────────────────────────────────────────────────────

export function ExercisesSection({ sessionId }: Props) {
  const queryClient = useQueryClient();
  const { apply } = useCorrections();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [sets, setSets] = useState<DraftSet[]>([{ weight: "", reps: "" }]);
  const [dictationText, setDictationText] = useState("");
  const [interim, setInterim] = useState("");

  // Queries / mutations
  const { data: exercises, isLoading } = useListSessionExercises(sessionId, {
    query: { enabled: !!sessionId, queryKey: getListSessionExercisesQueryKey(sessionId) },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListSessionExercisesQueryKey(sessionId) });

  const createExercise = useCreateSessionExercise({
    mutation: {
      onSuccess: () => {
        invalidate();
        resetForm();
      },
    },
  });

  const deleteExercise = useDeleteExercise({
    mutation: { onSuccess: () => invalidate() },
  });

  // Voice recognition
  const speech = useSpeechRecognition({
    lang: "he-IL",
    continuous: false,
    interimResults: true,
    onFinalTranscript: (text) => {
      const fixed = apply(text.trim());
      setDictationText(fixed);
      setInterim("");
      const parsed = parseExerciseDictation(fixed);
      setName(parsed.name);
      setUnit(parsed.unit);
      // Build set rows: one row per set, all with same weight/reps
      const rows: DraftSet[] = Array.from({ length: parsed.numSets || 1 }, () => ({
        weight: parsed.weight > 0 ? String(parsed.weight) : "",
        reps: parsed.reps > 0 ? String(parsed.reps) : "",
      }));
      setSets(rows);
    },
    onInterimTranscript: (text) => setInterim(text),
  });

  // Helpers
  const resetForm = () => {
    setShowForm(false);
    setVoiceMode(true);
    setName("");
    setSets([{ weight: "", reps: "" }]);
    setDictationText("");
    setInterim("");
    if (speech.isListening) speech.stop();
  };

  const updateSet = (i: number, field: keyof DraftSet, value: string) =>
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));

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
      .map((s) => ({
        weight: s.weight === "" ? 0 : parseFloat(s.weight),
        reps: parseInt(s.reps, 10),
      }))
      .filter((s) => !isNaN(s.reps) && s.reps > 0);
    if (cleaned.length === 0) return;
    createExercise.mutate({
      sessionId,
      data: { name: name.trim(), unit, sets: cleaned, position: exercises?.length ?? 0 },
    });
  };

  const toggleMic = () => {
    if (speech.isListening) { speech.stop(); setInterim(""); }
    else { setDictationText(""); speech.start(); }
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
        {/* Exercise list */}
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
                        {" · "}{summary.totalVolume.toLocaleString()} {ex.unit} volume
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
                        {s.weight}{ex.unit} × {s.reps}
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

        {/* Add form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="border border-border/60 rounded-lg p-3 bg-card space-y-3"
          >
            {/* Mode toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {voiceMode ? "Voice entry" : "Manual entry"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground gap-1"
                onClick={() => {
                  setVoiceMode((v) => !v);
                  if (speech.isListening) speech.stop();
                }}
              >
                {voiceMode ? <Keyboard size={12} /> : <Mic size={12} />}
                {voiceMode ? "Switch to manual" : "Switch to voice"}
              </Button>
            </div>

            {/* ── Voice mode ── */}
            {voiceMode && speech.isSupported && (
              <div className="space-y-3">
                {/* Big mic button */}
                <div className="flex flex-col items-center gap-2 py-2">
                  <Button
                    type="button"
                    variant={speech.isListening ? "destructive" : "outline"}
                    size="lg"
                    onClick={toggleMic}
                    className={`w-16 h-16 rounded-full text-lg shadow-sm transition-all ${speech.isListening ? "animate-pulse scale-110" : "hover:scale-105"}`}
                    title={speech.isListening ? "Stop" : "Start dictation"}
                  >
                    {speech.isListening ? <MicOff size={24} /> : <Mic size={24} />}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground max-w-[220px]">
                    {speech.isListening
                      ? (interim || "Listening…")
                      : dictationText
                      ? <span className="text-foreground">{dictationText}</span>
                      : <>Say: <em>"bench press, 3 sets, 10 reps, 60 kilo"</em></>
                    }
                  </p>
                  {speech.error && (
                    <p className="text-xs text-destructive">{speech.error}</p>
                  )}
                </div>

                {/* Parsed preview — shown once we have a name */}
                {name && (
                  <div className="rounded-md bg-accent/20 border border-border/40 px-3 py-2 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Parsed</p>
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {sets.length} set{sets.length !== 1 ? "s" : ""} ·{" "}
                      {sets[0]?.reps || "?"} reps ·{" "}
                      {sets[0]?.weight ? `${sets[0].weight} ${unit}` : "no weight"}
                    </p>
                    <button
                      type="button"
                      className="text-xs text-primary underline-offset-2 hover:underline"
                      onClick={() => setVoiceMode(false)}
                    >
                      Edit fields
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Manual mode (also shown for review/edit) ── */}
            {!voiceMode && (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Exercise name"
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
                      <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
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
              </>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
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
