import { Link } from 'react-router-dom';
import StateScreen from '../components/StateScreen.jsx';

export default function NotFound() {
  return (
    <StateScreen icon="🫥" title="Page not found" message="Flatline. There is nothing at this address.">
      <Link className="btn btn--primary" to="/">Back to home</Link>
    </StateScreen>
  );
}
