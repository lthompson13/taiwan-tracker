import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Legislators from './pages/Legislators';
import LegislatorDetail from './pages/LegislatorDetail';
import Bills from './pages/Bills';
import BillDetail from './pages/BillDetail';
import Interpellations from './pages/Interpellations';
import Committees from './pages/Committees';
import Activity from './pages/Activity';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="legislators" element={<Legislators />} />
          <Route path="legislators/:name" element={<LegislatorDetail />} />
          <Route path="bills" element={<Bills />} />
          <Route path="bills/:id" element={<BillDetail />} />
          <Route path="interpellations" element={<Interpellations />} />
          <Route path="committees" element={<Committees />} />
          <Route path="activity" element={<Activity />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
