import React, { useState } from 'react';
import ShadowStage from './components/ShadowStage';
import { AppState } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);

  return (
    <div className="w-full h-screen overflow-hidden">
      <ShadowStage onStateChange={setState} />
      
      {/* Instructions overlay if Idle or Ready */}
      {(state === AppState.READY || state === AppState.IDLE) && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-30 pointer-events-none max-w-md w-full">
            <p className="text-amber-100/40 text-lg font-lato italic mb-2">
                "Where shadows come to life..."
            </p>
            {state === AppState.READY && (
                <div className="bg-black/40 backdrop-blur-sm p-6 rounded-lg border border-white/5">
                    <h3 className="text-amber-500 font-bold mb-2 uppercase tracking-widest text-sm">Instructions</h3>
                    <ul className="text-gray-300 text-sm space-y-2 text-left list-disc list-inside">
                        <li>Stand back from the camera.</li>
                        <li>Hold your hands up to cast shadows.</li>
                        <li>Press <strong>Start Show</strong> to enable the AI Narrator.</li>
                        <li>Make shapes (birds, wolves) and listen to the story!</li>
                    </ul>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default App;