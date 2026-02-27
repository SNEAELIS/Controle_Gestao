import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx'; // Mude de .js para .jsx
// Se você não usa o reportWebVitals, pode comentar a linha abaixo
// import reportWebVitals from './reportWebVitals.js'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);