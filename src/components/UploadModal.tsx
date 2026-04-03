import React, { useState, useRef } from 'react';
import { X, Upload, Film, CheckCircle2, Loader2, AlertCircle, Plus, Trash2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  storage, 
  db, 
  auth, 
  handleFirestoreError, 
  OperationType 
} from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Channel } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  userChannels: Channel[];
}

export default function UploadModal({ isOpen, onClose, userChannels }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>(userChannels?.[0]?.id || '');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [chapters, setChapters] = useState<{ timestamp: number; title: string }[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterTime, setNewChapterTime] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateThumbnail = (videoFile: File): Promise<{ blob: Blob; url: string }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        // Seek to 1 second or half duration
        video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              resolve({ blob, url });
            } else {
              reject(new Error('Failed to generate thumbnail blob'));
            }
          }, 'image/jpeg', 0.7);
        } else {
          reject(new Error('Failed to get canvas context'));
        }
        URL.revokeObjectURL(video.src);
      };

      video.onerror = () => {
        reject(new Error('Failed to load video for thumbnail generation'));
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type.startsWith('video/')) {
        setFile(selectedFile);
        setTitle(selectedFile.name.split('.').slice(0, -1).join('.'));
        setUploadStatus('idle');
        setChapters([]); // Reset chapters on new file
        
        try {
          const { blob, url } = await generateThumbnail(selectedFile);
          setThumbnailBlob(blob);
          setThumbnailPreview(url);
        } catch (err) {
          console.error("Thumbnail generation error:", err);
          // Fallback to placeholder if thumbnail generation fails
        }
      } else {
        setErrorMessage('Please select a valid video file.');
        setUploadStatus('error');
      }
    }
  };

  const addChapter = () => {
    if (!newChapterTitle || !newChapterTime) return;
    
    let seconds = 0;
    if (newChapterTime.includes(':')) {
      const parts = newChapterTime.split(':').map(Number);
      if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
      else if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
      seconds = Number(newChapterTime);
    }

    if (isNaN(seconds)) return;

    setChapters([...chapters, { timestamp: seconds, title: newChapterTitle }].sort((a, b) => a.timestamp - b.timestamp));
    setNewChapterTitle('');
    setNewChapterTime('');
  };

  const removeChapter = (index: number) => {
    setChapters(chapters.filter((_, i) => i !== index));
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleUpload = async () => {
    if (!file || !auth.currentUser || !selectedChannelId) return;

    const selectedChannel = userChannels.find(c => c.id === selectedChannelId);
    if (!selectedChannel) return;

    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      // 1. Upload Video
      const videoStoragePath = `videos/${auth.currentUser.uid}/${Date.now()}_${file.name}`;
      const videoStorageRef = ref(storage, videoStoragePath);
      const videoUploadTask = uploadBytesResumable(videoStorageRef, file);

      // 2. Upload Thumbnail (if generated)
      let thumbnailURL = `https://picsum.photos/seed/${Date.now()}/800/450`;
      if (thumbnailBlob) {
        const thumbStoragePath = `thumbnails/${auth.currentUser.uid}/${Date.now()}_thumb.jpg`;
        const thumbStorageRef = ref(storage, thumbStoragePath);
        await uploadBytesResumable(thumbStorageRef, thumbnailBlob);
        thumbnailURL = await getDownloadURL(thumbStorageRef);
      }

      videoUploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload failed", error);
          setUploadStatus('error');
          setErrorMessage('Failed to upload video to storage.');
          setIsUploading(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(videoUploadTask.snapshot.ref);
            
            // Save metadata to Firestore
            const videoData = {
              title,
              description,
              videoUrl: downloadURL,
              thumbnail: thumbnailURL,
              userId: auth.currentUser?.uid,
              channelId: selectedChannel.id,
              channelName: selectedChannel.name,
              channelAvatar: selectedChannel.avatarUrl || '',
              views: "0 views",
              likes: "0",
              duration: "0:00",
              postedAt: serverTimestamp(),
              subscribers: "0 subscribers",
              qualities: {
                "Original": downloadURL
              },
              chapters: chapters.length > 0 ? chapters : null
            };

            await addDoc(collection(db, 'videos'), videoData);
            
            setUploadStatus('success');
            setIsUploading(false);
            setTimeout(() => {
              onClose();
              resetForm();
            }, 2000);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'videos');
            setUploadStatus('error');
            setErrorMessage('Failed to save video information.');
            setIsUploading(false);
          }
        }
      );
    } catch (error) {
      console.error("Upload process error:", error);
      setUploadStatus('error');
      setErrorMessage('An unexpected error occurred during upload.');
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setSelectedChannelId(userChannels?.[0]?.id || '');
    setChapters([]);
    setNewChapterTitle('');
    setNewChapterTime('');
    setUploadProgress(0);
    setIsUploading(false);
    setUploadStatus('idle');
    setErrorMessage('');
    setThumbnailBlob(null);
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-bold">Upload Video</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              disabled={isUploading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            {uploadStatus === 'success' ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Upload Complete!</h3>
                <p className="text-gray-500">Your video is being processed and will appear in the feed shortly.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {!file ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 hover:bg-red-50/30 transition-all group"
                  >
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-red-100 transition-colors">
                      <Upload className="w-8 h-8 text-gray-400 group-hover:text-red-600" />
                    </div>
                    <p className="font-bold text-gray-700">Select video file to upload</p>
                    <p className="text-sm text-gray-500 mt-1">Your videos will be private until you publish them</p>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="video/*"
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200 overflow-hidden relative">
                        {thumbnailPreview ? (
                          <img 
                            src={thumbnailPreview} 
                            alt="Thumbnail preview" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Film className="w-12 h-12 text-gray-300" />
                        )}
                        <div className="absolute bottom-2 left-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded truncate">
                          {file.name}
                        </div>
                      </div>
                      <button 
                        onClick={() => setFile(null)}
                        className="text-sm text-red-600 font-bold hover:underline"
                        disabled={isUploading}
                      >
                        Change file
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Select Channel</label>
                        <select
                          value={selectedChannelId}
                          onChange={(e) => setSelectedChannelId(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                          disabled={isUploading}
                        >
                          {userChannels.map(channel => (
                            <option key={channel.id} value={channel.id}>
                              {channel.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Title (required)</label>
                        <input 
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Add a title that describes your video"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                          disabled={isUploading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                        <textarea 
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Tell viewers about your video"
                          rows={4}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                          disabled={isUploading}
                        />
                      </div>

                      {/* Chapters Section */}
                      <div className="space-y-3 pt-2">
                        <label className="block text-sm font-bold text-gray-700">Video Chapters</label>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={newChapterTime}
                            onChange={(e) => setNewChapterTime(e.target.value)}
                            placeholder="0:00"
                            className="w-24 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                            disabled={isUploading}
                          />
                          <input 
                            type="text"
                            value={newChapterTitle}
                            onChange={(e) => setNewChapterTitle(e.target.value)}
                            placeholder="Chapter title"
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                            disabled={isUploading}
                            onKeyPress={(e) => e.key === 'Enter' && addChapter()}
                          />
                          <button 
                            onClick={addChapter}
                            disabled={isUploading || !newChapterTitle || !newChapterTime}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>

                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {chapters.map((chapter, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-xl group">
                              <div className="flex items-center gap-3">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-xs font-mono font-bold text-red-600">{formatTime(chapter.timestamp)}</span>
                                <span className="text-xs font-medium text-gray-700">{chapter.title}</span>
                              </div>
                              <button 
                                onClick={() => removeChapter(index)}
                                className="p-1 hover:bg-red-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                disabled={isUploading}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {uploadStatus === 'error' && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{errorMessage}</p>
                  </div>
                )}

                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span className="text-gray-700">Uploading...</span>
                      <span className="text-red-600">{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="h-full bg-red-600"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {uploadStatus !== 'success' && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-2 font-bold text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button 
                onClick={handleUpload}
                disabled={!file || !title || isUploading}
                className="px-8 py-2 bg-red-600 text-white font-bold rounded-full hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading
                  </>
                ) : (
                  'Upload'
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
