import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Legislators from './pages/Legislators';
import LegislatorDetail from './pages/LegislatorDetail';
import Bills from './pages/Bills';
import BillDetail from './pages/BillDetail';
import Committees from './pages/Committees';
import Activity from './pages/Activity';
import Watchlist from './pages/Watchlist';
import Hearings from './pages/Hearings';
import News from './pages/News';
import Admin from './pages/Admin';
import Upgrade from './pages/Upgrade';
import UpgradeSuccess from './pages/UpgradeSuccess';
import SignInPage from './pages/SignIn';
import SignUpPage from './pages/SignUp';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth pages — outside main layout (no sidebar) */}
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />

        {/* Full-page post-checkout — outside main layout */}
        <Route path="/upgrade/success" element={<UpgradeSuccess />} />

        {/* Main app */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="legislators" element={<Legislators />} />
          <Route path="legislators/:name" element={<LegislatorDetail />} />
          <Route path="bills" element={<Bills />} />
          <Route path="bills/:id" element={<BillDetail />} />
          <Route path="committees" element={<Committees />} />
          <Route path="activity" element={<Activity />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="hearings" element={<Hearings />} />
          <Route path="news" element={<News />} />
          <Route path="admin" element={<Admin />} />
          <Route path="upgrade" element={<Upgrade />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
