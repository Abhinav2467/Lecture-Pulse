import { Link, NavLink } from 'react-router-dom';
import PulseLine from './PulseLine.jsx';

export default function Header() {
  return (
    <header className="header">
      <Link to="/" className="brand">
        <span>Lecture Pulse</span>
        <PulseLine />
      </Link>
      <nav className="nav" aria-label="Main">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/history">History</NavLink>
      </nav>
    </header>
  );
}
