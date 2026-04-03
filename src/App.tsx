import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Home, 
  PlaySquare, 
  Library, 
  Search, 
  Bell, 
  User, 
  ThumbsUp, 
  ThumbsDown, 
  Share2, 
  PlusSquare, 
  MoreVertical,
  ChevronDown,
  ExternalLink,
  MonitorPlay,
  Download,
  ListPlus,
  Sparkles,
  Loader2,
  SlidersHorizontal,
  Settings,
  Gauge,
  Image as ImageIcon,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_VIDEOS, Video } from './types';
import { generateVideoRecommendations } from './services/geminiService';
import LiveChat from './components/LiveChat';
import ErrorBoundary from './components/ErrorBoundary';
import UploadModal from './components/UploadModal';
import ChannelCustomizationModal from './components/ChannelCustomizationModal';
import CreateChannelModal from './components/CreateChannelModal';
import { db, auth, signInWithGoogle, handleFirestoreError, OperationType } from './firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, getDocs, where, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Channel } from './types';

type SortOption = 'relevance' | 'date' | 'views' | 'duration';

const parseViews = (views: string): number => {
  const clean = views.toLowerCase().replace('views', '').trim();
  const num = parseFloat(clean.replace(/[^0-9.]/g, ''));
  if (clean.includes('m')) return num * 1000000;
  if (clean.includes('k')) return num * 1000;
  return num || 0;
};

const parseDuration = (duration: string): number => {
  if (duration === 'AI') return 0;
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
};

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'watch' | 'subscriptions' | 'channel'>('home');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [viewingChannelId, setViewingChannelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiRecommendations, setAiRecommendations] = useState<Video[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<Video[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isCreateChannelModalOpen, setIsCreateChannelModalOpen] = useState(false);
  const [firestoreVideos, setFirestoreVideos] = useState<Video[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userChannels, setUserChannels] = useState<Channel[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string>('');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [channelData, setChannelData] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserChannels([]);
      return;
    }

    const q = query(collection(db, 'channels'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const channels = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Channel[];
      setUserChannels(channels);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSubscriptions([]);
      return;
    }

    const q = query(collection(db, 'subscriptions'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => doc.data().channelId);
      setSubscriptions(subs);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (viewingChannelId) {
      const unsubscribe = onSnapshot(doc(db, 'channels', viewingChannelId), (doc) => {
        if (doc.exists()) {
          setChannelData(doc.data());
        } else {
          setChannelData(null);
        }
      });
      return () => unsubscribe();
    } else {
      setChannelData(null);
    }
  }, [viewingChannelId]);

  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('postedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videos = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          postedAt: data.postedAt?.toDate?.()?.toLocaleDateString() || 'Recently'
        };
      }) as Video[];
      setFirestoreVideos(videos);
    });
    return () => unsubscribe();
  }, []);

  const allVideos = [...firestoreVideos, ...MOCK_VIDEOS];

  const filteredVideos = useMemo(() => {
    let results = [...allVideos];
    
    if (currentView === 'subscriptions') {
      results = results.filter(v => subscriptions.includes(v.channelId));
    }

    if (searchQuery.trim()) {
      results = results.filter(v => 
        v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.channelName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    switch (sortBy) {
      case 'date':
        results.sort((a, b) => {
          const dateA = new Date(a.postedAt).getTime() || 0;
          const dateB = new Date(b.postedAt).getTime() || 0;
          return dateB - dateA;
        });
        break;
      case 'views':
        results.sort((a, b) => parseViews(b.views) - parseViews(a.views));
        break;
      case 'duration':
        results.sort((a, b) => parseDuration(b.duration) - parseDuration(a.duration));
        break;
      case 'relevance':
      default:
        // Default order (Firestore desc + Mock)
        break;
    }

    return results;
  }, [allVideos, searchQuery, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        const filtered = allVideos.filter(v => 
          v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.channelName.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 5);
        setSuggestions(filtered);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, firestoreVideos]);

  /**
   * Fetches AI-powered video recommendations based on the currently selected video's title.
   * Uses the Gemini AI service to generate relevant video titles and channels,
   * which are then mapped to mock video objects for display in the "Up next" sidebar.
   */
  useEffect(() => {
    if (selectedVideo && currentView === 'watch') {
      const fetchAIRecommendations = async () => {
        setIsLoadingAI(true);
        try {
          const recommendations = await generateVideoRecommendations(selectedVideo.title);
          
          const aiVideos: Video[] = recommendations.map((rec: any, index: number) => ({
            id: `ai-${index}-${Date.now()}`,
            title: rec.title,
            channelName: rec.channel,
            thumbnail: `https://picsum.photos/seed/ai-${index}-${rec.title.length}/800/450`,
            videoUrl: index % 2 === 0 
              ? "https://www.w3schools.com/html/mov_bbb.mp4" 
              : "https://www.w3schools.com/html/movie.mp4",
            channelAvatar: `https://picsum.photos/seed/ai-avatar-${index}/100/100`,
            subscribers: "AI Pick",
            views: "Recommended",
            postedAt: "Just now",
            duration: "AI",
            description: `AI-generated recommendation based on "${selectedVideo.title}".`,
            likes: "✨"
          }));
          
          setAiRecommendations(aiVideos);
        } catch (error) {
          console.error("Failed to fetch AI recommendations", error);
        } finally {
          setIsLoadingAI(false);
        }
      };

      fetchAIRecommendations();
    }
  }, [selectedVideo, currentView]);

  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video);
    setCurrentView('watch');
    setViewingChannelId(null);
    setIsDescriptionExpanded(false);
    const defaultQuality = video.qualities ? Object.keys(video.qualities)[0] : 'Original';
    setSelectedQuality(defaultQuality);
    setShowQualityMenu(false);
    setPlaybackSpeed(1);
    setShowSpeedMenu(false);
    window.scrollTo(0, 0);
  };

  const handleChannelClick = (channelId: string) => {
    setViewingChannelId(channelId);
    setCurrentView('channel');
    setSelectedVideo(null);
    window.scrollTo(0, 0);
  };

  const currentVideoUrl = useMemo(() => {
    if (!selectedVideo) return '';
    if (selectedVideo.qualities && selectedVideo.qualities[selectedQuality]) {
      return selectedVideo.qualities[selectedQuality];
    }
    return selectedVideo.videoUrl;
  }, [selectedVideo, selectedQuality]);

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedVideo(null);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  const toggleSubscription = async (channelId: string, channelName: string) => {
    if (!user) {
      signInWithGoogle();
      return;
    }

    try {
      const q = query(
        collection(db, 'subscriptions'), 
        where('userId', '==', user.uid),
        where('channelId', '==', channelId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        // Unsubscribe
        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'subscriptions', d.id)));
        await Promise.all(deletePromises);
      } else {
        // Subscribe
        await addDoc(collection(db, 'subscriptions'), {
          userId: user.uid,
          channelId,
          channelName,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'subscriptions');
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans pb-16 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1 cursor-pointer" onClick={handleBackToHome}>
          <div className="bg-red-600 p-1 rounded-lg">
            <PlaySquare className="text-white w-5 h-5 fill-current" />
          </div>
          <span className="font-bold text-xl tracking-tighter">VidFlow</span>
        </div>

        <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-gray-50 border border-gray-200 rounded-full py-2 px-4 pl-10 focus:outline-none focus:ring-1 focus:ring-red-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
          </div>

          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-[60] overflow-hidden"
              >
                {suggestions.map((video) => (
                  <div
                    key={video.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      handleVideoClick(video);
                      setShowSuggestions(false);
                      setSearchQuery('');
                    }}
                  >
                    <Search className="w-4 h-4 text-gray-400" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium line-clamp-1">{video.title}</span>
                      <span className="text-xs text-gray-500">{video.channelName}</span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              if (!user) {
                signInWithGoogle();
                return;
              }
              if (userChannels.length === 0) {
                setIsCreateChannelModalOpen(true);
              } else {
                setIsUploadModalOpen(true);
              }
            }}
            className="hidden md:flex items-center gap-2 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-full transition-colors text-sm font-bold"
          >
            <PlusSquare className="w-5 h-5 text-red-600" />
            Upload
          </button>
          <Search className="md:hidden w-6 h-6 text-gray-700" />
          <Bell className="w-6 h-6 text-gray-700" />
          {user ? (
            <img 
              src={user.photoURL || ''} 
              alt="Profile" 
              className="w-8 h-8 rounded-full object-cover border border-gray-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <button 
              onClick={() => signInWithGoogle()}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors"
            >
              <User className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        userChannels={userChannels}
      />

      <ChannelCustomizationModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        userId={user?.uid || ''}
      />

      <CreateChannelModal
        isOpen={isCreateChannelModalOpen}
        onClose={() => setIsCreateChannelModalOpen(false)}
        onSuccess={(channelId) => {
          handleChannelClick(channelId);
        }}
      />

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 h-[calc(100vh-56px)] sticky top-14 p-2 gap-1 border-r border-gray-50 overflow-y-auto no-scrollbar">
          <SidebarItem icon={<Home className="w-5 h-5" />} label="Home" active={currentView === 'home'} onClick={handleBackToHome} />
          <SidebarItem icon={<PlaySquare className="w-5 h-5" />} label="Shorts" />
          <SidebarItem icon={<PlusSquare className="w-5 h-5" />} label="Subscriptions" active={currentView === 'subscriptions'} onClick={() => setCurrentView('subscriptions')} />
          
          {userChannels.length > 0 ? (
            userChannels.map(channel => (
              <SidebarItem 
                key={channel.id}
                icon={<User className="w-5 h-5" />} 
                label={channel.name} 
                active={currentView === 'channel' && viewingChannelId === channel.id} 
                onClick={() => handleChannelClick(channel.id)} 
              />
            ))
          ) : (
            <SidebarItem 
              icon={<PlusSquare className="w-5 h-5" />} 
              label="Create Channel" 
              onClick={() => user ? setIsCreateChannelModalOpen(true) : signInWithGoogle()} 
            />
          )}

          {userChannels.length > 0 && (
            <SidebarItem 
              icon={<PlusSquare className="w-5 h-5" />} 
              label="New Channel" 
              onClick={() => setIsCreateChannelModalOpen(true)} 
            />
          )}
          
          <hr className="my-2 border-gray-100" />
          
          <SidebarItem icon={<Library className="w-5 h-5" />} label="Library" />
          <SidebarItem icon={<MonitorPlay className="w-5 h-5" />} label="History" />
          <SidebarItem icon={<ThumbsUp className="w-5 h-5" />} label="Liked videos" />
          
          <hr className="my-2 border-gray-100" />
          
          <div className="px-3 py-2">
            <h3 className="text-sm font-bold mb-2">Subscriptions</h3>
            {subscriptions.length > 0 ? (
              <div className="flex flex-col gap-1">
                {subscriptions.map(sub => (
                  <div key={sub} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors group">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold uppercase">
                      {sub?.[0] || '?'}
                    </div>
                    <span className="text-sm truncate flex-1">{sub}</span>
                    <div className="w-1 h-1 rounded-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 px-3 italic">No subscriptions yet</p>
            )}
          </div>
        </aside>

        <main className="flex-1 max-w-7xl mx-auto overflow-hidden">
          {/* Search Filters UI */}
          {currentView !== 'watch' && (
            <div className="px-4 py-2 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
                  {['All', 'Music', 'Gaming', 'Live', 'News', 'Tech', 'Cooking'].map((tag) => (
                    <button 
                      key={tag}
                      className={`px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tag === 'All' ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${showFilters ? 'bg-red-50 text-red-600' : 'hover:bg-gray-100'}`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Filters</span>
                </button>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-4 py-4 border-t border-gray-100">
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sort By</span>
                        <div className="flex flex-wrap gap-2">
                          {(['relevance', 'date', 'views', 'duration'] as SortOption[]).map((option) => (
                            <button
                              key={option}
                              onClick={() => setSortBy(option)}
                              className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${
                                sortBy === option 
                                  ? 'bg-red-600 text-white shadow-lg shadow-red-200' 
                                  : 'bg-white border border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <AnimatePresence mode="wait">
            {currentView === 'home' || currentView === 'subscriptions' || currentView === 'channel' ? (
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-0 md:p-4"
              >
                {currentView === 'channel' && viewingChannelId && (
                  <div className="mb-8">
                    {/* Channel Banner */}
                    <div className="w-full aspect-[6/1] bg-gray-100 rounded-2xl overflow-hidden mb-6">
                      {channelData?.bannerUrl ? (
                        <img 
                          src={channelData.bannerUrl} 
                          alt="Channel Banner" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ImageIcon className="w-12 h-12" />
                        </div>
                      )}
                    </div>

                    {/* Channel Header */}
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6 px-4">
                      <img 
                        src={channelData?.avatarUrl || `https://picsum.photos/seed/${viewingChannelId}/100/100`}
                        alt="Channel Avatar"
                        className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover shadow-lg"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 space-y-2">
                        <h1 className="text-2xl md:text-3xl font-bold">
                          {channelData?.name || 'Channel'}
                        </h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>@{viewingChannelId.slice(0, 8)}</span>
                          <span>•</span>
                          <span>{allVideos.filter(v => v.channelId === viewingChannelId).length} videos</span>
                        </div>
                        {channelData?.description && (
                          <p className="text-sm text-gray-600 max-w-2xl line-clamp-2">
                            {channelData.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 pt-2">
                          {user?.uid === channelData?.userId ? (
                            <button 
                              onClick={() => setIsChannelModalOpen(true)}
                              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-bold transition-colors"
                            >
                              Customize Channel
                            </button>
                          ) : (
                            <button 
                              onClick={() => toggleSubscription(viewingChannelId, channelData?.name || '')}
                              className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                                subscriptions.includes(viewingChannelId)
                                  ? 'bg-gray-100 text-gray-600'
                                  : 'bg-black text-white hover:bg-gray-800'
                              }`}
                            >
                              {subscriptions.includes(viewingChannelId) ? 'Subscribed' : 'Subscribe'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-12 border-b border-gray-100">
                      <div className="flex gap-8 px-4">
                        <button className="pb-3 border-b-2 border-black font-bold text-sm">Videos</button>
                        <button className="pb-3 text-gray-500 hover:text-black font-medium text-sm transition-colors">About</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-8 gap-x-4">
                  {(currentView === 'channel' 
                    ? filteredVideos.filter(v => v.channelId === viewingChannelId)
                    : filteredVideos
                  ).length > 0 ? (
                    (currentView === 'channel' 
                      ? filteredVideos.filter(v => v.channelId === viewingChannelId)
                      : filteredVideos
                    ).map((video) => (
                      <VideoCard 
                        key={video.id} 
                        video={video} 
                        onClick={() => handleVideoClick(video)} 
                        onChannelClick={() => handleChannelClick(video.channelId)}
                      />
                    ))
                  ) : (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-500">
                      <PlaySquare className="w-16 h-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium">No videos found</p>
                      {currentView === 'subscriptions' && (
                        <p className="text-sm">Subscribe to channels to see their latest videos here!</p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
            <motion.div
              key="watch"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col lg:flex-row gap-6 p-0 lg:p-6"
            >
              {selectedVideo && (
                <>
                  {/* Video Player & Info Section */}
                  <div className="flex-1">
                    <div className="aspect-video bg-black w-full sticky top-14 lg:relative lg:top-0 z-40 group/player">
                      <video 
                        ref={videoRef}
                        key={currentVideoUrl}
                        src={currentVideoUrl} 
                        className="w-full h-full" 
                        controls 
                        autoPlay
                        poster={selectedVideo.thumbnail}
                        onLoadedMetadata={() => {
                          if (videoRef.current) {
                            videoRef.current.playbackRate = playbackSpeed;
                          }
                        }}
                      />
                      
                      {/* Controls Overlay */}
                      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
                        {/* Quality Selector */}
                        <div className="relative">
                          <button 
                            onClick={() => {
                              setShowQualityMenu(!showQualityMenu);
                              setShowSpeedMenu(false);
                            }}
                            className="bg-black/40 hover:bg-black/60 backdrop-blur-md text-white p-2 rounded-full transition-all flex items-center gap-1 border border-white/20"
                          >
                            <Settings className={`w-5 h-5 ${showQualityMenu ? 'rotate-90' : ''} transition-transform duration-300`} />
                            <span className="text-[10px] font-bold pr-1">{selectedQuality}</span>
                          </button>

                          <AnimatePresence>
                            {showQualityMenu && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                className="absolute top-full right-0 mt-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl min-w-[120px]"
                              >
                                <div className="p-2 border-b border-white/10">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">Quality</p>
                                </div>
                                <div className="p-1">
                                  {(selectedVideo.qualities ? Object.keys(selectedVideo.qualities) : ['Original']).map((q) => (
                                    <button
                                      key={q}
                                      onClick={() => {
                                        setSelectedQuality(q);
                                        setShowQualityMenu(false);
                                      }}
                                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                                        selectedQuality === q 
                                          ? 'bg-red-600 text-white' 
                                          : 'text-gray-300 hover:bg-white/10'
                                      }`}
                                    >
                                      {q}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Playback Speed Selector */}
                        <div className="relative">
                          <button 
                            onClick={() => {
                              setShowSpeedMenu(!showSpeedMenu);
                              setShowQualityMenu(false);
                            }}
                            className="bg-black/40 hover:bg-black/60 backdrop-blur-md text-white p-2 rounded-full transition-all flex items-center gap-1 border border-white/20"
                          >
                            <Gauge className="w-5 h-5" />
                            <span className="text-[10px] font-bold pr-1">{playbackSpeed}x</span>
                          </button>

                          <AnimatePresence>
                            {showSpeedMenu && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                className="absolute top-full right-0 mt-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl min-w-[120px]"
                              >
                                <div className="p-2 border-b border-white/10">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">Speed</p>
                                </div>
                                <div className="p-1">
                                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                                    <button
                                      key={speed}
                                      onClick={() => {
                                        setPlaybackSpeed(speed);
                                        if (videoRef.current) {
                                          videoRef.current.playbackRate = speed;
                                        }
                                        setShowSpeedMenu(false);
                                      }}
                                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                                        playbackSpeed === speed 
                                          ? 'bg-red-600 text-white' 
                                          : 'text-gray-300 hover:bg-white/10'
                                      }`}
                                    >
                                      {speed === 1 ? 'Normal' : `${speed}x`}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <h1 className="text-xl font-bold leading-tight mb-2">
                        {selectedVideo.title}
                      </h1>
                      
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            {selectedVideo.views} views • {selectedVideo.postedAt}
                          </div>
                          <div className="flex items-center gap-1 text-sm font-medium bg-gray-100 px-3 py-1.5 rounded-full">
                            <ThumbsUp className="w-4 h-4" />
                            {selectedVideo.likes}
                            <div className="w-[1px] h-4 bg-gray-300 mx-1" />
                            <ThumbsDown className="w-4 h-4" />
                          </div>
                        </div>

                        {/* Description Section */}
                        <div className="bg-gray-50 rounded-xl p-3">
                          <button 
                            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                            className="flex items-center justify-between w-full text-left"
                          >
                            <span className="text-sm font-bold">
                              {isDescriptionExpanded ? 'Hide Description' : 'View Description'}
                            </span>
                            <motion.div
                              animate={{ rotate: isDescriptionExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="w-5 h-5 text-gray-600" />
                            </motion.div>
                          </button>
                          
                          <motion.div
                            initial={false}
                            animate={{ 
                              height: isDescriptionExpanded ? 'auto' : 0,
                              opacity: isDescriptionExpanded ? 1 : 0,
                              marginTop: isDescriptionExpanded ? 8 : 0
                            }}
                            className="overflow-hidden"
                          >
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {selectedVideo.description}
                            </p>

                            {selectedVideo.chapters && selectedVideo.chapters.length > 0 && (
                              <div className="mt-6 space-y-3">
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                                  <Clock className="w-4 h-4" />
                                  Chapters
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                  {selectedVideo.chapters.map((chapter, index) => (
                                    <button
                                      key={index}
                                      onClick={() => seekTo(chapter.timestamp)}
                                      className="flex items-center gap-3 p-2 hover:bg-gray-200 rounded-xl transition-all text-left group"
                                    >
                                      <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg group-hover:bg-red-100 transition-colors">
                                        {formatTime(chapter.timestamp)}
                                      </span>
                                      <span className="text-sm font-medium text-gray-700 group-hover:text-black transition-colors">
                                        {chapter.title}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                          <ActionButton icon={<ListPlus className="w-5 h-5" />} label="Playlist" />
                          <ActionButton icon={<MonitorPlay className="w-5 h-5" />} label="Background" />
                          <ActionButton icon={<ExternalLink className="w-5 h-5" />} label="Pop up" />
                          <ActionButton icon={<Share2 className="w-5 h-5" />} label="Share" />
                          <ActionButton icon={<Download className="w-5 h-5" />} label="Download" />
                        </div>

                        <hr className="border-gray-100" />

                        {/* Channel Info */}
                        <div className="flex items-center justify-between py-2">
                          <div 
                            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => handleChannelClick(selectedVideo.channelId)}
                          >
                            <img 
                              src={selectedVideo.channelAvatar} 
                              alt={selectedVideo.channelName}
                              className="w-10 h-10 rounded-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <h3 className="font-bold text-sm">{selectedVideo.channelName}</h3>
                              <p className="text-xs text-gray-500">{selectedVideo.subscribers} subscribers</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => toggleSubscription(selectedVideo.channelId, selectedVideo.channelName)}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                              subscriptions.includes(selectedVideo.channelId)
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                : 'bg-black text-white hover:bg-gray-800'
                            }`}
                          >
                            {subscriptions.includes(selectedVideo.channelId) ? 'Subscribed' : 'Subscribe'}
                          </button>
                        </div>

                        <hr className="border-gray-100" />

                        {/* AI Recommendations Section */}
                        <div className="py-2">
                          <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-purple-600 fill-purple-100" />
                            <h2 className="font-bold text-base">AI Recommended for you</h2>
                          </div>
                          
                          {isLoadingAI ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-3 text-gray-500">
                              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                              <p className="text-sm animate-pulse">Gemini is thinking...</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {aiRecommendations.map((video) => (
                                <div 
                                  key={video.id} 
                                  className="flex flex-col gap-2 cursor-pointer group"
                                  onClick={() => handleVideoClick(video)}
                                >
                                  <div className="relative aspect-video rounded-xl overflow-hidden">
                                    <img 
                                      src={video.thumbnail} 
                                      alt={video.title} 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute top-2 left-2 bg-purple-600/90 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5 fill-current" />
                                      AI
                                    </div>
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-bold line-clamp-2 leading-tight group-hover:text-purple-600 transition-colors">
                                      {video.title}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">{video.channelName}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <hr className="border-gray-100" />

                        {/* Comments Preview */}
                        <div className="bg-gray-50 p-3 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm">Comments <span className="text-gray-500 font-normal ml-1">16K</span></span>
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                          </div>
                          <div className="flex gap-3 items-start">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] text-white font-bold">K</div>
                            <p className="text-xs line-clamp-2">
                              Bhai is video ke bad kam se kam 2 lakh log YouTube channel banayege ...
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations Sidebar & Live Chat */}
                  <div className="lg:w-[400px] p-4 lg:p-0 flex flex-col gap-6">
                    {/* Live Chat (Desktop) */}
                    <div className="hidden lg:block">
                      <ErrorBoundary>
                        <LiveChat videoId={selectedVideo.id} />
                      </ErrorBoundary>
                    </div>

                    <h2 className="font-bold text-lg hidden lg:block">Up next</h2>
                    
                    {/* Live Chat (Mobile) */}
                    <div className="lg:hidden">
                      <ErrorBoundary>
                        <LiveChat videoId={selectedVideo.id} />
                      </ErrorBoundary>
                    </div>

                    {allVideos.filter(v => v.id !== selectedVideo.id).map(video => (
                      <div 
                        key={video.id} 
                        className="flex gap-3 cursor-pointer group"
                        onClick={() => handleVideoClick(video)}
                      >
                        <div className="relative flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden">
                          <img 
                            src={video.thumbnail} 
                            alt={video.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded">
                            {video.duration}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3 className="text-sm font-bold line-clamp-2 leading-tight">{video.title}</h3>
                          <p className="text-xs text-gray-500">{video.channelName}</p>
                          <p className="text-[10px] text-gray-400">{video.views} views • {video.postedAt}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>

    {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-2 flex justify-between items-center z-50">
        <NavItem icon={<Home className="w-6 h-6" />} label="Home" active={currentView === 'home'} onClick={handleBackToHome} />
        <NavItem icon={<PlaySquare className="w-6 h-6" />} label="Shorts" />
        <NavItem icon={<PlusSquare className="w-6 h-6" />} label="Subscriptions" active={currentView === 'subscriptions'} onClick={() => setCurrentView('subscriptions')} />
        <NavItem icon={<Library className="w-6 h-6" />} label="Library" />
        <NavItem icon={<User className="w-6 h-6" />} label="You" />
      </nav>
    </div>
  );
}

interface VideoCardProps {
  video: Video;
  onClick: () => void;
  onChannelClick?: () => void;
  key?: string | number;
}

function VideoCard({ video, onClick, onChannelClick }: VideoCardProps) {
  return (
    <div className="flex flex-col gap-3 group">
      <div 
        className="relative aspect-video w-full overflow-hidden md:rounded-xl cursor-pointer" 
        onClick={onClick}
      >
        <img 
          src={video.thumbnail} 
          alt={video.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
          {video.duration}
        </span>
      </div>
      <div className="flex gap-3 px-3 md:px-0">
        <img 
          src={video.channelAvatar} 
          alt={video.channelName} 
          className="w-9 h-9 rounded-full object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          referrerPolicy="no-referrer"
          onClick={(e) => {
            e.stopPropagation();
            onChannelClick?.();
          }}
        />
        <div className="flex flex-col gap-1 flex-1">
          <h3 
            className="font-bold text-base leading-tight line-clamp-2 group-hover:text-red-600 transition-colors cursor-pointer"
            onClick={onClick}
          >
            {video.title}
          </h3>
          <div className="text-sm text-gray-500 flex flex-wrap items-center gap-x-1">
            <span 
              className="hover:text-black cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onChannelClick?.();
              }}
            >
              {video.channelName}
            </span>
            <span className="hidden md:inline">•</span>
            <span>{video.views} views</span>
            <span>•</span>
            <span>{video.postedAt}</span>
          </div>
        </div>
        <MoreVertical className="w-5 h-5 text-gray-400 flex-shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
      </div>
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function NavItem({ icon, label, active = false, onClick }: NavItemProps) {
  return (
    <div 
      className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${active ? 'text-red-600' : 'text-gray-500 hover:text-black'}`}
      onClick={onClick}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function SidebarItem({ icon, label, active = false, onClick }: SidebarItemProps) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-4 px-3 py-2.5 rounded-xl transition-all w-full text-left ${
        active 
          ? 'bg-red-50 text-red-600 font-bold' 
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
}

function ActionButton({ icon, label }: ActionButtonProps) {
  return (
    <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors px-4 py-2 rounded-full whitespace-nowrap">
      {icon}
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}
