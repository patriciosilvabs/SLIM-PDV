import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { createPrintJob, listPendingPrintJobs, updatePrintJobStatus } from '@/lib/firebaseTenantCrud';

export type PrintJobType = 'kitchen_ticket' | 'customer_receipt' | 'cancellation_ticket' | 'kitchen_ticket_sector';
export type PrintJobStatus = 'pending' | 'printed' | 'failed';

export interface PrintJob {
  id: string;
  print_type: PrintJobType;
  data: Record<string, unknown>;
  status: PrintJobStatus;
  created_by: string | null;
  created_at: string;
  printed_at: string | null;
  printed_by_device: string | null;
}

export function usePrintQueue(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const enabled = options?.enabled ?? true;

  const { data: pendingJobs } = useQuery({
    queryKey: ['print-queue', 'pending', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const data = await listPendingPrintJobs(tenantId);
      return data.map((item) => ({
        ...item,
        data: item.data as Record<string, unknown>,
      })) as PrintJob[];
    },
    enabled: enabled && !!tenantId && !tenantLoading,
    refetchInterval: 5000,
  });

  const addPrintJob = useMutation({
    mutationFn: async (job: { print_type: PrintJobType; data: Record<string, unknown> }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const data = await createPrintJob(tenantId, {
        print_type: job.print_type,
        data: job.data,
        created_by: user?.id ?? null,
      });
      return {
        ...data,
        data: data.data as Record<string, unknown>,
      } as PrintJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-queue'] });
    },
  });

  const markAsPrinted = useMutation({
    mutationFn: async ({ jobId, deviceId }: { jobId: string; deviceId: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await updatePrintJobStatus(tenantId, jobId, 'printed', { printed_by_device: deviceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-queue'] });
    },
  });

  const markAsFailed = useMutation({
    mutationFn: async (jobId: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await updatePrintJobStatus(tenantId, jobId, 'failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-queue'] });
    },
  });

  return {
    pendingJobs,
    addPrintJob,
    markAsPrinted,
    markAsFailed,
  };
}
