import { Header } from '@/components/header';
import { CalendarView } from '@/components/calendar/calendar-view';
import { DailyView } from '@/components/daily/daily-view';
import { WeekView } from '@/components/daily/week-view';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useStore } from '@/store';

function AppContent() {
  const { currentView } = useStore();

  const renderView = () => {
    switch (currentView) {
      case 'day':
        return <DailyView />;
      case 'week':
        return <WeekView />;
      case 'month':
        return <CalendarView />;
      default:
        return <DailyView />;
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex flex-1 overflow-hidden">{renderView()}</main>
    </div>
  );
}

function App() {
  return (
    <TooltipProvider>
      <AppContent />
    </TooltipProvider>
  );
}

export default App;
