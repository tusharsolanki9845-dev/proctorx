import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminWorkspace from "./pages/AdminWorkspace";
import AttemptReview from "./pages/AttemptReview";
import AccountHelp from "./pages/AccountHelp";
import Downloads from "./pages/Downloads";
import AuthPage from "./pages/AuthPage";
import ExamConsole from "./pages/ExamConsole";
import Home from "./pages/Home";
import IdentityDirectory from "./pages/IdentityDirectory";
import NotFound from "./pages/NotFound";
import ResultPage from "./pages/ResultPage";
import ReportLibrary from "./pages/ReportLibrary";
import ResetPassword from "./pages/ResetPassword";
import StudentDashboard from "./pages/StudentDashboard";
import StudentSignUp from "./pages/StudentSignUp";
import SupportDesk from "./pages/SupportDesk";
import VerifyEmail from "./pages/VerifyEmail";

function Router() { return <Switch><Route path="/" component={Home} /><Route path="/downloads" component={Downloads} /><Route path="/signin" component={AuthPage} /><Route path="/signup" component={StudentSignUp} /><Route path="/account-help" component={AccountHelp} /><Route path="/verify-email" component={VerifyEmail} /><Route path="/reset-password" component={ResetPassword} /><Route path="/dashboard" component={StudentDashboard} /><Route path="/reports" component={ReportLibrary} /><Route path="/exam/:attemptId" component={ExamConsole} /><Route path="/result/:attemptId" component={ResultPage} /><Route path="/admin/attempt/:attemptId" component={AttemptReview} /><Route path="/admin/support" component={SupportDesk} /><Route path="/admin/identities" component={IdentityDirectory} /><Route path="/admin/results" component={AdminWorkspace} /><Route path="/admin" component={AdminWorkspace} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster theme="dark" richColors /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
