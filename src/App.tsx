import '@xyflow/react/dist/style.css';
import { ReactFlowProvider } from '@xyflow/react';
import { Studio } from './components/Studio';

export default function App() {
  return (
    <ReactFlowProvider>
      <Studio />
    </ReactFlowProvider>
  );
}
