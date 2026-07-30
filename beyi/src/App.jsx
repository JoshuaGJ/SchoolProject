import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import SignupForm from "./registration/registration"
import Login from "./login/login.jsx"
import Dashboard from "./agentDashboard/dashboard.jsx"
import Searchdash from "./searchdash/searchdash.jsx"
import AnalyticsPage from "./analytics/AnalyticsPage.jsx"
import { ThemeProvider } from './ThemeContext';
import ProfileDash from './profile/profileDash.jsx';
import Home from './home/home.jsx';
function App() {

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/home" element={<Searchdash/>}/>
          <Route path="/analytics" element={<AnalyticsPage/>}/>
          <Route path="/login" element={<Login/>}/>
          <Route path="/signup" element={<SignupForm/>}/>
          <Route path="/profile" element={<ProfileDash/>}/>
          <Route path='/dash' element={<Dashboard/>}/>
          <Route path="*" element={<div>404 — Page not found</div>} />
          <Route path="/landing" element={<Home/>} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
