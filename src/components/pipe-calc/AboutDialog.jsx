import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AboutDialog({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ background: '#0f172a', border: '1px solid #1e3a5f', color: '#94a3b8', maxWidth: 480 }}>
        <DialogHeader>
          <DialogTitle style={{ color: '#e2e8f0', fontSize: 18 }}>О нас</DialogTitle>
        </DialogHeader>

        <p style={{ fontSize: 13, lineHeight: 1.7, color: '#94a3b8' }}>
          Онлайн-сервис Тройник позволяет построить топологическую гидравлическую модель двухтрубной, тройниковой радиаторной системы отопления и определить диаметры участков трубопроводов.
        </p>

        <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, marginTop: 8 }}>Как это работает</h3>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: '#94a3b8' }}>
          Добавляете на холст тройники, углы, радиаторы и связываете их между собой линиями (трубами). Нажимаете кнопку Рассчитать и смотрите результат.
        </p>

        <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, marginTop: 8 }}>Контакты</h3>
        <p style={{ fontSize: 13, color: '#3b82f6' }}>
          <a href="mailto:savelov@priborpodbor.ru" style={{ color: '#3b82f6' }}>savelov@priborpodbor.ru</a>
        </p>
      </DialogContent>
    </Dialog>
  );
}