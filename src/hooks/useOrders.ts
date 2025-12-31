import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { useTenant } from './useTenant';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export interface OrderItemStation {
  id: string;
  name: string;
  station_type: string;
  color: string | null;
  icon: string | null;
  sort_order: number | null;
}

export interface OrderItemSubExtra {
  id: string;
  group_name: string;
  option_name: string;
  price: number;
  quantity: number;
}

export interface OrderItemSubItem {
  id: string;
  sub_item_index: number;
  notes: string | null;
  sub_extras: OrderItemSubExtra[];
}

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
  added_by?: string | null;
  current_station_id?: string | null;
  station_status?: 'waiting' | 'in_progress' | 'completed' | null;
  product?: { name: string; image_url: string | null };
  variation?: { name: string } | null;
  extras?: { extra_name: string; price: number }[] | null;
  current_station?: OrderItemStation | null;
  added_by_profile?: { name: string } | null;
  sub_items?: OrderItemSubItem[] | null;
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
  party_size?: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  ready_at?: string | null;
  served_at?: string | null;
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
        .select('*, table:tables(number), order_items(*, added_by, product:products(name, image_url), variation:product_variations(name), extras:order_item_extras(extra_name, price), current_station:kds_stations(id, name, station_type, color, icon, sort_order), sub_items:order_item_sub_items(id, sub_item_index, notes, sub_extras:order_item_sub_item_extras(id, group_name, option_name, price, quantity)))')
        .order('created_at', { ascending: false });
      
      if (status && status.length > 0) {
        q = q.in('status', status);
      }
      
      const { data: ordersData, error } = await q;
      if (error) throw error;
      
      // Collect all user IDs (order creators + item adders)
      const createdByIds = ordersData?.map(o => o.created_by).filter(Boolean) as string[];
      const addedByIds = ordersData?.flatMap(o => 
        o.order_items?.map((item: { added_by?: string | null }) => item.added_by).filter(Boolean) || []
      ) as string[];
      
      const allUserIds = [...new Set([...createdByIds, ...addedByIds])];
      let profilesMap: Record<string, { name: string }> = {};
      
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', allUserIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = { name: p.name };
            return acc;
          }, {} as Record<string, { name: string }>);
        }
      }
      
      // Merge profiles into orders and order items
      const ordersWithProfiles = ordersData?.map(order => {
        const orderItems = (order.order_items || []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          order_id: item.order_id as string,
          product_id: item.product_id as string | null,
          variation_id: item.variation_id as string | null,
          quantity: item.quantity as number,
          unit_price: item.unit_price as number,
          total_price: item.total_price as number,
          notes: item.notes as string | null,
          status: item.status as OrderStatus,
          created_at: item.created_at as string,
          added_by: item.added_by as string | null,
          current_station_id: item.current_station_id as string | null,
          station_status: item.station_status as 'waiting' | 'in_progress' | 'completed' | null,
          product: item.product as { name: string; image_url: string | null } | undefined,
          variation: item.variation as { name: string } | null,
          extras: item.extras as { extra_name: string; price: number }[] | null,
          current_station: item.current_station as OrderItemStation | null,
          added_by_profile: (item.added_by as string) ? profilesMap[item.added_by as string] || null : null,
          sub_items: item.sub_items as OrderItemSubItem[] | null,
        })) as OrderItem[];

        return {
          id: order.id,
          table_id: order.table_id,
          order_type: order.order_type as OrderType,
          status: order.status as OrderStatus,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_address: order.customer_address,
          subtotal: order.subtotal ?? 0,
          discount: order.discount ?? 0,
          total: order.total ?? 0,
          notes: order.notes,
          party_size: order.party_size,
          created_by: order.created_by,
          created_at: order.created_at ?? '',
          updated_at: order.updated_at ?? '',
          ready_at: order.ready_at,
          served_at: order.served_at,
          delivered_at: order.delivered_at,
          cancelled_at: order.cancelled_at,
          cancelled_by: order.cancelled_by,
          cancellation_reason: order.cancellation_reason,
          status_before_cancellation: order.status_before_cancellation as OrderStatus | null,
          is_draft: order.is_draft,
          table: order.table as { number: number } | null,
          order_items: orderItems,
          created_by_profile: order.created_by ? profilesMap[order.created_by] || null : null
        } as Order;
      }) || [];
      
      return ordersWithProfiles;
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
  const { tenantId } = useTenant();

  const createOrder = useMutation({
    mutationFn: async (order: Partial<Order>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('orders')
        .insert({ ...order, created_by: userData.user?.id, tenant_id: tenantId })
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
    mutationFn: async (item: Omit<OrderItem, 'id' | 'created_at' | 'product' | 'added_by' | 'added_by_profile'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      // Obter usuário atual para registrar quem adicionou o item
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || null;
      
      console.log('[addOrderItem] Inserindo item com added_by:', userId);
      
      const { data, error } = await supabase
        .from('order_items')
        .insert({ 
          ...item, 
          added_by: userId,
          tenant_id: tenantId
        })
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
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const extrasWithTenant = extras.map(e => ({ ...e, tenant_id: tenantId }));
      
      const { data, error } = await supabase
        .from('order_item_extras')
        .insert(extrasWithTenant)
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

  // Mutation para adicionar sub-items (pizzas individuais de um combo)
  const addOrderItemSubItems = useMutation({
    mutationFn: async (params: {
      order_item_id: string;
      sub_items: {
        sub_item_index: number;
        notes?: string | null;
        extras: {
          group_id?: string | null;
          group_name: string;
          option_id?: string | null;
          option_name: string;
          price: number;
          quantity: number;
        }[];
      }[];
    }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      if (params.sub_items.length === 0) return [];

      // 1. Inserir os sub-items
      const subItemsToInsert = params.sub_items.map(si => ({
        order_item_id: params.order_item_id,
        sub_item_index: si.sub_item_index,
        notes: si.notes || null,
        tenant_id: tenantId,
      }));

      const { data: insertedSubItems, error: subItemsError } = await supabase
        .from('order_item_sub_items')
        .insert(subItemsToInsert)
        .select();

      if (subItemsError) throw subItemsError;
      if (!insertedSubItems) throw new Error('Falha ao inserir sub-items');

      // 2. Inserir os extras de cada sub-item
      const extrasToInsert: {
        sub_item_id: string;
        group_id: string | null;
        group_name: string;
        option_id: string | null;
        option_name: string;
        price: number;
        quantity: number;
        tenant_id: string;
      }[] = [];

      for (const insertedSubItem of insertedSubItems) {
        const originalSubItem = params.sub_items.find(
          si => si.sub_item_index === insertedSubItem.sub_item_index
        );
        if (originalSubItem && originalSubItem.extras.length > 0) {
          for (const extra of originalSubItem.extras) {
            extrasToInsert.push({
              sub_item_id: insertedSubItem.id,
              group_id: extra.group_id || null,
              group_name: extra.group_name,
              option_id: extra.option_id || null,
              option_name: extra.option_name,
              price: extra.price,
              quantity: extra.quantity,
              tenant_id: tenantId,
            });
          }
        }
      }

      if (extrasToInsert.length > 0) {
        const { error: extrasError } = await supabase
          .from('order_item_sub_item_extras')
          .insert(extrasToInsert);

        if (extrasError) throw extrasError;
      }

      return insertedSubItems;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar sub-items', description: error.message, variant: 'destructive' });
    },
  });

  return { createOrder, updateOrder, addOrderItem, addOrderItemExtras, addOrderItemSubItems, updateOrderItem, deleteOrderItem };
}