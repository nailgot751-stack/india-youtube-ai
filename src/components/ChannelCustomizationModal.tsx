import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, storage, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface ChannelCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function ChannelCustomizationModal({ isOpen, onClose, userId }: ChannelCustomizationModalProps) {
  const [description, setDescription] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && userId) {
      const fetchChannelData = async () => {
        try {
          const docRef = doc(db, 'channels', userId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setDescription(data.description || '');
            setBannerPreview(data.bannerUrl || null);
          }
        } catch (error) {
          console.error('Error fetching channel data:', error);
        }
      };
      fetchChannelData();
    }
  }, [isOpen, userId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setStatus('error');
        setErrorMessage('Banner image must be less than 5MB');
        return;
      }
      setBannerFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setStatus('idle');
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    setIsUploading(true);
    setStatus('uploading');
    setUploadProgress(0);

    try {
      let bannerUrl = bannerPreview;

      if (bannerFile) {
        const storageRef = ref(storage, `banners/${userId}/${Date.now()}_${bannerFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, bannerFile);

        bannerUrl = await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => reject(error),
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            }
          );
        });
      }

      await setDoc(doc(db, 'channels', userId), {
        userId,
        bannerUrl,
        description,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setStatus('success');
      setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 2000);
    } catch (error) {
      setStatus('error');
      setErrorMessage('Failed to save channel customization');
      handleFirestoreError(error, OperationType.WRITE, 'channels');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-bold">Customize Channel</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Banner Upload */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Channel Banner</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative aspect-[4/1] w-full bg-gray-100 rounded-2xl border-2 border-dashed border-gray-200 hover:border-red-300 hover:bg-red-50/30 transition-all cursor-pointer overflow-hidden group"
              >
                {bannerPreview ? (
                  <>
                    <img 
                      src={bannerPreview} 
                      alt="Banner Preview" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-white/20 backdrop-blur-md p-3 rounded-full">
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
                    <ImageIcon className="w-10 h-10" />
                    <p className="text-sm font-medium">Click to upload banner image</p>
                    <p className="text-xs">Recommended size: 2048 x 1152 px</p>
                  </div>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Channel Description</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell viewers about your channel..."
                className="w-full h-32 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
              />
            </div>

            {/* Status Messages */}
            {status === 'error' && (
              <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-2xl text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}

            {status === 'success' && (
              <div className="flex items-center gap-2 p-4 bg-green-50 text-green-600 rounded-2xl text-sm">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <p>Channel customized successfully!</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isUploading}
              className="px-8 py-2 bg-red-600 text-white rounded-full text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving {Math.round(uploadProgress)}%</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
