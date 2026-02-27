
import { Link } from '@tanstack/react-router';
import './Header.css';

interface HeaderProps {
  title?: string;
}

export default function Header({ title = '🪂 Tableau de Bord Parapente' }: HeaderProps) {
  return (
    <header className="header">
      <h1>{title}</h1>
      <nav className="nav">
        <Link to="/" className="nav-link">
          Dashboard
        </Link>
        <Link to="/flights" className="nav-link">
          Vols
        </Link>
        <Link to="/analytics" className="nav-link">
          Analyses
        </Link>
        <Link to="/settings" className="nav-link">
          Paramètres
        </Link>
        <a
          href="http://portainer.local:9000"
          target="_blank"
          rel="noopener noreferrer"
          className="portainer-badge"
          title="Portainer"
        >
          🐳 Portainer
        </a>
      </nav>
    </header>
  );
}
