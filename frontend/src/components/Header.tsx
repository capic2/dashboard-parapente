import { Link } from '@tanstack/react-router';

interface HeaderProps {
  title?: string;
}

export default function Header({ title = '🪂 Tableau de Bord Parapente' }: HeaderProps) {
  return (
    <header className="bg-white rounded-xl p-4 mb-4 shadow-lg flex justify-between items-center flex-wrap gap-2.5">
      <h1 className="text-2xl sm:text-xl text-sky-600 font-semibold flex-1 min-w-[200px] m-0">
        {title}
      </h1>
      <nav className="flex gap-2 flex-wrap items-center w-full sm:w-auto justify-center sm:justify-start">
        <Link
          to="/"
          className="px-3.5 py-2 rounded-md text-gray-600 text-sm transition-all hover:bg-gray-100 hover:text-sky-600 [&.active]:bg-sky-600 [&.active]:text-white"
        >
          Dashboard
        </Link>
        <Link
          to="/flights"
          className="px-3.5 py-2 rounded-md text-gray-600 text-sm transition-all hover:bg-gray-100 hover:text-sky-600 [&.active]:bg-sky-600 [&.active]:text-white"
        >
          Vols
        </Link>
        <Link
          to="/analytics"
          className="px-3.5 py-2 rounded-md text-gray-600 text-sm transition-all hover:bg-gray-100 hover:text-sky-600 [&.active]:bg-sky-600 [&.active]:text-white"
        >
          Analyses
        </Link>
        <Link
          to="/thermal"
          className="px-3.5 py-2 rounded-md text-gray-600 text-sm transition-all hover:bg-gray-100 hover:text-purple-600 [&.active]:bg-purple-600 [&.active]:text-white"
        >
          🌡️ Thermique
        </Link>
        <Link
          to="/sites"
          className="px-3.5 py-2 rounded-md text-gray-600 text-sm transition-all hover:bg-gray-100 hover:text-sky-600 [&.active]:bg-sky-600 [&.active]:text-white"
        >
          Sites
        </Link>
        <Link
          to="/settings"
          className="px-3.5 py-2 rounded-md text-gray-600 text-sm transition-all hover:bg-gray-100 hover:text-sky-600 [&.active]:bg-sky-600 [&.active]:text-white"
        >
          Paramètres
        </Link>
        <a
          href="http://portainer.local:9000"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-md bg-cyan-500 text-white text-xs font-medium transition-all hover:bg-cyan-600 hover:-translate-y-0.5 no-print"
          title="Portainer"
        >
          🐳 Portainer
        </a>
      </nav>
    </header>
  );
}
