import StateScreen from '../components/StateScreen.jsx';
import Button from '../components/ui/Button.jsx';

export default function NotFound() {
  return (
    <main className="main">
      <StateScreen icon="search" title={<>Page <em>not found</em></>} message="Flatline. There is nothing at this address.">
        <Button to="/">Back to home</Button>
      </StateScreen>
    </main>
  );
}
