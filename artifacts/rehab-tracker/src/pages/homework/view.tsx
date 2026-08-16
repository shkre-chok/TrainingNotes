import { useParams } from "wouter";
import { useGetHomeworkView } from "@workspace/api-client-react";
import { Calendar, Play, ChevronDown, ChevronUp, Dumbbell } from "lucide-react";
import { useState } from "react";

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

function formatVolume(ex: { sets?: number | null; reps?: number | null; weight?: number | null; unit?: string }) {
  const parts: string[] = [];
  if (ex.sets) parts.push(`${ex.sets} sets`);
  if (ex.reps) parts.push(`${ex.reps} reps`);
  if (ex.weight) parts.push(`${ex.weight} ${ex.unit ?? "kg"}`);
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

export default function HomeworkView() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data, isLoading, isError } = useGetHomeworkView(token, {
    query: { enabled: !!token },
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
