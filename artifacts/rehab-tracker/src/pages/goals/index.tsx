import { useState } from "react";
import { format, parseISO } from "date-fns";
import { 
  useListGoals, getListGoalsQueryKey,
  useListClients, getListClientsQueryKey,
  useUpdateGoal
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Target, Search, Filter, Calendar, CheckCircle2, MoreHorizontal } from "lucide-react";
import { Link } from "wouter";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListGoalsStatus } from "@workspace/api-client-react";

export default function Goals() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  
  const queryClient = useQueryClient();

  const { data: clients } = useListClients({
    query: { queryKey: getListClientsQueryKey() }
  });

  const queryParams = statusFilter !== "all" 
    ? { status: statusFilter as ListGoalsStatus } 
    : {};
    
  const { data: goals, isLoading } = useListGoals(queryParams, {
    query: { queryKey: getListGoalsQueryKey(queryParams) }
  });

  const updateGoal = useUpdateGoal();

  const handleStatusChange = (goalId: string, newStatus: ListGoalsStatus, currentProgress: number) => {
    updateGoal.mutate(
      { 
        goalId, 
        data: { 
          status: newStatus,
          progress: newStatus === 'achieved' ? 100 : currentProgress
        } 
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey(queryParams) });
          // If status changes to achieved, it affects progress, which might be cached differently
          queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() }); 
        }
      }
    );
  };

  const handleProgressChange = (goalId: string, progress: number) => {
    updateGoal.mutate(
      { goalId, data: { progress } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey(queryParams) });
        }
      }
    );
  };

  let filteredGoals = goals || [];
  
  if (clientFilter !== "all") {
    filteredGoals = filteredGoals.filter(g => g.clientId === clientFilter);
  }
  
  if (search) {
    filteredGoals = filteredGoals.filter(g => 
      g.title.toLowerCase().includes(search.toLowerCase()) || 
      (g.clientName && g.clientName.toLowerCase().includes(search.toLowerCase()))
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight">Goals</h1>
          <p className="text-muted-foreground mt-1">Track training objectives across all clients.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="Search goals..." 
              className="pl-9 bg-background shadow-sm border-border/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="achieved">Achieved</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[180px] bg-background">
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
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-[200px] w-full rounded-xl" />
            ))}
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="text-center py-20 px-4 bg-muted/20 rounded-xl border border-dashed border-border/50">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-serif font-medium text-foreground mb-1">No goals found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {search || statusFilter !== "all" || clientFilter !== "all" 
                ? "Try adjusting your filters to find what you're looking for." 
                : "Goals are created from individual client profiles."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGoals.map(goal => (
              <Card key={goal.id} className={`shadow-sm border-border/50 transition-colors ${goal.status === 'achieved' ? 'bg-muted/20' : 'bg-card'}`}>
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs font-normal capitalize ${
                        goal.status === 'active' ? 'bg-primary/10 text-primary border-primary/20' : 
                        goal.status === 'achieved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                        'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      {goal.status}
                    </Badge>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2 text-muted-foreground hover:text-foreground">
                          <MoreHorizontal size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                        <DropdownMenuItem 
                          disabled={goal.status === 'active'}
                          onClick={() => handleStatusChange(goal.id, 'active', goal.progress)}
                        >
                          Mark Active
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          disabled={goal.status === 'achieved'}
                          onClick={() => handleStatusChange(goal.id, 'achieved', goal.progress)}
                        >
                          <CheckCircle2 size={14} className="mr-2 text-blue-600" /> Mark Achieved
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          disabled={goal.status === 'paused'}
                          onClick={() => handleStatusChange(goal.id, 'paused', goal.progress)}
                        >
                          Pause Goal
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Update Progress</DropdownMenuLabel>
                        {[0, 25, 50, 75, 100].map(val => (
                          <DropdownMenuItem 
                            key={val}
                            disabled={goal.progress === val}
                            onClick={() => handleProgressChange(goal.id, val)}
                          >
                            Set to {val}%
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <Link href={`/clients/${goal.clientId}`}>
                    <h3 className="font-serif font-medium text-lg leading-tight mb-1 hover:text-primary transition-colors cursor-pointer">
                      {goal.title}
                    </h3>
                  </Link>
                  
                  {goal.clientName && (
                    <Link href={`/clients/${goal.clientId}`}>
                      <p className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-4">
                        For: {goal.clientName}
                      </p>
                    </Link>
                  )}
                  
                  <div className="mt-auto pt-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Progress</span>
                      <span className="font-medium text-foreground">{goal.progress}%</span>
                    </div>
                    <Progress 
                      value={goal.progress} 
                      className={`h-2 bg-muted ${goal.status === 'achieved' ? '[&>div]:bg-blue-500' : '[&>div]:bg-primary'}`} 
                    />
                    
                    {goal.targetDate && goal.status !== 'achieved' && (
                      <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground border-t border-border/50 pt-3">
                        <Calendar size={13} className="opacity-70" /> 
                        <span>Target: {format(parseISO(goal.targetDate), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}