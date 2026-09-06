import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import api from '../../lib/axios';
import { BusinessTemplateSummary, TemplateCategory } from '../../types/template';

export const AdminTemplateManagementPage: React.FC = () => {
  const [templates, setTemplates] = useState<BusinessTemplateSummary[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/templates?includeInactive=true'),
      api.get('/api/templates/categories'),
    ])
      .then(([tmplRes, catRes]) => {
        if (tmplRes.data?.data) setTemplates(tmplRes.data.data);
        if (catRes.data?.data) setCategories(catRes.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      setUpdatingId(id);
      await api.patch(`/api/templates/${id}/status`, {
        isActive: !currentActive,
      });
      setTemplates(prev =>
        prev.map(t => (t.id === id ? { ...t, isActive: !currentActive } : t))
      );
    } catch (err: any) {
      alert('Failed to update template status');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = templates.filter(
    t =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.profession.toLowerCase().includes(search.toLowerCase()) ||
      t.categoryName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto pb-16 space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-300 rounded-[12px] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-300 text-[10px] font-bold uppercase tracking-wider text-black">
              <Shield className="w-3 h-3 text-black" />
              <span>Admin Control Panel</span>
            </div>
            <h1 className="text-2xl font-bold font-display text-black">
              Template Settings
            </h1>
            <p className="text-xs text-gray-500">
              Manage the master business template library, activate/deactivate templates, and audit source metadata.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-[8px] bg-gray-100 border border-gray-300 text-black">
              {templates.filter(t => t.isActive).length} Active / {templates.length} Total
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search master templates..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded-[6px] text-xs text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-300 rounded-[10px] overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-xs">Loading template catalogue...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-black text-white font-semibold">
                  <th className="p-3">Template Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Target Profession</th>
                  <th className="p-3">Version & Source</th>
                  <th className="p-3">ERP Binding</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(tmpl => (
                  <tr key={tmpl.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-black font-sans">
                      {tmpl.name}
                      <span className="block text-[10px] text-gray-500 font-normal truncate max-w-xs">
                        {tmpl.description}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-black border border-gray-300 font-medium text-[10px]">
                        {tmpl.categoryName}
                      </span>
                    </td>
                    <td className="p-3 text-gray-700 max-w-xs truncate">
                      {tmpl.profession}
                    </td>
                    <td className="p-3 text-gray-600 text-[11px]">
                      <div>v{tmpl.version}</div>
                      <div className="text-[10px] text-gray-400 italic truncate max-w-[180px]">
                        {tmpl.sourceType}
                      </div>
                    </td>
                    <td className="p-3 text-black font-mono text-[11px]">
                      {tmpl.erpDataSource ? (
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-black border border-gray-300">
                          {tmpl.erpDataSource}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tmpl.isActive
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-gray-600 border border-gray-300'
                        }`}
                      >
                        {tmpl.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        disabled={updatingId === tmpl.id}
                        onClick={() => handleToggleActive(tmpl.id, tmpl.isActive)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                          tmpl.isActive
                            ? 'text-black hover:bg-gray-200'
                            : 'text-black hover:bg-gray-200 font-bold underline'
                        }`}
                      >
                        {tmpl.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTemplateManagementPage;
