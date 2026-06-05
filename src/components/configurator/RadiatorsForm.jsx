import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ArrowRight, ArrowLeft, Heater, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

const DEFAULT_RADIATOR = {
  name: "",
  power_w: 1000,
  floor: 1,
  room: "",
  distance_m: 10,
  local_resistances: 5
};

export default function RadiatorsForm({ radiators, onChange, onNext, onBack }) {
  const addRadiator = () => {
    const newRad = { ...DEFAULT_RADIATOR, id: generateId(), name: `Радиатор ${radiators.length + 1}` };
    onChange([...radiators, newRad]);
  };

  const duplicateRadiator = (idx) => {
    const source = radiators[idx];
    const newRad = { ...source, id: generateId(), name: source.name + " (копия)" };
    const updated = [...radiators];
    updated.splice(idx + 1, 0, newRad);
    onChange(updated);
  };

  const removeRadiator = (idx) => {
    onChange(radiators.filter((_, i) => i !== idx));
  };

  const updateRadiator = (idx, key, value) => {
    const updated = [...radiators];
    updated[idx] = { ...updated[idx], [key]: value };
    onChange(updated);
  };

  const totalPower = radiators.reduce((sum, r) => sum + (r.power_w || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border/50">
        <div className="flex items-center gap-2">
          <Heater className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Радиаторов: <span className="text-primary">{radiators.length}</span></span>
        </div>
        <div className="h-4 w-px bg-border" />
        <span className="text-sm font-medium">Общая мощность: <span className="text-primary">{(totalPower / 1000).toFixed(1)} кВт</span></span>
        <div className="ml-auto">
          <Button onClick={addRadiator} size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Добавить
          </Button>
        </div>
      </div>

      {/* Radiator list */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {radiators.map((rad, idx) => (
            <motion.div
              key={rad.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              layout
            >
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {idx + 1}
                    </div>
                    <Input
                      value={rad.name}
                      onChange={(e) => updateRadiator(idx, "name", e.target.value)}
                      className="h-8 w-48 text-sm font-medium border-0 bg-transparent p-0 focus-visible:ring-0"
                      placeholder="Название"
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => duplicateRadiator(idx)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRadiator(idx)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Мощность (Вт)</Label>
                      <Input
                        type="number"
                        value={rad.power_w}
                        onChange={(e) => updateRadiator(idx, "power_w", Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Помещение</Label>
                      <Input
                        value={rad.room}
                        onChange={(e) => updateRadiator(idx, "room", e.target.value)}
                        className="h-9"
                        placeholder="Комната"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Этаж</Label>
                      <Input
                        type="number"
                        value={rad.floor}
                        onChange={(e) => updateRadiator(idx, "floor", Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Расстояние (м)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={rad.distance_m}
                        onChange={(e) => updateRadiator(idx, "distance_m", Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Σζ (мест. сопр.)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={rad.local_resistances}
                        onChange={(e) => updateRadiator(idx, "local_resistances", Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {radiators.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Heater className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Нет радиаторов</p>
            <p className="text-sm mt-1">Добавьте первый радиатор для расчёта</p>
            <Button onClick={addRadiator} className="mt-4 gap-2">
              <Plus className="w-4 h-4" /> Добавить радиатор
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} size="lg" className="gap-2 px-8">
          <ArrowLeft className="w-4 h-4" /> Назад
        </Button>
        <Button onClick={onNext} size="lg" className="gap-2 px-8" disabled={radiators.length === 0}>
          Рассчитать <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}