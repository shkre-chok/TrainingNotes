import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { 
  Activity, Users, Target, CheckCircle2, AlertCircle, 
  Calendar, TrendingUp, ChevronRight, FileText,
  Clock
} from "lucide-react";
import { 
  useGetDashboardSummary, 
  getGetDashboardSummaryQueryKey,
  useGetRecentActivity,
  getGetRecentActivityQueryKey,
  useGetUpcomingSessions,
  getGetUpcomingSessionsQueryKey
} from "@workspace/api-client-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() }
  });

  const { data: upcoming, isLoading: isLoadingUpcoming } = useGetUpcomingSessions({
    query: { queryKey: getGetUpcomingSessionsQueryKey() }
  });

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight">Good morning.</h1>
            <p className="text-muted-foreground mt-1">Here's what's happening across your caseload today.</p>
          </div>
          <Link href="/sessions/new">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
              Log a Session
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard 
            title="Active Clients" 
            value={summary?.totalClients} 
            icon={Users} 
            isLoading={isLoadingSummary} 
          />
          <SummaryCard 
            title="Sessions This Week" 
            value={summary?.sessionsThisWeek} 
            icon={Calendar} 
            isLoading={isLoadingSummary} 
          />
          <SummaryCard 
            title="Active Goals" 
            value={summary?.activeGoals} 
            icon={Target} 
            isLoading={isLoadingSummary} 
          />
          <SummaryCard 
            title="Important Notes" 
            value={summary?.importantNotes} 
            icon={AlertCircle} 
            isLoading={isLoadingSummary} 
            highlight={summary?.importantNotes ? summary.importantNotes > 0 : false}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="shadow-sm border-border/50">
              <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/50 bg-muted/20">
                <div>
                  <CardTitle className="text-lg font-serif">Recent Activity</CardTitle>
                </div>
                <Link href="/sessions">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                    View all <ChevronRight size={14} className="ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingActivity ? (
                  <div className="p-4 space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : activity?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>No recent activity.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {activity?.map((item) => (
                      <div key={item.id} className="p-4 hover:bg-muted/20 transition-colors flex items-start gap-4">
                        <div className="mt-1">
                          {item.kind === 'session' && <Activity className="text-primary h-5 w-5" />}
                          {item.kind === 'note' && <FileText className="text-accent-foreground h-5 w-5" />}
                          {item.kind === 'goal' && <Target className="text-blue-600 h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(parseISO(item.timestamp), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          {item.subtitle && <p className="text-sm text-muted-foreground mt-0.5">{item.subtitle}</p>}
                          {item.clientName && (
                            <Badge variant="outline" className="mt-2 text-xs font-normal bg-background">
                              {item.clientName}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-sm border-border/50">
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-lg font-serif">Upcoming Sessions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingUpcoming ? (
                  <div className="p-4 space-y-4">
                    {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : upcoming?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>No upcoming sessions scheduled.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {upcoming?.map((session) => (
                      <Link key={session.id} href={`/sessions/${session.id}`}>
                        <div className="p-4 hover:bg-muted/20 transition-colors cursor-pointer group">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-sm group-hover:text-primary transition-colors">{session.clientName}</h4>
                            <div className="flex items-center text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">
                              <Clock size={12} className="mr-1" />
                              {session.durationMinutes}m
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center">
                            <Calendar size={14} className="mr-1.5 opacity-70" />
                            {format(parseISO(session.sessionDate), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50 bg-primary/5 border-primary/10">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground text-sm mb-1">Average Pain Level</h3>
                  <div className="flex items-baseline gap-2">
                    {isLoadingSummary ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <>
                        <span className="text-2xl font-serif font-medium">{summary?.avgPainLevel?.toFixed(1) || '-'}</span>
                        <span className="text-xs text-muted-foreground">/ 10 this week</span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function SummaryCard({ title, value, icon: Icon, isLoading, highlight = false }: any) {
  return (
    <Card className={`shadow-sm border-border/50 ${highlight ? 'bg-destructive/5 border-destructive/20' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-md ${highlight ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
            <Icon size={16} strokeWidth={2.5} />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        </div>
        {isLoading ? (
          <Skeleton className="h-8 w-16 mt-1" />
        ) : (
          <div className={`text-3xl font-serif font-medium ${highlight ? 'text-destructive' : 'text-foreground'}`}>
            {value !== undefined ? value : '-'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
