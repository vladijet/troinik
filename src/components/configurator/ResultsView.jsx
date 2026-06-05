import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, FileDown } from "lucide-react";
import { motion } from "framer-motion";
import ResultsSummary from "./ResultsSummary";
import ResultsTable from "./ResultsTable";

export default function ResultsView({ results, onBack, onSave }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <ResultsSummary results={results} />
      <ResultsTable results={results} />

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="outline" onClick={onBack} size="lg" className="gap-2 px-8">
          <ArrowLeft className="w-4 h-4" /> Изменить параметры
        </Button>
        <Button onClick={onSave} size="lg" className="gap-2 px-8">
          <Save className="w-4 h-4" /> Сохранить проект
        </Button>
      </div>
    </motion.div>
  );
}