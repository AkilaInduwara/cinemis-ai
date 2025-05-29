import React from 'react';
import { FaSearch } from 'react-icons/fa';
import '../css/MainPage.css';

const MainPage = () => {
 const handleSearch = (e) => {
    e.preventDefault();
    const searchTerm = e.target.search.value;
    console.log('Searching for:', searchTerm);
    // Add your search logic here
  };

  return (
    <div className="main-container">
      <div className="main-content">
        <h1 className="main-title">CineMIS AI</h1>
        <p className="main-subtitle">Find your Movie with us</p>
        
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-container">
            <input
              type="text"
              name="search"
              placeholder="Search"
              className="search-input"
            />
            <button type="submit" className="search-button">
              <FaSearch className="search-icon" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MainPage
