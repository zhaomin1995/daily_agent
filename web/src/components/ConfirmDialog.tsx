"use client";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/* Modal confirmation dialog. Renders a backdrop + centered card. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog card */}
      <div className="relative glass border border-white/50 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-5 sm:p-6 animate-scale-in">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn-brand flex-1 px-4 py-2.5 text-sm font-medium rounded-lg"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
