import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './lib/tauri-bridge' // Initialize Tauri bridge

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
