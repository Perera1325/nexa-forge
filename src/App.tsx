import { lazy, Suspense } from 'react';
import { useRoute } from './router';
import { Docs } from './site/Docs';
import { Landing } from './site/Landing';
import { NotFound } from './site/NotFound';

const StudioRoute = lazy(() => import('./StudioRoute'));

export default function App() {
  const route = useRoute();
  if (route === 'studio') {
    return (
      <Suspense fallback={<div className="route-loading" role="status">Loading Studio…</div>}>
        <StudioRoute />
      </Suspense>
    );
  }
  if (route === 'docs') return <Docs />;
  if (route === 'home') return <Landing />;
  return <NotFound />;
}
