import React from 'react';
import { 
  MapPin, 
  Paintbrush, 
  CloudRain, 
  Play, 
  Sparkles, 
  ChevronRight, 
  CheckCircle2 
} from 'lucide-react';

const STEPS = [
  {
    id: 1,
    title: "1. Choose a Neighborhood",
    description: "Explore the live aerial map with roads, buildings, grass, and low-lying land.",
    icon: MapPin
  },
  {
    id: 2,
    title: "2. Choose a Proposed Change",
    description: "Use voice, text, or click presets: 'Replace this grassy area with a parking lot.'",
    icon: Paintbrush
  },
  {
    id: 3,
    title: "3. Select Weather Conditions",
    description: "Adjust storm rainfall: 'What if 50 mm of rain falls during a storm?'",
    icon: CloudRain
  },
  {
    id: 4,
    title: "4. Run Simulation & Ripple",
    description: "View runoff delta and see where additional water travels downhill.",
    icon: Play
  },
  {
    id: 5,
    title: "5. Compare Solutions",
    description: "Evaluate alternatives: permeable pavers, rain gardens, and 2026 Groundsource evidence.",
    icon: Sparkles
  }
];

export default function StepWizard({
  currentStep,
  onSelectStep
}) {
  return (
    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <button
              key={step.id}
              onClick={() => onSelectStep(step.id)}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                isActive
                  ? 'bg-cyan-950/60 border-cyan-500 ring-1 ring-cyan-400/40 text-white shadow-md shadow-cyan-950/40'
                  : isCompleted
                  ? 'bg-slate-950/90 border-slate-700/80 text-slate-300 hover:border-slate-600'
                  : 'bg-slate-950/50 border-slate-800/80 text-slate-500 hover:text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`p-1.5 rounded-lg ${
                  isActive ? 'bg-cyan-500 text-white' : isCompleted ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-slate-800 text-slate-400'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                {isCompleted && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold truncate">{step.title}</div>
                <div className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">
                  {step.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
