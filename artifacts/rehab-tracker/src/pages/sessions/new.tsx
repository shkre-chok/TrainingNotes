import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Clock, Activity, Zap, FileText } from "lucide-react";
import { 
  useListClients, getListClientsQueryKey,
  useCreateSession
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const sessionSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  title: z.string().optional(),
  sessionDate: z.string().min(1, "Date is required"),
  sessionTime: z.string().min(1, "Time is required"),
  durationMinutes: z.coerce.number().min(1).max(300).optional().or(z.literal("")),
  focusArea: z.string().optional(),
  painLevel: z.number().min(0).max(10).optional(),
  energyLevel: z.number().min(0).max(10).optional(),
  summary: z.string().optional(),
});

export default function NewSession() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const queryParams = new URLSearchParams(searchString);
  const prefillClientId = queryParams.get("client");
  
  const queryClient = useQueryClient();
  const [painEnabled, setPainEnabled] = useState(false);
  const [energyEnabled, setEnergyEnabled] = useState(false);

  const { data: clients, isLoading: isLoadingClients } = useListClients({
    query: { queryKey: getListClientsQueryKey() }
  });

  const createSession = useCreateSession({
    mutation: {
      onSuccess: (data) => {
        setLocation(`/sessions/${data.id}`);
      }
    }
  });

  const now = new Date();
  
  const form = useForm<z.infer<typeof sessionSchema>>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      clientId: prefillClientId || "",
      title: "",
      sessionDate: format(now, "yyyy-MM-dd"),
      sessionTime: format(now, "HH:mm"),
      durationMinutes: 60,
      focusArea: "",
      painLevel: 5,
      energyLevel: 5,
      summary: "",
    },
  });

  function onSubmit(values: z.infer<typeof sessionSchema>) {
    // Combine date and time
    const dateStr = `${values.sessionDate}T${values.sessionTime}:00`;
    const sessionDate = new Date(dateStr).toISOString();

    createSession.mutate({
      data: {
        clientId: values.clientId,
        title: values.title || undefined,
        sessionDate,
        durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : undefined,
        focusArea: values.focusArea || undefined,
        painLevel: painEnabled ? values.painLevel : undefined,
        energyLevel: energyEnabled ? values.energyLevel : undefined,
        summary: values.summary || undefined,
      }
    });
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="-ml-2 mb-4 text-muted-foreground hover:text-foreground"
            onClick={() => window.history.back()}
          >
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
          <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight">Log Session</h1>
          <p className="text-muted-foreground mt-1">Start a new training session or log a past one.</p>
        </div>

        <Card className="shadow-sm border-border/50">
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                
                {/* Client Selection */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">
                    Who & When
                  </h3>
                  
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingClients}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a client..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients?.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="sessionDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sessionTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="durationMinutes"
                      render={({ field }) => (
                        <FormItem className="col-span-2 md:col-span-1">
                          <FormLabel>Duration (min)</FormLabel>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <FormControl>
                              <Input type="number" placeholder="60" className="pl-9" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Session Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">
                    Session Focus
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="E.g. Phase 2 Assessment" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="focusArea"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Focus Area (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="E.g. Knee extension, core stability" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Vitals */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">
                    Client State
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity size={16} className="text-amber-500" />
                          <Label className="mb-0">Pain Level (0-10)</Label>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => setPainEnabled(!painEnabled)}
                        >
                          {painEnabled ? "Clear" : "Record"}
                        </Button>
                      </div>
                      
                      {painEnabled && (
                        <FormField
                          control={form.control}
                          name="painLevel"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <div className="space-y-3 pt-2">
                                  <Slider
                                    value={[field.value || 0]}
                                    max={10}
                                    step={1}
                                    onValueChange={(vals) => field.onChange(vals[0])}
                                    className="[&>span:first-child]:bg-amber-200 dark:[&>span:first-child]:bg-amber-900/50 [&_[role=slider]]:border-amber-500 [&_[role=slider]]:bg-amber-50"
                                  />
                                  <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                    <span>0 (None)</span>
                                    <span className="text-foreground text-sm bg-background px-2 py-0.5 rounded shadow-sm border border-border/50">{field.value}</span>
                                    <span>10 (Severe)</span>
                                  </div>
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap size={16} className="text-blue-500" />
                          <Label className="mb-0">Energy Level (0-10)</Label>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => setEnergyEnabled(!energyEnabled)}
                        >
                          {energyEnabled ? "Clear" : "Record"}
                        </Button>
                      </div>
                      
                      {energyEnabled && (
                        <FormField
                          control={form.control}
                          name="energyLevel"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <div className="space-y-3 pt-2">
                                  <Slider
                                    value={[field.value || 0]}
                                    max={10}
                                    step={1}
                                    onValueChange={(vals) => field.onChange(vals[0])}
                                    className="[&>span:first-child]:bg-blue-200 dark:[&>span:first-child]:bg-blue-900/50 [&_[role=slider]]:border-blue-500 [&_[role=slider]]:bg-blue-50"
                                  />
                                  <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                    <span>0 (Exhausted)</span>
                                    <span className="text-foreground text-sm bg-background px-2 py-0.5 rounded shadow-sm border border-border/50">{field.value}</span>
                                    <span>10 (High)</span>
                                  </div>
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <FileText size={16} /> Pre-session Notes (Optional)
                        </FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any goals for today's session? You can add structured notes during the session." 
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          You'll be taken to the session view next where you can rapidly capture observations.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => window.history.back()}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createSession.isPending}
                    className="min-w-[140px]"
                  >
                    {createSession.isPending ? "Creating..." : "Create & Start Session"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}