import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Plus, Dumbbell, Pencil, Trash2, Send, Link2, Copy, Check,
  ChevronDown, ChevronUp, Play, Calendar
} from "lucide-react";
import {
  useListHomeworkPrograms, getListHomeworkProgramsQueryKey,
  useCreateHomeworkProgram,
  useUpdateHomeworkProgram,
  useDeleteHomeworkProgram,
  useListHomeworkExercises, getListHomeworkExercisesQueryKey,
  useCreateHomeworkExercise,
  useUpdateHomeworkExercise,
  useDeleteHomeworkExercise,
  useSendHomeworkReminder,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Exercise form schema ──────────────────────────────────────────────────────

const exerciseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sets: z.coerce.number().int().optional().or(z.literal("")),
  reps: z.coerce.number().int().optional().or(z.literal("")),
  weight: z.coerce.number().int().optional().or(z.literal("")),
  unit: z.string().default("kg"),
  frequencyType: z.enum(["daily", "specific_days", "times_per_week"]).default("daily"),
  daysOfWeek: z.array(z.number()).default([]),
  timesPerDay: z.coerce.number().int().default(1),
  videoUrl: z.string().optional().or(z.literal("")),
  instructions: z.string().optional(),
});

type ExerciseFormValues = z.infer<typeof exerciseSchema>;

// ── Program form schema ───────────────────────────────────────────────────────

const programSchema = z.object({
  title: z.string().min(1, "Title is required"),
  notes: z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFreq(ex: { frequencyType: string; daysOfWeek?: number[]; timesPerDay?: number }) {
  if (ex.frequencyType === "daily") return ex.timesPerDay && ex.timesPerDay > 1 ? `${ex.timesPerDay}× daily` : "Daily";
  if (ex.frequencyType === "specific_days" && ex.daysOfWeek?.length)
    return ex.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ");
  return ex.frequencyType;
}

// ── Exercise form dialog ──────────────────────────────────────────────────────

function ExerciseDialog({
  open,
  onClose,
  onSave,
  defaultValues,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (values: ExerciseFormValues) => void;
  defaultValues?: Partial<ExerciseFormValues>;
  isPending?: boolean;
}) {
  const form = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: {
      name: "", sets: undefined, reps: undefined, weight: undefined,
      unit: "kg", frequencyType: "daily", daysOfWeek: [], timesPerDay: 1,
      videoUrl: "", instructions: "",
      ...defaultValues,
    },
  });

  const freqType = form.watch("frequencyType");
  const daysOfWeek = form.watch("daysOfWeek");

  function toggleDay(day: number) {
    const current = daysOfWeek ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
    form.setValue("daysOfWeek", next);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">{defaultValues?.name ? "Edit Exercise" : "Add Exercise"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4 pt-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Exercise Name</FormLabel>
                <FormControl><Input placeholder="e.g. Knee extension" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="sets" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sets</FormLabel>
                  <FormControl><Input type="number" min={1} placeholder="3" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="reps" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reps</FormLabel>
                  <FormControl><Input type="number" min={1} placeholder="10" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="weight" render={({ field }) => (
                <FormItem>
                  <FormLabel>Weight</FormLabel>
                  <FormControl><Input type="number" min={0} placeholder="0" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="frequencyType" render={({ field }) => (
              <FormItem>
                <FormLabel>Frequency</FormLabel>
                <div className="flex gap-2">
                  {(["daily", "specific_days", "times_per_week"] as const).map((v) => (
                    <button key={v} type="button"
                      onClick={() => field.onChange(v)}
                      className={`flex-1 text-xs rounded-lg py-2 px-1 border transition-colors ${field.value === v ? "bg-primary text-white border-primary" : "bg-background border-border/60 text-muted-foreground hover:border-primary/40"}`}>
                      {v === "daily" ? "Daily" : v === "specific_days" ? "Pick days" : "×/week"}
                    </button>
                  ))}
                </div>
              </FormItem>
            )} />

            {freqType === "specific_days" && (
              <div>
                <p className="text-sm font-medium mb-2">Days</p>
                <div className="flex gap-1.5 flex-wrap">
                  {DAY_NAMES.map((name, i) => (
                    <button key={i} type="button"
                      onClick={() => toggleDay(i)}
                      className={`w-10 h-10 rounded-lg text-xs font-medium border transition-colors ${(daysOfWeek ?? []).includes(i) ? "bg-primary text-white border-primary" : "bg-background border-border/60 text-muted-foreground hover:border-primary/40"}`}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {freqType === "daily" && (
              <FormField control={form.control} name="timesPerDay" render={({ field }) => (
                <FormItem>
                  <FormLabel>Times per day</FormLabel>
                  <FormControl><Input type="number" min={1} max={10} {...field} /></FormControl>
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="instructions" render={({ field }) => (
              <FormItem>
                <FormLabel>Instructions (optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe the exercise or add notes for the client…" className="min-h-[72px]" {...field} />
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="videoUrl" render={({ field }) => (
              <FormItem>
                <FormLabel>Video URL (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="https://youtube.com/watch?v=…" {...field} value={field.value ?? ""} />
                </FormControl>
                <p className="text-xs text-muted-foreground">YouTube, Vimeo, or any direct video link</p>
              </FormItem>
            )} />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save Exercise"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Exercise card ─────────────────────────────────────────────────────────────

function ExerciseCard({
  ex,
  programId,
  onDeleted,
}: {
  ex: any;
  programId: string;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const updateEx = useUpdateHomeworkExercise({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHomeworkExercisesQueryKey(programId) });
        setEditOpen(false);
      },
    },
  });

  const deleteEx = useDeleteHomeworkExercise({
    mutation: { onSuccess: onDeleted },
  });

  const vol = [ex.sets && `${ex.sets} sets`, ex.reps && `${ex.reps} reps`, ex.weight && `${ex.weight} ${ex.unit}`]
    .filter(Boolean).join(" · ");

  return (
    <>
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground">{ex.name}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <Badge variant="secondary" className="text-[11px] font-normal py-0">
                  <Calendar size={10} className="mr-1" />{formatFreq(ex)}
                </Badge>
                {vol && <Badge variant="outline" className="text-[11px] font-normal py-0 border-border/50">{vol}</Badge>}
              </div>
              {(ex.instructions || ex.videoUrl) && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-2 text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {expanded ? "Hide details" : "Show details"}
                </button>
              )}
              {expanded && (
                <div className="mt-2 space-y-1.5">
                  {ex.instructions && <p className="text-xs text-muted-foreground leading-relaxed">{ex.instructions}</p>}
                  {ex.videoUrl && (
                    <a href={ex.videoUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                      <Play size={12} /> Watch video
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditOpen(true)}>
                <Pencil size={13} />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => deleteEx.mutate({ exerciseId: ex.id })}>
                <Trash2 size={13} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ExerciseDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        isPending={updateEx.isPending}
        defaultValues={{
          name: ex.name, sets: ex.sets ?? undefined, reps: ex.reps ?? undefined,
          weight: ex.weight ?? undefined, unit: ex.unit,
          frequencyType: ex.frequencyType, daysOfWeek: ex.daysOfWeek ?? [],
          timesPerDay: ex.timesPerDay, videoUrl: ex.videoUrl ?? "",
          instructions: ex.instructions ?? "",
        }}
        onSave={(values) =>
          updateEx.mutate({
            exerciseId: ex.id,
            data: {
              name: values.name,
              sets: values.sets ? Number(values.sets) : null,
              reps: values.reps ? Number(values.reps) : null,
              weight: values.weight ? Number(values.weight) : null,
              unit: values.unit,
              frequencyType: values.frequencyType,
              daysOfWeek: values.daysOfWeek,
              timesPerDay: values.timesPerDay,
              videoUrl: values.videoUrl || null,
              instructions: values.instructions || null,
            },
          })
        }
      />
    </>
  );
}

// ── Program section ───────────────────────────────────────────────────────────

function ProgramSection({ program, clientName, clientEmail }: { program: any; clientName: string; clientEmail?: string | null }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: exercises, isLoading } = useListHomeworkExercises(program.id, {
    query: { queryKey: getListHomeworkExercisesQueryKey(program.id) },
  });

  const createEx = useCreateHomeworkExercise({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHomeworkExercisesQueryKey(program.id) });
        setAddOpen(false);
      },
    },
  });

  const deleteProgram = useDeleteHomeworkProgram({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getListHomeworkProgramsQueryKey({ clientId: program.clientId }) }),
    },
  });

  const sendReminder = useSendHomeworkReminder({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Reminder sent ✓",
          description: clientEmail
            ? `Email sent to ${clientEmail}`
            : "Link generated (client has no email yet)",
        });
        // Also copy the link to clipboard
        navigator.clipboard.writeText(data.magicLink).catch(() => {});
      },
      onError: (err: any) => {
        toast({ title: "Failed to send", description: err?.message ?? "Unknown error", variant: "destructive" });
      },
    },
  });

  function copyLink() {
    const appUrl = window.location.origin;
    // We don't have the token here, so just send the reminder to get it
    sendReminder.mutate({ programId: program.id });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-serif font-medium text-lg text-foreground">{program.title}</h3>
          {program.notes && <p className="text-sm text-muted-foreground mt-0.5">{program.notes}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="border-border/50 text-xs h-8"
            disabled={sendReminder.isPending}
            onClick={() => sendReminder.mutate({ programId: program.id })}>
            <Send size={13} className="mr-1.5" />
            {sendReminder.isPending ? "Sending…" : "Send"}
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
            onClick={() => {
              if (confirm(`Delete program "${program.title}"?`))
                deleteProgram.mutate({ programId: program.id });
            }}>
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground animate-pulse">Loading exercises…</p>
      ) : (
        <div className="space-y-2">
          {exercises?.map((ex) => (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              programId={program.id}
              onDeleted={() =>
                queryClient.invalidateQueries({ queryKey: getListHomeworkExercisesQueryKey(program.id) })
              }
            />
          ))}
        </div>
      )}

      <Button size="sm" variant="outline" className="border-dashed border-border w-full text-muted-foreground hover:text-foreground h-9"
        onClick={() => setAddOpen(true)}>
        <Plus size={14} className="mr-1.5" /> Add Exercise
      </Button>

      <ExerciseDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        isPending={createEx.isPending}
        onSave={(values) =>
          createEx.mutate({
            programId: program.id,
            data: {
              name: values.name,
              sets: values.sets ? Number(values.sets) : null,
              reps: values.reps ? Number(values.reps) : null,
              weight: values.weight ? Number(values.weight) : null,
              unit: values.unit,
              frequencyType: values.frequencyType,
              daysOfWeek: values.daysOfWeek,
              timesPerDay: values.timesPerDay,
              videoUrl: values.videoUrl || null,
              instructions: values.instructions || null,
            },
          })
        }
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function HomeworkTab({ clientId, clientName, clientEmail }: { clientId: string; clientName: string; clientEmail?: string | null }) {
  const queryClient = useQueryClient();
  const [newProgramOpen, setNewProgramOpen] = useState(false);

  const { data: programs, isLoading } = useListHomeworkPrograms(
    { clientId },
    { query: { queryKey: getListHomeworkProgramsQueryKey({ clientId }) } }
  );

  const programForm = useForm<z.infer<typeof programSchema>>({
    resolver: zodResolver(programSchema),
    defaultValues: { title: "", notes: "" },
  });

  const createProgram = useCreateHomeworkProgram({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHomeworkProgramsQueryKey({ clientId }) });
        setNewProgramOpen(false);
        programForm.reset();
      },
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-serif font-medium">Homework Programs</h2>
        <Button size="sm" variant="outline" className="border-border/50 shadow-sm"
          onClick={() => setNewProgramOpen(true)}>
          <Plus size={16} className="mr-1.5" /> New Program
        </Button>
      </div>

      {/* Empty state */}
      {!isLoading && (!programs || programs.length === 0) && (
        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border/50">
          <Dumbbell className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-1">No homework programs yet</h3>
          <p className="text-muted-foreground mb-6 text-sm">
            Create a program, add exercises with schedules, then send a reminder link to your client.
          </p>
          <Button onClick={() => setNewProgramOpen(true)}>Create First Program</Button>
        </div>
      )}

      {/* Programs */}
      {programs?.map((program, i) => (
        <div key={program.id}>
          {i > 0 && <div className="border-t border-border/30" />}
          <ProgramSection program={program} clientName={clientName} clientEmail={clientEmail} />
        </div>
      ))}

      {/* New program dialog */}
      <Dialog open={newProgramOpen} onOpenChange={setNewProgramOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-serif">New Homework Program</DialogTitle>
          </DialogHeader>
          <Form {...programForm}>
            <form onSubmit={programForm.handleSubmit((v) =>
              createProgram.mutate({ data: { clientId, title: v.title, notes: v.notes || null } })
            )} className="space-y-4 pt-2">
              <FormField control={programForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Week 1 – Mobility" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={programForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any instructions or context for this program…" {...field} />
                  </FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNewProgramOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createProgram.isPending}>
                  {createProgram.isPending ? "Creating…" : "Create Program"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
