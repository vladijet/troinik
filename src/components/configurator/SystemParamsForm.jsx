import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Thermometer, Droplets, Gauge, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { PIPE_MATERIALS } from "@/lib/hydraulicCalc";

export default function SystemParamsForm({ params, onChange, onNext }) {
  const update = (key, value) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Температурный график */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10">
                <Thermometer className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-base">Температурный график</CardTitle>
                <CardDescription>Температуры подачи и обратки</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Подача (°C)</Label>
              <Input
                type="number"
                value={params.tSupply || 80}
                onChange={(e) => update("tSupply", Number(e.target.value))}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Обратка (°C)</Label>
              <Input
                type="number"
                value={params.tReturn || 60}
                onChange={(e) => update("tReturn", Number(e.target.value))}
                className="h-11"
              />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              ΔT = <span className="font-semibold text-foreground">{(params.tSupply || 80) - (params.tReturn || 60)}°C</span>
            </div>
          </CardContent>
        </Card>

        {/* Параметры теплоносителя */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <Droplets className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">Теплоноситель</CardTitle>
                <CardDescription>Тип и параметры потока</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Тип теплоносителя</Label>
              <Select
                value={params.coolantType || "water"}
                onValueChange={(v) => update("coolantType", v)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="water">Вода</SelectItem>
                  <SelectItem value="antifreeze">Антифриз</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Макс. скорость потока (м/с)</Label>
              <Input
                type="number"
                step="0.1"
                value={params.maxVelocity || 0.8}
                onChange={(e) => update("maxVelocity", Number(e.target.value))}
                className="h-11"
              />
            </div>
          </CardContent>
        </Card>

        {/* Трубопровод */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10">
                <Gauge className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-base">Трубопровод</CardTitle>
                <CardDescription>Материал и характеристики</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Материал труб</Label>
              <Select
                value={params.pipeMaterial || "polypropylene"}
                onValueChange={(v) => update("pipeMaterial", v)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PIPE_MATERIALS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} size="lg" className="gap-2 px-8">
          Далее <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}