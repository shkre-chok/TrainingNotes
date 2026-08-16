import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients/index";
import ClientDetail from "@/pages/clients/detail";
import Goals from "@/pages/goals/index";
import Sessions from "@/pages/sessions/index";
import SessionDetail from "@/pages/sessions/detail";
import NewSession from "@/pages/sessions/new";
import Vocabulary from "@/pages/vocabulary/index";
import VideoLibrary from "@/pages/video-library/index";
import HomeworkView from "@/pages/homework/view";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:clientId" component={ClientDetail} />
      <Route path="/goals" component={Goals} />
      <Route path="/sessions" component={Sessions} />
      <Route path="/sessions/new" component={NewSession} />
      <Route path="/sessions/:sessionId" component={SessionDetail} />
      <Route path="/vocabulary" component={Vocabulary} />
      <Route path="/video-library" component={VideoLibrary} />
      <Route path="/homework/:token" component={HomeworkView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
