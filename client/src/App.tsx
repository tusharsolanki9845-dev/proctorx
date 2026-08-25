import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminWorkspace from "./pages/AdminWorkspace";
import AttemptReview from "./pages/AttemptReview";
import ExamConsole from "./pages/ExamConsole";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import ResultPage from "./pages/ResultPage";
import StudentDashboard from "./pages/StudentDashboard";

function Router() { return <Switch><Route path="/" component={Home} /><Route path="/dashboard" component={StudentDashboard} /><Route path="/exam/:attemptId" component={ExamConsole} /><Route path="/result/:attemptId" component={ResultPage} /><Route path="/admin/attempt/:attemptId" component={AttemptReview} /><Route path="/admin/results" component={AdminWorkspace} /><Route path="/admin" component={AdminWorkspace} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster theme="dark" richColors /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
