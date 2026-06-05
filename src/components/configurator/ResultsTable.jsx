import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function getVelocityStatus(velocity) {
  if (velocity < 0.2) return { label: "Низкая", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
  if (velocity <= 0.8) return { label: "Норма", className: "bg-green-500/10 text-green-600 border-green-500/20" };
  if (velocity <= 1.2) return { label: "Высокая", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
  return { label: "Критич.", className: "bg-red-500/10 text-red-600 border-red-500/20" };
}

export default function ResultsTable({ results }) {
  if (!results || !results.sections) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Расчёт участков магистрали</CardTitle>
          <CardDescription>Параметры по каждому участку от котла</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">№</TableHead>
                  <TableHead className="text-xs font-semibold">Радиатор</TableHead>
                  <TableHead className="text-xs font-semibold">Помещ.</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Q, Вт</TableHead>
                  <TableHead className="text-xs font-semibold text-right">ΣQ, Вт</TableHead>
                  <TableHead className="text-xs font-semibold text-right">G, кг/ч</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Ø мм</TableHead>
                  <TableHead className="text-xs font-semibold text-right">V, м/с</TableHead>
                  <TableHead className="text-xs font-semibold text-right">R, Па/м</TableHead>
                  <TableHead className="text-xs font-semibold text-right">ΔP тр, Па</TableHead>
                  <TableHead className="text-xs font-semibold text-right">ΔP мест, Па</TableHead>
                  <TableHead className="text-xs font-semibold text-right">ΔP общ, Па</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.sections.map((section, idx) => {
                  const vs = getVelocityStatus(section.mainSection.velocity);
                  return (
                    <TableRow key={section.radiatorId} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{section.radiatorName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{section.room}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{section.radiatorPower}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">{section.cumulativePower}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{section.mainSection.flowRateKgH}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-sm font-semibold text-primary">
                          Ø{section.mainSection.outerDiameter}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-mono text-sm">{section.mainSection.velocity}</span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", vs.className)}>
                            {vs.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{section.mainSection.specificLoss}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{section.mainSection.frictionLoss}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{section.mainSection.localLoss}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">{section.mainSection.totalLoss}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Radiator connections table */}
      <Card className="border-border/50 shadow-sm overflow-hidden mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Подводки к радиаторам</CardTitle>
          <CardDescription>Индивидуальные подводки от тройника к радиатору</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">Радиатор</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Q, Вт</TableHead>
                  <TableHead className="text-xs font-semibold text-right">G, кг/ч</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Ø мм</TableHead>
                  <TableHead className="text-xs font-semibold text-right">V, м/с</TableHead>
                  <TableHead className="text-xs font-semibold text-right">ΔP, Па</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.sections.map((section) => {
                  const vs = getVelocityStatus(section.radSection.velocity);
                  return (
                    <TableRow key={section.radiatorId + "_rad"} className="hover:bg-muted/30">
                      <TableCell className="text-sm font-medium">{section.radiatorName}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{section.radiatorPower}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{section.radSection.flowRateKgH}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                        Ø{section.radSection.outerDiameter}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-mono text-sm">{section.radSection.velocity}</span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", vs.className)}>
                            {vs.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">{section.radSection.totalLoss}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}