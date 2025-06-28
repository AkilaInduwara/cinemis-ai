import React from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import "./App.css"
import MainLayout from './Components/MainLayout';
import StartPage from './pages/StartPage'
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import HomePage from './pages/HomePage';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<StartPage />} />
          <Route path="login" element={<LoginPage />} />
           <Route path="signup" element={<SignupPage />} />
           <Route path="home" element={<HomePage />} />
          {/* Add other routes here */}
        </Route>
      </Routes>
    </Router>
  )
}

export default App


