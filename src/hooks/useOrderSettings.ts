import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export type PrintFontSize = 'normal' | 'large' | 'extra_large';
export type LogoPrintMode = 'original' | 'grayscale' | 'dithered';

interface OrderSettings {
  duplicateItems: boolean;
  autoPrintKitchenTicket: boolean;
  autoPrintCustomerReceipt: boolean;
  kitchenFontSize: PrintFontSize;
  receiptFontSize: PrintFontSize;
  lineSpacing: number;
  leftMargin: number;
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
  restaurantCnpj: string;
  restaurantLogoUrl: string;
  duplicateKitchenTicket: boolean;
  asciiMode: boolean;
  charSpacing: number;
  topMargin: number;
  bottomMarginKitchen: number;
  bottomMarginReceipt: number;
  showItemNumber: boolean;
  showComplementPrice: boolean;
  showComplementName: boolean;
  largeFontProduction: boolean;
  multiplyOptions: boolean;
  showLogo: boolean;
  printCancellation: boolean;
  printRatingQr: boolean;
  printMessageStandard: string;
  printMessageTable: string;
  printQrStandard: string;
  printQrTable: string;
  logoMaxWidth: number;
  qrCodeSize: number;
  logoPrintMode: LogoPrintMode;
}

const defaultSettings: OrderSettings = {
  duplicateItems: false,
  autoPrintKitchenTicket: true,
  autoPrintCustomerReceipt: true,
  kitchenFontSize: 'normal',
  receiptFontSize: 'normal',
  lineSpacing: 0,
  leftMargin: 0,
  restaurantName: 'TOTAL',
  restaurantAddress: '',
  restaurantPhone: '',
  restaurantCnpj: '',
  restaurantLogoUrl: '',
  duplicateKitchenTicket: false,
  asciiMode: false,
  charSpacing: 1,
  topMargin: 0,
  bottomMarginKitchen: 3,
  bottomMarginReceipt: 4,
  showItemNumber: true,
  showComplementPrice: false,
  showComplementName: true,
  largeFontProduction: false,
  multiplyOptions: false,
  showLogo: true,
  printCancellation: true,
  printRatingQr: false,
  printMessageStandard: 'Obrigado pelo seu pedido!',
  printMessageTable: 'Obrigado pela preferência!',
  printQrStandard: '',
  printQrTable: '',
  logoMaxWidth: 300,
  qrCodeSize: 5,
  logoPrintMode: 'original',
};

const SETTINGS_KEY = 'order_settings';

export function useOrderSettings() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ['order-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return { settings: defaultSettings };

      const { data: record, error } = await supabase
        .from('global_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('key', SETTINGS_KEY)
        .maybeSingle();

      if (error) {
        console.error('Error fetching order settings:', error);
        return { settings: defaultSettings };
      }

      if (!record) {
        return { settings: defaultSettings };
      }

      const storedValue = record.value as Record<string, unknown>;
      return {
        settings: { ...defaultSettings, ...storedValue } as OrderSettings,
      };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<OrderSettings>) => {
      if (!tenantId) throw new Error('No tenant ID');

      const currentSettings = data?.settings ?? defaultSettings;
      const newSettings = { ...currentSettings, ...updates };

      const { error } = await supabase
        .from('global_settings')
        .upsert(
          {
            tenant_id: tenantId,
            key: SETTINGS_KEY,
            value: newSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,key' }
        );

      if (error) throw error;
      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-settings', tenantId] });
    },
  });

  const settings = data?.settings ?? defaultSettings;

  // Toggle functions - mantendo compatibilidade com a API original
  const toggleDuplicateItems = (value: boolean) => updateMutation.mutate({ duplicateItems: value });
  const toggleAutoPrintKitchenTicket = (value: boolean) => updateMutation.mutate({ autoPrintKitchenTicket: value });
  const toggleAutoPrintCustomerReceipt = (value: boolean) => updateMutation.mutate({ autoPrintCustomerReceipt: value });
  const toggleDuplicateKitchenTicket = (value: boolean) => updateMutation.mutate({ duplicateKitchenTicket: value });
  const toggleAsciiMode = (value: boolean) => updateMutation.mutate({ asciiMode: value });
  const toggleShowItemNumber = (value: boolean) => updateMutation.mutate({ showItemNumber: value });
  const toggleShowComplementPrice = (value: boolean) => updateMutation.mutate({ showComplementPrice: value });
  const toggleShowComplementName = (value: boolean) => updateMutation.mutate({ showComplementName: value });
  const toggleLargeFontProduction = (value: boolean) => updateMutation.mutate({ largeFontProduction: value });
  const toggleMultiplyOptions = (value: boolean) => updateMutation.mutate({ multiplyOptions: value });
  const toggleShowLogo = (value: boolean) => updateMutation.mutate({ showLogo: value });
  const togglePrintCancellation = (value: boolean) => updateMutation.mutate({ printCancellation: value });
  const togglePrintRatingQr = (value: boolean) => updateMutation.mutate({ printRatingQr: value });

  // Update functions
  const updateKitchenFontSize = (value: PrintFontSize) => updateMutation.mutate({ kitchenFontSize: value });
  const updateReceiptFontSize = (value: PrintFontSize) => updateMutation.mutate({ receiptFontSize: value });
  const updateLineSpacing = (value: number) => updateMutation.mutate({ lineSpacing: value });
  const updateLeftMargin = (value: number) => updateMutation.mutate({ leftMargin: value });
  const updateRestaurantName = (value: string) => updateMutation.mutate({ restaurantName: value });
  const updateRestaurantAddress = (value: string) => updateMutation.mutate({ restaurantAddress: value });
  const updateRestaurantPhone = (value: string) => updateMutation.mutate({ restaurantPhone: value });
  const updateRestaurantCnpj = (value: string) => updateMutation.mutate({ restaurantCnpj: value });
  const updateRestaurantLogoUrl = (value: string) => updateMutation.mutate({ restaurantLogoUrl: value });
  const updateCharSpacing = (value: number) => updateMutation.mutate({ charSpacing: value });
  const updateTopMargin = (value: number) => updateMutation.mutate({ topMargin: value });
  const updateBottomMarginKitchen = (value: number) => updateMutation.mutate({ bottomMarginKitchen: value });
  const updateBottomMarginReceipt = (value: number) => updateMutation.mutate({ bottomMarginReceipt: value });
  const updatePrintMessageStandard = (value: string) => updateMutation.mutate({ printMessageStandard: value });
  const updatePrintMessageTable = (value: string) => updateMutation.mutate({ printMessageTable: value });
  const updatePrintQrStandard = (value: string) => updateMutation.mutate({ printQrStandard: value });
  const updatePrintQrTable = (value: string) => updateMutation.mutate({ printQrTable: value });
  const updateLogoMaxWidth = (value: number) => updateMutation.mutate({ logoMaxWidth: value });
  const updateQrCodeSize = (value: number) => updateMutation.mutate({ qrCodeSize: value });
  const updateLogoPrintMode = (value: LogoPrintMode) => updateMutation.mutate({ logoPrintMode: value });

  return {
    // Settings values - spread para manter compatibilidade
    duplicateItems: settings.duplicateItems,
    autoPrintKitchenTicket: settings.autoPrintKitchenTicket,
    autoPrintCustomerReceipt: settings.autoPrintCustomerReceipt,
    kitchenFontSize: settings.kitchenFontSize,
    receiptFontSize: settings.receiptFontSize,
    lineSpacing: settings.lineSpacing,
    leftMargin: settings.leftMargin,
    restaurantName: settings.restaurantName,
    restaurantAddress: settings.restaurantAddress,
    restaurantPhone: settings.restaurantPhone,
    restaurantCnpj: settings.restaurantCnpj,
    restaurantLogoUrl: settings.restaurantLogoUrl,
    duplicateKitchenTicket: settings.duplicateKitchenTicket,
    asciiMode: settings.asciiMode,
    charSpacing: settings.charSpacing,
    topMargin: settings.topMargin,
    bottomMarginKitchen: settings.bottomMarginKitchen,
    bottomMarginReceipt: settings.bottomMarginReceipt,
    showItemNumber: settings.showItemNumber,
    showComplementPrice: settings.showComplementPrice,
    showComplementName: settings.showComplementName,
    largeFontProduction: settings.largeFontProduction,
    multiplyOptions: settings.multiplyOptions,
    showLogo: settings.showLogo,
    printCancellation: settings.printCancellation,
    printRatingQr: settings.printRatingQr,
    printMessageStandard: settings.printMessageStandard,
    printMessageTable: settings.printMessageTable,
    printQrStandard: settings.printQrStandard,
    printQrTable: settings.printQrTable,
    logoMaxWidth: settings.logoMaxWidth,
    qrCodeSize: settings.qrCodeSize,
    logoPrintMode: settings.logoPrintMode,

    // Loading states
    isLoading,
    isSaving: updateMutation.isPending,

    // Toggle functions
    toggleDuplicateItems,
    toggleAutoPrintKitchenTicket,
    toggleAutoPrintCustomerReceipt,
    toggleDuplicateKitchenTicket,
    toggleAsciiMode,
    toggleShowItemNumber,
    toggleShowComplementPrice,
    toggleShowComplementName,
    toggleLargeFontProduction,
    toggleMultiplyOptions,
    toggleShowLogo,
    togglePrintCancellation,
    togglePrintRatingQr,

    // Update functions
    updateKitchenFontSize,
    updateReceiptFontSize,
    updateLineSpacing,
    updateLeftMargin,
    updateRestaurantName,
    updateRestaurantAddress,
    updateRestaurantPhone,
    updateRestaurantCnpj,
    updateRestaurantLogoUrl,
    updateCharSpacing,
    updateTopMargin,
    updateBottomMarginKitchen,
    updateBottomMarginReceipt,
    updatePrintMessageStandard,
    updatePrintMessageTable,
    updatePrintQrStandard,
    updatePrintQrTable,
    updateLogoMaxWidth,
    updateQrCodeSize,
    updateLogoPrintMode,
  };
}
