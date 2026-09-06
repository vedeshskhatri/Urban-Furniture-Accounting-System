import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  FileSpreadsheet,
  Filter,
  Eye,
  ArrowRight,
  FolderCheck,
  Sparkles,
  Layers,
  Copy,
  Trash2,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building,
} from 'lucide-react';
import api from '../../lib/axios';
import { TemplateCategory, BusinessTemplateSummary, BusinessTemplateDetail, UserTemplateItem } from '../../types/template';
import { TemplatePreviewModal } from '../../components/templates/TemplatePreviewModal';
import { TemplateCustomizeModal } from '../../components/templates/TemplateCustomizeModal';

export const TemplateLibraryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL state
  const activeTab = searchParams.get('tab') === 'saved' ? 'saved' : 'library';
  const categoryParam = searchParams.get('category') || 'all';

  // State
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [templates, setTemplates] = useState<BusinessTemplateSummary[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<UserTemplateItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProfession, setSelectedProfession] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [previewTemplate, setPreviewTemplate] = useState<BusinessTemplateDetail | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  const [customizeTemplate, setCustomizeTemplate] = useState<BusinessTemplateDetail | null>(null);
  const [customizeSavedItem, setCustomizeSavedItem] = useState<UserTemplateItem | null>(null);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState<boolean>(false);

  // Load Categories & Templates
  useEffect(() => {
    // Ensure document scroll is reset and unlocked
    document.body.style.overflow = 'auto';

    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/api/templates/categories'),
      api.get('/api/templates'),
      api.get('/api/templates/my/saved').catch(() => ({ data: { data: [] } })),
    ])
      .then(([catRes, tmplRes, savedRes]) => {
        if (catRes.data?.data) setCategories(catRes.data.data);
        if (tmplRes.data?.data) setTemplates(tmplRes.data.data);
        if (savedRes.data?.data) setSavedTemplates(savedRes.data.data);
      })
      .catch((err: any) => {
        setError(err?.response?.data?.error?.message || err.message || 'Failed to load templates');
      })
      .finally(() => setLoading(false));

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Reload saved templates after save/duplicate/delete
  const loadSavedTemplates = () => {
    api.get('/api/templates/my/saved')
      .then(res => {
        if (res.data?.data) setSavedTemplates(res.data.data);
      })
      .catch(() => {});
  };

  // Open Preview Handler
  const handleOpenPreview = async (templateId: number) => {
    try {
      const res = await api.get(`/api/templates/${templateId}`);
      if (res.data?.data) {
        setPreviewTemplate(res.data.data);
        setIsPreviewOpen(true);
      }
    } catch (err: any) {
      setError('Could not load template details');
    }
  };

  // Open Customize Handler
  const handleOpenCustomize = async (templateId: number, savedItem?: UserTemplateItem) => {
    try {
      const res = await api.get(`/api/templates/${templateId}`);
      if (res.data?.data) {
        setCustomizeTemplate(res.data.data);
        setCustomizeSavedItem(savedItem || null);
        setIsCustomizeOpen(true);
      }
    } catch (err: any) {
      setError('Could not load template details for customization');
    }
  };

  // Delete Saved Template
  const handleDeleteSaved = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this saved template?')) return;
    try {
      await api.delete(`/api/templates/my/${id}`);
      setSavedTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      alert('Failed to delete template');
    }
  };

  // Duplicate Saved Template
  const handleDuplicateSaved = async (id: number) => {
    try {
      const res = await api.post(`/api/templates/my/${id}/duplicate`);
      if (res.data?.data) {
        setSavedTemplates(prev => [res.data.data, ...prev]);
      }
    } catch (err: any) {
      alert('Failed to duplicate template');
    }
  };

  // Switch Tab
  const handleTabChange = (tab: 'library' | 'saved') => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  // Switch Category
  const handleCategoryChange = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('category', slug);
    setSearchParams(next);
  };

  // Extract distinct professions for quick filtering
  const distinctProfessions = useMemo(() => {
    const set = new Set<string>();
    templates.forEach(t => {
      t.profession.split(',').forEach(p => set.add(p.trim()));
    });
    return Array.from(set).sort();
  }, [templates]);

  // Filter templates locally
  const filteredTemplates = useMemo(() => {
    return templates.filter(tmpl => {
      // Category filter
      if (categoryParam !== 'all' && tmpl.categorySlug !== categoryParam) {
        return false;
      }

      // Profession filter
      if (
        selectedProfession !== 'all' &&
        !tmpl.profession.toLowerCase().includes(selectedProfession.toLowerCase())
      ) {
        return false;
      }

      // Search query filter (name, profession, category, description, fields)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = tmpl.name.toLowerCase().includes(q);
        const matchDesc = tmpl.description.toLowerCase().includes(q);
        const matchProf = tmpl.profession.toLowerCase().includes(q);
        const matchCat = tmpl.categoryName.toLowerCase().includes(q);
        const matchFields = tmpl.fields.some(f => f.toLowerCase().includes(q));

        if (!matchName && !matchDesc && !matchProf && !matchCat && !matchFields) {
          return false;
        }
      }

      return true;
    });
  }, [templates, categoryParam, selectedProfession, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto pb-16 space-y-6">
      {/* Hero Header - Clean Black and White */}
      <div className="bg-white border border-gray-300 rounded-[12px] p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-300 text-[11px] font-bold uppercase tracking-wider text-black">
              <Sparkles className="w-3.5 h-3.5 text-black" />
              <span>Business Tools • Local-First Library</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-black tracking-tight">
              Ready-to-Use Business Templates
            </h1>
            <p className="text-sm text-gray-600 leading-relaxed">
              Stop building business sheets from scratch. Choose a template, customize it, and start using it.
            </p>
          </div>

          {/* View Mode Tabs Switcher */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-[8px] border border-gray-300 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => handleTabChange('library')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-[6px] transition-all flex items-center gap-1.5 ${
                activeTab === 'library'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-700 hover:text-black'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Template Library ({templates.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('saved')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-[6px] transition-all flex items-center gap-1.5 ${
                activeTab === 'saved'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-700 hover:text-black'
              }`}
            >
              <FolderCheck className="w-3.5 h-3.5" />
              <span>My Templates ({savedTemplates.length})</span>
            </button>
          </div>
        </div>

        {/* Search & Profession Bar (When in Library tab) */}
        {activeTab === 'library' && (
          <div className="mt-6 pt-6 border-t border-gray-200 flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search templates by keyword, profession (e.g. Contractor, Freelancer, Cash, Stock)..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-[8px] text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black focus:border-black shadow-2xs font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-black"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Profession quick dropdown */}
            <div className="w-full md:w-64">
              <select
                value={selectedProfession}
                onChange={e => setSelectedProfession(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-[8px] text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black shadow-2xs"
              >
                <option value="all">All Professions & Trades</option>
                {distinctProfessions.map(prof => (
                  <option key={prof} value={prof}>
                    {prof}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Category Filter Pills (When in Library tab) */}
      {activeTab === 'library' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => handleCategoryChange('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${
              categoryParam === 'all'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
            }`}
          >
            All Templates
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryChange(cat.slug)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${
                categoryParam === cat.slug
                  ? 'bg-black text-white border-black shadow-xs'
                  : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Loading & Error States */}
      {loading && (
        <div className="py-16 text-center text-gray-500 text-sm">
          Loading business templates...
        </div>
      )}

      {error && (
        <div className="p-4 bg-gray-100 border border-black text-black rounded-[8px] text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-black shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 1: TEMPLATE LIBRARY GRID */}
      {/* ============================================================ */}
      {!loading && activeTab === 'library' && (
        <div>
          {filteredTemplates.length === 0 ? (
            <div className="p-12 text-center bg-white border border-gray-300 rounded-[12px] space-y-3">
              <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto" />
              <h3 className="text-base font-bold text-black">No templates found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Try another search term, select "All Templates", or choose a different profession filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedProfession('all');
                  handleCategoryChange('all');
                }}
                className="px-4 py-2 text-xs font-semibold rounded-[6px] bg-white hover:bg-gray-100 text-black border border-black transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTemplates.map(tmpl => (
                <div
                  key={tmpl.id}
                  className="bg-white border border-gray-300 rounded-[10px] p-5 shadow-2xs hover:shadow-md hover:border-black transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    {/* Top Row: Category Pill & Compatibility */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-black border border-gray-300">
                        {tmpl.categoryName}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500 font-medium">
                        {tmpl.fileType}
                      </span>
                    </div>

                    {/* Template Title */}
                    <h3 className="text-base font-bold font-display text-black group-hover:text-gray-700 transition-colors leading-snug">
                      {tmpl.name}
                    </h3>

                    {/* Profession Tag */}
                    <div className="text-[11px] text-gray-700 font-medium flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <span className="truncate">{tmpl.profession}</span>
                    </div>

                    {/* Short Description */}
                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {tmpl.description}
                    </p>

                    {/* Source Note */}
                    <div className="text-[10px] text-gray-400 italic truncate pt-1 border-t border-gray-200">
                      {tmpl.sourceType}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 mt-4 border-t border-gray-200 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(tmpl.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-black hover:bg-gray-100 bg-white rounded-[6px] border border-gray-300 transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-black" />
                      <span>Preview</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenCustomize(tmpl.id)}
                      className="px-3.5 py-1.5 text-xs font-bold rounded-[6px] bg-black text-white hover:bg-gray-800 transition-all flex items-center gap-1.5 shadow-2xs active:scale-[0.99] border border-black"
                    >
                      <span>Use Template</span>
                      <ArrowRight className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: MY SAVED TEMPLATES */}
      {/* ============================================================ */}
      {!loading && activeTab === 'saved' && (
        <div>
          {savedTemplates.length === 0 ? (
            <div className="p-12 text-center bg-white border border-gray-300 rounded-[12px] space-y-3">
              <FolderCheck className="w-10 h-10 text-gray-400 mx-auto" />
              <h3 className="text-base font-bold text-black">
                You haven't saved any templates yet.
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Customize any business template and click "Save to My Templates" to store your configurations for fast reuse.
              </p>
              <button
                type="button"
                onClick={() => handleTabChange('library')}
                className="px-4 py-2 text-xs font-bold rounded-[6px] bg-black text-white hover:bg-gray-800 transition-colors shadow-2xs border border-black"
              >
                Browse Template Library
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {savedTemplates.map(saved => (
                <div
                  key={saved.id}
                  className="bg-white border border-gray-300 rounded-[10px] p-5 shadow-2xs hover:shadow-md hover:border-black transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-black border border-gray-300">
                        {saved.categoryName}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(saved.updatedAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>

                    <h3 className="text-base font-bold font-display text-black leading-snug">
                      {saved.name}
                    </h3>

                    <div className="text-xs text-gray-700">
                      Based on: <strong>{saved.templateName}</strong>
                    </div>

                    <div className="p-2.5 bg-gray-50 rounded-[6px] border border-gray-200 text-[11px] text-gray-700 space-y-1">
                      <div>Company: <strong>{saved.configuration?.businessName || 'Default'}</strong></div>
                      <div>FY: <strong>{saved.configuration?.financialYear || '2026-2027'}</strong></div>
                      <div>Custom Rows: <strong>{saved.customData?.rows?.length || 0}</strong></div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDuplicateSaved(saved.id)}
                        className="p-1.5 text-gray-600 hover:text-black hover:bg-gray-100 rounded"
                        title="Duplicate Template"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSaved(saved.id)}
                        className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded"
                        title="Delete Template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenCustomize(saved.templateId, saved)}
                      className="px-3.5 py-1.5 text-xs font-bold rounded-[6px] bg-black text-white hover:bg-gray-800 transition-all flex items-center gap-1.5 shadow-2xs border border-black"
                    >
                      <span>Open & Export</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {isPreviewOpen && previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            document.body.style.overflow = 'auto';
          }}
          onUseTemplate={tmpl => {
            setIsPreviewOpen(false);
            setCustomizeTemplate(tmpl);
            setCustomizeSavedItem(null);
            setIsCustomizeOpen(true);
          }}
        />
      )}

      {/* Customize & Export Modal */}
      {isCustomizeOpen && customizeTemplate && (
        <TemplateCustomizeModal
          template={customizeTemplate}
          savedItem={customizeSavedItem}
          isOpen={isCustomizeOpen}
          onClose={() => {
            setIsCustomizeOpen(false);
            document.body.style.overflow = 'auto';
          }}
          onSavedSuccess={loadSavedTemplates}
        />
      )}
    </div>
  );
};

export default TemplateLibraryPage;
