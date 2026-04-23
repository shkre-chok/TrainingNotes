import { useMemo, useState } from "react";
import {
  useGetClientExerciseProgress,
  getGetClientExerciseProgressQueryKey,
} from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  clientId: string;
}

export function ExerciseProgressChart({ clientId }: Props) {
  const { data, isLoading } = useGetClientExerciseProgress(clientId, {
    query: {
      enabled: !!clientId,
      queryKey: getGetClientExerciseProgressQueryKey(clientId),
    },
  });

  const trackable = useMemo(
    () => (data ?? []).filter((d) => d.points.length >= 1),
    [data]
  );

  const [selected, setSelected] = useState<string | null>(null);
  const activeName = selected ?? trackable[0]?.name ?? null;
  const active = trackable.find((d) => d.name === activeName) ?? trackable[0];

  const chartData = useMemo(() => {
    if (!active) return [];
    return active.points.map((p) => ({
      date: format(parseISO(p.sessionDate), "MMM d"),
      maxWeight: p.maxWeight,
      volume: p.totalVolume,
      reps: p.totalReps,
    }));
  }, [active]);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2 font-serif font-medium">
          <TrendingUp size={16} className="text-primary" />
          Weights &amp; reps progress
        </CardTitle>
        {trackable.length > 1 && (
          <Select
            value={active?.name ?? ""}
            onValueChange={(v) => setSelected(v)}
          >
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {trackable.map((d) => (
                <SelectItem key={d.name} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : !active || chartData.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-sm text-muted-foreground text-center px-4">
            <p>No exercise data yet.</p>
            <p className="text-xs opacity-70 mt-1">
              Log weights and reps inside a session to see progress here.
            </p>
          </div>
        ) : (
          <>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    label={{
                      value: active.unit,
                      angle: -90,
                      position: "insideLeft",
                      offset: 18,
                      style: { fontSize: 11, fill: "currentColor" },
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "Top weight") return [`${value} ${active.unit}`, name];
                      if (name === "Total volume") return [`${value.toLocaleString()} ${active.unit}`, name];
                      return [value, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="maxWeight"
                    name="Top weight"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="reps"
                    name="Total reps"
                    stroke="#9ca3af"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-muted-foreground mt-2 text-center">
              {active.name} — {active.points.length} session{active.points.length === 1 ? "" : "s"}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
