import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface BackfillJob {
  id: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';
  criado_por: string;
  data_inicio: string;
  data_fim: string;
  monitoramento_id: string | null;
  progresso: {
    processados: number;
    total: number;
    novas: number;
    descartadas: number;
    duplicadas: number;
    erros: number;
  };
  erro: string | null;
  logs: string[];
}

export function useBackfillJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<BackfillJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchJobs = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('backfill_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setJobs((data || []) as BackfillJob[]);
    } catch (error: any) {
      console.error('Error fetching backfill jobs:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    fetchJobs();

    const channel = supabase
      .channel('backfill-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'backfill_jobs',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setJobs(prev => [payload.new as BackfillJob, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setJobs(prev => prev.map(job => 
              job.id === payload.new.id ? payload.new as BackfillJob : job
            ));
          } else if (payload.eventType === 'DELETE') {
            setJobs(prev => prev.filter(job => job.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchJobs]);

  const createJob = async (
    dataInicio: string, 
    dataFim: string, 
    monitoramentoId?: string
  ): Promise<BackfillJob | null> => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return null;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-djen-job', {
        body: {
          action: 'create',
          dataInicio,
          dataFim,
          monitoramentoId,
          criadoPor: user.id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Backfill iniciado em background!');
      return data.job as BackfillJob;
    } catch (error: any) {
      console.error('Error creating backfill job:', error);
      toast.error('Erro ao criar job: ' + error.message);
      return null;
    } finally {
      setCreating(false);
    }
  };

  const cancelJob = async (jobId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('backfill-djen-job', {
        body: { action: 'cancel', jobId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Job cancelado');
      return true;
    } catch (error: any) {
      console.error('Error cancelling job:', error);
      toast.error('Erro ao cancelar: ' + error.message);
      return false;
    }
  };

  const deleteJob = async (jobId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('backfill_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;
      
      setJobs(prev => prev.filter(j => j.id !== jobId));
      toast.success('Job removido');
      return true;
    } catch (error: any) {
      console.error('Error deleting job:', error);
      toast.error('Erro ao remover: ' + error.message);
      return false;
    }
  };

  const activeJob = jobs.find(j => j.status === 'running' || j.status === 'pending');

  return {
    jobs,
    loading,
    creating,
    activeJob,
    fetchJobs,
    createJob,
    cancelJob,
    deleteJob,
  };
}
