import { useMutation } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { extractBucketPathFromUrl, removeFromBucket, uploadToBucket } from '@/lib/firebaseStorageCompat';

const BUCKET_NAME = 'product-images';

export function useProductImages() {
  const uploadImage = useMutation({
    mutationFn: async ({ file, folder = 'products' }: { file: File; folder?: string }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${crypto.randomUUID()}.${fileExt}`;

      return uploadToBucket({
        bucket: BUCKET_NAME,
        filePath: fileName,
        file,
        contentType: file.type || undefined,
      });
    },
    onError: (error) => {
      toast({ title: 'Erro ao fazer upload', description: error.message, variant: 'destructive' });
    }
  });

  const deleteImage = useMutation({
    mutationFn: async (url: string) => {
      const filePath = extractBucketPathFromUrl(url, BUCKET_NAME);
      if (!filePath) return;
      await removeFromBucket({ bucket: BUCKET_NAME, paths: [filePath] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover imagem', description: error.message, variant: 'destructive' });
    }
  });

  return { uploadImage, deleteImage };
}
