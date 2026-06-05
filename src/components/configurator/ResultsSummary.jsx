import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Droplets, Gauge, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

function StatCard({ icon: Icon, label, value, unit, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="text-2xl font-bold mt-1.5 font-mono">
                {value}
                <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
              </p>
            </div>
            <div className={`p-2.5 rounded-xl ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function ResultsSummary({ results }) {
  if (!results) return null;

  const stats = [
    {
      icon: Zap,
      label: "Общая мощность",
      value: (results.totalPower / 1000).toFixed(1),
      unit: "кВт",
      color: "bg-amber-500/10 text-amber-600"
    },
    {
      icon: Droplets,
      label: "Расход теплоносителя",
      value: results.totalFlowLH,
      unit: "л/ч",
      color: "bg-blue-500/10 text-blue-600"
    },
    {
      icon: Gauge,
      label: "Потери давления",
      value: results.totalLossKPa,
      unit: "кПа",
      color: "bg-red-500/10 text-red-600"
    },
    {
      icon: TrendingUp,
      label: "Напор насоса",
      value: results.requiredPumpHeadM,
      unit: "м.вод.ст.",
      color: "bg-green-500/10 text-green-600"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => (
        <StatCard key={stat.label} {...stat} delay={idx * 0.1} />
      ))}
    </div>
  );
}