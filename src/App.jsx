import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from './hooks.js'
import { Loading } from './components/ui.jsx'
import Home from './screens/Home.jsx'
import Bucket from './screens/Bucket.jsx'
import PaycheckForm from './screens/PaycheckForm.jsx'
import PaycheckList from './screens/PaycheckList.jsx'
import QuickAdd from './screens/QuickAdd.jsx'
import Split from './screens/Split.jsx'
import ItemForm from './screens/ItemForm.jsx'
import Activity from './screens/Activity.jsx'
import Settings from './screens/Settings.jsx'
import LinesEditor from './screens/LinesEditor.jsx'
import Presets from './screens/Presets.jsx'
import RecurringList from './screens/RecurringList.jsx'
import RecurringForm from './screens/RecurringForm.jsx'
import Setup from './screens/Setup.jsx'

// Sample-data seeding only exists in local development builds.
const DevSeed = import.meta.env.DEV ? lazy(() => import('./dev/Seed.jsx')) : null

const SETUP_FREE = ['/setup', '/dev/seed']

export default function App() {
  const settings = useSettings()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (settings && !settings.setupDone && !SETUP_FREE.includes(location.pathname)) {
      navigate('/setup', { replace: true })
    }
  }, [settings, location.pathname, navigate])

  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

  if (!settings) return <Loading />

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/bucket/:bucket" element={<Bucket />} />
      <Route path="/paychecks" element={<PaycheckList />} />
      <Route path="/paycheck/new" element={<PaycheckForm />} />
      <Route path="/paycheck/:id/edit" element={<PaycheckForm />} />
      <Route path="/add" element={<QuickAdd />} />
      <Route path="/split/:id" element={<Split />} />
      <Route path="/item/new" element={<ItemForm />} />
      <Route path="/item/:id" element={<ItemForm />} />
      <Route path="/activity" element={<Activity />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/settings/lines/:type" element={<LinesEditor />} />
      <Route path="/settings/presets" element={<Presets />} />
      <Route path="/settings/recurring" element={<RecurringList />} />
      <Route path="/settings/recurring/:id" element={<RecurringForm />} />
      {DevSeed && (
        <Route path="/dev/seed" element={<Suspense fallback={<Loading />}><DevSeed /></Suspense>} />
      )}
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
