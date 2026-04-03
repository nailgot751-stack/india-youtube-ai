export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  videoUrl: string;
  channelName: string;
  channelAvatar: string;
  subscribers: string;
  views: string;
  postedAt: string;
  duration: string;
  description: string;
  likes: string;
}

export const MOCK_VIDEOS: Video[] = [
  {
    id: "1",
    title: "How To Start A YouTube Channel In 2026 | FULL COURSE",
    thumbnail: "https://picsum.photos/seed/tube1/800/450",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    channelName: "Tube Sensei",
    channelAvatar: "https://picsum.photos/seed/avatar1/100/100",
    subscribers: "8.6 Lakh",
    views: "68 Lakh",
    postedAt: "1 year ago",
    duration: "15:40",
    description: "In this full course, I will show you exactly how to start and grow a successful YouTube channel in 2026. We cover everything from niche selection to advanced SEO.",
    likes: "287.7K",
  },
  {
    id: "2",
    title: "Iran America War Update: Arab Countries' Stance",
    thumbnail: "https://picsum.photos/seed/news1/800/450",
    videoUrl: "https://www.w3schools.com/html/movie.mp4",
    channelName: "News18 UP Uttarakhand",
    channelAvatar: "https://picsum.photos/seed/avatar2/100/100",
    subscribers: "1.2M",
    views: "93K",
    postedAt: "1 hour ago",
    duration: "12:15",
    description: "Latest updates on the geopolitical situation in the Middle East and the shifting world order.",
    likes: "12K",
  },
  {
    id: "3",
    title: "Cuban Vibes: Music, Culture & Energy",
    thumbnail: "https://picsum.photos/seed/music1/800/450",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    channelName: "Vibe Central",
    channelAvatar: "https://picsum.photos/seed/avatar3/100/100",
    subscribers: "450K",
    views: "1.2M",
    postedAt: "2 days ago",
    duration: "08:30",
    description: "Experience the vibrant energy of Cuba through its music and street culture.",
    likes: "89K",
  },
  {
    id: "4",
    title: "The Future of AI in Web Development",
    thumbnail: "https://picsum.photos/seed/tech1/800/450",
    videoUrl: "https://www.w3schools.com/html/movie.mp4",
    channelName: "Tech Insider",
    channelAvatar: "https://picsum.photos/seed/avatar4/100/100",
    subscribers: "2.5M",
    views: "500K",
    postedAt: "5 hours ago",
    duration: "20:10",
    description: "How AI agents are changing the way we build applications in 2026.",
    likes: "45K",
  },
  {
    id: "5",
    title: "Top 10 Travel Destinations for 2026",
    thumbnail: "https://picsum.photos/seed/travel1/800/450",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    channelName: "Wanderlust",
    channelAvatar: "https://picsum.photos/seed/avatar5/100/100",
    subscribers: "890K",
    views: "2.1M",
    postedAt: "3 weeks ago",
    duration: "14:55",
    description: "From hidden gems in Asia to the bustling cities of Europe, here are the top places to visit this year.",
    likes: "150K",
  }
];
