import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";

import StepIndicator from "@/components/configurator/StepIndicator";
import SystemParamsForm from "@/components/configurator/SystemParamsForm";
import RadiatorsForm from "@/components/configurator/RadiatorsForm";
import PipeConfigForm from "@/components/configurator/PipeConfigForm";
import ResultsView from "@/components/configurator/ResultsView";
import { calcFullSystem } from "@/lib/hydraulicCalc";

const DEFAULT_PARAMS = {
  tSupply: 80,
  tReturn: 60,
  coolantType: "water",
  maxVelocity: 0.8,
  pipeMaterial: "polypropylene"
};

export default function Configurator() {
  const [step, setStep] = useState(1);
  const [systemParams, setSystemParams] = useState(DEFAULT_PARAMS);
  const [radiators, setRadiators] = useState([]);
  const [results, setResults] = useState(null);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: () => {
      toast.success("Проект сохранён");
    }
  });

  const handleCalculate = () => {
    const calcResults = calcFullSystem(
      systemParams,
      radiators,
      systemParams.pipeMaterial || "polypropylene"
    );
    setResults(calcResults);
    setStep(4);
  };

  const handleSave = () => {
    saveMutation.mutate({
      name: `Проект от ${new Date().toLocaleDateString("ru-RU")}`,
      system_params: systemParams,
      radiators: radiators,
      pipe_material: systemParams.pipeMaterial,
      results: results
    });
  };

  const handleStepClick = (targetStep) => {
    if (targetStep < step) {
      setStep(targetStep);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Flame className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">HydroCalc</h1>
            <p className="text-xs text-muted-foreground">Гидравлический расчёт системы отопления</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StepIndicator currentStep={step} onStepClick={handleStepClick} />

        <AnimatePresence mode="wait">
          {step === 1 && (
            <SystemParamsForm
              key="step1"
              params={systemParams}
              onChange={setSystemParams}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <RadiatorsForm
              key="step2"
              radiators={radiators}
              onChange={setRadiators}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <PipeConfigForm
              key="step3"
              systemParams={systemParams}
              radiators={radiators}
              onNext={handleCalculate}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && (
            <ResultsView
              key="step4"
              results={results}
              onBack={() => setStep(2)}
              onSave={handleSave}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}