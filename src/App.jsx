import React from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import HomePage from "./pages/HomePage.jsx"

function App() {
    return (
     
        <Router>
            <Routes>
                <Route path="/" element={<HomePage />} />
                {/* Add more routes here as needed */}
            </Routes>
        </Router>
    
  )
}

export default App
