import React, { useState, useMemo, useEffect } from 'react';
import ShadowStage from './components/ShadowStage';
import { AppState, AppMode, TargetShadow } from './types';
import { detectGesture } from './utils/gestureDetector';
import { Rabbit, Dog, RefreshCcw, CheckCircle2, Hand, VenetianMask } from 'lucide-react';

const TARGETS: TargetShadow[] = [
    {
        id: 'rabbit',
        name: 'The Bunny',
        icon: Rabbit,
        difficulty: 'Easy',
        description: 'Extend your Index and Middle fingers. Curl the others.',
        hint: 'Make a peace sign!',
    },
    {
        id: 'wolf',
        name: 'The Wolf',
        icon: Dog,
        difficulty: 'Medium',
        description: 'Lift your pinky and index finger. Curl the middle ones. Keep your thumb up!',
        hint: 'Like a "Rock On" sign.',
    },
    {
        id: 'deer',
        name: 'The Stag',
        icon: VenetianMask, // Placeholder for antlers
        difficulty: 'Easy',
        description: 'Spread all 5 fingers wide and turn your hand sideways.',
        hint: 'Open your hand fully.',
    }
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [mode, setMode] = useState<AppMode>(AppMode.LIVE_SHOW);
  
  // Learn Mode State
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [isMatched, setIsMatched] = useState(false);
  const [detectedGesture, setDetectedGesture] = useState<string | null>(null);

  const currentTarget = TARGETS[currentTargetIndex];

  const handleNextTarget = () => {
    setIsMatched(false);
    setCurrentTargetIndex((prev) => (prev + 1) % TARGETS.length);
  };

  const handleLandmarks = (landmarks: any[]) => {
    if (mode !== AppMode.LEARN) return;

    const gesture = detectGesture(landmarks);
    setDetectedGesture(gesture);

    if (gesture === currentTarget.id) {
        setIsMatched(true);
    } else {
        setIsMatched(false); // Or keep it true if we want sticky success
    }
  };

  // Effect to auto-advance or sound effect on match?
  // For now, just visual feedback is fine.

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col bg-neutral-900">
      {/* Top Navigation Bar */}
      <div className="h-16 bg-neutral-950 border-b border-white/10 flex items-center justify-between px-6 z-50 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white font-cinzel font-bold shadow-[0_0_15px_rgba(245,158,11,0.5)]">L</div>
             <span className="text-white font-cinzel text-lg tracking-widest">LUMINA</span>
          </div>

          <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
             <button 
                onClick={() => setMode(AppMode.LIVE_SHOW)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${mode === AppMode.LIVE_SHOW ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
             >
                Live Show
             </button>
             <button 
                onClick={() => setMode(AppMode.LEARN)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${mode === AppMode.LEARN ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
             >
                Learn Puppets
             </button>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
          
          {/* LEARN MODE: LEFT PANEL */}
          {mode === AppMode.LEARN && (
             <div className="w-1/2 bg-neutral-900 text-white p-8 flex flex-col items-center justify-center border-r border-white/10 relative overflow-y-auto">
                 
                 <div className="max-w-md w-full text-center space-y-8">
                    
                    {/* Header */}
                    <div>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-4 tracking-widest uppercase ${currentTarget.difficulty === 'Easy' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                            {currentTarget.difficulty}
                        </span>
                        <h2 className="text-4xl font-cinzel text-amber-50">{currentTarget.name}</h2>
                    </div>

                    {/* Icon / Visualization */}
                    <div className={`relative w-64 h-64 mx-auto rounded-full flex items-center justify-center border-4 transition-all duration-500 ${isMatched ? 'bg-green-900/20 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'bg-white/5 border-white/10'}`}>
                        <currentTarget.icon className={`w-32 h-32 transition-all duration-500 ${isMatched ? 'text-green-400 scale-110' : 'text-gray-500'}`} />
                        
                        {isMatched && (
                             <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full backdrop-blur-sm animate-in fade-in zoom-in">
                                 <CheckCircle2 className="w-20 h-20 text-green-400 drop-shadow-lg" />
                             </div>
                        )}
                    </div>

                    {/* Instructions */}
                    <div className="space-y-4 bg-white/5 p-6 rounded-xl border border-white/5">
                        <p className="text-lg font-lato text-gray-200">
                           {currentTarget.description}
                        </p>
                        <p className="text-sm text-amber-500/80 italic">
                            💡 Hint: {currentTarget.hint}
                        </p>
                    </div>

                    {/* Actions */}
                    <button 
                        onClick={handleNextTarget}
                        className="flex items-center justify-center gap-2 w-full py-4 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg font-bold text-gray-300 transition-all"
                    >
                        <RefreshCcw className="w-5 h-5" />
                        Try Another Shadow
                    </button>

                    {/* Debug / Feedback */}
                    {detectedGesture && detectedGesture !== currentTarget.id && (
                        <p className="text-xs text-gray-600 mt-4">
                            I see a <span className="text-gray-400 font-bold uppercase">{detectedGesture}</span> instead.
                        </p>
                    )}
                 </div>
             </div>
          )}

          {/* 3D STAGE: FULL or RIGHT PANEL */}
          <div className={`relative transition-all duration-500 ease-in-out h-full ${mode === AppMode.LEARN ? 'w-1/2' : 'w-full'}`}>
             <ShadowStage 
                mode={mode} 
                onStateChange={setState} 
                onLandmarksDetected={handleLandmarks}
            />
             
             {/* Learn Mode Stage Overlay */}
             {mode === AppMode.LEARN && (
                 <div className="absolute top-6 left-6 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 pointer-events-none">
                     <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${isMatched ? 'bg-green-500' : 'bg-red-500'}`}></div>
                         <span className="text-white/90 text-xs font-bold uppercase tracking-widest">Live Camera Feed</span>
                     </div>
                 </div>
             )}
          </div>

          {/* Live Mode Overlay Instructions (Original) */}
          {mode === AppMode.LIVE_SHOW && (state === AppState.READY || state === AppState.IDLE) && (
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
    </div>
  );
};

export default App;
