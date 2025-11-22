/**
 * Mock Reddit API Responses
 * Based on official Reddit API JSON structure
 */

import type {
  RedditOAuth2Token,
  RedditListing,
  RedditLink,
  RedditComment,
  RedditThing,
} from "../types/reddit.js";

// OAuth2 Token Response
export const mockRedditAuthResponse: RedditOAuth2Token = {
  access_token: "mock_access_token_1234567890abcdef",
  token_type: "bearer",
  expires_in: 3600,
  scope: "*",
};

// Empty Listing (no results)
export const mockEmptyListing: RedditListing = {
  kind: "Listing",
  data: {
    before: null,
    after: null,
    modhash: "",
    children: [],
    dist: 0,
  },
};

// Link (Post) Data - t3
export const mockRedditLinkData: RedditLink = {
  // Thing properties
  id: "abc123",
  name: "t3_abc123",

  // Votable
  ups: 150,
  downs: 10,
  likes: null,
  score: 140,

  // Created
  created: 1700000000,
  created_utc: 1700000000,

  // Link-specific
  author: "testuser",
  title: "Looking for a better JSON formatter - current tools are terrible",
  url: "https://www.reddit.com/r/webdev/comments/abc123/looking_for_better_json_formatter/",
  domain: "self.webdev",
  selftext:
    "I've been searching for a good JSON formatter but all the ones I find are either slow, have ads everywhere, or don't handle large files. Wish there was a simple, fast, ad-free option. Any recommendations?",
  selftext_html:
    "&lt;div class=\"md\"&gt;&lt;p&gt;I&amp;#39;ve been searching for a good JSON formatter...&lt;/p&gt;\n&lt;/div&gt;",
  thumbnail: "self",
  subreddit: "webdev",
  subreddit_id: "t5_2qs0q",
  permalink: "/r/webdev/comments/abc123/looking_for_better_json_formatter/",
  num_comments: 47,

  // Post type
  is_self: true,
  is_video: false,

  // Media
  media: null,
  media_embed: null,

  // Status flags
  over_18: false,
  spoiler: false,
  locked: false,
  stickied: false,
  pinned: false,
  archived: false,
  removed_by_category: null,
  hidden: false,
  quarantine: false,

  // Engagement
  gilded: 1,
  total_awards_received: 1,
  num_crossposts: 2,

  // Flair
  link_flair_text: "Discussion",
  link_flair_css_class: "discussion",
  link_flair_background_color: "#0079d3",
  author_flair_text: "Senior Dev",

  // Metadata
  distinguished: null,
  edited: false,
  post_hint: "self",
  suggested_sort: "top",
  view_count: 1250,
  visited: false,

  // Mod-related
  approved_by: null,
  banned_by: null,
  mod_note: null,
  num_reports: null,
  report_reasons: null,
};

// Comment Data - t1
export const mockRedditCommentData: RedditComment = {
  // Thing properties
  id: "comment1",
  name: "t1_comment1",

  // Votable
  ups: 45,
  downs: 2,
  likes: null,
  score: 43,

  // Created
  created: 1700001000,
  created_utc: 1700001000,

  // Comment-specific
  author: "helpful_dev",
  author_flair_text: "Contributor",
  body: "I totally understand your frustration! I need a tool that can handle massive JSON files without freezing. Have you tried X? It's decent but still has issues with files over 10MB.",
  body_html:
    "&lt;div class=\"md\"&gt;&lt;p&gt;I totally understand your frustration!...&lt;/p&gt;\n&lt;/div&gt;",
  subreddit: "webdev",
  subreddit_id: "t5_2qs0q",
  parent_id: "t3_abc123",
  link_id: "t3_abc123",
  link_title: "Looking for a better JSON formatter - current tools are terrible",
  link_author: "testuser",
  replies: "", // Empty string when no nested comments
  edited: false,
  gilded: 0,
  distinguished: null,
  stickied: false,
  depth: 0,
  controversiality: 0,
  permalink:
    "/r/webdev/comments/abc123/looking_for_better_json_formatter/def456",
  archived: false,
  is_submitter: false,
  score_hidden: false,
  collapsed: false,
  collapsed_reason: null,
};

// Search Results with Multiple Posts
export const mockRedditSearchResponse: RedditListing<RedditLink> = {
  kind: "Listing",
  data: {
    before: null,
    after: "t3_xyz789",
    modhash: "modhash123",
    children: [
      {
        kind: "t3",
        id: "abc123",
        name: "t3_abc123",
        data: mockRedditLinkData,
      },
      {
        kind: "t3",
        id: "def456",
        name: "t3_def456",
        data: {
          ...mockRedditLinkData,
          id: "def456",
          title: "I wish there was an AI-powered code formatter",
          selftext: "Looking for a tool that can automatically format my messy code...",
          score: 89,
          ups: 95,
          downs: 6,
          num_comments: 23,
          created_utc: 1700010000,
          permalink: "/r/programming/comments/def456/wish_there_was_ai_formatter/",
          subreddit: "programming",
        },
      },
      {
        kind: "t3",
        id: "ghi789",
        name: "t3_ghi789",
        data: {
          ...mockRedditLinkData,
          id: "ghi789",
          title: "CSV converter tools all suck - need better alternative",
          selftext:
            "Every CSV to JSON converter I've tried either has a 100KB limit or requires payment. This is ridiculous for such a simple task.",
          score: 234,
          ups: 250,
          downs: 16,
          num_comments: 78,
          created_utc: 1700020000,
          permalink: "/r/webdev/comments/ghi789/csv_converter_tools_suck/",
          subreddit: "webdev",
          link_flair_text: "Rant",
        },
      },
    ],
    dist: 3,
  },
};

// Comment Thread (with nested replies)
export const mockRedditCommentsResponse: Array<RedditListing> = [
  // First element: Post listing
  {
    kind: "Listing",
    data: {
      before: null,
      after: null,
      modhash: "",
      children: [
        {
          kind: "t3",
          id: "abc123",
          name: "t3_abc123",
          data: mockRedditLinkData,
        },
      ],
    },
  },
  // Second element: Comments listing
  {
    kind: "Listing",
    data: {
      before: null,
      after: null,
      modhash: "",
      children: [
        {
          kind: "t1",
          id: "comment1",
          name: "t1_comment1",
          data: mockRedditCommentData,
        },
        {
          kind: "t1",
          id: "comment2",
          name: "t1_comment2",
          data: {
            ...mockRedditCommentData,
            id: "comment2",
            body: "Same issue here! The performance of online JSON validators is awful.",
            score: 28,
            created_utc: 1700002000,
            permalink:
              "/r/webdev/comments/abc123/looking_for_better_json_formatter/comment2",
          },
        },
        {
          kind: "t1",
          id: "comment3",
          name: "t1_comment3",
          data: {
            ...mockRedditCommentData,
            id: "comment3",
            body: "I need a tool for this exact problem. +1",
            score: 15,
            created_utc: 1700003000,
            parent_id: "t1_comment1", // Reply to comment1
            depth: 1,
            permalink:
              "/r/webdev/comments/abc123/looking_for_better_json_formatter/comment3",
          },
        },
      ],
    },
  },
];

// Frustration Signal Posts
export const mockFrustrationPosts: RedditThing<RedditLink>[] = [
  {
    kind: "t3",
    id: "frust1",
    name: "t3_frust1",
    data: {
      ...mockRedditLinkData,
      id: "frust1",
      title: "Wish there was a better way to compress images online",
      selftext:
        "All the image compressors I've tried either reduce quality too much or are super slow. Need something that just works.",
      score: 156,
      num_comments: 34,
      subreddit: "webdesign",
      permalink: "/r/webdesign/comments/frust1/wish_better_image_compressor/",
    },
  },
  {
    kind: "t3",
    id: "frust2",
    name: "t3_frust2",
    data: {
      ...mockRedditLinkData,
      id: "frust2",
      title: "Looking for a decent PDF merger - all current options are trash",
      selftext: "Why is it so hard to find a simple, free PDF merger without ads?",
      score: 203,
      num_comments: 56,
      subreddit: "productivity",
      permalink: "/r/productivity/comments/frust2/looking_for_pdf_merger/",
    },
  },
];

// Error Response
export const mockRedditErrorResponse = {
  message: "Forbidden",
  error: 403,
};

// Rate Limit Response
export const mockRateLimitResponse = {
  message: "You are doing that too much. Try again in 5 minutes.",
  error: 429,
};

// Type validation helpers for tests
export function isRedditListing(obj: any): obj is RedditListing {
  return (
    obj &&
    obj.kind === "Listing" &&
    obj.data &&
    Array.isArray(obj.data.children)
  );
}

export function isRedditLink(obj: any): obj is RedditThing<RedditLink> {
  return obj && obj.kind === "t3" && obj.data && typeof obj.data.title === "string";
}

export function isRedditComment(obj: any): obj is RedditThing<RedditComment> {
  return obj && obj.kind === "t1" && obj.data && typeof obj.data.body === "string";
}
