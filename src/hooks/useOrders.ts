import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variation_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  status: OrderStatus;
  created_at: string;
  product?: { name: string; image_url: string | null };
  variation?: { name: string } | null;
  extras?: { extra_name: string; price: number }[] | null;
}

export interface Order {
  id: string;
  table_id: string | null;
  order_type: OrderType;
  status: OrderStatus;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  ready_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  status_before_cancellation?: OrderStatus | null;
  is_draft?: boolean;
  table?: { number: number } | null;
  order_items?: OrderItem[];
  created_by_profile?: { name: string } | null;
}

export function useOrders(status?: OrderStatus[]) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['orders', status],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('*, table:tables(number), order_items(*, product:products(name, image_url), variation:product_variations(name), extras:order_item_extras(extra_name, price))')
        .order('created_at', { ascending: false });
      
      if (status && status.length > 0) {
        q = q.in('status', status);
      }
      
      const { data: ordersData, error } = await q;
      if (error) throw error;
      
      // Fetch profiles for created_by users
      const createdByIds = [...new Set(ordersData?.map(o => o.created_by).filter(Boolean) as string[])];
      let profilesMap: Record<string, { name: string }> = {};
      
      if (createdByIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', createdByIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = { name: p.name };
            return acc;
          }, {} as Record<string, { name: string }>);
        }
      }
      
      // Merge profiles into orders
      const ordersWithProfiles = ordersData?.map(order => ({
        ...order,
        created_by_profile: order.created_by ? profilesMap[order.created_by] || null : null
      }));
      
      return ordersWithProfiles as Order[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useOrderMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createOrder = useMutation({
    mutationFn: async (order: Partial<Order>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('orders')
        .insert({ ...order, created_by: userData.user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast({ title: 'Pedido criado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar pedido', description: error.message, variant: 'destructive' });
    },
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, ...order }: Partial<Order> & { id: string }) => {
      const { data, error } = await supabase
        .from('orders')
        .update(order)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar pedido', description: error.message, variant: 'destructive' });
    },
  });

  const addOrderItem = useMutation({
    mutationFn: async (item: Omit<OrderItem, 'id' | 'created_at' | 'product'>) => {
      const { data, error } = await supabase
        .from('order_items')
        .insert(item)
        .select()
        .single();
      
      if (error) throw error;

      // Update order totals
      const { data: items } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', item.order_id);
      
      const subtotal = items?.reduce((sum, i) => sum + Number(i.total_price), 0) || 0;
      
      await supabase
        .from('orders')
        .update({ subtotal, total: subtotal })
        .eq('id', item.order_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar item', description: error.message, variant: 'destructive' });
    },
  });

  const updateOrderItem = useMutation({
    mutationFn: async ({ id, order_id, ...item }: Partial<OrderItem> & { id: string; order_id: string }) => {
      const { data, error } = await supabase
        .from('order_items')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // Update order totals
      const { data: items } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', order_id);
      
      const subtotal = items?.reduce((sum, i) => sum + Number(i.total_price), 0) || 0;
      
      await supabase
        .from('orders')
        .update({ subtotal, total: subtotal })
        .eq('id', order_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const deleteOrderItem = useMutation({
    mutationFn: async ({ id, order_id }: { id: string; order_id: string }) => {
      const { error } = await supabase
        .from('order_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;

      // Update order totals
      const { data: items } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', order_id);
      
      const subtotal = items?.reduce((sum, i) => sum + Number(i.total_price), 0) || 0;
      
      await supabase
        .from('orders')
        .update({ subtotal, total: subtotal })
        .eq('id', order_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const addOrderItemExtras = useMutation({
    mutationFn: async (extras: { order_item_id: string; extra_name: string; price: number; extra_id?: string | null }[]) => {
      if (extras.length === 0) return [];
      
      const { data, error } = await supabase
        .from('order_item_extras')
        .insert(extras)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar complementos', description: error.message, variant: 'destructive' });
    },
  });

  return { createOrder, updateOrder, addOrderItem, addOrderItemExtras, updateOrderItem, deleteOrderItem };
}