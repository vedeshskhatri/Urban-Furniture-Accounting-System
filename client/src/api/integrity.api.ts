import api from '../lib/axios';

export type IntegrityCheckStatus = 'pass' | 'fail' | 'unknown';

export interface IntegrityCheck {
  id: string;
  label: string;
  status: IntegrityCheckStatus;
  detail: string;
  value: string;
}

export interface IntegrityReport {
  runAt: string;
  passed: number;
  failed: number;
  unknown: number;
  total: number;
  checks: IntegrityCheck[];
}

export const IntegrityApi = {
  /** Runs all ten checks live against the database. Admin only. */
  runAll: async (): Promise<IntegrityReport> => {
    const res = await api.get<{ data: IntegrityReport; error: unknown }>('/api/integrity');
    if (!res.data?.data) {
      throw new Error('Integrity report unavailable');
    }
    return res.data.data;
  },

  /** Server-side Puppeteer PDF of the current report with printable HTML fallback. */
  downloadPdf: async (): Promise<void> => {
    const res = await api.get('/api/integrity/pdf', { responseType: 'blob' });
    const type = res.headers['content-type'] || 'application/pdf';
    const isPdf = String(type).includes('pdf');

    if (!isPdf) {
      // Server returned printable HTML fallback: open in dedicated print window
      const text = await (res.data as Blob).text();
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(text);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 350);
        return;
      }
    }

    const blob = new Blob([res.data], { type: isPdf ? 'application/pdf' : 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `System-Integrity-Report-${new Date().toISOString().split('T')[0]}.${isPdf ? 'pdf' : 'html'}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
