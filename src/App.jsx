import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx'; 
import Formulario from './pages/Formulario.jsx';
import Tabela from './pages/Tabela.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/novo" element={<Formulario />} />
        <Route path="/editar/:id" element={<Formulario />} />
        <Route path="/tabela" element={<Tabela />} />
      </Routes>
    </Router>
  );
}

export default App;