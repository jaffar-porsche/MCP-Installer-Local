import { useEffect, useState } from 'react';

import Wizard from './pages/wizard/Wizard';
import ControlPanel from './pages/panel/ControlPanel';
import BrandFrame from './components/BrandFrame';

type Route = 'wizard' | 'panel';

function readInitialRoute(): Route {
  // Preferred: `#/wizard` or `#/panel` set by the main process when loading.
  const hash = window.location.hash.replace('#/', '').replace('#', '');
  if (hash === 'wizard' || hash === 'panel') return hash;
  return 'panel';
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => readInitialRoute());

  useEffect(() => {
    const onHash = () => setRoute(readInitialRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <BrandFrame variant={route === 'wizard' ? 'wizard' : 'panel'}>
      {route === 'wizard' ? <Wizard /> : <ControlPanel />}
    </BrandFrame>
  );
}
