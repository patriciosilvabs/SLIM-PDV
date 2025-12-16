import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Employee {
  id: string;
  name: string;
}

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });
}
