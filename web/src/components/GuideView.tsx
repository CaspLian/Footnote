import React, { useState } from 'react';
import { glossaryTerms } from '../data/glossary';
import { Language, GlossaryTerm } from '../types';
import { 
  BookOpen, 
  MagnifyingGlass, 
  ShieldCheck, 
  CaretDown, 
  CaretUp, 
  Info,
  Lightbulb
} from '@phosphor-icons/react';

interface GuideViewProps {
  language: Language;
}

export const GuideView: React.FC<GuideViewProps> = ({ language }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedTerm, setExpandedTerm] = useState<string | null>(glossaryTerms[0].term);

  const filteredTerms = glossaryTerms.filter((item) => {
    const query = search.toLowerCase();
    const matchesSearch =
      item.term.toLowerCase().includes(query) ||
      item.term_es.toLowerCase().includes(query) ||
      item.definition.toLowerCase().includes(query) ||
      item.definition_es.toLowerCase().includes(query);

    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const toggleExpand = (term: string) => {
    setExpandedTerm((prev) => (prev === term ? null : term));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="pb-4 border-b border-slate-200/80">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-200/80 px-2.5 py-1 rounded-full inline-block mb-1">
          {language === 'en' ? 'Bilingual Knowledge Base' : 'Base de Conocimiento Bilingüe'}
        </span>
        <h1 className="text-2xl font-extrabold text-ink-primary tracking-tight">
          {language === 'en' ? 'Insurance & Patient Rights Guide' : 'Guía de Seguros y Derechos del Paciente'}
        </h1>
        <p className="text-sm text-ink-secondary mt-0.5">
          {language === 'en'
            ? 'Plain-language explanations of confusing medical jargon, billing codes, and statutory protections.'
            : 'Explicaciones en lenguaje sencillo sobre términos de seguros, códigos de facturación y derechos legales.'}
        </p>
      </div>

      {/* Search and Category Filters */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === 'en' ? 'Search insurance terms...' : 'Buscar términos de seguros...'}
            className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: language === 'en' ? 'All' : 'Todos' },
            { id: 'rights', label: language === 'en' ? 'Patient Rights' : 'Derechos del Paciente' },
            { id: 'billing', label: language === 'en' ? 'Billing Rules' : 'Reglas de Facturación' },
            { id: 'insurance', label: language === 'en' ? 'Insurance Basics' : 'Conceptos de Seguro' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-brand-600 text-white shadow-subtle'
                  : 'bg-slate-100 text-ink-secondary hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Glossary Accordions */}
      <div className="space-y-3">
        {filteredTerms.map((item) => {
          const isExpanded = expandedTerm === item.term;
          return (
            <div
              key={item.term}
              className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-subtle transition-all"
            >
              <button
                onClick={() => toggleExpand(item.term)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50/60 transition-colors"
              >
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        item.category === 'rights'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.category === 'billing'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-brand-100 text-brand-800'
                      }`}
                    >
                      {item.category.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-ink-primary">
                    {language === 'en' ? item.term : item.term_es}
                  </h3>
                  {language === 'es' && (
                    <span className="text-xs text-ink-muted block font-mono">
                      Inglés: {item.term}
                    </span>
                  )}
                </div>

                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                  {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                </div>
              </button>

              {isExpanded && (
                <div className="p-5 pt-0 border-t border-slate-100 space-y-3 text-xs sm:text-sm text-ink-secondary leading-relaxed bg-slate-50/40">
                  <p className="pt-3">
                    {language === 'en' ? item.definition : item.definition_es}
                  </p>

                  <div className="p-3.5 rounded-xl bg-brand-50/70 border border-brand-200/80 text-brand-900 flex items-start gap-2.5">
                    <Lightbulb size={18} className="text-brand-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-xs uppercase tracking-wider block mb-0.5">
                        {language === 'en' ? 'Practical Example:' : 'Ejemplo Práctico:'}
                      </span>
                      <p className="text-xs">
                        {language === 'en' ? item.example : item.example_es}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
