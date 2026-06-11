import { Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import DashboardPage from '@/app/dashboard/page';
import TrainsPage from '@/app/trains/page';
import PlatformsPage from '@/app/platforms/page';
import RoutesPage from '@/app/routes/page';
import SignalsPage from '@/app/signals/page';
import ConflictsPage from '@/app/conflicts/page';
import DelaysPage from '@/app/delays/page';
import AgentsPage from '@/app/agents/page';
import AnalyticsPage from '@/app/analytics/page';
import SettingsPage from '@/app/settings/page';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/trains" element={<TrainsPage />} />
        <Route path="/platforms" element={<PlatformsPage />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/signals" element={<SignalsPage />} />
        <Route path="/conflicts" element={<ConflictsPage />} />
        <Route path="/delays" element={<DelaysPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
