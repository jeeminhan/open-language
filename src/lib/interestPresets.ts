// Curated preset interests grouped by category. One-click pickable from the
// Interests page. Free-form "Add your own" still works alongside these.

export interface InterestPreset {
  name: string;
  category: string;
  hint?: string;
}

export const INTEREST_PRESETS: InterestPreset[] = [
  // TV / shows / anime / movies
  { name: "Anime", category: "anime" },
  { name: "K-dramas", category: "tv_shows" },
  { name: "J-dramas", category: "tv_shows" },
  { name: "Studio Ghibli", category: "movies" },
  { name: "Marvel / MCU", category: "movies" },
  { name: "Netflix series", category: "tv_shows" },
  { name: "Reality TV", category: "tv_shows" },

  // Music
  { name: "K-pop", category: "music" },
  { name: "J-pop", category: "music" },
  { name: "Hip-hop", category: "music" },
  { name: "Classical music", category: "music" },
  { name: "Indie / alt", category: "music" },
  { name: "Worship music", category: "music" },

  // Faith / religion
  { name: "Christianity", category: "culture", hint: "denomination, church, Bible study" },
  { name: "Buddhism", category: "culture" },
  { name: "Judaism", category: "culture" },
  { name: "Islam", category: "culture" },
  { name: "Spirituality", category: "culture" },

  // Games
  { name: "Video games", category: "games" },
  { name: "Nintendo", category: "games" },
  { name: "PlayStation", category: "games" },
  { name: "Board games", category: "games" },
  { name: "RPGs", category: "games" },

  // Sports
  { name: "Basketball", category: "sports" },
  { name: "Soccer / football", category: "sports" },
  { name: "Baseball", category: "sports" },
  { name: "Tennis", category: "sports" },
  { name: "Running", category: "sports" },
  { name: "Climbing", category: "sports" },
  { name: "Yoga", category: "sports" },

  // Food
  { name: "Cooking", category: "food" },
  { name: "Baking", category: "food" },
  { name: "Coffee", category: "food" },
  { name: "Ramen", category: "food" },
  { name: "Korean food", category: "food" },
  { name: "Japanese food", category: "food" },

  // Travel
  { name: "Japan travel", category: "travel" },
  { name: "Korea travel", category: "travel" },
  { name: "Hiking / outdoors", category: "travel" },
  { name: "Road trips", category: "travel" },

  // Tech
  { name: "Programming", category: "technology" },
  { name: "AI / ML", category: "technology" },
  { name: "Startups", category: "technology" },
  { name: "Gadgets", category: "technology" },

  // Books
  { name: "Novels / fiction", category: "books" },
  { name: "Manga", category: "books" },
  { name: "Philosophy", category: "books" },
  { name: "Self-help", category: "books" },

  // Hobbies
  { name: "Photography", category: "hobbies" },
  { name: "Drawing / art", category: "hobbies" },
  { name: "Music (playing)", category: "hobbies" },
  { name: "Gardening", category: "hobbies" },
  { name: "Journaling", category: "hobbies" },

  // Work / school
  { name: "Career", category: "work" },
  { name: "Studying abroad", category: "school" },
  { name: "Language exchange", category: "school" },
];
