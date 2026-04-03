import React, { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_VIDEOS, Video } from './types';
import { generateVideoRecommendations } from './services/geminiService';
import LiveChat from './components/LiveChat';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'watch'>('home');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiRecommendations, setAiRecommendations] = useState<Video[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<Video[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        const filtered = MOCK_VIDEOS.filter(v => 
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
  }, [searchQuery]);

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
    setIsDescriptionExpanded(false);
    window.scrollTo(0, 0);
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedVideo(null);
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
          <Search className="md:hidden w-6 h-6 text-gray-700" />
          <Bell className="w-6 h-6 text-gray-700" />
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
            JD
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {currentView === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-0 md:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-8 gap-x-4"
            >
              {MOCK_VIDEOS.map((video) => (
                <VideoCard key={video.id} video={video} onClick={() => handleVideoClick(video)} />
              ))}
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
                    <div className="aspect-video bg-black w-full sticky top-14 lg:relative lg:top-0 z-40">
                      <video 
                        src={selectedVideo.videoUrl} 
                        className="w-full h-full" 
                        controls 
                        autoPlay
                        poster={selectedVideo.thumbnail}
                      />
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
                          <div className="flex items-center gap-3">
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
                          <button className="bg-black text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-800 transition-colors">
                            Subscribe
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

                    {MOCK_VIDEOS.filter(v => v.id !== selectedVideo.id).map(video => (
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

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-2 flex justify-between items-center z-50">
        <NavItem icon={<Home className="w-6 h-6" />} label="Home" active={currentView === 'home'} onClick={handleBackToHome} />
        <NavItem icon={<PlaySquare className="w-6 h-6" />} label="Shorts" />
        <NavItem icon={<PlusSquare className="w-6 h-6" />} label="Create" />
        <NavItem icon={<Library className="w-6 h-6" />} label="Library" />
        <NavItem icon={<User className="w-6 h-6" />} label="You" />
      </nav>
    </div>
  );
}

interface VideoCardProps {
  video: Video;
  onClick: () => void;
  key?: string | number;
}

function VideoCard({ video, onClick }: VideoCardProps) {
  return (
    <div className="flex flex-col gap-3 cursor-pointer group" onClick={onClick}>
      <div className="relative aspect-video w-full overflow-hidden md:rounded-xl">
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
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
          referrerPolicy="no-referrer"
        />
        <div className="flex flex-col gap-1">
          <h3 className="font-bold text-base leading-tight line-clamp-2 group-hover:text-red-600 transition-colors">
            {video.title}
          </h3>
          <div className="text-sm text-gray-500 flex flex-wrap items-center gap-x-1">
            <span>{video.channelName}</span>
            <span className="hidden md:inline">•</span>
            <span>{video.views} views</span>
            <span>•</span>
            <span>{video.postedAt}</span>
          </div>
        </div>
        <MoreVertical className="w-5 h-5 text-gray-400 flex-shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
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
      className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${active ? 'text-black' : 'text-gray-500'}`}
      onClick={onClick}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </div>
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
