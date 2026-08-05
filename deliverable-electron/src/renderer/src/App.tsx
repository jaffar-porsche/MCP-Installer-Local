import { useEffect, useState } from 'react';

import Wizard from './pages/wizard/Wizard';
import ControlPanel from './pages/panel/ControlPanel';
import RotatePat from './pages/rotate/RotatePat';
import BrandFrame from './components/BrandFrame';

type Route =
  | { kind: 'wizard' }
  | { kind: 'panel' }
  | { kind: 'rotate'; serverKey: string };

function readInitialRoute(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash === 'wizard') return { kind: 'wizard' };
  if (hash === 'panel') return { kind: 'panel' };
  if (hash.startsWith('rotate/')) {
    const serverKey = hash.slice('rotate/'.length).trim();
    if (serverKey) return { kind: 'rotate', serverKey };
  }
  return { kind: 'panel' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => readInitialRoute());

  useEffect(() => {
    const onHash = () => setRoute(readInitialRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <BrandFrame variant={route.kind === 'panel' ? 'panel' : 'wizard'}>
      {route.kind === 'wizard' ? <Wizard /> : route.kind === 'rotate' ? <RotatePat serverKey={route.serverKey} /> : <ControlPanel />}
    </BrandFrame>
  );
}
