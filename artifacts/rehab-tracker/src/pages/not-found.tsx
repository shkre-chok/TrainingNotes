import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-4xl font-serif font-medium tracking-tight text-foreground mb-2">Page Not Found</h1>
        <p className="text-muted-foreground max-w-md mb-8 text-lg">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/">
          <Button size="lg" className="font-medium">
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </AppLayout>
  );
}
