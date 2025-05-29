import React from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./Pages/LoginPage.jsx";
import SignUp from './pages/SignUp.jsx';
import MainPage from './pages/MainPage.jsx';

function App() {
    return (
     
        <Router>
            <Routes>
                <Route path="/" element={<HomePage />} />  
                <Route path="/login" element={<LoginPage />} /> 
                <Route path="/signup" element={<SignUp />} />  
                <Route path="/main" element={<MainPage />} />  
                {/* Add more routes here as needed */}
            </Routes>
        </Router>
    
  )
}

export default App
