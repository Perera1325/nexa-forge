import '@xyflow/react/dist/style.css';
import { ReactFlowProvider } from '@xyflow/react';
import { Studio } from './components/Studio';
import { useTitle } from './router';

/** The unchanged Studio editor, mounted at /studio. Loaded lazily so the public pages do not download the editor. */
export default function StudioRoute() {
  useTitle('Studio · NEXA Forge');
  return (
    <ReactFlowProvider>
      <Studio />
    </ReactFlowProvider>
  );
}
