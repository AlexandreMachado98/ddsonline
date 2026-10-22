'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Check, AlertTriangle, Calendar, User, Building, 
  MapPin, Shield, Target, Plus, Trash2, Loader2, Sparkles,
  HelpCircle, Link as LinkIcon, Camera, Image as ImageIcon,
  CheckCircle2, History, FileText, Upload, Eye
} from 'lucide-react';
import { 
  ActionPlanStatus,
  ActionPlanPriority, 
  ActionPlanCriticality, 
  ORIGIN_LABELS, 
  PRIORITY_LABELS, 
  CRITICALITY_LABELS,
  STATUS_LABELS
} from '@/lib/actionPlanUtils';

interface UserOption {
  id: string;
  name: string;
  email: string;
  position?: string | null;
}

export interface DraftAttachment {
  id?: string;
  fileName: string;
  displayName: string;
  mimeType: string;
  fileSize: number;
  fileData: string;
  evidenceType: 'BEFORE' | 'DURING' | 'AFTER' | 'COMPLEMENTARY';
  caption: string;
}

interface ActionPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  planToEdit?: any;
}

export default function ActionPlanModal({
  isOpen,
  onClose,
  onSuccess,
  planToEdit
}: ActionPlanModalProps) {
  const [activeTab, setActiveTab] = useState<'IDENT' | 'PROBLEM' | 'ACTION' | 'TASKS' | 'EVIDENCES'>('IDENT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [sector, setSector] = useState('');
  const [location, setLocation] = useState('');
  const [identificationDate, setIdentificationDate] = useState(new Date().toISOString().slice(0, 10));
  const [origin, setOrigin] = useState('OTHER');
  const [originReferenceId, setOriginReferenceId] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [category, setCategory] = useState('SST');
  const [criticality, setCriticality] = useState<ActionPlanCriticality>('MEDIUM');
  const [priority, setPriority] = useState<ActionPlanPriority>('MEDIUM');
  const [status, setStatus] = useState<ActionPlanStatus>('OPEN');
  const [completedAt, setCompletedAt] = useState('');
  const [alertDaysBefore, setAlertDaysBefore] = useState(7);

  // Evidências Anexadas (Fotos Antes, Durante, Depois)
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [evidenceType, setEvidenceType] = useState<'BEFORE' | 'DURING' | 'AFTER' | 'COMPLEMENTARY'>('BEFORE');
  const [evidenceCaption, setEvidenceCaption] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Problema
  const [problemDescription, setProblemDescription] = useState('');
  const [identifiedRisk, setIdentifiedRisk] = useState('');
  const [potentialConsequences, setPotentialConsequences] = useState('');
  const [identifiedCause, setIdentifiedCause] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [immediateMeasures, setImmediateMeasures] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Ação Proposta (5W2H)
  const [actionDescription, setActionDescription] = useState('');
  const [actionObjective, setActionObjective] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [requiredResources, setRequiredResources] = useState('');
  const [completionCriteria, setCompletionCriteria] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [verifierId, setVerifierId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');

  // Subações / Etapas
  const [tasks, setTasks] = useState<Array<{ description: string; responsibleId: string; dueDate: string; weight: number }>>([
    { description: '', responsibleId: '', dueDate: '', weight: 1 }
  ]);

  // Carrega Usuários e Reuniões DDS
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/planos-de-acao/usuarios')
      .then(res => res.json())
      .then(data => {
        if (data.success) setUsers(data.users || []);
      })
      .catch(() => {});

    fetch('/api/reuniao?activeOnly=false')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.meetings)) {
          setMeetings(data.meetings.slice(0, 30));
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Preenche dados se estiver editando
  useEffect(() => {
    if (planToEdit) {
      setTitle(planToEdit.title || '');
      setSector(planToEdit.sector || '');
      setLocation(planToEdit.location || '');
      setIdentificationDate(planToEdit.identificationDate ? new Date(planToEdit.identificationDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      setOrigin(planToEdit.origin || 'OTHER');
      setOriginReferenceId(planToEdit.originReferenceId || '');
      setMeetingId(planToEdit.meetingId || '');
      setCategory(planToEdit.category || 'SST');
      setCriticality(planToEdit.criticality || 'MEDIUM');
      setPriority(planToEdit.priority || 'MEDIUM');
      setAlertDaysBefore(planToEdit.alertDaysBefore || 7);

      setProblemDescription(planToEdit.problemDescription || '');
      setIdentifiedRisk(planToEdit.identifiedRisk || '');
      setPotentialConsequences(planToEdit.potentialConsequences || '');
      setIdentifiedCause(planToEdit.identifiedCause || '');
      setRootCause(planToEdit.rootCause || '');
      setImmediateMeasures(planToEdit.immediateMeasures || '');
      setAdditionalNotes(planToEdit.additionalNotes || '');

      setActionDescription(planToEdit.actionDescription || '');
      setActionObjective(planToEdit.actionObjective || '');
      setExpectedResult(planToEdit.expectedResult || '');
      setRequiredResources(planToEdit.requiredResources || '');
      setCompletionCriteria(planToEdit.completionCriteria || '');
      setResponsibleId(planToEdit.responsibleId || '');
      setSupervisorId(planToEdit.supervisorId || '');
      setVerifierId(planToEdit.verifierId || '');
      setStartDate(planToEdit.startDate ? new Date(planToEdit.startDate).toISOString().slice(0, 10) : '');
      setDueDate(planToEdit.dueDate ? new Date(planToEdit.dueDate).toISOString().slice(0, 10) : '');
      setStatus(planToEdit.status || 'OPEN');
      setCompletedAt(planToEdit.completedAt ? new Date(planToEdit.completedAt).toISOString().slice(0, 10) : '');

      if (Array.isArray(planToEdit.attachments) && planToEdit.attachments.length > 0) {
        setAttachments(planToEdit.attachments.map((a: any) => ({
          id: a.id,
          fileName: a.fileName,
          displayName: a.displayName || a.fileName,
          mimeType: a.mimeType || 'image/jpeg',
          fileSize: a.fileSize || 0,
          fileData: a.fileData,
          evidenceType: a.evidenceType || 'COMPLEMENTARY',
          caption: a.caption || ''
        })));
      }

      if (Array.isArray(planToEdit.tasks) && planToEdit.tasks.length > 0) {
        setTasks(planToEdit.tasks.map((t: any) => ({
          description: t.description || '',
          responsibleId: t.responsibleId || '',
          dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : '',
          weight: t.weight || 1
        })));
      }
    } else {
      resetForm();
    }
  }, [planToEdit, isOpen]);

  const resetForm = () => {
    setTitle('');
    setSector('');
    setLocation('');
    setIdentificationDate(new Date().toISOString().slice(0, 10));
    setOrigin('OTHER');
    setOriginReferenceId('');
    setMeetingId('');
    setCategory('SST');
    setCriticality('MEDIUM');
    setPriority('MEDIUM');
    setStatus('OPEN');
    setCompletedAt('');
    setAttachments([]);
    setEvidenceCaption('');
    setAlertDaysBefore(7);
    setProblemDescription('');
    setIdentifiedRisk('');
    setPotentialConsequences('');
    setIdentifiedCause('');
    setRootCause('');
    setImmediateMeasures('');
    setAdditionalNotes('');
    setActionDescription('');
    setActionObjective('');
    setExpectedResult('');
    setRequiredResources('');
    setCompletionCriteria('');
    setResponsibleId('');
    setSupervisorId('');
    setVerifierId('');
    setStartDate(new Date().toISOString().slice(0, 10));
    setDueDate('');
    setTasks([{ description: '', responsibleId: '', dueDate: '', weight: 1 }]);
    setErrorMessage(null);
    setActiveTab('IDENT');
  };

  const handleAddTask = () => {
    setTasks(prev => [...prev, { description: '', responsibleId: responsibleId || '', dueDate: dueDate || '', weight: 1 }]);
  };

  const handleRemoveTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateTask = (index: number, field: string, value: any) => {
    setTasks(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Gerenciamento de Anexos e Evidências
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFile(true);
    const file = files[0];

    if (file.size > 10 * 1024 * 1024) {
      alert('O arquivo selecionado excede o limite de 10 MB.');
      setIsProcessingFile(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const newAtt: DraftAttachment = {
        fileName: file.name,
        displayName: evidenceCaption.trim() || file.name,
        mimeType: file.type || 'image/jpeg',
        fileSize: file.size,
        fileData: result,
        evidenceType: evidenceType,
        caption: evidenceCaption.trim()
      };

      setAttachments(prev => [...prev, newAtt]);
      setEvidenceCaption('');
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onerror = () => {
      alert('Falha ao processar arquivo.');
      setIsProcessingFile(false);
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('O título do plano de ação é obrigatório.');
      setActiveTab('IDENT');
      return;
    }

    if (!dueDate) {
      setErrorMessage('O prazo final de conclusão é obrigatório.');
      setActiveTab('ACTION');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        sector: sector.trim() || null,
        location: location.trim() || null,
        identificationDate,
        origin,
        originReferenceId: originReferenceId || null,
        meetingId: origin === 'DDS' && meetingId ? meetingId : null,
        category,
        criticality,
        priority,
        status,
        completedAt: status === 'COMPLETED' ? (completedAt || dueDate || new Date().toISOString().slice(0, 10)) : null,
        alertDaysBefore: Number(alertDaysBefore),
        problemDescription: problemDescription.trim() || null,
        identifiedRisk: identifiedRisk.trim() || null,
        potentialConsequences: potentialConsequences.trim() || null,
        identifiedCause: identifiedCause.trim() || null,
        rootCause: rootCause.trim() || null,
        immediateMeasures: immediateMeasures.trim() || null,
        additionalNotes: additionalNotes.trim() || null,
        actionDescription: actionDescription.trim() || null,
        actionObjective: actionObjective.trim() || null,
        expectedResult: expectedResult.trim() || null,
        requiredResources: requiredResources.trim() || null,
        completionCriteria: completionCriteria.trim() || null,
        responsibleId: responsibleId || null,
        supervisorId: supervisorId || null,
        verifierId: verifierId || null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        tasks: tasks.filter(t => t.description.trim().length > 0),
        attachments: attachments.map(a => ({
          fileName: a.fileName,
          displayName: a.displayName,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
          fileData: a.fileData,
          evidenceType: a.evidenceType,
          caption: a.caption
        }))
      };

      const url = '/api/planos-de-acao';
      const method = planToEdit ? 'PUT' : 'POST';
      const body = planToEdit ? { id: planToEdit.id, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao salvar plano de ação');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocorreu um erro ao processar o formulário');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-[#0F1F38] text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                {planToEdit ? 'Edição' : 'Novo Registro'}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {planToEdit ? `Editar Plano de Ação: ${planToEdit.code}` : 'Cadastrar Plano de Ação & Não Conformidade'}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Gestão preventiva, corretiva e controle de prazos em conformidade com as NRs.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas do Formulário */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 shrink-0 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('IDENT')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'IDENT'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building size={15} />
            <span>1. Identificação & Origem</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PROBLEM')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'PROBLEM'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle size={15} />
            <span>2. Diagnóstico & Causa Raiz</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ACTION')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'ACTION'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Target size={15} />
            <span>3. Ação Proposta & Prazos (5W2H)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TASKS')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'TASKS'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Check size={15} />
            <span>4. Subações / Etapas ({tasks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('EVIDENCES')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'EVIDENCES'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Camera size={15} />
            <span>5. Evidências & Fotos ({attachments.length})</span>
          </button>
        </div>

        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 shrink-0">
            <AlertTriangle size={16} className="shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Corpo do Formulário */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ========================================================================= */}
          {/* ABA 1: IDENTIFICAÇÃO & ORIGEM */}
          {/* ========================================================================= */}
          {activeTab === 'IDENT' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Título do Plano de Ação <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Adequação das proteções físicas da serra fita da carpintaria (NR-12)"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Origem da Ação <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  >
                    {Object.entries(ORIGIN_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {origin === 'DDS' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <LinkIcon size={12} className="text-blue-600" />
                      <span>Vincular Sessão de DDS Origem</span>
                    </label>
                    <select
                      value={meetingId}
                      onChange={e => setMeetingId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50/30 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    >
                      <option value="">Selecione o DDS correspondente...</option>
                      {meetings.map(m => (
                        <option key={m.id} value={m.id}>
                          {new Date(m.createdAt).toLocaleDateString('pt-BR')} - {m.topic} ({m.farm || 'Geral'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Setor / Área
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Manutenção, Obras, Caldeiraria, Escritório"
                    value={sector}
                    onChange={e => setSector(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Local Específico da Ocorrência
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Galpão 3, Linha 2 de Envase, Setor de Carga"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Data de Identificação
                  </label>
                  <input
                    type="date"
                    value={identificationDate}
                    onChange={e => setIdentificationDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Categoria da Ação
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Segurança de Máquinas, EPI, Meio Ambiente, Ergonômico"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nível de Criticidade
                  </label>
                  <select
                    value={criticality}
                    onChange={e => setCriticality(e.target.value as ActionPlanCriticality)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  >
                    {Object.entries(CRITICALITY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Prioridade de Execução
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as ActionPlanPriority)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  >
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Situação do Plano & Registro Retroativo */}
              <div className="pt-3 border-t border-slate-200">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <History size={15} className="text-blue-600" />
                      <span>Status do Registro & Histórico de Execução</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Permite cadastrar ações novas ou registrar planos já executados anteriormente
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Situação / Estado Inicial da Ação
                      </label>
                      <select
                        value={status}
                        onChange={e => {
                          const newSt = e.target.value as ActionPlanStatus;
                          setStatus(newSt);
                          if (newSt === 'COMPLETED' && !completedAt) {
                            setCompletedAt(dueDate || identificationDate || new Date().toISOString().slice(0, 10));
                          }
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="OPEN">Em Aberto (Ação Nova em Planejamento)</option>
                        <option value="IN_PROGRESS">Em Andamento (Em Execução)</option>
                        <option value="AWAITING_VALIDATION">Aguardando Validação de Eficácia</option>
                        <option value="COMPLETED">✓ Concluído Anteriormente (Histórico Retroativo)</option>
                      </select>
                    </div>

                    {status === 'COMPLETED' ? (
                      <div className="animate-in fade-in duration-200">
                        <label className="block text-[11px] font-bold text-emerald-800 mb-1 flex items-center justify-between">
                          <span>Data Efetiva da Conclusão</span>
                          <span className="text-[10px] text-emerald-600 font-bold">Histórico Oficial</span>
                        </label>
                        <input
                          type="date"
                          value={completedAt}
                          onChange={e => setCompletedAt(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50/50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center text-slate-400 text-xs pt-5">
                        <span>O prazo limite será definido na aba "3. Ação Proposta & Prazos".</span>
                      </div>
                    )}
                  </div>

                  {status === 'COMPLETED' && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold text-xs text-emerald-950">Registro Retroativo Ativo</p>
                          <p className="text-[11px] text-emerald-800">
                            {completedAt && dueDate && completedAt.slice(0, 10) <= dueDate.slice(0, 10)
                              ? 'A data de conclusão é igual ou anterior ao prazo: constará como "Concluído no Prazo" no sistema e nos relatórios em PDF.'
                              : completedAt && dueDate
                              ? 'Atenção: A data de conclusão informada é posterior ao prazo limite estipulado.'
                              : 'Defina o prazo final na aba 3 para calcular a conformidade temporal.'}
                          </p>
                        </div>
                      </div>

                      {completedAt && dueDate && (
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 ${
                          completedAt.slice(0, 10) <= dueDate.slice(0, 10)
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}>
                          {completedAt.slice(0, 10) <= dueDate.slice(0, 10) ? 'No Prazo' : 'Com Atraso'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 2: DIAGNÓSTICO DO PROBLEMA & ANÁLISE DE CAUSA */}
          {/* ========================================================================= */}
          {activeTab === 'PROBLEM' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição Detalhada da Situação / Desvio Encontrado
                </label>
                <textarea
                  rows={3}
                  placeholder="Descreva a condição insegura, ato inseguro ou não conformidade identificada de forma clara e objetiva..."
                  value={problemDescription}
                  onChange={e => setProblemDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Risco Identificado & Perigos
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Risco de prensamento de membros, choque elétrico, queda"
                    value={identifiedRisk}
                    onChange={e => setIdentifiedRisk(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Consequências Potenciais
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Amputação, fratura grave, parada de linha produtiva"
                    value={potentialConsequences}
                    onChange={e => setPotentialConsequences(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Causa Imediata Identificada
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Proteção removida durante limpeza e não reinstalada"
                    value={identifiedCause}
                    onChange={e => setIdentifiedCause(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Causa Raiz (Ishikawa / 5 Porquês)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Falha no procedimento de manutenção autônoma e ausência de sensor com intertravamento"
                    value={rootCause}
                    onChange={e => setRootCause(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Medidas Imediatas / Bloqueios Adotados
                </label>
                <input
                  type="text"
                  placeholder="Ex: Equipamento etiquetado e bloqueado (Lockout/Tagout) até a conclusão da adequação"
                  value={immediateMeasures}
                  onChange={e => setImmediateMeasures(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações Adicionais / Evidências Anexadas
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações técnicas complementares, histórico anterior de quebras ou ocorrências semelhantes..."
                  value={additionalNotes}
                  onChange={e => setAdditionalNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 3: AÇÃO PROPOSTA, ATRIBUIÇÕES & PRAZOS */}
          {/* ========================================================================= */}
          {activeTab === 'ACTION' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição da Ação Corretiva / Preventiva (O Que Fazer) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Descreva minuciosamente a ação técnica que será executada para sanar definitivamente a não conformidade..."
                  value={actionDescription}
                  onChange={e => setActionDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Objetivo da Ação (Para Que)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Eliminar o risco de acidentes na operação de corte"
                    value={actionObjective}
                    onChange={e => setActionObjective(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Resultado Esperado
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Máquina 100% conforme com laudo de adequação da NR-12"
                    value={expectedResult}
                    onChange={e => setExpectedResult(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Recursos Necessários (Orçamento / Materiais)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Chave de segurança magnética, policarbonato 6mm, serralheiro"
                    value={requiredResources}
                    onChange={e => setRequiredResources(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Critério de Conclusão / Aceite
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Teste prático de parada e validação da segurança operacional"
                    value={completionCriteria}
                    onChange={e => setCompletionCriteria(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Atribuições de Pessoas */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">
                  Atribuição de Papéis & Responsabilidades
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Responsável Principal (Executante)
                    </label>
                    <select
                      value={responsibleId}
                      onChange={e => setResponsibleId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    >
                      <option value="">Selecione um colaborador...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.position || 'Colaborador'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Supervisor / Acompanhante
                    </label>
                    <select
                      value={supervisorId}
                      onChange={e => setSupervisorId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    >
                      <option value="">Selecione o supervisor...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.position || 'Supervisor'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Verificador de Eficácia
                    </label>
                    <select
                      value={verifierId}
                      onChange={e => setVerifierId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    >
                      <option value="">Selecione o auditor/SST...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.position || 'SST'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Prazos & Alertas */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">
                  Controle Inteligente de Prazos
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Data de Início
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Prazo Final de Conclusão <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-blue-300 bg-blue-50/20 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Alerta de Proximidade (Dias antes)
                    </label>
                    <select
                      value={alertDaysBefore}
                      onChange={e => setAlertDaysBefore(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    >
                      <option value={15}>15 dias antes</option>
                      <option value={7}>7 dias antes (Padrão)</option>
                      <option value={3}>3 dias antes</option>
                      <option value={1}>1 dia antes</option>
                      <option value={0}>No dia do vencimento</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 4: SUBAÇÕES / ETAPAS EXECUTIVAS */}
          {/* ========================================================================= */}
          {activeTab === 'TASKS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    Desdobramento em Subações / Etapas Executivas
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Divida a implementação em etapas claras com prazos e pesos para o cálculo de progresso ponderado.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddTask}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Adicionar Etapa</span>
                </button>
              </div>

              <div className="space-y-3">
                {tasks.map((task, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-600 text-white">
                        Etapa {idx + 1}
                      </span>
                      {tasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTask(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Remover etapa"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder={`Descrição da etapa ${idx + 1}...`}
                      value={task.description}
                      onChange={e => handleUpdateTask(idx, 'description', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Responsável</label>
                        <select
                          value={task.responsibleId}
                          onChange={e => handleUpdateTask(idx, 'responsibleId', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white"
                        >
                          <option value="">Responsável geral do plano</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Prazo Limite</label>
                        <input
                          type="date"
                          value={task.dueDate}
                          onChange={e => handleUpdateTask(idx, 'dueDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Peso no Progresso</label>
                        <select
                          value={task.weight}
                          onChange={e => handleUpdateTask(idx, 'weight', Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white"
                        >
                          <option value={1}>Peso 1 (Normal)</option>
                          <option value={2}>Peso 2 (Importante)</option>
                          <option value={3}>Peso 3 (Crítico / Decisivo)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 5: EVIDÊNCIAS & COMPROVAÇÕES (FOTOS ANTES / DURANTE / DEPOIS) */}
          {/* ========================================================================= */}
          {activeTab === 'EVIDENCES' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera size={15} className="text-blue-600" />
                    <span>Registro de Evidências Fotográficas & Comprovações</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Anexe fotos do Antes (desvio), Durante (execução) e Depois (solução implementada) para constarem no relatório oficial em PDF.
                  </p>
                </div>
              </div>

              {/* Box de Upload de Evidência */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-700 block">
                  Adicionar Nova Evidência
                </span>

                {/* Seletor do Tipo de Evidência */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEvidenceType('BEFORE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      evidenceType === 'BEFORE'
                        ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🔴 Antes (Risco / Desvio)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEvidenceType('DURING')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      evidenceType === 'DURING'
                        ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🟡 Durante (Execução)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEvidenceType('AFTER')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      evidenceType === 'AFTER'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🟢 Depois (Solução / Concluído)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEvidenceType('COMPLEMENTARY')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      evidenceType === 'COMPLEMENTARY'
                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🔵 Complementar (Laudo / Doc)
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    placeholder="Legenda da foto / evidência (ex: Proteção física instalada e aterrada)..."
                    value={evidenceCaption}
                    onChange={e => setEvidenceCaption(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingFile}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isProcessingFile ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Carregando...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={15} />
                        <span>Selecionar Foto ou Arquivo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Galeria de Evidências Anexadas */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Evidências Vinculadas a este Plano ({attachments.length})
                </span>

                {attachments.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <ImageIcon size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-600">Nenhuma evidência anexada até o momento</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Você pode anexar fotos comprovando a execução antes de salvar ou incluir posteriormente no painel de acompanhamento.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            att.evidenceType === 'BEFORE'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : att.evidenceType === 'AFTER'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : att.evidenceType === 'DURING'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            {att.evidenceType === 'BEFORE' ? 'Antes' :
                             att.evidenceType === 'AFTER' ? 'Depois' :
                             att.evidenceType === 'DURING' ? 'Durante' : 'Complementar'}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(idx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Remover anexo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {att.fileData && (att.mimeType?.startsWith('image/') || att.fileData.startsWith('data:image/')) ? (
                          <div className="h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 flex items-center justify-center">
                            <img
                              src={att.fileData}
                              alt={att.displayName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-28 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-500 gap-1.5">
                            <FileText size={28} className="text-blue-600" />
                            <span className="text-[10px] font-bold truncate max-w-[90%]">
                              {att.fileName}
                            </span>
                          </div>
                        )}

                        <div>
                          <p className="text-xs font-bold text-slate-800 line-clamp-2">
                            {att.caption || att.displayName || att.fileName}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {att.fileSize ? `${Math.round(att.fileSize / 1024)} KB` : 'Evidência anexada'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rodapé de Ações */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-2">
              {activeTab !== 'IDENT' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'EVIDENCES') setActiveTab('TASKS');
                    else if (activeTab === 'TASKS') setActiveTab('ACTION');
                    else if (activeTab === 'ACTION') setActiveTab('PROBLEM');
                    else if (activeTab === 'PROBLEM') setActiveTab('IDENT');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Voltar
                </button>
              )}

              {activeTab !== 'EVIDENCES' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'IDENT') setActiveTab('PROBLEM');
                    else if (activeTab === 'PROBLEM') setActiveTab('ACTION');
                    else if (activeTab === 'ACTION') setActiveTab('TASKS');
                    else if (activeTab === 'TASKS') setActiveTab('EVIDENCES');
                  }}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-sm"
                >
                  Avançar
                </button>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-sm hover:shadow flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>{planToEdit ? 'Salvar Alterações' : status === 'COMPLETED' ? 'Registrar Plano Concluído' : 'Criar Plano de Ação'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
