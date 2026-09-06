import React from 'react';

interface FormButtonsProps {
  onNew?: () => void;
  onSaveDraft?: () => void;
  onSave?: () => void;
  onConfirm?: () => void;
  onCreateInvoice?: () => void;
  onViewInvoice?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
  canConfirm?: boolean;
  canCreateInvoice?: boolean;
  canSave?: boolean;
  canCancel?: boolean;
  isDraft?: boolean;
  isConfirmed?: boolean;
  isInvoiced?: boolean;
  invoiceNumber?: string | null;
  isLoading?: boolean;
}

export const FormButtons: React.FC<FormButtonsProps> = ({
  onNew,
  onSaveDraft,
  onSave,
  onConfirm,
  onCreateInvoice,
  onViewInvoice,
  onCancel,
  onBack,
  canConfirm = true,
  canCreateInvoice = false,
  canSave = true,
  canCancel = true,
  isDraft = false,
  isConfirmed = false,
  isInvoiced = false,
  invoiceNumber,
  isLoading = false,
}) => {
  return (
    <div className="sticky top-0 z-20 bg-cream/95 backdrop-blur-sm border-b border-brown-300/40 py-3 px-6 mb-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-3 flex-wrap gap-y-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 text-sm font-medium text-brown-700 hover:text-brown-900 transition-colors cursor-pointer"
          >
            ← Back
          </button>
        )}

        {onNew && (
          <button
            type="button"
            onClick={onNew}
            className="px-4 py-1.5 text-sm font-medium bg-surface text-brown-900 border border-brown-300 rounded-[6px] hover:bg-brown-100 transition-colors shadow-sm cursor-pointer"
          >
            New
          </button>
        )}

        {/* 1. Unsaved new order: Verify & Save Draft */}
        {onSaveDraft && (
          <button
            type="button"
            disabled={!canSave || isLoading}
            onClick={onSaveDraft}
            className={`px-4 py-1.5 text-sm font-semibold rounded-[6px] shadow-sm transition-all cursor-pointer ${
              canSave && !isLoading
                ? 'bg-brown-900 text-cream hover:bg-brown-700 active:scale-[0.99]'
                : 'bg-brown-300 text-brown-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? 'Saving...' : 'Verify & Save Draft'}
          </button>
        )}

        {/* 2. Existing order (draft or confirmed before invoice): Save Changes */}
        {onSave && !isInvoiced && (
          <button
            type="button"
            disabled={!canSave || isLoading}
            onClick={onSave}
            className={`px-4 py-1.5 text-sm font-semibold bg-surface text-brown-900 border border-brown-300 rounded-[6px] hover:bg-brown-100 transition-all shadow-sm cursor-pointer ${
              !canSave || isLoading ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99]'
            }`}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        )}

        {/* 3. Confirm Order (moves Draft to Confirmed) */}
        {onConfirm && isDraft && (
          <button
            type="button"
            disabled={!canConfirm || isLoading}
            onClick={onConfirm}
            className={`px-4 py-1.5 text-sm font-semibold rounded-[6px] shadow-sm transition-all cursor-pointer ${
              canConfirm && !isLoading
                ? 'bg-brown-900 text-cream hover:bg-brown-700 active:scale-[0.99]'
                : 'bg-brown-300 text-brown-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? 'Confirming...' : 'Confirm Order'}
          </button>
        )}

        {/* 4. Create Invoice (when confirmed and not yet invoiced) */}
        {onCreateInvoice && isConfirmed && !isInvoiced && (
          <button
            type="button"
            disabled={!canCreateInvoice || isLoading}
            onClick={onCreateInvoice}
            className="px-4 py-1.5 text-sm font-semibold bg-brown-900 text-cream rounded-[6px] hover:bg-brown-700 transition-all shadow-sm active:scale-[0.99] cursor-pointer"
          >
            {isLoading ? 'Generating Invoice...' : 'Create Invoice'}
          </button>
        )}

        {/* 5. View Invoice (when invoice is created and SO is permanently locked) */}
        {onViewInvoice && isInvoiced && (
          <button
            type="button"
            onClick={onViewInvoice}
            className="px-4 py-1.5 text-sm font-semibold bg-posted text-white rounded-[6px] hover:bg-posted/90 transition-all shadow-sm active:scale-[0.99] cursor-pointer"
          >
            View Invoice {invoiceNumber ? `(${invoiceNumber})` : ''} →
          </button>
        )}

        {onCancel && !isInvoiced && (
          <button
            type="button"
            disabled={!canCancel}
            onClick={onCancel}
            className="px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-bg rounded-[6px] transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
