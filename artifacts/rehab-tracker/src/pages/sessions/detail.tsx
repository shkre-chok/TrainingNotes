import { useState, useRef, useEffect } from "react";
import { Link, useParams } from "wouter";
import { format, parseISO } from "date-fns";
import { 
  useGetSession, getGetSessionQueryKey,
  useListSessionNotes, getListSessionNotesQueryKey,
  useCreateSessionNote,
  useDeleteNote,
  NoteKind,
  NewNoteKind
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, Clock, Activity, Zap, Info, 
  MessageSquare, Trophy, AlertTriangle, PlayCircle, Ruler,
  Flag, Trash2, Send, Mic, MicOff
} from "lucide-react";

import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useCorrections } from "@/hooks/useCorrections";
import { AppLayout } from "@/components/layout/AppLayout";
import { ExercisesSection } from "@/components/exercises/ExercisesSection";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

// Map note kinds to UI styling
const noteStyleMap = {
  observation: { icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-200 dark:border-blue-800" },
  win: { icon: Trophy, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-200 dark:border-emerald-800" },
  concern: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
  action: { icon: PlayCircle, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
  measurement: { icon: Ruler, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-200 dark:border-purple-800" },
};

export default function SessionDetail() {
  const params = useParams();
  const sessionId = params.sessionId || "";
  const queryClient = useQueryClient();
  const notesEndRef = useRef<HTMLDivElement>(null);
  
  // Fast capture state
  const [noteContent, setNoteContent] = useState("");
  const [noteKind, setNoteKind] = useState<NewNoteKind>("observation");
  const [isImportant, setIsImportant] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");

  const { apply } = useCorrections();

  const speech = useSpeechRecognition({
    lang: "he-IL",
    onFinalTranscript: (text) => {
      const fixed = apply(text.trim());
      setNoteContent((prev) => {
        const trimmed = prev.trimEnd();
        return trimmed ? `${trimmed} ${fixed}` : fixed;
      });
      setInterimTranscript("");
    },
    onInterimTranscript: (text) => {
      setInterimTranscript(text);
    },
  });

  const toggleMic = () => {
    if (speech.isListening) {
      speech.stop();
      setInterimTranscript("");
    } else {
      speech.start();
    }
  };

  const { data: session, isLoading: isLoadingSession } = useGetSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetSessionQueryKey(sessionId) }
  });

  const { data: notes, isLoading: isLoadingNotes } = useListSessionNotes(sessionId, {
    query: { enabled: !!sessionId, queryKey: getListSessionNotesQueryKey(sessionId) }
  });

  const createNote = useCreateSessionNote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSessionNotesQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
        setNoteContent("");
        // Keep kind and important state to allow rapid entry of similar notes
      }
    }
  });

  const deleteNote = useDeleteNote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSessionNotesQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
      }
    }
  });

  // Auto-scroll to bottom of notes when new one added
  useEffect(() => {
    if (notes && notes.length > 0) {
      notesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [notes]);

  const handleCreateNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!noteContent.trim()) return;

    createNote.mutate({
      sessionId,
      data: {
        content: noteContent,
        kind: noteKind,
        important: isImportant,
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateNote();
    }
  };

  if (isLoadingSession) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!session) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-serif mb-2">Session not found</h2>
          <Link href="/sessions">
            <Button variant="outline">Back to Sessions</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  // Reverse notes so newest is at the bottom (timeline chronological)
  const sortedNotes = [...(notes || [])].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 pb-6">
        
        {/* Header Area */}
        <div>
          <Link href={`/clients/${session.clientId}`}>
            <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft size={16} className="mr-1" /> Back to {session.clientName}
            </Button>
          </Link>
          
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif font-medium text-foreground tracking-tight">
                {session.title || "Session"}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className="font-medium text-foreground">{session.clientName}</span>
                <span className="hidden md:inline text-border/60">•</span>
                <span>{format(parseISO(session.sessionDate), 'EEEE, MMMM d, yyyy')}</span>
                <span className="hidden md:inline text-border/60">•</span>
                <span>{format(parseISO(session.sessionDate), 'h:mm a')}</span>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {session.durationMinutes && (
                <Badge variant="outline" className="bg-background text-xs font-normal border-border/50 py-1">
                  <Clock size={12} className="mr-1.5" /> {session.durationMinutes} min
                </Badge>
              )}
              {session.painLevel !== undefined && session.painLevel !== null && (
                <Badge variant="outline" className={`text-xs font-medium py-1
                  ${session.painLevel > 6 ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                    session.painLevel > 3 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-500 border-amber-200 dark:border-amber-800' : 
                    'bg-primary/10 text-primary border-primary/20'}
                `}>
                  <Activity size={12} className="mr-1.5" /> Pain: {session.painLevel}/10
                </Badge>
              )}
              {session.energyLevel !== undefined && session.energyLevel !== null && (
                <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-xs font-medium py-1">
                  <Zap size={12} className="mr-1.5" /> Energy: {session.energyLevel}/10
                </Badge>
              )}
            </div>
          </div>
          
          {(session.focusArea || session.summary) && (
            <div className="mt-4 p-3 md:p-4 rounded-lg bg-muted/30 border border-border/50 flex gap-3 text-sm">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                {session.focusArea && (
                  <p className="font-medium text-foreground mb-1">Focus: {session.focusArea}</p>
                )}
                {session.summary && (
                  <p className="text-muted-foreground">{session.summary}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Body: two columns on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-6 items-start">

          {/* Exercises column — scrolls independently on desktop */}
          <div className="md:overflow-y-auto md:max-h-[calc(100vh-18rem)]">
            <ExercisesSection sessionId={sessionId} />
          </div>

          {/* Notes column — fixed height with internal scroll on desktop */}
          <Card className="flex flex-col overflow-hidden border-border/50 shadow-sm min-h-[450px] md:h-[calc(100vh-14rem)]">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-accent/20">
            {isLoadingNotes ? (
              <div className="space-y-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-16 w-full md:w-2/3 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedNotes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">No notes captured yet.</p>
                <p className="text-xs opacity-70 mt-1">Use the input below to log observations during the session.</p>
              </div>
            ) : (
              <div className="space-y-6 md:space-y-8">
                {sortedNotes.map((note) => {
                  const style = noteStyleMap[note.kind as keyof typeof noteStyleMap] || noteStyleMap.observation;
                  const Icon = style.icon;
                  
                  return (
                    <div key={note.id} className="flex gap-3 md:gap-4 group">
                      <div className={`shrink-0 mt-1 flex flex-col items-center gap-1`}>
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${style.bg} ${style.color}`}>
                          <Icon size={14} />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0 max-w-2xl">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {note.kind}
                          </span>
                          <span className="text-xs text-muted-foreground/60">
                            {format(parseISO(note.createdAt), 'h:mm a')}
                          </span>
                          {note.important && (
                            <Badge variant="destructive" className="h-4 text-[10px] px-1 py-0 ml-1 rounded-sm uppercase tracking-widest font-bold">
                              Flagged
                            </Badge>
                          )}
                        </div>
                        
                        <div className={`p-3 md:p-4 rounded-xl text-sm md:text-base border shadow-sm relative group-hover:border-foreground/20 transition-colors
                          ${note.important ? 'bg-destructive/5 border-destructive/20 text-foreground' : `bg-card ${style.border} text-foreground/90`}
                        `}>
                          <p dir="auto" className="whitespace-pre-wrap break-words">{note.content}</p>
                          
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => deleteNote.mutate({ noteId: note.id })}
                            title="Delete note"
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={notesEndRef} />
              </div>
            )}
          </div>

          {/* Fast Capture Input */}
          <div className="shrink-0 border-t border-border/50 bg-card p-3 md:p-4">
            <form onSubmit={handleCreateNote} className="max-w-4xl mx-auto flex gap-3">
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                  <Select value={noteKind} onValueChange={(val) => setNoteKind(val as NewNoteKind)}>
                    <SelectTrigger className="w-[130px] md:w-[150px] h-8 text-xs border-border/50 bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(NoteKind).map(([key, value]) => {
                        const style = noteStyleMap[value as keyof typeof noteStyleMap];
                        const Icon = style.icon;
                        return (
                          <SelectItem key={key} value={value}>
                            <div className="flex items-center gap-2 text-xs">
                              <Icon size={12} className={style.color} />
                              <span className="capitalize">{value}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="important-mode" 
                      checked={isImportant}
                      onCheckedChange={setIsImportant}
                      className="data-[state=checked]:bg-destructive"
                    />
                    <Label htmlFor="important-mode" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                      <Flag size={12} className={isImportant ? "text-destructive" : ""} /> Flag
                    </Label>
                  </div>
                </div>
                
                <div className="relative">
                  <Textarea 
                    dir="auto"
                    value={noteContent + (interimTranscript ? (noteContent ? " " : "") + interimTranscript : "")}
                    onChange={(e) => setNoteContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={speech.isListening ? "Listening…" : "Type or dictate. Enter to save, Shift+Enter for newline."}
                    className="min-h-[60px] resize-none pr-28 focus-visible:ring-primary/50 text-base py-3"
                  />
                  {speech.isSupported && (
                    <Button
                      type="button"
                      size="icon"
                      variant={speech.isListening ? "default" : "ghost"}
                      onClick={toggleMic}
                      className={`absolute bottom-2 right-12 h-8 w-8 rounded-full ${speech.isListening ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse' : 'text-muted-foreground hover:text-foreground'}`}
                      title={speech.isListening ? "Stop dictation" : "Dictate (any language)"}
                    >
                      {speech.isListening ? <MicOff size={14} /> : <Mic size={14} />}
                    </Button>
                  )}
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={!noteContent.trim() || createNote.isPending}
                    className={`absolute bottom-2 right-2 h-8 w-8 rounded-full ${isImportant ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}`}
                  >
                    <Send size={14} className={noteContent.trim() && !isImportant ? "translate-x-[-1px] translate-y-[1px]" : ""} />
                  </Button>
                </div>
                {speech.error && (
                  <p className="text-xs text-destructive mt-1">{speech.error}</p>
                )}
                {!speech.isSupported && (
                  <p className="text-xs text-muted-foreground mt-1">Hebrew dictation requires Chrome or Edge.</p>
                )}
              </div>
            </form>
          </div>
        </Card>
        </div>{/* end grid */}
      </div>
    </AppLayout>
  );
}