import React from 'react';
import { createRoot } from 'react-dom/client';
import TrendsAnalysis from './components/TrendsAnalysis';

// Estilo global adicional si es necesario
import './styles.css';

// Componente principal de la aplicación
const App = () => {
  return (
    <div className="container mx-auto py-8">
      <TrendsAnalysis />
    </div>
  );
};

// Inicializar la aplicación React
const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);