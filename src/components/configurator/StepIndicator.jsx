import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  { id: 1, label: "Параметры системы" },
  { id: 2, label: "Радиаторы" },
  { id: 3, label: "Трубопроводы" },
  { id: 4, label: "Результаты" }
];

export default function StepIndicator({ currentStep, onStepClick }) {
  return (
    <div className="flex items-center justify-between w-full max-w-2xl mx-auto mb-8">
      {steps.map((step, idx) => (
        <div key={step.id} className="flex items-center flex-1 last:flex-none">
          <button
            onClick={() => onStepClick?.(step.id)}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <motion.div
              initial={false}
              animate={{
                scale: currentStep === step.id ? 1.1 : 1,
              }}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 border-2",
                currentStep === step.id
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                  : currentStep > step.id
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted text-muted-foreground border-border"
              )}
            >
              {currentStep > step.id ? (
                <Check className="w-4 h-4" />
              ) : (
                step.id
              )}
            </motion.div>
            <span
              className={cn(
                "text-xs font-medium transition-colors hidden sm:block",
                currentStep === step.id
                  ? "text-primary"
                  : currentStep > step.id
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </button>
          {idx < steps.length - 1 && (
            <div className="flex-1 mx-3 h-0.5 rounded-full bg-border relative overflow-hidden">
              <motion.div
                initial={false}
                animate={{ width: currentStep > step.id ? "100%" : "0%" }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="absolute inset-0 bg-primary/40 rounded-full"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}