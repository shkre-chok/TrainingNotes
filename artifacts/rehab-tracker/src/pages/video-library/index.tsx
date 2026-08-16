import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Pencil, Trash2, Video, ExternalLink, Tag, Search } from "lucide-react";
import {
  useListVideoLibrary, getListVideoLibraryQueryKey,
  useCreateVideoLibraryItem,
  useUpdateVideoLibraryItem,
  useDeleteVideoLibraryItem,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
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

const videoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  url: z.string().url("Must be a valid URL"),
  tagsRaw: z.string().optional(), // comma-separated
});

type VideoFormValues = z.infer<typeof videoSchema>;

function parseTags(raw: string | undefined) {
  return (raw ?? "").split(",").map(t => t.trim()).filter(Boolean);
}

function VideoDialog({
  open, onClose, onSave, defaultValues, isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (v: VideoFormValues) => void;
  defaultValues?: Partial<VideoFormValues>;
  isPending?: boolean;
}) {
  const form = useForm<VideoFormValues>({
    resolver: zodResolver(videoSchema),
    defaultValues: { title: "", url: "", description: "", tagsRaw: "", ...defaultValues },
  });

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="font-serif">{defaultValues?.title ? "Edit Video" : "Add Video"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4 pt-2">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl><Input placeholder="e.g. Knee extension technique" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="url" render={({ field }) => (
              <FormItem>
                <FormLabel>Video URL</FormLabel>
                <FormControl><Input placeholder="https://youtube.com/watch?v=…" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description (optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="What does this video demonstrate?" className="min-h-[72px]" {...field} />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="tagsRaw" render={({ field }) => (
              <FormItem>
                <FormLabel>Tags (optional, comma-separated)</FormLabel>
                <FormControl><Input placeholder="knee, strength, beginner" {...field} /></FormControl>
                <p className="text-xs text-muted-foreground">Used to filter in the exercise picker</p>
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save Video"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function VideoLibraryPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [search, setSearch] = useState("");

  const { data: videos, isLoading } = useListVideoLibrary({
    query: { queryKey: getListVideoLibraryQueryKey() },
  });

  const createVideo = useCreateVideoLibraryItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListVideoLibraryQueryKey() });
        setAddOpen(false);
        toast({ title: "Video added ✓" });
      },
    },
  });

  const updateVideo = useUpdateVideoLibraryItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListVideoLibraryQueryKey() });
        setEditItem(null);
      },
    },
  });

  const deleteVideo = useDeleteVideoLibraryItem({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListVideoLibraryQueryKey() }),
    },
  });

  const filtered = (videos ?? []).filter(v => {
    if (!search) return true;
    const q = search.toLowerCase();
    return v.title.toLowerCase().includes(q) ||
      (v.description ?? "").toLowerCase().includes(q) ||
      (v.tags as string[]).some(t => t.toLowerCase().includes(q));
  });

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-medium text-foreground">Video Library</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Save exercise videos here and attach them to homework exercises.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)} className="shadow-sm">
            <Plus size={16} className="mr-1.5" /> Add Video
          </Button>
        </div>

        {/* Search */}
        {(videos?.length ?? 0) > 0 && (
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by title, description, or tag…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border/50">
            <Video className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            {search ? (
              <p className="text-muted-foreground">No videos match "{search}"</p>
            ) : (
              <>
                <h3 className="text-lg font-medium text-foreground mb-1">No videos yet</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Add YouTube, Vimeo, or any video links. Then attach them to exercises in homework programs.
                </p>
                <Button onClick={() => setAddOpen(true)}>Add First Video</Button>
              </>
            )}
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(video => (
            <Card key={video.id} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-foreground text-base leading-snug line-clamp-2 flex-1">
                    {video.title}
                  </h3>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                      onClick={() => setEditItem(video)}>
                      <Pencil size={13} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete "${video.title}"?`))
                          deleteVideo.mutate({ videoId: video.id });
                      }}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>

                {video.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{video.description}</p>
                )}

                <div className="flex items-center justify-between mt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(video.tags as string[]).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[11px] font-normal py-0">
                        <Tag size={9} className="mr-1" />{tag}
                      </Badge>
                    ))}
                  </div>
                  <a href={video.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0 ml-2">
                    <ExternalLink size={12} /> Open
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Add dialog */}
      <VideoDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        isPending={createVideo.isPending}
        onSave={v => createVideo.mutate({
          data: { title: v.title, url: v.url, description: v.description || null, tags: parseTags(v.tagsRaw) },
        })}
      />

      {/* Edit dialog */}
      {editItem && (
        <VideoDialog
          open={!!editItem}
          onClose={() => setEditItem(null)}
          isPending={updateVideo.isPending}
          defaultValues={{
            title: editItem.title,
            url: editItem.url,
            description: editItem.description ?? "",
            tagsRaw: (editItem.tags as string[]).join(", "),
          }}
          onSave={v => updateVideo.mutate({
            videoId: editItem.id,
            data: { title: v.title, url: v.url, description: v.description || null, tags: parseTags(v.tagsRaw) },
          })}
        />
      )}
    </AppLayout>
  );
}
