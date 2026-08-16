import { useState } from "react";
import { Link, useParams } from "wouter";
import { format, parseISO } from "date-fns";
import { 
  useGetClient, getGetClientQueryKey,
  useListGoals, getListGoalsQueryKey,
  useListSessions, getListSessionsQueryKey,
  useCreateGoal
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  ArrowLeft, UserCircle, Calendar, Target, Activity, 
  Plus, Edit3, Clock, TrendingUp, Phone, Mail, BookOpen
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { HomeworkTab } from "@/components/homework/HomeworkTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const goalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  targetDate: z.string().optional(),
});

export default function ClientDetail() {
  const params = useParams();
  const clientId = params.clientId || "";
  const queryClient = useQueryClient();
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);

  const { data: client, isLoading: isLoadingClient } = useGetClient(clientId, {
    query: { enabled: !!clientId, queryKey: getGetClientQueryKey(clientId) }
  });

  const { data: goals, isLoading: isLoadingGoals } = useListGoals({ clientId }, {
    query: { enabled: !!clientId, queryKey: getListGoalsQueryKey({ clientId }) }
  });

  const { data: sessions, isLoading: isLoadingSessions } = useListSessions({ clientId }, {
    query: { enabled: !!clientId, queryKey: getListSessionsQueryKey({ clientId }) }
  });

  const createGoal = useCreateGoal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey({ clientId }) });
        setIsGoalDialogOpen(false);
        form.reset();
      }
    }
  });

  const form = useForm<z.infer<typeof goalSchema>>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      targetDate: "",
    },
  });

  function onSubmit(values: z.infer<typeof goalSchema>) {
    createGoal.mutate({
      data: {
        clientId,
        title: values.title,
        description: values.description,
        category: values.category,
        targetDate: values.targetDate ? new Date(values.targetDate).toISOString() : undefined,
        status: "active",
        progress: 0
      }
    });
  }

  if (isLoadingClient) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <div className="flex gap-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-4 flex-1">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-6 w-1/4" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-serif mb-2">Client not found</h2>
          <Link href="/clients">
            <Button variant="outline">Back to Clients</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const activeGoals = goals?.filter(g => g.status === 'active') || [];
  const achievedGoals = goals?.filter(g => g.status === 'achieved') || [];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <Link href="/clients">
            <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft size={16} className="mr-1" /> Back to Clients
            </Button>
          </Link>
          
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
              <UserCircle className="h-12 w-12 md:h-14 md:w-14 text-primary/80" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground tracking-tight mb-1">{client.name}</h1>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {client.condition && (
                      <Badge variant="secondary" className="bg-secondary text-secondary-foreground font-normal">
                        {client.condition}
                      </Badge>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar size={14} className="opacity-70" />
                      Started {client.startDate ? format(parseISO(client.startDate), 'MMM d, yyyy') : format(parseISO(client.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="hidden sm:flex border-border/50">
                  <Edit3 size={14} className="mr-2" /> Edit Profile
                </Button>
              </div>
              
              {(client.phone || client.email) && (
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {client.phone && (
                    <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                      <Phone size={14} className="opacity-70" />
                      {client.phone}
                    </a>
                  )}
                  {client.email && (
                    <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                      <Mail size={14} className="opacity-70" />
                      {client.email}
                    </a>
                  )}
                </div>
              )}

              {client.notes && (
                <div className="mt-4 p-4 rounded-md bg-muted/30 border border-border/50 text-sm text-foreground/80 leading-relaxed">
                  {client.notes}
                </div>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
            <TabsTrigger value="sessions" className="font-medium">Sessions</TabsTrigger>
            <TabsTrigger value="goals" className="font-medium">Goals ({goals?.length || 0})</TabsTrigger>
            <TabsTrigger value="homework" className="font-medium"><BookOpen size={14} className="mr-1.5" />Homework</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sessions" className="mt-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-serif font-medium">Session History</h2>
              <Link href={`/sessions/new?client=${clientId}`}>
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus size={16} className="mr-1.5" /> Log Session
                </Button>
              </Link>
            </div>
            
            {isLoadingSessions ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : sessions?.length === 0 ? (
              <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border/50">
                <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <h3 className="text-lg font-medium text-foreground mb-1">No sessions yet</h3>
                <p className="text-muted-foreground mb-6 text-sm">Start tracking progress by logging your first session.</p>
                <Link href={`/sessions/new?client=${clientId}`}>
                  <Button>Log First Session</Button>
                </Link>
              </div>
            ) : (
              <div className="relative border-l-2 border-muted ml-3 pl-6 space-y-8">
                {sessions?.map((session) => (
                  <div key={session.id} className="relative">
                    <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                    
                    <Link href={`/sessions/${session.id}`}>
                      <Card className="hover:border-primary/40 transition-colors shadow-sm border-border/50 cursor-pointer group">
                        <CardContent className="p-5">
                          <div className="flex justify-between items-start gap-4 mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-serif font-medium text-lg group-hover:text-primary transition-colors">
                                  {session.title || format(parseISO(session.sessionDate), 'EEEE, MMMM d')}
                                </h3>
                                {session.durationMinutes && (
                                  <Badge variant="outline" className="text-xs font-normal border-border/50">
                                    <Clock size={12} className="mr-1" /> {session.durationMinutes} min
                                  </Badge>
                                )}
                              </div>
                              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <Calendar size={14} />
                                {format(parseISO(session.sessionDate), 'h:mm a')}
                              </span>
                            </div>
                            
                            {(session.painLevel !== undefined && session.painLevel !== null) && (
                              <div className="text-right">
                                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Pain</div>
                                <div className={`text-sm font-medium px-2 py-0.5 rounded-md inline-block
                                  ${session.painLevel > 6 ? 'bg-destructive/10 text-destructive' : 
                                    session.painLevel > 3 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-500' : 
                                    'bg-primary/10 text-primary'}
                                `}>
                                  {session.painLevel} / 10
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {session.focusArea && (
                            <p className="text-sm text-foreground/80 mb-3"><span className="font-medium">Focus:</span> {session.focusArea}</p>
                          )}
                          
                          {session.summary && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-2 pt-2 border-t border-border/50">{session.summary}</p>
                          )}
                          
                          <div className="mt-4 flex gap-2">
                            <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted font-normal text-xs">
                              {session.noteCount || 0} Notes
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="goals" className="mt-6 space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-serif font-medium">Training Goals</h2>
              <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="border-border/50 shadow-sm">
                    <Plus size={16} className="mr-1.5" /> Add Goal
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-serif">Add New Goal</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Goal Title</FormLabel>
                            <FormControl>
                              <Input placeholder="E.g. Full knee extension" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Details about this goal..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <FormControl>
                                <Input placeholder="E.g. Mobility" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="targetDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Target Date (Optional)</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsGoalDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createGoal.isPending}>
                          {createGoal.isPending ? "Saving..." : "Save Goal"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            
            {isLoadingGoals ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[1, 2].map(i => <Skeleton key={i} className="h-40 w-full" />)}
              </div>
            ) : goals?.length === 0 ? (
              <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border/50">
                <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <h3 className="text-lg font-medium text-foreground mb-1">No goals set</h3>
                <p className="text-muted-foreground mb-6 text-sm">Define what success looks like for this client.</p>
                <Button onClick={() => setIsGoalDialogOpen(true)}>Create First Goal</Button>
              </div>
            ) : (
              <div className="space-y-8">
                {activeGoals.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Target size={14} /> Active Goals
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {activeGoals.map(goal => (
                        <GoalCard key={goal.id} goal={goal} />
                      ))}
                    </div>
                  </div>
                )}
                
                {achievedGoals.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Target size={14} /> Achieved Goals
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {achievedGoals.map(goal => (
                        <GoalCard key={goal.id} goal={goal} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="homework" className="mt-6">
            <HomeworkTab
              clientId={clientId}
              clientName={client.name}
              clientEmail={client.email}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function GoalCard({ goal }: { goal: any }) {
  const isAchieved = goal.status === 'achieved';
  
  return (
    <Card className={`shadow-sm border-border/50 transition-colors ${isAchieved ? 'bg-muted/30 opacity-80' : 'bg-card'}`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start gap-2 mb-3">
          <h4 className={`font-serif font-medium text-lg leading-tight ${isAchieved ? 'text-muted-foreground line-through decoration-muted-foreground/30' : 'text-foreground'}`}>
            {goal.title}
          </h4>
          {goal.category && (
            <Badge variant="outline" className="text-[10px] uppercase font-medium tracking-wider px-1.5 py-0">
              {goal.category}
            </Badge>
          )}
        </div>
        
        {goal.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{goal.description}</p>
        )}
        
        <div className="mt-auto">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Progress</span>
            <span className="font-medium text-foreground">{goal.progress}%</span>
          </div>
          <Progress 
            value={goal.progress} 
            className={`h-2 bg-muted ${isAchieved ? '[&>div]:bg-muted-foreground' : '[&>div]:bg-primary'}`} 
          />
          
          {goal.targetDate && !isAchieved && (
            <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar size={12} /> Target: {format(parseISO(goal.targetDate), 'MMM d, yyyy')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}