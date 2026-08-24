import { useParams } from "wouter";
import {
  getGetHomeworkViewQueryKey,
  useCreateHomeworkClientMessage,
  useGetHomeworkView,
  type HomeworkMessage,
  type HomeworkView,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, Play, ChevronDown, ChevronUp, Dumbbell, MessageCircle, Mic, Send, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { useHomeworkChat, type HomeworkChatStatus } from "@/hooks/useHomeworkChat";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatFrequency(ex: {
  frequencyType: string;
  daysOfWeek?: number[];
  timesPerDay?: number;
}) {
  if (ex.frequencyType === "daily") {
    return ex.timesPerDay && ex.timesPerDay > 1 ? `${ex.timesPerDay}× per day` : "Every day";
  }
  if (ex.frequencyType === "specific_days" && ex.daysOfWeek?.length) {
    return ex.daysOfWeek.map((d) => DAY_NAMES[d]).join(" · ");
  }
  return ex.frequencyType;
}

function formatVolume(ex: { sets?: number | null; reps?: number | null; weight?: number | null; unit?: string; durationSeconds?: number | null }) {
  const parts: string[] = [];
  if (ex.sets) parts.push(`${ex.sets} sets`);
  if (ex.reps) parts.push(`${ex.reps} reps`);
  if (ex.weight) parts.push(`${ex.weight} ${ex.unit ?? "kg"}`);
  if (ex.durationSeconds != null) {
    const m = Math.floor(ex.durationSeconds / 60);
    const s = ex.durationSeconds % 60;
    parts.push(m > 0 ? (s > 0 ? `${m}m ${s}s` : `${m}min`) : `${s}s`);
  }
  return parts.join(" · ");
}

function ExerciseCard({ ex }: { ex: any }) {
  const [expanded, setExpanded] = useState(false);
  const volume = formatVolume(ex);
  const freq = formatFrequency(ex);
  const hasDetails = ex.instructions || ex.videoUrl;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div
        className="p-5 flex items-start justify-between gap-4 cursor-pointer"
        onClick={() => hasDetails && setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-base leading-snug">{ex.name}</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 rounded-full px-2.5 py-1 font-medium">
              <Calendar size={11} /> {freq}
            </span>
            {volume && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 font-medium">
                <Dumbbell size={11} /> {volume}
              </span>
            )}
          </div>
        </div>
        {hasDetails && (
          <button className="shrink-0 text-gray-400 mt-1">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="px-5 pb-5 pt-0 space-y-3 border-t border-gray-50">
          {ex.instructions && (
            <p className="text-sm text-gray-600 leading-relaxed">{ex.instructions}</p>
          )}
          {ex.videoUrl && (
            <a
              href={ex.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-xl px-4 py-2.5 transition-colors"
            >
              <Play size={14} fill="white" /> Watch Video
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function audioSource(audioUrl: string) {
  return audioUrl.startsWith("/objects/") ? `/api/storage${audioUrl}` : audioUrl;
}

function formatMessageTime(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function chatStatusLabel(status: HomeworkChatStatus) {
  if (status === "connected") return "Live";
  if (status === "offline") return "Offline · REST fallback";
  return status === "connecting" ? "Connecting…" : "Reconnecting…";
}

function ClientMessageThread({
  programId,
  token,
  messages,
}: {
  programId: string;
  token: string;
  messages: HomeworkMessage[];
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { uploadFile, isUploading } = useUpload();

  const sendMessage = useCreateHomeworkClientMessage({
    mutation: {
      onSuccess: () => {
        setDraft("");
        queryClient.invalidateQueries({ queryKey: getGetHomeworkViewQueryKey(token) });
      },
      onError: () => setVoiceError("Your message could not be sent. Please try again."),
    },
  });
  const { status: chatStatus } = useHomeworkChat({
    programId,
    role: "client",
    token,
    onMessage: (message) => {
      if (message.senderRole !== "practitioner") return;
      queryClient.setQueryData<HomeworkView>(
        getGetHomeworkViewQueryKey(token),
        (current) => {
          if (!current) return current;
          return {
            ...current,
            programs: current.programs.map((program) => {
              if (program.id !== programId) return program;
              const messages = program.messages ?? [];
              if (messages.some((item) => item.id === message.id)) return program;
              return {
                ...program,
                messages: [...messages, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
              };
            }),
          };
        },
      );
    },
    onSnapshot: (snapshot) => {
      queryClient.setQueryData<HomeworkView>(
        getGetHomeworkViewQueryKey(token),
        (current) => {
          if (!current) return current;
          return {
            ...current,
            programs: current.programs.map((program) => {
              if (program.id !== programId) return program;
              const merged = [...(program.messages ?? []), ...snapshot];
              return {
                ...program,
                messages: merged.filter((message, index, all) =>
                  all.findIndex((candidate) => candidate.id === message.id) === index,
                ).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
              };
            }),
          };
        },
      );
    },
  });

  useEffect(() => () => {
    recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function submitText() {
    const content = draft.trim();
    if (!content || sendMessage.isPending) return;
    setVoiceError(null);
    sendMessage.mutate({ token, programId, data: { content } });
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Voice notes are not supported in this browser.");
      return;
    }

    try {
      setVoiceError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setIsRecording(false);
        const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (!audio.size) {
          setVoiceError("No audio was captured. Please try recording again.");
          return;
        }
        const file = new File([audio], `voice-note-${Date.now()}.webm`, { type: audio.type });
        const uploaded = await uploadFile(file);
        if (!uploaded) {
          setVoiceError("Your voice note could not be uploaded. Please try again.");
          return;
        }
        sendMessage.mutate({ token, programId, data: { audioUrl: uploaded.objectPath } });
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      setVoiceError("Microphone access was not available. Please allow it and try again.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  const isSending = sendMessage.isPending || isUploading;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <MessageCircle size={17} className="text-green-700" />
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Message your practitioner</h3>
          <p className="text-xs text-gray-500">
            <span className={chatStatus === "connected" ? "text-green-600" : undefined}>●</span>{" "}
            {chatStatusLabel(chatStatus)} · Ask a question or share how you’re feeling.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3 max-h-72 overflow-y-auto bg-gray-50/60">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-3">No messages yet. Your practitioner is here if you need help.</p>
        ) : messages.map((message) => {
          const isClient = message.senderRole === "client";
          return (
            <div key={message.id} className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${isClient ? "bg-green-600 text-white rounded-br-md" : "bg-white border border-gray-100 text-gray-800 rounded-bl-md"}`}>
                <p className={`text-[11px] font-medium mb-1 ${isClient ? "text-green-100" : "text-gray-400"}`}>
                  {isClient ? "You" : "Your practitioner"} · {formatMessageTime(message.createdAt)}
                </p>
                {message.content && <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>}
                {message.audioUrl && (
                  <div className="flex items-center gap-2 mt-1">
                    <Volume2 size={15} aria-hidden="true" />
                    <audio controls className="h-8 max-w-[195px]" src={audioSource(message.audioUrl)}>
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-100">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitText();
            }
          }}
          maxLength={5000}
          placeholder="Write a message…"
          disabled={isSending || isRecording}
          className="w-full min-h-20 resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
        />
        {voiceError && <p className="mt-2 text-xs text-red-600">{voiceError}</p>}
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isSending}
            className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 transition-colors ${isRecording ? "bg-red-50 text-red-700 hover:bg-red-100" : "text-gray-600 hover:bg-gray-100"}`}
          >
            {isRecording ? <Square size={13} fill="currentColor" /> : <Mic size={14} />}
            {isRecording ? "Stop recording" : isUploading ? "Uploading…" : "Voice note"}
          </button>
          <button
            type="button"
            onClick={submitText}
            disabled={!draft.trim() || isSending || isRecording}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-3.5 py-2 text-sm font-medium transition-colors"
          >
            <Send size={14} /> {sendMessage.isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomeworkView() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data, isLoading, isError } = useGetHomeworkView(token, {
    query: { enabled: !!token, queryKey: getGetHomeworkViewQueryKey(token) },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading your program…</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="text-red-400" size={28} />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link not found</h1>
          <p className="text-gray-500 text-sm">This homework link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <Dumbbell size={18} className="text-green-700" />
          </div>
          <div>
            <p className="text-xs text-gray-400 leading-none">Homework for</p>
            <h1 className="font-semibold text-gray-900 leading-snug">{data.clientName}</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-5 py-6 space-y-8">
        {data.programs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400">No active programs assigned yet.</p>
          </div>
        ) : (
          data.programs.map((program) => (
            <section key={program.id}>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{program.title}</h2>
                {program.notes && (
                  <p className="text-sm text-gray-500 mt-1">{program.notes}</p>
                )}
              </div>
              <div className="space-y-3">
                {program.exercises.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No exercises in this program yet.</p>
                ) : (
                  program.exercises.map((ex) => (
                    <ExerciseCard key={ex.id} ex={ex} />
                  ))
                )}
              </div>
               <div className="mt-5">
                 <ClientMessageThread programId={program.id} token={token} messages={program.messages ?? []} />
               </div>
            </section>
          ))
        )}

        <p className="text-center text-xs text-gray-300 pt-4">
          Sent by your practitioner via Training Tracker
        </p>
      </div>
    </div>
  );
}
