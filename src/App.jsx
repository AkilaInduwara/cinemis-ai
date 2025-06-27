import React from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import "./App.css"
import MainLayout from './Components/MainLayout';
import StartPage from './pages/StartPage'
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<StartPage />} />
          <Route path="login" element={<LoginPage />} />
           <Route path="signup" element={<SignupPage />} />
          {/* Add other routes here */}
        </Route>
      </Routes>
    </Router>
  )
}

export default App


