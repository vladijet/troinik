import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ResetConfirmDialog({ open, onConfirm, onCancel }) {
  return (
    <AnimatePresence>
    {open && (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent
        className="max-w-sm"
        style={{ background: '#0f172a', border: '1px solid #1e3a5f', color: '#e2e8f0' }}
        asChild
      >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 10 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
              style={{ background: '#1a0a0a', border: '1px solid #7f1d1d' }}>
              <AlertTriangle className="w-4 h-4" style={{ color: '#f87171' }} />
            </div>
            <DialogTitle style={{ color: '#e2e8f0', fontSize: 15 }}>
              Сбросить расчёт?
            </DialogTitle>
          </div>
          <DialogDescription style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
            Вся текущая схема будет удалена, а параметры системы сброшены до значений по умолчанию. Это действие нельзя отменить.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 text-xs h-8"
            style={{ borderColor: '#1e3a5f', color: '#94a3b8', background: 'transparent' }}
          >
            Отмена
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 text-xs h-8"
            style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b' }}
            onMouseEnter={e => e.currentTarget.style.background = '#991b1b'}
            onMouseLeave={e => e.currentTarget.style.background = '#7f1d1d'}
          >
            Сбросить
          </Button>
        </div>
      </motion.div>
      </DialogContent>
    </Dialog>
    )}
    </AnimatePresence>
  );
}