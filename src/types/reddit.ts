/**
 * Reddit API Types
 * Based on official documentation: https://github.com/reddit-archive/reddit/wiki/JSON
 */

// Base "thing" class - all Reddit objects inherit from this
export interface RedditThing<T = any> {
  id: string; // e.g., "8xwlg"
  name: string; // Fullname of the thing (e.g., "t3_8xwlg")
  kind: RedditKind;
  data: T;
}

// Kind identifiers
export type RedditKind =
  | "Listing" // Listing wrapper
  | "more" // Load more comments indicator
  | "t1" // Comment
  | "t2" // Account
  | "t3" // Link (post)
  | "t4" // Message
  | "t5" // Subreddit
  | "t6"; // Award

// Listing - container for paginated content
export interface RedditListing<T = any> {
  kind: "Listing";
  data: {
    before: string | null; // Fullname of previous page
    after: string | null; // Fullname of next page
    modhash: string; // Authentication hash
    children: RedditThing<T>[]; // Array of things
    dist?: number; // Number of children (optional)
  };
}

// Votable mixin
export interface Votable {
  ups: number; // Upvote count
  downs: number; // Downvote count
  likes: boolean | null; // User's vote: true = upvoted, false = downvoted, null = not voted
  score: number; // Net score (ups - downs)
}

// Created mixin
export interface Created {
  created: number; // Unix timestamp in local time
  created_utc: number; // Unix timestamp in UTC
}

// Comment (t1) - implements Votable & Created
export interface RedditComment extends Votable, Created {
  id?: string; // Item identifier (also in parent Thing)
  name?: string; // Fullname (also in parent Thing)
  author: string; // Username of commenter
  author_flair_text: string | null;
  body: string; // Raw markdown text
  body_html: string; // HTML-rendered text
  subreddit: string;
  subreddit_id: string;
  parent_id: string; // Fullname of parent (t1_xxx or t3_xxx)
  link_id: string; // Fullname of the link (t3_xxx)
  link_title?: string;
  link_author?: string;
  replies: RedditListing<RedditComment> | ""; // Nested comments or empty string
  edited: number | false; // Unix timestamp if edited, false otherwise
  gilded: number; // Number of times gilded
  distinguished: "moderator" | "admin" | "special" | null;
  stickied: boolean;
  depth: number; // Nesting level
  controversiality: number;
  permalink: string;
  archived: boolean;
  is_submitter: boolean; // Is this comment by the post author?
  score_hidden: boolean;
  collapsed: boolean;
  collapsed_reason: string | null;
}

// Link/Post (t3) - implements Votable & Created
export interface RedditLink extends Votable, Created {
  id?: string; // Item identifier (also in parent Thing)
  name?: string; // Fullname (also in parent Thing)
  author: string;
  title: string;
  url: string;
  domain: string; // Domain of the link (e.g., "self.AskReddit", "imgur.com")
  selftext: string; // Raw markdown for self posts
  selftext_html: string | null; // HTML-rendered selftext
  thumbnail: string; // URL to thumbnail image
  subreddit: string;
  subreddit_id: string;
  permalink: string;
  num_comments: number;

  // Post type
  is_self: boolean; // Is this a self/text post?
  is_video: boolean;

  // Media
  media: RedditMedia | null;
  media_embed: RedditMediaEmbed | null;
  preview?: RedditPreview;

  // Status flags
  over_18: boolean; // NSFW flag
  spoiler: boolean;
  locked: boolean;
  stickied: boolean;
  pinned: boolean;
  archived: boolean;
  removed_by_category: string | null;
  hidden: boolean;
  quarantine: boolean;

  // Engagement
  gilded: number;
  awards?: RedditAward[];
  all_awardings?: RedditAward[];
  total_awards_received: number;
  num_crossposts: number;

  // Flair
  link_flair_text: string | null;
  link_flair_css_class: string | null;
  link_flair_background_color: string;
  author_flair_text: string | null;

  // Metadata
  distinguished: "moderator" | "admin" | null;
  edited: number | false;
  post_hint?: "image" | "link" | "self" | "video" | "hosted:video" | "rich:video";
  suggested_sort: string | null;
  view_count: number | null;
  visited: boolean;

  // Mod-related
  approved_by: string | null;
  banned_by: string | null;
  mod_note: string | null;
  num_reports: number | null;
  report_reasons: string[] | null;
}

// Subreddit (t5)
export interface RedditSubreddit extends Created {
  display_name: string; // Subreddit name without r/ prefix
  display_name_prefixed: string; // With r/ prefix
  title: string;
  description: string; // Sidebar description (markdown)
  description_html: string; // HTML-rendered description
  public_description: string; // Short description

  // Stats
  subscribers: number;
  accounts_active: number; // Currently active users

  // Settings
  over18: boolean; // NSFW subreddit
  subreddit_type: "public" | "private" | "restricted" | "gold_restricted" | "archived" | "employees_only";
  submission_type: "any" | "link" | "self";

  // Appearance
  header_img: string | null;
  header_size: [number, number] | null;
  icon_img: string;
  icon_size: [number, number] | null;
  banner_img: string;
  banner_background_color: string;
  primary_color: string;
  key_color: string;

  // Configuration
  allow_images: boolean;
  allow_videos: boolean;
  allow_videogifs: boolean;
  allow_polls: boolean;
  allow_predictions: boolean;
  collapse_deleted_comments: boolean;
  public_traffic: boolean;
  wiki_enabled: boolean;

  // URLs
  url: string; // e.g., "/r/programming/"

  // Relationships
  user_is_subscriber: boolean;
  user_is_moderator: boolean;
  user_is_contributor: boolean;
  user_is_banned: boolean;
}

// Account (t2) - implements Created
export interface RedditAccount extends Created {
  name: string; // Username
  id: string;

  // Karma
  link_karma: number;
  comment_karma: number;
  awardee_karma: number;
  awarder_karma: number;
  total_karma: number;

  // Status
  is_gold: boolean;
  is_mod: boolean;
  is_employee: boolean;
  has_verified_email: boolean;
  verified: boolean;
  is_suspended: boolean;

  // Settings
  hide_from_robots: boolean;
  accept_followers: boolean;

  // Avatar
  icon_img: string;
  snoovatar_img: string;

  // Inbox
  inbox_count: number;
  has_mail: boolean;
  has_mod_mail: boolean;
}

// Message (t4) - implements Created
export interface RedditMessage extends Created {
  author: string;
  dest: string; // Recipient username
  body: string;
  body_html: string;
  subject: string;
  context: string; // Context URL if this is a comment reply
  first_message: string | null; // ID of first message in thread
  first_message_name: string | null;
  parent_id: string | null;
  subreddit: string | null;
  was_comment: boolean; // Is this a reply to a comment?
  new: boolean; // Unread status
  distinguished: "moderator" | "admin" | null;
  num_comments: number | null;
}

// More (load more comments indicator)
export interface RedditMore {
  children: string[]; // IDs of comments to load
  count: number; // Number of children
  depth: number;
  parent_id: string;
  id: string;
  name: string;
}

// Media types
export interface RedditMedia {
  type: string; // e.g., "youtube.com", "gfycat.com"
  oembed?: {
    provider_url: string;
    version: string;
    title: string;
    type: "video" | "rich";
    thumbnail_url: string;
    thumbnail_width: number;
    thumbnail_height: number;
    html: string;
    width: number;
    height: number;
    author_name: string;
    author_url: string;
    provider_name: string;
  };
  reddit_video?: {
    fallback_url: string;
    height: number;
    width: number;
    scrubber_media_url: string;
    dash_url: string;
    duration: number;
    hls_url: string;
    is_gif: boolean;
    transcoding_status: "completed" | "processing" | "error";
  };
}

export interface RedditMediaEmbed {
  content: string; // HTML embed code
  width: number;
  height: number;
  scrolling: boolean;
  media_domain_url: string;
}

export interface RedditPreview {
  images: Array<{
    source: RedditImageSource;
    resolutions: RedditImageSource[];
    variants: {
      gif?: { source: RedditImageSource; resolutions: RedditImageSource[] };
      mp4?: { source: RedditImageSource; resolutions: RedditImageSource[] };
      nsfw?: { source: RedditImageSource; resolutions: RedditImageSource[] };
      obfuscated?: { source: RedditImageSource; resolutions: RedditImageSource[] };
    };
    id: string;
  }>;
  enabled: boolean;
  reddit_video_preview?: {
    fallback_url: string;
    height: number;
    width: number;
    scrubber_media_url: string;
    dash_url: string;
    duration: number;
    hls_url: string;
    is_gif: boolean;
    transcoding_status: string;
  };
}

export interface RedditImageSource {
  url: string;
  width: number;
  height: number;
}

export interface RedditAward {
  award_type: string;
  coin_price: number;
  coin_reward: number;
  count: number;
  days_of_drip_extension: number;
  days_of_premium: number;
  description: string;
  icon_url: string;
  id: string;
  is_enabled: boolean;
  name: string;
  resized_icons: RedditImageSource[];
  subreddit_coin_reward: number;
}

// OAuth2 Token Response
export interface RedditOAuth2Token {
  access_token: string;
  token_type: "bearer";
  expires_in: number; // Seconds until expiration
  scope: string; // Space-separated scopes
  refresh_token?: string; // Only for code grant
}

// API Error Response
export interface RedditError {
  message: string;
  error: number | string;
}

// Search response types
export type RedditSearchResult = RedditListing<RedditLink>;
export type RedditCommentListing = RedditListing<RedditComment>;

// Helper type for API responses
export type RedditAPIResponse<T> = RedditListing<T> | RedditError;
