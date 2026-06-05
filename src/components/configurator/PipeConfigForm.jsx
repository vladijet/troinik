import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Pipette, Info } from "lucide-react";
import { motion } from "framer-motion";
import { PIPE_MATERIALS, STANDARD_DIAMETERS } from "@/lib/hydraulicCalc";

export default function PipeConfigForm({ systemParams, radiators, onNext, onBack }) {
  const material = systemParams.pipeMaterial || "polypropylene";
  const diameters = STANDARD_DIAMETERS[material] || [];
  const totalPower = radiators.reduce((sum, r) => sum + (r.power_w || 0), 0);
  const maxDist = Math.max(...radiators.map(r => r.distance_m || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Pipette className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Параметры трубопровода</CardTitle>
                <CardDescription>Сводка по выбранным параметрам</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Материал</span>
                <span className="text-sm font-medium">{PIPE_MATERIALS[material]}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Доступные Ø внутр.</span>
                <span className="text-sm font-medium font-mono">{diameters.join(", ")} мм</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Температурный график</span>
                <span className="text-sm font-medium">{systemParams.tSupply}/{systemParams.tReturn} °C</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Макс. скорость</span>
                <span className="text-sm font-medium">{systemParams.maxVelocity || 0.8} м/с</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-muted-foreground">Теплоноситель</span>
                <span className="text-sm font-medium">{systemParams.coolantType === "antifreeze" ? "Антифриз" : "Вода"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-500/10">
                <Info className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-base">Сводка по системе</CardTitle>
                <CardDescription>Перед расчётом</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Кол-во радиаторов</span>
                <span className="text-sm font-semibold text-primary">{radiators.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Суммарная мощность</span>
                <span className="text-sm font-semibold text-primary">{(totalPower / 1000).toFixed(1)} кВт</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Макс. расстояние</span>
                <span className="text-sm font-medium">{maxDist} м</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-muted-foreground">Тип системы</span>
                <span className="text-sm font-medium">Тройниковая (двухтрубная)</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-accent/50 text-sm text-accent-foreground">
              Диаметры труб будут подобраны автоматически по условию максимальной скорости потока.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} size="lg" className="gap-2 px-8">
          <ArrowLeft className="w-4 h-4" /> Назад
        </Button>
        <Button onClick={onNext} size="lg" className="gap-2 px-8">
          Рассчитать <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}