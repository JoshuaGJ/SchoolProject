import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import SignupForm from "./registration/registration"
import Login from "./login/login.jsx"
import Dashboard from "./agentDashboard/dashboard.jsx"
import Searchdash from "./searchdash/searchdash.jsx"
import { ThemeProvider } from './ThemeContext';
function App() {

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Searchdash/>}/>
          <Route path="/login" element={<Login/>}/>
          <Route path="/signup" element={<SignupForm/>}/>
          
          <Route path='/dash' element={<Dashboard/>}/>
          <Route path="*" element={<div>404 — Page not found</div>} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
