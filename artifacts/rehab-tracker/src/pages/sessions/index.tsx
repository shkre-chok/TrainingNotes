import { useState } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { 
  useListSessions, getListSessionsQueryKey,
  useListClients, getListClientsQueryKey
} from "@workspace/api-client-react";
import { Activity, Plus, Search, Calendar, Clock, ChevronRight } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Sessions() {
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");

  const { data: clients } = useListClients({
    query: { queryKey: getListClientsQueryKey() }
  });

  const queryParams = clientFilter !== "all" ? { clientId: clientFilter } : {};
  
  const { data: sessions, isLoading } = useListSessions(queryParams, {
    query: { queryKey: getListSessionsQueryKey(queryParams) }
  });

  let filteredSessions = sessions || [];
  
  if (search) {
    filteredSessions = filteredSessions.filter(s => 
      (s.title && s.title.toLowerCase().includes(search.toLowerCase())) || 
      (s.clientName && s.clientName.toLowerCase().includes(search.toLowerCase())) ||
      (s.focusArea && s.focusArea.toLowerCase().includes(search.toLowerCase()))
    );
  }

  // Group sessions by month/year
  const groupedSessions: Record<string, typeof sessions> = {};
  filteredSessions.forEach(session => {
    const date = parseISO(session.sessionDate);
    const key = format(date, 'MMMM yyyy');
    if (!groupedSessions[key]) groupedSessions[key] = [];
    groupedSessions[key].push(session);
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight">Sessions</h1>
            <p className="text-muted-foreground mt-1">Review past sessions and notes.</p>
          </div>
          <Link href="/sessions/new">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
              <Plus className="mr-2" size={16} /> Log Session
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="Search sessions..." 
              className="pl-9 bg-background shadow-sm border-border/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-full sm:w-[220px] bg-background">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients?.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-32 mb-4" />
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-20 px-4 bg-muted/20 rounded-xl border border-dashed border-border/50">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-serif font-medium text-foreground mb-1">No sessions found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              {search || clientFilter !== "all" 
                ? "Try adjusting your filters." 
                : "You haven't logged any sessions yet."}
            </p>
            {!search && clientFilter === "all" && (
              <Link href="/sessions/new">
                <Button>Log a Session</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(groupedSessions).map(([month, monthSessions]) => (
              <div key={month}>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 border-b border-border/50 pb-2">
                  {month}
                </h3>
                <div className="space-y-3">
                  {(monthSessions ?? []).map(session => (
                    <Link key={session.id} href={`/sessions/${session.id}`}>
                      <Card className="hover:border-primary/40 transition-colors shadow-sm border-border/50 cursor-pointer group">
                        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
                          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="w-full sm:w-[140px] shrink-0">
                              <div className="text-sm font-medium text-foreground">
                                {format(parseISO(session.sessionDate), 'MMM d, yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <Calendar size={12} /> {format(parseISO(session.sessionDate), 'h:mm a')}
                              </div>
                            </div>
                            
                            <div className="hidden sm:block h-10 w-px bg-border/50"></div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-serif font-medium text-lg leading-tight group-hover:text-primary transition-colors truncate">
                                  {session.clientName}
                                </h4>
                                {session.durationMinutes && (
                                  <Badge variant="outline" className="text-[10px] font-normal border-border/50 shrink-0">
                                    <Clock size={10} className="mr-1" /> {session.durationMinutes}m
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {session.title || session.focusArea || "General Session"}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto shrink-0 border-t sm:border-t-0 border-border/50 pt-3 sm:pt-0 mt-2 sm:mt-0">
                            {session.painLevel !== undefined && session.painLevel !== null && (
                              <div className="text-center">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Pain</div>
                                <div className={`text-xs font-medium px-1.5 py-0.5 rounded
                                  ${session.painLevel > 6 ? 'text-destructive' : 
                                    session.painLevel > 3 ? 'text-amber-600 dark:text-amber-500' : 
                                    'text-primary'}
                                `}>
                                  {session.painLevel}/10
                                </div>
                              </div>
                            )}
                            
                            <div className="text-center">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Notes</div>
                              <div className="text-xs font-medium text-foreground">
                                {session.noteCount || 0}
                              </div>
                            </div>
                            
                            <ChevronRight size={18} className="text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all group-hover:translate-x-1" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}