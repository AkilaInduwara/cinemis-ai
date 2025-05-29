import React from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./Pages/LoginPage.jsx";

function App() {
    return (
     
        <Router>
            <Routes>
                <Route path="/" element={<HomePage />} />  
                <Route path="/login" element={<LoginPage />} />  
                {/* Add more routes here as needed */}
            </Routes>
        </Router>
    
  )
}

export default App
