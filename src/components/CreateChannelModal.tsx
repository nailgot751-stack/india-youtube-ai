import React, { useState } from 'react';
import { X, Loader2, Sparkles, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (channelId: string) => void;
}

export default function CreateChannelModal({ isOpen, onClose, onSuccess }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim() || !auth.currentUser) return;

    setIsCreating(true);
    setError('');

    try {
      const channelData = {
        userId: auth.currentUser.uid,
        name: name.trim(),
        description: description.trim(),
        avatarUrl: auth.currentUser.photoURL || '',
        bannerUrl: '',
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'channels'), channelData);
      onSuccess(docRef.id);
      onClose();
      setName('');
      setDescription('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'channels');
      setError('Failed to create channel. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-red-600" />
              Create New Channel
            </h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              disabled={isCreating}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Channel Name</label>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter channel name"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                disabled={isCreating}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Description (Optional)</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is your channel about?"
                rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                disabled={isCreating}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 font-medium">{error}</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button 
                onClick={onClose}
                className="flex-1 px-6 py-2.5 font-bold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate}
                disabled={!name.trim() || isCreating}
                className="flex-1 px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Channel'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
